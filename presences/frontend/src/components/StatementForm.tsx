import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { attachmentUrl, emptyStatementForm, isTreated, STATEMENT_ERRORS, statementError, statementFormData } from '../statements';
import { dateFr, heure, schoolYear, todayIso } from '../utils';

/**
 * Déclaration d'absence d'un enfant par son responsable (parité IHM AngularJS) : période, journée entière, motif,
 * justificatif facultatif (image ou PDF), puis historique des déclarations déjà déposées pour cet enfant.
 */
export function StatementForm({ structureId, studentId, studentName }: { structureId: string; studentId: string; studentName: string }) {
  const { t } = useTranslation(['presences', 'common']);
  const qc = useQueryClient();
  const today = todayIso();
  const [form, setForm] = useState(() => emptyStatementForm(structureId, studentId, today));
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);
  const f = { ...form, structureId, studentId };

  const slotsQuery = useQuery({ queryKey: ['pres', 'time-slots', structureId], queryFn: () => api.getTimeSlots(structureId), enabled: !!structureId });
  const slots = (slotsQuery.data ?? []).filter((s) => s.startHour && s.endHour).sort((a, b) => a.startHour.localeCompare(b.startHour));
  const firstStart = slots[0]?.startHour;
  const lastEnd = slots.length > 0 ? slots[slots.length - 1].endHour : undefined;

  const year = schoolYear();
  const historyParams = `?structure_id=${structureId}&start_at=${year.start}&end_at=${year.end}%2023:59:59&student_id=${studentId}`;
  const historyQuery = useQuery({ queryKey: ['pres', 'statements-history', structureId, studentId], queryFn: () => api.getStatementsPage(historyParams), enabled: !!structureId && !!studentId });

  const error = statementError(f, today, firstStart, lastEnd);
  const mut = useMutation({
    mutationFn: () => api.createStatement(statementFormData(f, firstStart, lastEnd)),
    onSuccess: () => {
      setForm({ ...form, description: '', file: null });
      setSubmitted(false);
      setDone(true);
      qc.invalidateQueries({ queryKey: ['pres', 'statements-history'] });
    },
  });
  const set = (patch: Partial<typeof form>) => { setDone(false); setForm({ ...form, ...patch }); };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); setSubmitted(true); if (!error) mut.mutate(); };

  return (
    <section className="mt-24" data-statement-form-section>
      <h2 style={{ fontSize: 20 }} className="mb-12">{t('presences.statements.absence.form', { defaultValue: "Déclarer l'absence de [[name]]", name: studentName })}</h2>
      <form className="border rounded p-16 mb-24" onSubmit={onSubmit} data-statement-form>
        <div className="d-flex gap-12 flex-wrap align-items-end mb-12">
          <div>
            <label htmlFor="stf-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
            <input id="stf-start" type="date" min={today} className="form-control" value={form.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })} />
          </div>
          <div>
            <label htmlFor="stf-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
            <input id="stf-end" type="date" min={form.startDate} className="form-control" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          </div>
          <label className="mb-8">
            <input type="checkbox" data-full-day checked={form.fullDay} onChange={(e) => set({ fullDay: e.target.checked })} /> {t('presences.day.complete', { defaultValue: 'Journée entière' })}
          </label>
          <div>
            <label htmlFor="stf-start-time" className="form-label">{t('presences.as.of', { defaultValue: 'À partir de' })}</label>
            <input id="stf-start-time" type="time" className="form-control" disabled={form.fullDay} value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
          </div>
          <div>
            <label htmlFor="stf-end-time" className="form-label">{t('presences.until', { defaultValue: "Jusqu'à" })}</label>
            <input id="stf-end-time" type="time" className="form-control" disabled={form.fullDay} value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
          </div>
        </div>
        <div className="mb-12">
          <label htmlFor="stf-description" className="form-label">{t('presences.absence.reason.this', { defaultValue: "Motif de l'absence" })}</label>
          <input id="stf-description" className="form-control" value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
        <div className="mb-12">
          <label htmlFor="stf-file" className="form-label">{t('presences.add.supporting.document', { defaultValue: 'Ajouter un justificatif (image ou PDF)' })}</label>
          <input id="stf-file" type="file" accept="image/*,.pdf" className="form-control" onChange={(e) => set({ file: e.target.files?.[0] ?? null })} />
        </div>
        {submitted && error && <div className="alert alert-warning" role="alert" data-form-error>{t(`presences.statement.error.${error}`, { defaultValue: STATEMENT_ERRORS[error] })}</div>}
        {mut.isError && <div className="alert alert-warning" role="alert" data-create-error>{t('presences.statement.form.create.error', { defaultValue: "La déclaration n'a pas pu être enregistrée." })}</div>}
        {done && <div className="alert alert-success" role="status" data-created>{t('presences.statement.form.create.success', { defaultValue: 'Déclaration enregistrée.' })}</div>}
        <button type="submit" className="btn btn-primary" data-send disabled={mut.isPending}>{t('presences.exemptions.form.submit', { defaultValue: 'Valider' })}</button>
      </form>

      <h3 style={{ fontSize: 18 }} className="mb-12">{t('presences.statements.absence.form.history', { defaultValue: 'Historique des déclarations' })}</h3>
      {historyQuery.isError && <div className="alert alert-warning" role="alert">{t('presences.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {historyQuery.data && historyQuery.data.all.length === 0 && <p className="text-muted" data-history-empty>{t('presences.presences.empty.state', { defaultValue: 'Aucune déclaration.' })}</p>}
      <ul className="list-unstyled" data-history>
        {(historyQuery.data?.all ?? []).map((s) => (
          <li key={s.id} className="border-bottom py-8" data-history-item={s.id}>
            <strong>{dateFr(s.start_at)} {heure(s.start_at)} → {dateFr(s.end_at)} {heure(s.end_at)}</strong>
            {isTreated(s) && <span className="badge bg-success ms-8">{t('presences.statements.treated', { defaultValue: 'Traitée' })}</span>}
            <div>{s.description || '—'}</div>
            {s.attachment_id && <a href={attachmentUrl(s)} target="_blank" rel="noreferrer">{t('presences.statements.attachment', { defaultValue: 'Justificatif' })}</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default StatementForm;
