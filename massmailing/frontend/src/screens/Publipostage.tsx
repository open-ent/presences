import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, MASSMAILING_TYPES, MassmailingType } from '../api';
import { totalCount, typeLabel } from '../utils';

/**
 * Publipostage — parité IHM AngularJS (CCTP 51C) : sélection du type d'événement, de la période
 * et du seuil de déclenchement, puis synthèse (événements à notifier, élèves contactables par
 * courriel, anomalies de coordonnées) avec la liste des élèves concernés.
 */
export function Publipostage() {
  const { t } = useTranslation(['massmailing', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const [type, setType] = useState<MassmailingType>('UNREGULARIZED');
  const [startAt, setStartAt] = useState(1);
  const [start, setStart] = useState('2025-09-01');
  const [end, setEnd] = useState('2026-07-31');

  const key = [structureId, type, startAt, start, end] as const;
  const statusQuery = useQuery({ queryKey: ['mm', 'status', ...key], queryFn: () => api.getStatus(structureId, type, startAt, start, end), enabled: !!structureId });
  const prefetchQuery = useQuery({ queryKey: ['mm', 'prefetch', ...key], queryFn: () => api.getPrefetch('MAIL', structureId, type, startAt, start, end), enabled: !!structureId });
  const anomaliesQuery = useQuery({ queryKey: ['mm', 'anomalies', ...key], queryFn: () => api.getAnomalies(structureId, type, startAt, start, end), enabled: !!structureId });

  const status = statusQuery.data ?? 0;
  const prefetch = prefetchQuery.data;
  const anomalies = anomaliesQuery.data ?? [];

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('massmailing.title', { defaultValue: 'Publipostage' })}</h1>
        <div className="alert alert-info" role="alert">{t('massmailing.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">{t('massmailing.title', { defaultValue: 'Publipostage' })}</h1>

      {/* Filtres : type d'événement + seuil + période */}
      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="mm-type" className="form-label">{t('massmailing.event.type', { defaultValue: "Type d'événement" })}</label>
          <select id="mm-type" className="form-select" value={type} onChange={(e) => setType(e.target.value as MassmailingType)}>
            {MASSMAILING_TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mm-seuil" className="form-label">{t('massmailing.threshold', { defaultValue: 'À partir de (seuil)' })}</label>
          <input id="mm-seuil" type="number" min={1} className="form-control" style={{ width: 110 }} value={startAt} onChange={(e) => setStartAt(Math.max(1, Number(e.target.value)))} />
        </div>
        <div>
          <label htmlFor="mm-start" className="form-label">{t('massmailing.from', { defaultValue: 'Du' })}</label>
          <input id="mm-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="mm-end" className="form-label">{t('massmailing.to', { defaultValue: 'Au' })}</label>
          <input id="mm-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {/* Synthèse */}
      <div className="d-flex gap-16 flex-wrap mb-24">
        <div className="card p-16 text-center" style={{ minWidth: 180, flexGrow: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{status}</div>
          <div className="text-muted">{t('massmailing.status.count', { defaultValue: 'Événement(s) sur la période' })}</div>
        </div>
        <div className="card p-16 text-center" style={{ minWidth: 180, flexGrow: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{prefetch?.counts.students ?? 0}</div>
          <div className="text-muted">{t('massmailing.students.mail', { defaultValue: 'Élève(s) contactable(s) par courriel' })}</div>
        </div>
        <div className="card p-16 text-center" style={{ minWidth: 180, flexGrow: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: anomalies.length > 0 ? '#c0392b' : undefined }}>{anomalies.length}</div>
          <div className="text-muted">{t('massmailing.anomalies', { defaultValue: 'Anomalie(s) de coordonnées' })}</div>
        </div>
      </div>

      {(statusQuery.isLoading || prefetchQuery.isLoading) && <p>{t('massmailing.loading', { defaultValue: 'Chargement…' })}</p>}

      {/* Élèves à publiposter (canal courriel) */}
      {(prefetch?.students.length ?? 0) > 0 && (
        <section className="mb-24">
          <h2 style={{ fontSize: 18 }} className="mb-12">{t('massmailing.students.title', { defaultValue: 'Élèves à publiposter (courriel)' })}</h2>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('massmailing.student', { defaultValue: 'Élève' })}</th>
                <th>{t('massmailing.class', { defaultValue: 'Classe' })}</th>
                <th className="text-center">{t('massmailing.count', { defaultValue: "Nombre d'événements" })}</th>
              </tr>
            </thead>
            <tbody>
              {prefetch!.students.map((s) => (
                <tr key={s.id}>
                  <td>{s.displayName ?? '—'}</td>
                  <td>{s.className ?? '—'}</td>
                  <td className="text-center">{totalCount(s.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Anomalies : élèves sans coordonnées valides */}
      {anomalies.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18 }} className="mb-12">{t('massmailing.anomalies.title', { defaultValue: 'Anomalies (coordonnées manquantes)' })}</h2>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('massmailing.student', { defaultValue: 'Élève' })}</th>
                <th>{t('massmailing.class', { defaultValue: 'Classe' })}</th>
                <th className="text-center">{t('massmailing.count', { defaultValue: "Nombre d'événements" })}</th>
                <th>{t('massmailing.missing.channel', { defaultValue: 'Canal manquant' })}</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id}>
                  <td>{a.displayName ?? '—'}</td>
                  <td>{a.className ?? '—'}</td>
                  <td className="text-center">{totalCount(a.count)}</td>
                  <td>{Object.entries(a.bug ?? {}).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {status === 0 && !statusQuery.isLoading && (
        <p className="text-muted">{t('massmailing.empty', { defaultValue: 'Aucun événement à publiposter sur la période.' })}</p>
      )}
    </div>
  );
}

export default Publipostage;
