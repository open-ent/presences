import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { absenceDates, initialPlannedFilters, listUrl, ownerName, PlannedAbsence, regularizeState } from '../plannedAbsences';
import { calendarLink } from '../studentCalendar';
import { jour, visibleByLabel } from '../utils';
import { AudienceSearch, PickedAudience } from './AudienceSearch';
import { PickedStudent, StudentSearch } from './StudentSearch';

/**
 * Widget « Absences » du tableau de bord (parité IHM AngularJS) : absences d'une période (aujourd'hui par défaut),
 * recherche par élève ou classe, motif modifiable, régularisation, lien vers le calendrier de l'élève.
 */
export function AbsencesWidget({ structureId }: { structureId: string }) {
  const { t } = useTranslation(['presences', 'common']);
  const qc = useQueryClient();
  const today = jour(new Date());
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [students, setStudents] = useState<PickedStudent[]>([]);
  const [classes, setClasses] = useState<PickedAudience[]>([]);

  const reasonsQuery = useQuery({ queryKey: ['pres', 'reasons', structureId], queryFn: () => api.getReasons(structureId), enabled: !!structureId });
  const reasons = visibleByLabel(reasonsQuery.data ?? []).filter((r) => r.reason_type_id === undefined || r.reason_type_id === 1);
  const provingById = Object.fromEntries(reasons.map((r) => [r.id, Boolean(r.proving)]));
  const filters = { ...initialPlannedFilters(structureId, start, end, reasons.map((r) => r.id)), studentIds: students.map((s) => s.id), classIds: classes.map((c) => c.id) };
  const url = listUrl(filters, 0).replace(/&page=0$/, '');
  const listQuery = useQuery({ queryKey: ['pres', 'widget-absences', structureId, url], queryFn: () => api.getPlannedAbsences(url), enabled: !!structureId && reasonsQuery.isSuccess });
  const absences: PlannedAbsence[] = [...(listQuery.data?.all ?? [])].sort((a, b) => `${a.student?.name ?? ''}${a.start_date}`.localeCompare(`${b.student?.name ?? ''}${b.start_date}`));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pres', 'widget-absences'] });
  const reasonMut = useMutation({ mutationFn: (v: { id: number; reasonId: number | null }) => api.setAbsenceReason([v.id], v.reasonId), onSuccess: invalidate });
  const regularizeMut = useMutation({ mutationFn: (v: { id: number; value: boolean }) => api.regularizeAbsences([v.id], v.value), onSuccess: invalidate });

  return (
    <section className="card p-16 mb-24" data-absences-widget>
      <h2 style={{ fontSize: 18 }} className="mb-12">{t('presences.widgets.absences', { defaultValue: 'Absences' })}</h2>
      <div className="d-flex gap-12 flex-wrap align-items-end mb-12">
        <div><label htmlFor="aw-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label><input id="aw-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label htmlFor="aw-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label><input id="aw-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div style={{ minWidth: 220 }}>
          <StudentSearch id="aw-student" label={t('presences.exemptions.search.student', { defaultValue: 'Rechercher un élève' })} structureId={structureId} selected={students} onAdd={(s) => setStudents([...students, s])} onRemove={(s) => setStudents(students.filter((x) => x.id !== s.id))} />
        </div>
        <div style={{ minWidth: 220 }}>
          <AudienceSearch id="aw-class" label={t('presences.exemptions.search.audience', { defaultValue: 'Rechercher une classe' })} structureId={structureId} selected={classes} onChange={setClasses} />
        </div>
      </div>
      {listQuery.isError && <div className="alert alert-warning" role="alert" data-load-error>{t('presences.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {(reasonMut.isError || regularizeMut.isError) && <div className="alert alert-warning" role="alert" data-action-error>{t('presences.error', { defaultValue: "L'opération a échoué." })}</div>}
      {listQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!listQuery.isLoading && !listQuery.isError && absences.length === 0 && <p className="text-muted" data-empty>{t('presences.widgets.absences.empty', { defaultValue: 'Aucune absence sur la période.' })}</p>}
      <ul className="list-unstyled mb-0" data-absence-list>
        {absences.map((a) => {
          const st = regularizeState(a, provingById);
          const name = a.student?.name ?? a.student?.displayName ?? '';
          return (
            <li key={a.id} className="d-flex gap-12 align-items-center flex-wrap border-bottom py-8" data-absence={a.id}>
              <div style={{ minWidth: 200 }}>
                {a.student?.id ? <a href={calendarLink(a.student.id, a.start_date)}>{name}</a> : name}
                <div className="text-muted">{a.student?.className}</div>
              </div>
              <select className="form-control" style={{ maxWidth: 220 }} aria-label={`${t('presences.absence.reason', { defaultValue: 'Motif' })} ${name}`} data-reason-select={a.id} value={a.reason?.id ?? a.reason_id ?? ''} disabled={reasonMut.isPending}
                onChange={(e) => reasonMut.mutate({ id: a.id, reasonId: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">{t('presences.absence.select.empty', { defaultValue: 'Sans motif' })}</option>
                {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <em className="text-muted">{absenceDates(a)} {ownerName(a)}</em>
              {st.visible && (
                <label className="ms-auto">
                  {t('presences.widgets.absences.regularized', { defaultValue: 'Régularisée' })}{' '}
                  <input type="checkbox" data-regularized={a.id} checked={Boolean(a.counsellor_regularisation)} disabled={st.disabled || regularizeMut.isPending} onChange={() => regularizeMut.mutate({ id: a.id, value: !a.counsellor_regularisation })} />
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default AbsencesWidget;
