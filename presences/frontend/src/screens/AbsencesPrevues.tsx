import { useEdificeClient, useHasWorkflow } from '@open-ent/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { AudienceSearch, PickedAudience } from '../components/AudienceSearch';
import { QueryErrors } from '../components/QueryErrors';
import { PickedStudent, StudentSearch } from '../components/StudentSearch';
import {
  absenceDates, exportUrl, initialPlannedFilters, listUrl, ownerName, PlannedAbsence, PlannedFilters, regularizeState,
} from '../plannedAbsences';
import { useStructure } from '../structure';
import { jour, visibleByLabel } from '../utils';

const ONE_D = 'fr.openent.presences.controller.FakeRight|presences1D';

const plusOneMonth = (d: Date) => {
  const n = new Date(d);
  n.setMonth(n.getMonth() + 1);
  return jour(n);
};

/**
 * Absences prévues (parité IHM AngularJS) : absences de l'établissement à venir ou en cours, filtrées par période,
 * créneaux, élèves, classes, demi-pension / internat, état (sans motif, justifiée, régularisée), suivi et motifs ;
 * changement de motif, régularisation, repères du jour et export PDF / CSV.
 */
export function AbsencesPrevues() {
  const { t } = useTranslation(['presences', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const oneD = useHasWorkflow(ONE_D) as boolean | undefined;

  const today = jour(new Date());
  const [filters, setFilters] = useState<PlannedFilters | null>(null);
  const [draft, setDraft] = useState<PlannedFilters | null>(null);
  const [students, setStudents] = useState<PickedStudent[]>([]);
  const [classes, setClasses] = useState<PickedAudience[]>([]);

  const reasonsQuery = useQuery({ queryKey: ['pres', 'reasons', structureId], queryFn: () => api.getReasons(structureId), enabled: !!structureId });
  const slotsQuery = useQuery({ queryKey: ['pres', 'time-slots', structureId], queryFn: () => api.getTimeSlots(structureId), enabled: !!structureId });
  const reasons = visibleByLabel(reasonsQuery.data ?? []);
  const provingById = Object.fromEntries(reasons.map((r) => [r.id, Boolean(r.proving)]));
  const slots = (slotsQuery.data ?? []).filter((s) => s.startHour && s.endHour).sort((a, b) => a.startHour.localeCompare(b.startHour));

  // Au départ : aujourd'hui → dans un mois, tous les états et tous les motifs retenus.
  const effective: PlannedFilters | null = !structureId || !reasonsQuery.isSuccess && !reasonsQuery.isError
    ? null
    : (filters ?? initialPlannedFilters(structureId, today, plusOneMonth(new Date()), reasons.map((r) => r.id)));
  const active = effective ? { ...effective, studentIds: students.map((s) => s.id), classIds: classes.map((c) => c.id) } : null;
  const key = active ? listUrl(active, 0) : '';

  const listQuery = useInfiniteQuery({
    queryKey: ['pres', 'planned', key],
    queryFn: ({ pageParam }) => api.getPlannedAbsences(listUrl(active as PlannedFilters, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.all.length >= 20 ? all.length : undefined),
    enabled: !!active,
  });
  const markersQuery = useQuery({
    queryKey: ['pres', 'absence-markers', structureId],
    queryFn: () => api.getAbsenceMarkers(structureId, `${today} 00:00:00`, `${today} 23:59:59`),
    enabled: !!structureId && oneD === false,
  });
  const absences: PlannedAbsence[] = (listQuery.data?.pages ?? []).flatMap((p) => p.all);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pres', 'planned'] });
  const reasonMut = useMutation({ mutationFn: (v: { id: number; reasonId: number | null }) => api.setAbsenceReason([v.id], v.reasonId), onSuccess: invalidate });
  const regularizeMut = useMutation({ mutationFn: (v: { id: number; value: boolean }) => api.regularizeAbsences([v.id], v.value), onSuccess: invalidate });

  const apply = () => { if (draft) setFilters(draft); setDraft(null); };
  const set = (patch: Partial<PlannedFilters>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  if (init && !structureId) {
    return <div className="alert alert-info" role="alert">{t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>;
  }

  return (
    <div>
      <h1 className="mb-16">{t('presences.planned.absences.title', { defaultValue: 'Absences prévues' })}</h1>
      <QueryErrors queries={[listQuery, reasonsQuery]} />

      <div className="d-flex gap-24 flex-wrap mb-12">
        <div style={{ minWidth: 260 }}>
          <StudentSearch
            id="pa-student" label={t('presences.exemptions.search.student', { defaultValue: 'Rechercher un élève' })} structureId={structureId} selected={students}
            onAdd={(s) => setStudents([...students, s])} onRemove={(s) => setStudents(students.filter((x) => x.id !== s.id))}
          />
        </div>
        <div style={{ minWidth: 260 }}>
          <AudienceSearch id="pa-class" label={t('presences.exemptions.search.audience', { defaultValue: 'Rechercher une classe, un groupe ou un regroupement' })} structureId={structureId} selected={classes} onChange={setClasses} />
        </div>
      </div>

      {effective && (
        <div className="d-flex gap-12 align-items-end flex-wrap mb-12">
          <div>
            <label htmlFor="pa-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
            <input id="pa-start" type="date" className="form-control" value={effective.start} onChange={(e) => setFilters({ ...effective, start: e.target.value })} />
          </div>
          <div>
            <label htmlFor="pa-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
            <input id="pa-end" type="date" className="form-control" value={effective.end} onChange={(e) => setFilters({ ...effective, end: e.target.value })} />
          </div>
          <button type="button" className="btn btn-outline-primary" data-open-filters onClick={() => setDraft(effective)}>{t('presences.filters', { defaultValue: 'Filtres' })}</button>
          <span className="ms-auto d-flex gap-8">
            <a className={`btn btn-outline-primary${absences.length === 0 ? ' disabled' : ''}`} data-export="PDF" aria-disabled={absences.length === 0} href={absences.length === 0 || !active ? undefined : exportUrl(active, 'PDF')}>{t('presences.export.topdf', { defaultValue: 'Exporter (PDF)' })}</a>
            <a className={`btn btn-outline-primary${absences.length === 0 ? ' disabled' : ''}`} data-export="CSV" aria-disabled={absences.length === 0} href={absences.length === 0 || !active ? undefined : exportUrl(active, 'CSV')}>{t('presences.export.tocsv', { defaultValue: 'Exporter (CSV)' })}</a>
          </span>
        </div>
      )}

      {draft && (
        <section className="border rounded p-16 mb-16" data-filter-panel aria-label={t('presences.filters', { defaultValue: 'Filtres' })}>
          <fieldset className="mb-12">
            <legend className="form-label">{t('presences.absence.states', { defaultValue: "États de l'absence" })}</legend>
            <label className="me-12"><input type="checkbox" data-state="noReasons" checked={draft.noReasons} onChange={(e) => set({ noReasons: e.target.checked })} /> {t('presences.absence.unjustified', { defaultValue: 'Sans motif' })}</label>
            <label className="me-12"><input type="checkbox" data-state="notRegularized" checked={draft.notRegularized} onChange={(e) => set({ notRegularized: e.target.checked })} /> {t('presences.absence.types.justified.not.regularized', { defaultValue: 'Justifiées, non régularisées' })}</label>
            <label className="me-12"><input type="checkbox" data-state="regularized" checked={draft.regularized} onChange={(e) => set({ regularized: e.target.checked })} /> {t('presences.absence.types.justified.regularized', { defaultValue: 'Justifiées, régularisées' })}</label>
          </fieldset>
          <fieldset className="mb-12">
            <legend className="form-label">{t('presences.followed', { defaultValue: 'Suivi' })}</legend>
            <label className="me-12"><input type="checkbox" data-state="followed" checked={draft.followed} onChange={(e) => set({ followed: e.target.checked })} /> {t('presences.absence.types.followed', { defaultValue: 'Suivies' })}</label>
            <label className="me-12"><input type="checkbox" data-state="notFollowed" checked={draft.notFollowed} onChange={(e) => set({ notFollowed: e.target.checked })} /> {t('presences.absence.types.not.followed', { defaultValue: 'Non suivies' })}</label>
          </fieldset>
          <fieldset className="mb-12">
            <legend className="form-label">{t('presences.students.kind', { defaultValue: 'Élèves' })}</legend>
            <label className="me-12"><input type="checkbox" data-state="halfBoarders" checked={draft.halfBoarders} onChange={(e) => set({ halfBoarders: e.target.checked })} /> {t('presences.half.boarders', { defaultValue: 'Demi-pensionnaires' })}</label>
            <label className="me-12"><input type="checkbox" data-state="interns" checked={draft.interns} onChange={(e) => set({ interns: e.target.checked })} /> {t('presences.interns', { defaultValue: 'Internes' })}</label>
          </fieldset>
          {slots.length > 0 && (
            <div className="d-flex gap-12 flex-wrap mb-12">
              <div>
                <label htmlFor="pa-slot-start" className="form-label">{t('presences.slot.from', { defaultValue: 'À partir du créneau' })}</label>
                <select id="pa-slot-start" className="form-control" value={draft.startHour} onChange={(e) => set({ startHour: e.target.value })}>
                  <option value="">—</option>
                  {slots.map((s) => <option key={s.id} value={s.startHour.slice(0, 5)}>{s.name} ({s.startHour.slice(0, 5)})</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="pa-slot-end" className="form-label">{t('presences.slot.to', { defaultValue: "Jusqu'au créneau" })}</label>
                <select id="pa-slot-end" className="form-control" value={draft.endHour} onChange={(e) => set({ endHour: e.target.value })}>
                  <option value="">—</option>
                  {slots.map((s) => <option key={s.id} value={s.endHour.slice(0, 5)}>{s.name} ({s.endHour.slice(0, 5)})</option>)}
                </select>
              </div>
            </div>
          )}
          {reasons.length > 0 && (
            <div className="mb-12">
              <div className="form-label">{t('presences.absence.reason.title', { defaultValue: "Motifs d'absence" })}</div>
              <div className="d-flex gap-8 flex-wrap" data-reasons>
                {reasons.map((r) => (
                  <button key={r.id} type="button" className={`btn btn-sm ${draft.reasonIds.includes(r.id) ? 'btn-primary' : 'btn-outline-secondary'}`} data-reason={r.id} aria-pressed={draft.reasonIds.includes(r.id)}
                    onClick={() => set({ reasonIds: draft.reasonIds.includes(r.id) ? draft.reasonIds.filter((x) => x !== r.id) : [...draft.reasonIds, r.id] })}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="d-flex gap-12">
            <button type="button" className="btn btn-primary" data-apply onClick={apply}>{t('presences.exemptions.form.submit', { defaultValue: 'Valider' })}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setDraft(null)}>{t('presences.cancel', { defaultValue: 'Annuler' })}</button>
          </div>
        </section>
      )}

      {oneD === false && (
        <ul className="list-unstyled d-flex gap-24 mb-12" data-markers>
          <li>{t('presences.absence.day.student', { defaultValue: 'Élèves absents à la journée' })} : <strong data-day-students>{markersQuery.data?.nb_day_students ?? 0}</strong></li>
          {(markersQuery.data?.nb_internals ?? 0) > 0 && <li>{t('presences.absence.absent.interns', { defaultValue: 'Internes absents' })} : <strong>{markersQuery.data?.nb_internals}</strong></li>}
        </ul>
      )}

      {(reasonMut.isError || regularizeMut.isError) && <div className="alert alert-warning" role="alert" data-action-error>{t('presences.error', { defaultValue: "L'opération a échoué." })}</div>}
      {listQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!listQuery.isLoading && !listQuery.isError && active && absences.length === 0 && (
        <p className="text-muted" data-empty>{t('presences.absences.empty', { defaultValue: 'Aucune absence prévue sur la période.' })}</p>
      )}
      {absences.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0" data-planned-table>
            <thead>
              <tr>
                <th>{t('presences.student.caps', { defaultValue: 'Élève' })}</th>
                <th>{t('presences.date', { defaultValue: 'Date' })}</th>
                <th>{t('presences.absence.reason', { defaultValue: 'Motif' })}</th>
                <th>{t('presences.created.by.caps', { defaultValue: 'Créée par' })}</th>
                <th className="text-center">{t('presences.planned.absence.regularized.abbr', { defaultValue: 'Régul.' })}</th>
              </tr>
            </thead>
            <tbody>
              {absences.map((a) => {
                const st = regularizeState(a, provingById);
                const name = a.student?.name ?? a.student?.displayName ?? '';
                return (
                  <tr key={a.id} data-absence={a.id}>
                    <td>{name} <span className="text-muted">{a.student?.className}</span></td>
                    <td>{absenceDates(a)}</td>
                    <td>
                      <select
                        className="form-control" aria-label={`${t('presences.absence.reason', { defaultValue: 'Motif' })} ${name}`} data-reason-select={a.id}
                        value={a.reason?.id ?? a.reason_id ?? ''} disabled={reasonMut.isPending}
                        onChange={(e) => reasonMut.mutate({ id: a.id, reasonId: e.target.value === '' ? null : Number(e.target.value) })}
                      >
                        <option value="">{t('presences.absence.select.empty', { defaultValue: 'Sans motif' })}</option>
                        {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </td>
                    <td>{ownerName(a) || '—'}</td>
                    <td className="text-center">
                      {st.visible ? (
                        <input type="checkbox" data-regularized={a.id} aria-label={`${t('presences.regularised', { defaultValue: 'Régularisée' })} ${name}`} checked={Boolean(a.counsellor_regularisation)} disabled={st.disabled || regularizeMut.isPending}
                          onChange={() => regularizeMut.mutate({ id: a.id, value: !a.counsellor_regularisation })} />
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {listQuery.hasNextPage && (
        <div className="text-center my-12">
          <button type="button" className="btn btn-outline-primary" data-more disabled={listQuery.isFetchingNextPage} onClick={() => listQuery.fetchNextPage()}>{t('presences.more', { defaultValue: 'Afficher la suite' })}</button>
        </div>
      )}
    </div>
  );
}

export default AbsencesPrevues;
