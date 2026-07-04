import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { dateFr } from '../utils';

/**
 * Punitions / sanctions — parité IHM AngularJS (CCTP 51C) : liste des punitions de la structure
 * (GET /incidents/punishments) + rappel des types de sanction paramétrés (référentiel).
 */
export function Punitions() {
  const { t } = useTranslation(['incidents', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const [start, setStart] = useState('2025-09-01');
  const [end, setEnd] = useState('2026-07-31');

  const punishmentsQuery = useQuery({
    queryKey: ['incidents', 'punishments', structureId, start, end],
    queryFn: () => api.getPunishments(structureId, start, end),
    enabled: !!structureId,
  });
  const typesQuery = useQuery({ queryKey: ['incidents', 'punishment-types', structureId], queryFn: () => api.getPunishmentTypes(structureId), enabled: !!structureId });

  const punishments = punishmentsQuery.data ?? [];
  const types = typesQuery.data ?? [];

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('incidents.punishments.title', { defaultValue: 'Punitions' })}</h1>
        <div className="alert alert-info" role="alert">{t('incidents.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">
        {t('incidents.punishments.title', { defaultValue: 'Punitions' })} <span className="text-muted" style={{ fontSize: 14 }}>({punishments.length})</span>
      </h1>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="pun-start" className="form-label">{t('incidents.from', { defaultValue: 'Du' })}</label>
          <input id="pun-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pun-end" className="form-label">{t('incidents.to', { defaultValue: 'Au' })}</label>
          <input id="pun-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {punishmentsQuery.isLoading && <p>{t('incidents.loading', { defaultValue: 'Chargement…' })}</p>}
      {!punishmentsQuery.isLoading && punishments.length === 0 && (
        <p className="text-muted">{t('incidents.punishments.empty', { defaultValue: 'Aucune punition sur la période.' })}</p>
      )}
      {punishments.length > 0 && (
        <div style={{ overflowX: 'auto' }} className="mb-24">
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('incidents.date', { defaultValue: 'Date' })}</th>
                <th>{t('incidents.student', { defaultValue: 'Élève' })}</th>
                <th>{t('incidents.type', { defaultValue: 'Type' })}</th>
                <th>{t('incidents.description', { defaultValue: 'Description' })}</th>
              </tr>
            </thead>
            <tbody>
              {punishments.map((p) => (
                <tr key={p.id}>
                  <td>{dateFr(p.createdAt)}</td>
                  <td>{p.studentName || '—'}</td>
                  <td>{p.typeLabel || '—'}</td>
                  <td>{p.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Référentiel des types de sanction paramétrés */}
      {types.length > 0 && (
        <>
          <h2 style={{ fontSize: 18 }} className="mb-12">{t('incidents.punishment.types', { defaultValue: 'Types de sanction paramétrés' })}</h2>
          <div className="d-flex gap-8 flex-wrap">
            {types.map((ty) => <span key={ty.id} className="badge bg-secondary">{ty.label}</span>)}
          </div>
        </>
      )}
    </div>
  );
}

export default Punitions;
