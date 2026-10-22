import { Fragment, useState } from 'react';

import { MonthlyAudience, monthLabel, monthStat, MonthStat } from '../indicators';

/** Tableau mensuel : une ligne par classe (dépliable en élèves), une colonne par mois, un total. */
export function MonthlyTable({ data, months, hourDetail, showSlots, startOpen }: { data: MonthlyAudience[]; months: string[]; hourDetail: boolean; showSlots: boolean; startOpen: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (a: string) => open[a] ?? startOpen;
  const cell = (stat: MonthStat | null) =>
    stat && stat.count > 0 ? (
      <>
        {stat.count}
        {hourDetail && showSlots && stat.slots && stat.slots > 0 ? <em className="text-muted"> ({stat.slots} créneaux)</em> : null}
      </>
    ) : (
      '-'
    );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table table-bordered mb-0" data-monthly-table>
        <thead>
          <tr>
            <th>Classes / élèves</th>
            {months.map((m) => <th key={m} className="text-center">{monthLabel(m)}</th>)}
            <th className="text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.filter((a) => a.students.length > 0).map((a) => (
            <Fragment key={a.audience}>
              <tr data-audience={a.audience}>
                <td>
                  <button type="button" className="btn btn-link p-0" aria-expanded={isOpen(a.audience)} onClick={() => setOpen({ ...open, [a.audience]: !isOpen(a.audience) })}>
                    {isOpen(a.audience) ? '▾' : '▸'} {a.audience}
                  </button>
                </td>
                {months.map((m) => {
                  const s = monthStat(a.months, m);
                  return <td key={m} className={`text-center${s?.max ? ' table-danger' : ''}`}>{cell(s)}</td>;
                })}
                <td className="text-center"><strong>{a.total ?? 0}</strong></td>
              </tr>
              {isOpen(a.audience) && a.students.map((st) => (
                <tr key={`${a.audience}-${st.name}`} data-student-row>
                  <td className="ps-24">{st.name}</td>
                  {months.map((m) => {
                    const s = monthStat(st.months, m);
                    return <td key={m} className={`text-center${s?.max ? ' table-danger' : ''}`}>{cell(s)}</td>;
                  })}
                  <td className="text-center">{st.total ?? 0}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default MonthlyTable;
