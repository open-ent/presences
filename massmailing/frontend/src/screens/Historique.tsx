import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { dateFr, typeLabel } from '../utils';

/**
 * Historique des publipostages — parité IHM AngularJS (CCTP 51C) : envois passés sur une
 * période (GET /massmailing/mailings) avec canal, types d'événements et destinataire.
 */
export function Historique() {
  const { t } = useTranslation(['massmailing', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const [start, setStart] = useState('2025-09-01');
  const [end, setEnd] = useState('2026-07-31');

  const query = useQuery({
    queryKey: ['mm', 'mailings', structureId, start, end],
    queryFn: () => api.getMailings(structureId, start, end, 0),
    enabled: !!structureId,
  });
  const mailings = query.data?.all ?? [];

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('massmailing.history.title', { defaultValue: 'Historique' })}</h1>
        <div className="alert alert-info" role="alert">{t('massmailing.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">
        {t('massmailing.history.title', { defaultValue: 'Historique des publipostages' })}{' '}
        <span className="text-muted" style={{ fontSize: 14 }}>({mailings.length})</span>
      </h1>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="hist-start" className="form-label">{t('massmailing.from', { defaultValue: 'Du' })}</label>
          <input id="hist-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="hist-end" className="form-label">{t('massmailing.to', { defaultValue: 'Au' })}</label>
          <input id="hist-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {query.isLoading && <p>{t('massmailing.loading', { defaultValue: 'Chargement…' })}</p>}
      {query.isError && <div className="alert alert-warning" role="alert">{t('massmailing.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {!query.isLoading && mailings.length === 0 && (
        <p className="text-muted">{t('massmailing.history.empty', { defaultValue: 'Aucun publipostage sur la période.' })}</p>
      )}
      {mailings.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('massmailing.date', { defaultValue: 'Date' })}</th>
                <th>{t('massmailing.channel', { defaultValue: 'Canal' })}</th>
                <th>{t('massmailing.events', { defaultValue: 'Événements' })}</th>
                <th>{t('massmailing.student', { defaultValue: 'Élève' })}</th>
                <th>{t('massmailing.recipient', { defaultValue: 'Destinataire' })}</th>
              </tr>
            </thead>
            <tbody>
              {mailings.map((m, i) => (
                <tr key={m.id ?? i}>
                  <td>{dateFr(m.created)}</td>
                  <td>{m.type ?? '—'}</td>
                  <td>{(m.event_types ?? []).map(typeLabel).join(', ') || '—'}</td>
                  <td>{m.student?.name ?? '—'}{m.student?.className ? ` (${m.student.className})` : ''}</td>
                  <td>{m.recipient?.name ?? '—'}{m.recipient?.contact ? ` — ${m.recipient.contact}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Historique;
