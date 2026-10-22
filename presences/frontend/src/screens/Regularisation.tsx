import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { Pager } from '../components/Pager';
import { EventFilters, EventKind, KIND_TYPE_ID, RegularizedFilter, exportUrl, filterParams, hasNothingToLoad, toggleKind } from '../eventFilters';
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
  const { init } = useEdificeClient();
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

  const filters: EventFilters = { structureId, start, end, kinds, regularized, reasonIds, noReason };
  const params = filterParams(filters);
  const typeIds = kinds.map((k) => KIND_TYPE_ID[k]);
  const resetPage = () => { setPage(0); setChecked(new Set()); };

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
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
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
                </tr>
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
