import { DAY_LABEL, WeeklyGrid as Grid } from '../indicators';

/** Grille hebdomadaire : taux d'absentéisme par créneau et par jour (la valeur la plus haute est mise en évidence). */
export function WeeklyGrid({ grid }: { grid: Grid }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table table-bordered mb-0" data-weekly-grid>
        <thead>
          <tr>
            <th>Créneau</th>
            {grid.days.map((d) => <th key={d} className="text-center">{DAY_LABEL[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {grid.slots.map((s) => (
            <tr key={s._id ?? s.id}>
              <th scope="row">{s.name} <span className="text-muted">{s.startHour.slice(0, 5)}–{s.endHour.slice(0, 5)}</span></th>
              {grid.days.map((d) => {
                const c = grid.cell(d, s);
                return (
                  <td key={d} className={`text-center${c?.max ? ' table-danger fw-bold' : ''}`} data-cell={`${d}-${s._id ?? s.id}`}>
                    {c ? `${c.rate}%` : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default WeeklyGrid;
