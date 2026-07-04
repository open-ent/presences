import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { dateFr, heure } from '../utils';

/**
 * Régularisation des absences (parité IHM AngularJS) : liste des absences non régularisées
 * (GET /events?regularized=false), sélection multiple, puis PUT /events/regularized.
 */
export function Regularisation() {
  const { t } = useTranslation(['presences', 'common']);
  const { user, init } = useEdificeClient();
  const qc = useQueryClient();
  const structureId = user?.structures?.[0] ?? '';

  // Fenêtre par défaut : année scolaire en cours (large, pour retrouver toutes les absences).
  const [start, setStart] = useState('2025-09-01');
  const [end, setEnd] = useState('2026-07-31');
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const eventsQuery = useQuery({
    queryKey: ['pres', 'events', structureId, start, end],
    queryFn: () => api.getEvents(structureId, start, end, false),
    enabled: !!structureId,
  });
  const events = eventsQuery.data ?? [];

  const allChecked = events.length > 0 && events.every((e) => checked.has(e.id));
  const toggle = (id: number) => setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(events.map((e) => e.id)));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pres', 'events', structureId] });
  const regularizeMut = useMutation({
    mutationFn: () => api.regularizeEvents([...checked], true),
    onSuccess: () => { setChecked(new Set()); invalidate(); },
  });

  const selectedCount = useMemo(() => events.filter((e) => checked.has(e.id)).length, [events, checked]);

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
          <input id="reg-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="reg-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="reg-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={selectedCount === 0 || regularizeMut.isPending}
          onClick={() => regularizeMut.mutate()}
        >
          {t('presences.regularise.selection', { defaultValue: 'Régulariser la sélection' })} ({selectedCount})
        </button>
      </div>

      {eventsQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {eventsQuery.isError && <div className="alert alert-warning" role="alert">{t('presences.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {regularizeMut.isError && <div className="alert alert-warning" role="alert">{t('presences.regularise.error', { defaultValue: 'La régularisation a échoué.' })}</div>}

      {!eventsQuery.isLoading && events.length === 0 && (
        <p className="text-muted">{t('presences.regularisation.empty', { defaultValue: 'Aucune absence à régulariser sur la période.' })}</p>
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
                <th>{t('presences.date', { defaultValue: 'Date' })}</th>
                <th>{t('presences.slot', { defaultValue: 'Créneau' })}</th>
                <th>{t('presences.reason', { defaultValue: 'Motif' })}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td><input type="checkbox" aria-label={`${e.studentName} ${dateFr(e.date)}`} checked={checked.has(e.id)} onChange={() => toggle(e.id)} /></td>
                  <td>{e.studentName}</td>
                  <td>{e.classeName || '—'}</td>
                  <td>{dateFr(e.date)}</td>
                  <td>{heure(e.start_date)}{e.end_date ? ` – ${heure(e.end_date)}` : ''}</td>
                  <td>{e.reason || <span className="text-muted">{t('presences.no.reason', { defaultValue: 'Non justifiée' })}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Regularisation;
