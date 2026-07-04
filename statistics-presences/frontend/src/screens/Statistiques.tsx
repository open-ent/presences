import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, STAT_TYPES, StatType } from '../api';
import { statCount, statLabel, statTotal } from '../utils';

/**
 * Statistiques de présences — parité IHM AngularJS (CCTP 51C) : indicateur Global de la
 * structure (compteurs par type d'événement + tableau élèves × types), période et types
 * sélectionnables. Les données proviennent du pré-calcul du worker statistics-presences.
 */
export function Statistiques() {
  const { t } = useTranslation(['statistics-presences', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const [start, setStart] = useState('2025-09-01');
  const [end, setEnd] = useState('2026-07-31');
  const [types, setTypes] = useState<StatType[]>(['UNREGULARIZED', 'REGULARIZED', 'NO_REASON', 'LATENESS']);
  const [page, setPage] = useState(0);

  const toggleType = (ty: StatType) =>
    setTypes((prev) => (prev.includes(ty) ? prev.filter((x) => x !== ty) : [...prev, ty]));

  const query = useQuery({
    queryKey: ['stats-pres', 'global', structureId, start, end, [...types].sort().join(','), page],
    queryFn: () => api.getGlobalStats(structureId, start, end, types, page),
    enabled: !!structureId && types.length > 0,
  });

  const rows = query.data?.data ?? [];
  const count = query.data?.count ?? {};

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('statistics.title', { defaultValue: 'Statistiques' })}</h1>
        <div className="alert alert-info" role="alert">{t('statistics.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">{t('statistics.title', { defaultValue: 'Statistiques de présences' })}</h1>

      {/* Filtres : période + types d'événement */}
      <div className="d-flex gap-12 align-items-end flex-wrap mb-12">
        <div>
          <label htmlFor="sp-start" className="form-label">{t('statistics.from', { defaultValue: 'Du' })}</label>
          <input id="sp-start" type="date" className="form-control" value={start} onChange={(e) => { setStart(e.target.value); setPage(0); }} />
        </div>
        <div>
          <label htmlFor="sp-end" className="form-label">{t('statistics.to', { defaultValue: 'Au' })}</label>
          <input id="sp-end" type="date" className="form-control" value={end} onChange={(e) => { setEnd(e.target.value); setPage(0); }} />
        </div>
      </div>
      <div className="d-flex gap-12 flex-wrap mb-16">
        {STAT_TYPES.map((ty) => (
          <label key={ty} className="d-flex align-items-center gap-8 m-0" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={types.includes(ty)} onChange={() => { toggleType(ty); setPage(0); }} />
            {statLabel(ty)}
          </label>
        ))}
      </div>

      {/* Compteurs globaux */}
      <div className="d-flex gap-16 flex-wrap mb-24">
        {Object.entries(count).map(([k, v]) => (
          <div key={k} className="card p-16 text-center" style={{ minWidth: 160, flexGrow: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{v}</div>
            <div className="text-muted">{statLabel(k)}</div>
          </div>
        ))}
      </div>

      {query.isLoading && <p>{t('statistics.loading', { defaultValue: 'Chargement…' })}</p>}
      {query.isError && <div className="alert alert-warning" role="alert">{t('statistics.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {types.length === 0 && <p className="text-muted">{t('statistics.no.type', { defaultValue: 'Sélectionnez au moins un type d’événement.' })}</p>}

      {/* Tableau élèves × types */}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('statistics.student', { defaultValue: 'Élève' })}</th>
                <th>{t('statistics.class', { defaultValue: 'Classe' })}</th>
                {types.map((ty) => <th key={ty} className="text-center">{statLabel(ty)}</th>)}
                <th className="text-center">{t('statistics.total', { defaultValue: 'Total' })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.name ?? '—'}</td>
                  <td>{s.audience ?? '—'}</td>
                  {types.map((ty) => <td key={ty} className="text-center">{statCount(s.statistics?.[ty])}</td>)}
                  <td className="text-center"><strong>{statTotal(s.statistics)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="d-flex gap-8 align-items-center mt-12">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          {t('statistics.prev', { defaultValue: '← Précédent' })}
        </button>
        <span className="text-muted">{t('statistics.page', { defaultValue: 'Page' })} {page + 1}</span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={rows.length === 0} onClick={() => setPage((p) => p + 1)}>
          {t('statistics.next', { defaultValue: 'Suivant →' })}
        </button>
      </div>
    </div>
  );
}

export default Statistiques;
