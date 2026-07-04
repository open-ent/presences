import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { dateFr, heure, ouiNon } from '../utils';

/**
 * Incidents — parité IHM AngularJS (CCTP 51C) : liste des incidents de la structure sur une
 * période (GET /incidents/incidents), avec type / lieu / partenaire / gravité / protagonistes
 * résolus en clair et statut « traité ».
 */
export function Incidents() {
  const { t } = useTranslation(['incidents', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const [start, setStart] = useState('2025-09-01');
  const [end, setEnd] = useState('2026-07-31');

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'list', structureId, start, end],
    queryFn: () => api.getIncidents(structureId, start, end),
    enabled: !!structureId,
  });
  const incidents = incidentsQuery.data ?? [];

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('incidents.title', { defaultValue: 'Incidents' })}</h1>
        <div className="alert alert-info" role="alert">{t('incidents.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">
        {t('incidents.title', { defaultValue: 'Incidents' })} <span className="text-muted" style={{ fontSize: 14 }}>({incidents.length})</span>
      </h1>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="inc-start" className="form-label">{t('incidents.from', { defaultValue: 'Du' })}</label>
          <input id="inc-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="inc-end" className="form-label">{t('incidents.to', { defaultValue: 'Au' })}</label>
          <input id="inc-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {incidentsQuery.isLoading && <p>{t('incidents.loading', { defaultValue: 'Chargement…' })}</p>}
      {incidentsQuery.isError && <div className="alert alert-warning" role="alert">{t('incidents.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {!incidentsQuery.isLoading && incidents.length === 0 && (
        <p className="text-muted">{t('incidents.empty', { defaultValue: 'Aucun incident sur la période.' })}</p>
      )}
      {incidents.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('incidents.date', { defaultValue: 'Date' })}</th>
                <th>{t('incidents.type', { defaultValue: 'Type' })}</th>
                <th>{t('incidents.protagonists', { defaultValue: 'Protagonistes' })}</th>
                <th>{t('incidents.place', { defaultValue: 'Lieu' })}</th>
                <th>{t('incidents.seriousness', { defaultValue: 'Gravité' })}</th>
                <th>{t('incidents.partner', { defaultValue: 'Partenaire' })}</th>
                <th>{t('incidents.description', { defaultValue: 'Description' })}</th>
                <th className="text-center">{t('incidents.processed', { defaultValue: 'Traité' })}</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td>{dateFr(i.date)}{heure(i.date) ? ` ${heure(i.date)}` : ''}</td>
                  <td>{i.typeLabel || '—'}</td>
                  <td>{i.protagonistes || '—'}</td>
                  <td>{i.placeLabel || '—'}</td>
                  <td>{i.seriousnessLabel || '—'}</td>
                  <td>{i.partnerLabel || '—'}</td>
                  <td>{i.description || '—'}</td>
                  <td className="text-center">
                    <span className={`badge bg-${i.processed ? 'success' : 'secondary'}`}>{ouiNon(i.processed)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Incidents;
