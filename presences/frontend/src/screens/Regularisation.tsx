import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { AudienceSearch, PickedAudience } from '../components/AudienceSearch';
import { Pager } from '../components/Pager';
import { PickedStudent, StudentSearch } from '../components/StudentSearch';
import { EventFilters, EventKind, FollowedFilter, KIND_TYPE_ID, RegularizedFilter, exportUrl, filterParams, hasNothingToLoad, toggleKind } from '../eventFilters';
import { dateFr, heure, schoolYear, visibleByLabel } from '../utils';
import { useStructure } from '../structure';

const KINDS: Array<{ kind: EventKind; label: string }> = [
  { kind: 'absence', label: 'Absences' },
  { kind: 'lateness', label: 'Retards' },
  { kind: 'departure', label: 'Départs' },
];
const KIND_LABEL: Record<number, string> = { 1: 'Absence', 2: 'Retard', 3: 'Départ' };

/**
 * Liste des événements et régularisation (parité IHM AngularJS) : filtres (types, régularisation, motifs, période),
 * changement de motif, régularisation unitaire ou en lot, export. Par défaut : absences non régularisées de l'année.
 */
export function Regularisation() {
  const { t } = useTranslation(['presences', 'common']);
  const { init, user } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();

  // Fenêtre par défaut : année scolaire en cours (large, pour retrouver toutes les absences).
  const [start, setStart] = useState(schoolYear().start);
  const [end, setEnd] = useState(schoolYear().end);
  const [kinds, setKinds] = useState<EventKind[]>(['absence']);
  const [regularized, setRegularized] = useState<RegularizedFilter>('no');
  const [reasonIds, setReasonIds] = useState<number[]>([]);
  const [noReason, setNoReason] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [bulkReason, setBulkReason] = useState('');
  const [page, setPage] = useState(0);
  const [students, setStudents] = useState<PickedStudent[]>([]);
  const [classes, setClasses] = useState<PickedAudience[]>([]);
  const [followed, setFollowed] = useState<FollowedFilter>('all');
  const [startSlot, setStartSlot] = useState('');
  const [endSlot, setEndSlot] = useState('');
  const [actionFor, setActionFor] = useState<number | null>(null);
  const [actionId, setActionId] = useState('');
  const [actionComment, setActionComment] = useState('');

  const slotsQuery = useQuery({ queryKey: ['pres', 'time-slots', structureId], queryFn: () => api.getTimeSlots(structureId), enabled: !!structureId });
  const slots = slotsQuery.data ?? [];
  const startTime = slots.find((x) => x.id === startSlot)?.startHour;
  const endTime = slots.find((x) => x.id === endSlot)?.endHour;
  const filters: EventFilters = { structureId, start, end, kinds, regularized, reasonIds, noReason, studentIds: students.map((x) => x.id), classIds: classes.map((x) => x.id), followed, startTime, endTime };
  const params = filterParams(filters);
  const typeIds = kinds.map((k) => KIND_TYPE_ID[k]);
  const resetPage = () => { setPage(0); setChecked(new Set()); };

  const actionsTypesQuery = useQuery({ queryKey: ['pres', 'actions', structureId], queryFn: () => api.getActions(structureId), enabled: !!structureId });
  const historyQuery = useQuery({ queryKey: ['pres', 'event-actions', actionFor], queryFn: () => api.getEventActions(actionFor as number), enabled: actionFor !== null });
  const actionMut = useMutation({
    mutationFn: () => api.createEventAction([actionFor as number], Number(actionId), user?.userId ?? '', actionComment),
    onSuccess: () => { setActionId(''); setActionComment(''); qc.invalidateQueries({ queryKey: ['pres', 'event-actions', actionFor] }); invalidate(); },
  });
  const reasonsQuery = useQuery({ queryKey: ['pres', 'reasons', structureId], queryFn: () => api.getReasons(structureId), enabled: !!structureId });
  const reasons = visibleByLabel(reasonsQuery.data ?? []);

  const eventsQuery = useQuery({
    queryKey: ['pres', 'events', structureId, params, page],
    queryFn: () => api.getEventsFiltered(params, typeIds, page),
    enabled: !!structureId && !hasNothingToLoad(filters),
  });
  const events = eventsQuery.data?.items ?? [];

  const allChecked = events.length > 0 && events.every((e) => checked.has(e.id));
  const toggle = (id: number) => setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(events.map((e) => e.id)));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pres', 'events', structureId] });
  const regularizeMut = useMutation({
    mutationFn: (v: { ids: number[]; value: boolean }) => api.regularizeEvents(v.ids, v.value),
    onSuccess: () => { setChecked(new Set()); invalidate(); },
  });
  const reasonMut = useMutation({
    mutationFn: (v: { ids: number[]; reasonId: number | null }) => api.changeEventsReason(v.ids, v.reasonId),
    onSuccess: () => { setChecked(new Set()); setBulkReason(''); invalidate(); },
  });

  const selected = useMemo(() => events.filter((e) => checked.has(e.id)), [events, checked]);
  const selectedAbsences = selected.filter((e) => e.typeId === 1).map((e) => e.id);
  const selectedCount = selected.length;
  const busy = regularizeMut.isPending || reasonMut.isPending;
  const defaultView = regularized === 'no' && kinds.length === 1 && kinds[0] === 'absence';

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('presences.title', { defaultValue: 'Présences' })}</h1>
        <div className="alert alert-info" role="alert">
          {t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">{t('presences.regularisation.title', { defaultValue: 'Régularisation des absences' })}</h1>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="reg-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="reg-start" type="date" className="form-control" value={start} onChange={(e) => { setStart(e.target.value); resetPage(); }} />
        </div>
        <div>
          <label htmlFor="reg-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="reg-end" type="date" className="form-control" value={end} onChange={(e) => { setEnd(e.target.value); resetPage(); }} />
        </div>
        <div>
          <label htmlFor="reg-status" className="form-label">{t('presences.regularisation.status', { defaultValue: 'Régularisation' })}</label>
          <select id="reg-status" className="form-control" value={regularized} onChange={(e) => { setRegularized(e.target.value as RegularizedFilter); resetPage(); }}>
            <option value="no">{t('presences.regularisation.status.no', { defaultValue: 'Non régularisés' })}</option>
            <option value="yes">{t('presences.regularisation.status.yes', { defaultValue: 'Régularisés' })}</option>
            <option value="all">{t('presences.regularisation.status.all', { defaultValue: 'Tous' })}</option>
          </select>
        </div>
        <fieldset data-kinds>
          <legend className="form-label">{t('presences.event.types', { defaultValue: "Types d'événement" })}</legend>
          {KINDS.map(({ kind, label }) => (
            <label key={kind} className="me-12">
              <input type="checkbox" data-kind={kind} checked={kinds.includes(kind)} onChange={() => { setKinds(toggleKind(kinds, kind)); resetPage(); }} />{' '}
              {t(`presences.event.kind.${kind}`, { defaultValue: label })}
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="reg-followed" className="form-label">{t('presences.followed', { defaultValue: 'Suivi' })}</label>
          <select id="reg-followed" className="form-control" value={followed} onChange={(e) => { setFollowed(e.target.value as FollowedFilter); resetPage(); }}>
            <option value="all">{t('presences.followed.all', { defaultValue: 'Tous' })}</option>
            <option value="yes">{t('presences.followed.yes', { defaultValue: 'Suivis' })}</option>
            <option value="no">{t('presences.followed.no', { defaultValue: 'Non suivis' })}</option>
          </select>
        </div>
        {slots.length > 0 && (
          <>
            <div>
              <label htmlFor="reg-slot-start" className="form-label">{t('presences.slot.from', { defaultValue: 'Du créneau' })}</label>
              <select id="reg-slot-start" className="form-control" value={startSlot} onChange={(e) => { setStartSlot(e.target.value); resetPage(); }}>
                <option value="">—</option>
                {slots.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.startHour})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="reg-slot-end" className="form-label">{t('presences.slot.to', { defaultValue: 'Au créneau' })}</label>
              <select id="reg-slot-end" className="form-control" value={endSlot} onChange={(e) => { setEndSlot(e.target.value); resetPage(); }}>
                <option value="">—</option>
                {slots.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.endHour})</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <StudentSearch
            id="reg-filter-student" label={t('presences.student', { defaultValue: 'Élève' })} structureId={structureId} selected={students}
            pickAttr="data-filter-student" chipsAttr="data-filter-students" resultsAttr="data-filter-results"
            onAdd={(x) => { setStudents([...students, x]); resetPage(); }} onRemove={(x) => { setStudents(students.filter((y) => y.id !== x.id)); resetPage(); }}
          />
        </div>
        <div data-class-filter>
          <AudienceSearch id="reg-filter-class" label={t('presences.class', { defaultValue: 'Classe' })} structureId={structureId} selected={classes} onChange={(next) => { setClasses(next); resetPage(); }} />
        </div>
        <details data-reason-filter>
          <summary>{t('presences.reasons.filter', { defaultValue: 'Motifs' })}{reasonIds.length + (noReason ? 1 : 0) > 0 ? ` (${reasonIds.length + (noReason ? 1 : 0)})` : ''}</summary>
          <label className="d-block">
            <input type="checkbox" data-reason="none" checked={noReason} onChange={() => { setNoReason(!noReason); resetPage(); }} /> {t('presences.no.reason', { defaultValue: 'Sans motif' })}
          </label>
          {reasons.map((r) => (
            <label key={r.id} className="d-block">
              <input
                type="checkbox"
                data-reason={r.id}
                checked={reasonIds.includes(r.id)}
                onChange={() => { setReasonIds(reasonIds.includes(r.id) ? reasonIds.filter((x) => x !== r.id) : [...reasonIds, r.id]); resetPage(); }}
              />{' '}
              {r.label}
            </label>
          ))}
        </details>
      </div>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16" data-bulk>
        <button type="button" className="btn btn-primary" data-regularize disabled={selectedAbsences.length === 0 || busy} onClick={() => regularizeMut.mutate({ ids: selectedAbsences, value: true })}>
          {t('presences.regularise.selection', { defaultValue: 'Régulariser la sélection' })} ({selectedAbsences.length})
        </button>
        <button type="button" className="btn btn-outline-primary" data-unregularize disabled={selectedAbsences.length === 0 || busy} onClick={() => regularizeMut.mutate({ ids: selectedAbsences, value: false })}>
          {t('presences.unregularise.selection', { defaultValue: 'Annuler la régularisation' })}
        </button>
        <div>
          <label htmlFor="reg-bulk-reason" className="form-label">{t('presences.reason.change', { defaultValue: 'Motif de la sélection' })}</label>
          <select id="reg-bulk-reason" className="form-control" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)}>
            <option value="">{t('presences.no.reason', { defaultValue: 'Sans motif' })}</option>
            {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-outline-primary" data-apply-reason disabled={selectedCount === 0 || busy} onClick={() => reasonMut.mutate({ ids: selected.filter((e) => e.typeId === 1 || e.typeId === 2).map((e) => e.id), reasonId: bulkReason === '' ? null : Number(bulkReason) })}>
          {t('presences.reason.apply', { defaultValue: 'Appliquer le motif' })} ({selectedCount})
        </button>
        <span className="ms-auto">
          <a className="btn btn-outline-primary me-8" data-export="CSV" href={exportUrl(filters, 'CSV')}>{t('presences.export.csv', { defaultValue: 'Exporter (CSV)' })}</a>
          <a className="btn btn-outline-primary" data-export="PDF" href={exportUrl(filters, 'PDF')}>{t('presences.export.pdf', { defaultValue: 'Exporter (PDF)' })}</a>
        </span>
      </div>

      {eventsQuery.isLoading && !hasNothingToLoad(filters) && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {eventsQuery.isError && <div className="alert alert-warning" role="alert">{t('presences.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {regularizeMut.isError && <div className="alert alert-warning" role="alert">{t('presences.regularise.error', { defaultValue: 'La régularisation a échoué.' })}</div>}
      {reasonMut.isError && <div className="alert alert-warning" role="alert" data-reason-error>{t('presences.reason.error', { defaultValue: 'Le changement de motif a échoué.' })}</div>}
      {hasNothingToLoad(filters) && <p className="text-muted">{t('presences.event.types.none', { defaultValue: "Choisissez au moins un type d'événement." })}</p>}

      {!eventsQuery.isLoading && !eventsQuery.isError && !hasNothingToLoad(filters) && events.length === 0 && (
        <p className="text-muted">{defaultView ? t('presences.regularisation.empty', { defaultValue: 'Aucune absence à régulariser sur la période.' }) : t('presences.events.empty', { defaultValue: 'Aucun événement ne correspond aux filtres.' })}</p>
      )}

      {events.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" aria-label={t('presences.select.all', { defaultValue: 'Tout sélectionner' })} checked={allChecked} onChange={toggleAll} />
                </th>
                <th>{t('presences.student', { defaultValue: 'Élève' })}</th>
                <th>{t('presences.class', { defaultValue: 'Classe' })}</th>
                <th>{t('presences.type', { defaultValue: 'Type' })}</th>
                <th>{t('presences.date', { defaultValue: 'Date' })}</th>
                <th>{t('presences.slot', { defaultValue: 'Créneau' })}</th>
                <th>{t('presences.reason', { defaultValue: 'Motif' })}</th>
                <th>{t('presences.regularised', { defaultValue: 'Régularisé' })}</th>
                <th>{t('presences.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <Fragment key={e.id}>
                <tr>
                  <td><input type="checkbox" aria-label={`${e.studentName} ${dateFr(e.date)}`} checked={checked.has(e.id)} onChange={() => toggle(e.id)} /></td>
                  <td>{e.studentName}</td>
                  <td>{e.classeName || '—'}</td>
                  <td>{KIND_LABEL[e.typeId ?? 1]}</td>
                  <td>{dateFr(e.date)}</td>
                  <td>{heure(e.start_date)}{e.end_date ? ` – ${heure(e.end_date)}` : ''}</td>
                  <td>
                    {e.typeId === 3 ? (
                      e.reason || <span className="text-muted">{t('presences.no.reason', { defaultValue: 'Non justifiée' })}</span>
                    ) : (
                      <select
                        aria-label={`${t('presences.reason', { defaultValue: 'Motif' })} ${e.studentName} ${dateFr(e.date)}`}
                        data-row-reason={e.id}
                        className="form-control"
                        value={e.reason_id ?? ''}
                        disabled={busy}
                        onChange={(ev) => reasonMut.mutate({ ids: [e.id], reasonId: ev.target.value === '' ? null : Number(ev.target.value) })}
                      >
                        <option value="">{t('presences.no.reason', { defaultValue: 'Non justifiée' })}</option>
                        {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    {e.typeId === 1 ? (
                      <input
                        type="checkbox"
                        data-row-regularized={e.id}
                        aria-label={`${t('presences.regularised', { defaultValue: 'Régularisé' })} ${e.studentName} ${dateFr(e.date)}`}
                        checked={Boolean(e.counsellor_regularisation)}
                        disabled={busy}
                        onChange={() => regularizeMut.mutate({ ids: [e.id], value: !e.counsellor_regularisation })}
                      />
                    ) : '—'}
                  </td>
                  <td>
                    {e.typeId === 1 ? (
                      <button type="button" className="btn btn-outline-primary btn-sm" data-actions={e.id} onClick={() => setActionFor(actionFor === e.id ? null : e.id)}>
                        {t('presences.actions.open', { defaultValue: 'Suivi' })}
                      </button>
                    ) : '—'}
                  </td>
                </tr>
                {actionFor === e.id && (
                  <tr data-actions-row={e.id}>
                    <td colSpan={9}>
                      <h3 style={{ fontSize: 16 }}>{t('presences.absence.actions.concern.absence', { defaultValue: "Actions engagées pour l'absence" })} — {e.studentName} {dateFr(e.date)}</h3>
                      {historyQuery.isError && <div className="alert alert-warning" role="alert">{t('presences.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
                      <ul data-history className="mb-12">
                        {(historyQuery.data ?? []).map((a, i) => (
                          <li key={a.id ?? i}>{a.label}{a.comment ? ` — ${a.comment}` : ''}{a.created_date ? ` (${dateFr(a.created_date)})` : ''}</li>
                        ))}
                        {historyQuery.data && historyQuery.data.length === 0 && <li className="text-muted">{t('presences.actions.none', { defaultValue: 'Aucune action engagée.' })}</li>}
                      </ul>
                      <div className="d-flex gap-12 flex-wrap align-items-end">
                        <div>
                          <label htmlFor="reg-action-type" className="form-label">{t('presences.absence.action.types', { defaultValue: "Type d'action" })}</label>
                          <select id="reg-action-type" className="form-control" value={actionId} onChange={(ev) => setActionId(ev.target.value)}>
                            <option value="">—</option>
                            {(actionsTypesQuery.data ?? []).filter((x) => !x.hidden).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                          </select>
                        </div>
                        <div className="flex-grow-1">
                          <label htmlFor="reg-action-comment" className="form-label">{t('presences.absence.actions.comment', { defaultValue: 'Commentaire' })}</label>
                          <input id="reg-action-comment" className="form-control" value={actionComment} onChange={(ev) => setActionComment(ev.target.value)} />
                        </div>
                        <button type="button" className="btn btn-primary" data-action-save disabled={actionId === '' || actionMut.isPending} onClick={() => actionMut.mutate()}>
                          {t('presences.exemptions.form.submit', { defaultValue: 'Valider' })}
                        </button>
                      </div>
                      {actionMut.isError && <div className="alert alert-warning mt-8" role="alert" data-action-error>{t('presences.action.error', { defaultValue: "L'action n'a pas pu être enregistrée." })}</div>}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={!!eventsQuery.data?.hasNext} onChange={(p) => { setPage(p); setChecked(new Set()); }} />
    </div>
  );
}

export default Regularisation;
