import { monthLabel, Series } from '../indicators';
import { statLabel } from '../utils';

const COLORS = ['#2a9d8f', '#e76f51', '#264653', '#e9c46a', '#8d6a9f', '#457b9d', '#c1666b'];

/**
 * Courbes mensuelles (une par type d'événement), en SVG sans dépendance. Le tableau des valeurs est fourni en dessous
 * pour la lecture non visuelle.
 */
export function MonthlyChart({ series, months }: { series: Series[]; months: string[] }) {
  const W = 720, H = 280, L = 40, R = 16, T = 16, B = 36;
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  const x = (i: number) => L + (months.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (months.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  return (
    <div data-monthly-chart>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution mensuelle des événements" style={{ width: '100%', maxWidth: W }}>
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <g key={r}>
            <line x1={L} x2={W - R} y1={y(max * r)} y2={y(max * r)} stroke="#ddd" />
            <text x={L - 6} y={y(max * r) + 4} textAnchor="end" fontSize="11" fill="#555">{Math.round(max * r)}</text>
          </g>
        ))}
        {months.map((m, i) => <text key={m} x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="#555">{monthLabel(m)}</text>)}
        {series.map((s, k) => (
          <g key={s.type} data-series={s.type}>
            <polyline fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth="2" points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {s.points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={COLORS[k % COLORS.length]} />)}
          </g>
        ))}
      </svg>
      <ul className="list-unstyled d-flex gap-16 flex-wrap" data-legend>
        {series.map((s, k) => (
          <li key={s.type}><span style={{ display: 'inline-block', width: 12, height: 12, background: COLORS[k % COLORS.length], marginRight: 6 }} />{statLabel(s.type)}</li>
        ))}
      </ul>
      <table className="table table-sm" data-chart-values>
        <thead><tr><th>Type</th>{months.map((m) => <th key={m} className="text-center">{monthLabel(m)}</th>)}</tr></thead>
        <tbody>{series.map((s) => <tr key={s.type}><td>{statLabel(s.type)}</td>{s.points.map((v, i) => <td key={i} className="text-center">{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default MonthlyChart;
