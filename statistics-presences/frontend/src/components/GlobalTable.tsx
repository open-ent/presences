import type { GlobalResponse } from '../api';
import { absenceSelected, displayCount, EventType, isRateType } from '../indicators';
import { statLabel } from '../utils';

type Row = GlobalResponse['data'][number];

/** Tableau de l'indicateur Global : une ligne de totaux, puis une ligne par élève, avec le mode « taux » des absences. */
export function GlobalTable({
  rows, totals, types, rateMode, hourDetail, onRefresh, busy,
}: {
  rows: Row[];
  totals: Pick<GlobalResponse, 'count' | 'rate' | 'slots'>;
  types: EventType[];
  rateMode: boolean;
  hourDetail: boolean;
  onRefresh: (studentId: string) => void;
  busy: boolean;
}) {
  const withAbsence = absenceSelected(types);
  const columns: string[] = [...(withAbsence ? ['ABSENCE_TOTAL'] : []), ...types];
  const slotsOf = (n?: number) => (hourDetail && n && n > 0 ? <em className="text-muted"> ({n} créneaux)</em> : null);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table table-bordered mb-0" data-global-table>
        <thead>
          <tr>
            <th>Classe</th>
            <th>Élève</th>
            {columns.map((c) => <th key={c} className="text-center" data-col={c}>{c === 'ABSENCE_TOTAL' ? 'Total absences' : statLabel(c)}</th>)}
            <th aria-label="Actualiser" />
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 && (
            <tr className="table-light text-center" data-totals>
              <td colSpan={2} className="text-start">{totals.count?.STUDENTS ?? rows.length} élève(s)</td>
              {columns.map((c) => (
                <td key={c}>
                  {totals.count?.[c] ? <>{displayCount(c, totals.count[c], totals.rate?.[c], rateMode)}{slotsOf(totals.slots?.[c])}</> : '-'}
                </td>
              ))}
              <td />
            </tr>
          )}
          {rows.map((s) => (
            <tr key={s.id} data-student={s.id}>
              <td>{s.audience || '—'}</td>
              <td>{s.name || '—'}</td>
              {columns.map((c) => {
                const st = s.statistics?.[c];
                return (
                  <td key={c} className={`text-center${st?.max ? ' table-danger' : ''}`}>
                    {st ? <>{displayCount(c, st.count, st.rate, rateMode && isRateType(c))}{slotsOf(st.slots)}</> : '-'}
                  </td>
                );
              })}
              <td className="text-center">
                <button type="button" className="btn btn-link p-0" aria-label={`Recalculer les statistiques de ${s.name}`} data-refresh={s.id} disabled={busy} onClick={() => onRefresh(s.id)}>↻</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GlobalTable;
