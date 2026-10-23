import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, PAGE_SIZE } from '../api';
import { Pager } from '../components/Pager';
import { PickedStudent, StudentSearch } from '../components/StudentSearch';
import { QueryErrors } from '../components/QueryErrors';
import { attachmentUrl, isTreated, statementParams } from '../statements';
import { calendarLink } from '../studentCalendar';
import { useStructure } from '../structure';
import { dateFr, heure, schoolYear, todayIso } from '../utils';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayIso(d);
};

/**
 * Déclarations d'absence des parents (parité IHM AngularJS) : liste filtrée par période, élève et état de traitement,
 * marquage « traitée », pièce jointe, export CSV.
 */
export function Declarations() {
  const { t } = useTranslation(['presences', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();

  const [start, setStart] = useState(daysAgo(7));
  const [end, setEnd] = useState(schoolYear().end);
  const [includeTreated, setIncludeTreated] = useState(false);
  const [students, setStudents] = useState<PickedStudent[]>([]);
  const [page, setPage] = useState(0);

  const filters = { structureId, start, end, studentIds: students.map((x) => x.id), includeTreated };
  const listQuery = useQuery({
    queryKey: ['pres', 'statements-list', structureId, statementParams(filters, page)],
    queryFn: () => api.getStatementsPage(statementParams(filters, page)),
    enabled: !!structureId,
  });
  const treatMut = useMutation({
    mutationFn: (v: { id: number; treated: boolean }) => api.validateStatement(v.id, v.treated),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pres', 'statements-list'] }); qc.invalidateQueries({ queryKey: ['pres', 'statements'] }); },
  });

  const items = listQuery.data?.all ?? [];
  const reset = () => setPage(0);

  if (init && !structureId) {
    return <div className="alert alert-info" role="alert">{t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>;
  }

  return (
    <div>
      <h1 className="mb-16">
        {t('presences.statements.title', { defaultValue: "Déclarations d'absence des parents" })}{' '}
        <span className="text-muted" style={{ fontSize: 14 }}>({items.length})</span>
      </h1>
      <QueryErrors queries={[listQuery]} />

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="st-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="st-start" type="date" className="form-control" value={start} onChange={(e) => { setStart(e.target.value); reset(); }} />
        </div>
        <div>
          <label htmlFor="st-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="st-end" type="date" className="form-control" value={end} onChange={(e) => { setEnd(e.target.value); reset(); }} />
        </div>
        <div>
          <StudentSearch
            id="st-student" label={t('presences.student', { defaultValue: 'Élève' })} structureId={structureId} selected={students}
            onAdd={(x) => { setStudents([...students, x]); reset(); }} onRemove={(x) => { setStudents(students.filter((y) => y.id !== x.id)); reset(); }}
          />
        </div>
        <label className="mb-8">
          <input type="checkbox" data-include-treated checked={includeTreated} onChange={(e) => { setIncludeTreated(e.target.checked); reset(); }} /> {t('presences.statements.show.treated', { defaultValue: 'Afficher aussi les déclarations traitées' })}
        </label>
        <a className={`btn btn-outline-primary ms-auto${items.length === 0 ? ' disabled' : ''}`} data-export aria-disabled={items.length === 0} href={items.length === 0 ? undefined : `/presences/statements/absences/export${statementParams(filters)}`}>
          {t('presences.export.csv', { defaultValue: 'Exporter (CSV)' })}
        </a>
      </div>
      {treatMut.isError && <div className="alert alert-warning" role="alert" data-treat-error>{t('presences.statements.treat.error', { defaultValue: "Le changement d'état a échoué." })}</div>}

      {listQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
        <p className="text-muted" data-empty>{t('presences.statements.empty', { defaultValue: 'Aucune déclaration à traiter.' })}</p>
      )}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('presences.student', { defaultValue: 'Élève' })}</th>
                <th>{t('presences.class', { defaultValue: 'Classe' })}</th>
                <th>{t('presences.absence', { defaultValue: 'Absence' })}</th>
                <th>{t('presences.statements.reason', { defaultValue: 'Motif déclaré' })}</th>
                <th>{t('presences.statements.attachment', { defaultValue: 'Justificatif' })}</th>
                <th className="text-center">{t('presences.statements.treated', { defaultValue: 'Traitée' })}</th>
                <th className="text-center">{t('presences.calendar.view.abbr', { defaultValue: 'Calendrier' })}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} data-statement={s.id}>
                  <td>{s.student?.name ?? s.student?.displayName ?? '—'}</td>
                  <td>{s.student?.className ?? s.student?.classeName ?? '—'}</td>
                  <td>
                    {dateFr(s.start_at)} {heure(s.start_at)} → {dateFr(s.end_at) === dateFr(s.start_at) ? '' : `${dateFr(s.end_at)} `}{heure(s.end_at)}
                  </td>
                  <td>{s.description || '—'}</td>
                  <td>{s.attachment_id ? <a href={attachmentUrl(s)} target="_blank" rel="noreferrer" data-attachment={s.id}>{t('presences.statements.open', { defaultValue: 'Ouvrir' })}</a> : '—'}</td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      data-treated={s.id}
                      aria-label={`${t('presences.statements.treated', { defaultValue: 'Traitée' })} : ${s.student?.name ?? ''}`}
                      checked={isTreated(s)}
                      disabled={treatMut.isPending}
                      onChange={() => treatMut.mutate({ id: s.id, treated: !isTreated(s) })}
                    />
                  </td>
                  <td className="text-center">{s.student?.id ? <a href={calendarLink(s.student.id, s.start_at)} data-calendar-link={s.id}>{t('presences.calendar.view.abbr', { defaultValue: 'Voir' })}</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={items.length >= PAGE_SIZE} onChange={setPage} />
    </div>
  );
}

export default Declarations;
