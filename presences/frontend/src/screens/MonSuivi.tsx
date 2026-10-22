import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, STUDENT_EVENT_TYPES, StudentEvent, StudentEventType } from '../api';
import { QueryErrors } from '../components/QueryErrors';
import { StatementForm } from '../components/StatementForm';
import { useRights } from '../rights';
import { useStructure } from '../structure';
import { dateFr, heure, schoolYear } from '../utils';

/** Profils « famille » : élève (`ELEVE`) et responsable (`PERSRELELEVE`). */
export const isFamilyProfile = (type?: string) => type === 'ELEVE' || type === 'PERSRELELEVE';

const LABELS: Record<StudentEventType, { key: string; fallback: string }> = {
  NO_REASON: { key: 'presences.student.no.reason', fallback: 'Absences sans motif' },
  UNREGULARIZED: { key: 'presences.student.unregularized', fallback: 'Absences justifiées, non régularisées' },
  REGULARIZED: { key: 'presences.student.regularized', fallback: 'Absences justifiées, régularisées' },
  LATENESS: { key: 'presences.student.lateness', fallback: 'Retards' },
  DEPARTURE: { key: 'presences.student.departure', fallback: 'Départs anticipés' },
};

const reasonOf = (e: StudentEvent) => (typeof e.reason === 'string' ? e.reason : (e.reason?.label ?? ''));

/**
 * Suivi de la présence de l'élève (vue de l'élève ou de son responsable, comme le tableau de bord de l'IHM AngularJS) :
 * pour une période, le nombre d'événements par catégorie et leur détail. Un responsable choisit d'abord son enfant.
 */
export function MonSuivi() {
  const { t } = useTranslation(['presences', 'common']);
  const { user } = useEdificeClient();
  const { structureId } = useStructure();
  const isParent = user?.type === 'PERSRELELEVE';
  const rights = useRights();
  const year = schoolYear();
  const [start, setStart] = useState(year.start);
  const [end, setEnd] = useState(year.end);
  const [childId, setChildId] = useState('');

  const childrenQuery = useQuery({ queryKey: ['pres', 'children', user?.userId], queryFn: () => api.getChildren(user!.userId), enabled: isParent && !!user?.userId });
  const children = childrenQuery.data ?? [];
  useEffect(() => {
    if (isParent && !childId && children.length > 0) setChildId(children[0].id);
  }, [isParent, childId, children]);
  const studentId = isParent ? childId : (user?.userId ?? '');

  const eventsQuery = useQuery({
    queryKey: ['pres', 'student-events', structureId, studentId, start, end],
    queryFn: () => api.getStudentEvents(structureId, studentId, start, end),
    enabled: !!structureId && !!studentId,
  });
  const events = eventsQuery.data;

  return (
    <div>
      <h1 className="mb-16">{t('presences.student.title', { defaultValue: 'Mon suivi de présence' })}</h1>
      <QueryErrors queries={[eventsQuery, ...(isParent ? [childrenQuery] : [])]} />

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        {isParent && (
          <div>
            <label htmlFor="student-child" className="form-label">{t('presences.student.child', { defaultValue: 'Enfant' })}</label>
            <select id="student-child" className="form-select" value={childId} onChange={(e) => setChildId(e.target.value)} data-child-select>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="student-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="student-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="student-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="student-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {isParent && !childrenQuery.isLoading && !childrenQuery.isError && children.length === 0 && (
        <p className="text-muted">{t('presences.student.no.child', { defaultValue: 'Aucun enfant n’est rattaché à votre compte.' })}</p>
      )}
      {eventsQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}

      {events && (
        <div className="d-flex gap-16 flex-wrap align-items-start" data-student-events>
          {STUDENT_EVENT_TYPES.map((type) => {
            const list = events.all[type] ?? [];
            const total = events.totals[type] ?? list.length;
            return (
              <section key={type} className="card p-16 flex-grow-1" style={{ minWidth: 280 }} data-event-type={type}>
                <h2 style={{ fontSize: 16 }} className="mb-12">
                  {t(LABELS[type].key, { defaultValue: LABELS[type].fallback })} <span className="badge bg-secondary" data-total>{total}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="text-muted mb-0">{t('presences.student.none', { defaultValue: 'Aucun événement sur la période.' })}</p>
                ) : (
                  <ul className="list-unstyled mb-0">
                    {list.map((e, i) => (
                      <li key={e.id ?? i} className="py-4 border-bottom">
                        {dateFr(e.start_date ?? '')} {heure(e.start_date)}{e.end_date ? `–${heure(e.end_date)}` : ''}
                        {reasonOf(e) && <span className="text-muted"> · {reasonOf(e)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      {isParent && rights.createStatement && childId && (
        <StatementForm structureId={structureId} studentId={childId} studentName={children.find((c) => c.id === childId)?.displayName ?? ''} />
      )}
    </div>
  );
}

export default MonSuivi;
