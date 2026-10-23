import { useEdificeClient } from '@open-ent/react';
import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { api } from '../api';
import { AudienceSearch, PickedAudience } from '../components/AudienceSearch';
import { Pager } from '../components/Pager';
import { QueryErrors } from '../components/QueryErrors';
import { PickedStudent, StudentSearch } from '../components/StudentSearch';
import {
  DAYS, dateRange, daysSummary, defaultSubject, emptyExemptionForm, ExemptionFilters, ExemptionForm, exemptionError, exemptionKey, exemptionParams, formFromExemption,
  isRecursive, nextSort, RawExemption,
} from '../exemptions';
import { useRights } from '../rights';
import { useStructure } from '../structure';
import { jour } from '../utils';

const ERRORS: Record<string, string> = {
  students: 'Choisissez au moins un élève.',
  dates: 'La date de fin ne peut pas précéder la date de début.',
  subject: 'Choisissez une matière.',
  days: 'Choisissez au moins un jour de la semaine.',
  slots: 'Choisissez le créneau de début et le créneau de fin.',
};

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return jour(d); };

/**
 * Dispenses (parité IHM AngularJS) : liste filtrée (période, élèves, classes) et triable, création pour plusieurs élèves
 * d'une dispense ponctuelle (matière) ou récurrente (jours, créneaux, une semaine sur deux), modification, suppression
 * et export CSV.
 */
export function Dispenses() {
  const { t } = useTranslation(['presences', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const rights = useRights();

  const [start, setStart] = useState(daysAgo(30));
  const [end, setEnd] = useState(jour(new Date()));
  const [students, setStudents] = useState<PickedStudent[]>([]);
  const [classes, setClasses] = useState<PickedAudience[]>([]);
  const [sort, setSort] = useState<Pick<ExemptionFilters, 'order' | 'reverse'>>({ order: 'date', reverse: false });
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<ExemptionForm | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  const filters: ExemptionFilters = { structureId, start, end, studentIds: students.map((s) => s.id), audienceIds: classes.map((c) => c.id), ...sort };
  const exportParams = exemptionParams(filters);
  const listParams = exemptionParams(filters, page);
  const listQuery = useQuery({ queryKey: ['pres', 'exemptions', structureId, listParams], queryFn: () => api.getExemptionsPage(listParams, page), enabled: !!structureId });
  const subjectsQuery = useQuery({ queryKey: ['pres', 'subjects', structureId], queryFn: () => api.getSubjects(structureId), enabled: !!structureId });
  const slotsQuery = useQuery({ queryKey: ['pres', 'time-slots', structureId], queryFn: () => api.getTimeSlots(structureId), enabled: !!structureId });
  const subjects = subjectsQuery.data ?? [];
  const slots = (slotsQuery.data ?? []).filter((s) => s.startHour && s.endHour).sort((a, b) => a.startHour.localeCompare(b.startHour));
  const rows = listQuery.data?.values ?? [];
  const pageCount = listQuery.data?.pageCount ?? 1;
  const canManage = rights.manageExemption;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pres', 'exemptions', structureId] });
  const saveMut = useMutation({
    mutationFn: () => api.saveExemption(form!),
    onSuccess: () => { setMessage(form!.editing ? t('presences.exemptions.form.edit.succeed', { defaultValue: 'Dispense modifiée.' }) : t('presences.exemptions.form.create.succeed', { defaultValue: 'Dispense créée.' })); setForm(null); setSubmitted(false); invalidate(); },
  });
  const deleteMut = useMutation({
    mutationFn: (e: RawExemption) => api.deleteExemption(e),
    onSuccess: () => { setMessage(t('presences.exemptions.delete.succeed', { defaultValue: 'Dispense supprimée.' })); setForm(null); invalidate(); },
  });

  // Arrivée depuis le calendrier d'un élève (`#/dispenses?student=id~nom&start=&end=`) : formulaire ouvert et prérempli.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedStudent = searchParams.get('student');
  useEffect(() => {
    if (!linkedStudent || !structureId || !canManage || subjects.length === 0) return;
    const [id, ...rest] = linkedStudent.split('~');
    const start = searchParams.get('start') ?? jour(new Date());
    const base = emptyExemptionForm(structureId, start, defaultSubject(subjects));
    setForm({ ...base, students: [{ id, name: rest.length > 0 ? decodeURIComponent(rest.join('~')) : id }], endDate: searchParams.get('end') ?? base.endDate });
    setSubmitted(false);
    setMessage('');
    setSearchParams({}, { replace: true });
  }, [linkedStudent, structureId, canManage, subjects.length]);

  const patch = (p: Partial<ExemptionForm>) => setForm((f) => (f ? { ...f, ...p } : f));
  // Les élèves du filtre sont repris dans le formulaire de création (ils restent modifiables).
  const openCreate = () => { setForm({ ...emptyExemptionForm(structureId, jour(new Date()), defaultSubject(subjects)), students: students.map((s) => ({ id: s.id, name: s.name })) }); setSubmitted(false); setMessage(''); };
  const openEdit = (e: RawExemption) => { if (canManage) { setForm(formFromExemption(e, structureId, slots)); setSubmitted(false); setMessage(''); } };
  const err = form ? exemptionError(form) : null;
  const onSubmit = (e: FormEvent) => { e.preventDefault(); setSubmitted(true); if (!err) saveMut.mutate(); };
  const editedRow = form?.editing ? rows.find((r) => (form.editing!.exemptionId ? r.exemption_id === form.editing!.exemptionId : (r.exemption_recursive_id ?? r.recursive_id) === form.editing!.recursiveId)) : undefined;
  const toggleDay = (d: string) => form && patch({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] });
  const sortBy = (field: 'date' | 'attendance') => { setSort(nextSort(sort, field)); setPage(0); };
  const arrow = (field: 'date' | 'attendance') => (sort.order === field ? (sort.reverse ? ' ▲' : ' ▼') : '');
  const tooMany = pageCount > 50;

  if (init && !structureId) {
    return <div className="alert alert-info" role="alert">{t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>;
  }

  return (
    <div>
      <h1 className="mb-16">{t('presences.exemptions.title', { defaultValue: 'Dispenses' })}</h1>
      <QueryErrors queries={[listQuery, subjectsQuery]} />

      <div className="d-flex gap-24 flex-wrap align-items-end mb-12">
        <div style={{ minWidth: 260 }}>
          <StudentSearch
            id="ex-filter-student" label={t('presences.exemptions.search.student', { defaultValue: 'Rechercher un élève' })} structureId={structureId} selected={students}
            pickAttr="data-filter-student" chipsAttr="data-filter-students" resultsAttr="data-filter-results"
            onAdd={(s) => { setStudents([...students, s]); setPage(0); }} onRemove={(s) => { setStudents(students.filter((x) => x.id !== s.id)); setPage(0); }}
          />
        </div>
        <div style={{ minWidth: 260 }} data-class-filter>
          <AudienceSearch id="ex-filter-class" label={t('presences.exemptions.search.audience', { defaultValue: 'Rechercher une classe' })} structureId={structureId} selected={classes} onChange={(n) => { setClasses(n); setPage(0); }} />
        </div>
        <div>
          <label htmlFor="ex-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="ex-start" type="date" className="form-control" value={start} onChange={(e) => { setStart(e.target.value); setPage(0); }} />
        </div>
        <div>
          <label htmlFor="ex-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="ex-end" type="date" className="form-control" value={end} onChange={(e) => { setEnd(e.target.value); setPage(0); }} />
        </div>
        <span className="ms-auto d-flex gap-8">
          <a className={`btn btn-outline-primary${rows.length === 0 || tooMany ? ' disabled' : ''}`} data-export aria-disabled={rows.length === 0 || tooMany} href={rows.length === 0 || tooMany ? undefined : `/presences/exemptions/export${exportParams}`}>
            {t('presences.export.tocsv', { defaultValue: 'Exporter (CSV)' })}
          </a>
          {canManage && <button type="button" className="btn btn-primary" data-new-exemption onClick={openCreate}>{t('presences.exemptions.create', { defaultValue: 'Nouvelle dispense' })}</button>}
        </span>
      </div>
      {tooMany && <p className="text-muted" data-too-many>{t('presences.exemptions.csv.toMuchExemptions', { defaultValue: "Trop de dispenses pour l'export : réduisez la période." })}</p>}
      {message && <div className="alert alert-success" role="status" data-notice>{message}</div>}

      {form && (
        <form className="border rounded p-16 mb-24" data-exemption-form onSubmit={onSubmit}>
          <h2 style={{ fontSize: 18 }} className="mb-12">{form.editing ? t('presences.exemptions.edit', { defaultValue: 'Modifier la dispense' }) : t('presences.exemptions.create', { defaultValue: 'Nouvelle dispense' })}</h2>
          <div className="mb-12" style={{ maxWidth: 520 }}>
            {form.editing ? (
              <p data-fixed-student><strong>{form.students[0]?.name}</strong></p>
            ) : (
              <StudentSearch
                id="ex-student" label={t('presences.student', { defaultValue: 'Élèves' })} structureId={structureId} selected={form.students}
                onAdd={(s) => patch({ students: form.students.some((x) => x.id === s.id) ? form.students : [...form.students, s] })}
                onRemove={(s) => patch({ students: form.students.filter((x) => x.id !== s.id) })}
              />
            )}
          </div>
          <div className="mb-12">
            <label htmlFor="ex-mode" className="form-label">{t('presences.exemptions.type', { defaultValue: 'Type de dispense' })}</label>
            <select id="ex-mode" className="form-control" style={{ maxWidth: 260 }} value={form.mode} disabled={!!form.editing} onChange={(e) => patch({ mode: e.target.value as ExemptionForm['mode'], startHour: '', endHour: '' })}>
              <option value="punctual">{t('presences.exemptions.punctual', { defaultValue: 'Ponctuelle' })}</option>
              <option value="recursive">{t('presences.exemptions.recursive', { defaultValue: 'Récurrente' })}</option>
            </select>
          </div>
          <div className="d-flex gap-12 flex-wrap mb-12">
            <div>
              <label htmlFor="ex-form-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
              <input id="ex-form-start" type="date" className="form-control" value={form.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ex-form-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
              <input id="ex-form-end" type="date" className="form-control" value={form.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
            </div>
            {form.mode === 'punctual' && (
              <div>
                <label htmlFor="ex-subject" className="form-label">{t('presences.exemptions.subject', { defaultValue: 'Matière' })}</label>
                <select id="ex-subject" className="form-control" value={form.subjectId} onChange={(e) => patch({ subjectId: e.target.value })}>
                  <option value="">—</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {form.mode === 'recursive' && (
            <div className="mb-12" data-recursive>
              <div className="form-label">{t('presences.day', { defaultValue: 'Jours' })}</div>
              <div className="d-flex gap-8 flex-wrap mb-8" data-days>
                {DAYS.map((d) => (
                  <button key={d.value} type="button" data-day={d.value} aria-pressed={form.days.includes(d.value)} className={`btn btn-sm ${form.days.includes(d.value) ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => toggleDay(d.value)}>
                    {d.label.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="d-flex gap-12 flex-wrap align-items-end">
                <div>
                  <label htmlFor="ex-slot-start" className="form-label">{t('presences.slot.from', { defaultValue: 'Du créneau' })}</label>
                  <select id="ex-slot-start" className="form-control" value={form.startHour} onChange={(e) => patch({ startHour: e.target.value })}>
                    <option value="">{t('presences.pick.timeslot', { defaultValue: 'Choisir un créneau' })}</option>
                    {slots.map((s) => <option key={s.id} value={s.startHour.slice(0, 5)}>{s.name} : {s.startHour.slice(0, 5)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ex-slot-end" className="form-label">{t('presences.slot.to', { defaultValue: 'Au créneau' })}</label>
                  <select id="ex-slot-end" className="form-control" value={form.endHour} onChange={(e) => patch({ endHour: e.target.value })}>
                    <option value="">{t('presences.pick.timeslot', { defaultValue: 'Choisir un créneau' })}</option>
                    {slots.map((s) => <option key={s.id} value={s.endHour.slice(0, 5)}>{s.name} : {s.endHour.slice(0, 5)}</option>)}
                  </select>
                </div>
                <label className="mb-8"><input type="checkbox" data-two-weeks checked={form.everyTwoWeeks} onChange={(e) => patch({ everyTwoWeeks: e.target.checked })} /> {t('presences.exemptions.every.two.weeks', { defaultValue: 'Une semaine sur deux' })}</label>
              </div>
            </div>
          )}
          <label className="d-block mb-12"><input type="checkbox" data-attendance checked={form.attendance} onChange={(e) => patch({ attendance: e.target.checked })} /> {t('presences.exemptions.form.attendance', { defaultValue: 'Présence obligatoire' })}</label>
          <div className="mb-12">
            <label htmlFor="ex-comment" className="form-label">{t('presences.exemptions.comment', { defaultValue: 'Commentaire' })}</label>
            <input id="ex-comment" className="form-control" value={form.comment} placeholder={t('presences.exemptions.form.defautValue.comment', { defaultValue: 'Précisions sur la dispense' })} onChange={(e) => patch({ comment: e.target.value })} />
          </div>
          {submitted && err && <div className="alert alert-warning" role="alert" data-form-error>{t(`presences.exemptions.error.${err}`, { defaultValue: ERRORS[err] })}</div>}
          {(saveMut.isError || deleteMut.isError) && <div className="alert alert-warning" role="alert" data-save-error>{t('presences.exemption.save.error', { defaultValue: "L'enregistrement a échoué." })}</div>}
          <div className="d-flex gap-12">
            <button type="submit" className="btn btn-primary" data-save disabled={saveMut.isPending}>{t('presences.exemptions.form.submit', { defaultValue: 'Valider' })}</button>
            <button type="button" className="btn btn-outline-secondary" data-cancel onClick={() => setForm(null)}>{t('presences.cancel', { defaultValue: 'Annuler' })}</button>
            {form.editing && editedRow && (
              <button type="button" className="btn btn-outline-danger ms-auto" data-delete disabled={deleteMut.isPending} onClick={() => { if (window.confirm(t('presences.exemptions.delete.confirm', { defaultValue: 'Supprimer cette dispense ?' }))) deleteMut.mutate(editedRow); }}>
                {t('presences.delete', { defaultValue: 'Supprimer' })}
              </button>
            )}
          </div>
        </form>
      )}

      {listQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && <p className="text-muted" data-empty>{t('presences.exemptions.empty', { defaultValue: 'Aucune dispense sur la période.' })}</p>}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-hover table-bordered mb-0" data-exemption-table>
            <thead>
              <tr>
                <th>{t('presences.exemptions.student', { defaultValue: 'Élève' })}</th>
                <th>{t('presences.exemptions.audience', { defaultValue: 'Classe' })}</th>
                <th>{t('presences.exemptions.subject', { defaultValue: 'Matière' })}</th>
                <th><button type="button" className="btn btn-link p-0" data-sort="date" onClick={() => sortBy('date')}>{t('presences.exemptions.dates', { defaultValue: 'Dates' })}{arrow('date')}</button></th>
                <th>{t('presences.exemptions.comment', { defaultValue: 'Commentaire' })}</th>
                <th className="text-center"><button type="button" className="btn btn-link p-0" data-sort="attendance" onClick={() => sortBy('attendance')}>{t('presences.exemptions.attendance', { defaultValue: 'Présence' })}{arrow('attendance')}</button></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={exemptionKey(e)} data-exemption={exemptionKey(e)} style={{ cursor: canManage ? 'pointer' : 'default' }} onClick={() => openEdit(e)}>
                  <td>{`${e.student?.lastName ?? ''} ${e.student?.firstName ?? ''}`.trim() || '—'}</td>
                  <td>{e.student?.classeName ?? e.student?.className ?? '—'}</td>
                  <td>{isRecursive(e) ? <span className="badge bg-info" data-recursive-badge>{t('presences.exemptions.recursive', { defaultValue: 'Récurrente' })}</span> : (e.subject?.name ?? '—')}</td>
                  <td>{dateRange(e)}{isRecursive(e) && e.day_of_week?.length ? <div className="text-muted">{daysSummary(e.day_of_week)}{e.is_every_two_weeks ? ' · 1 semaine sur 2' : ''}</div> : null}</td>
                  <td>{e.comment || '—'}</td>
                  <td className="text-center">{e.attendance ? t('presences.yes', { defaultValue: 'Oui' }) : t('presences.no', { defaultValue: 'Non' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={pageCount > page + 1 || rows.length >= 20 && pageCount > page + 1} onChange={setPage} />
    </div>
  );
}

export default Dispenses;
