import { useEdificeClient } from '@open-ent/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { AudienceSearch, PickedAudience } from '../components/AudienceSearch';
import { QueryErrors } from '../components/QueryErrors';
import { canNotify, CourseFilters, courseDays, courseGroups, coursesExportUrl, coursesUrl, ListedCourse, mergeCourses, PAGE, registerLink } from '../courseList';
import { useRights } from '../rights';
import { useStructure } from '../structure';
import { dateFr, heure, jour } from '../utils';

/**
 * Liste des appels (parité IHM AngularJS) : cours d'une période avec l'état de leur appel, filtrés par enseignants,
 * classes, appels oubliés et présence d'un enseignant ; relance de l'enseignant d'un appel oublié ; export CSV ; un clic
 * ouvre le registre du cours.
 */
export function ListeAppels() {
  const { t } = useTranslation(['presences', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const rights = useRights();
  const today = jour(new Date());

  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>([]);
  const [teacherText, setTeacherText] = useState('');
  const [teacherTerm, setTeacherTerm] = useState('');
  const [groups, setGroups] = useState<PickedAudience[]>([]);
  const [forgotten, setForgotten] = useState(true);
  const [withTeacher, setWithTeacher] = useState(true);
  const [notified, setNotified] = useState<Set<string>>(new Set());

  const filters: CourseFilters = { structureId, start, end, teacherIds: teachers.map((x) => x.id), groupNames: groups.map((g) => g.name), forgotten, withTeacher };
  const listQuery = useInfiniteQuery({
    queryKey: ['pres', 'course-list', structureId, coursesUrl(filters, 0)],
    queryFn: ({ pageParam }) => api.getCourseList(coursesUrl(filters, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length >= PAGE ? all.length * PAGE : undefined),
    enabled: !!structureId,
  });
  const courses = (listQuery.data?.pages ?? []).reduce<ListedCourse[]>((acc, p) => mergeCourses(acc, p), []);
  const days = courseDays(courses);

  useEffect(() => { const h = setTimeout(() => setTeacherTerm(teacherText.trim()), 250); return () => clearTimeout(h); }, [teacherText]);
  const staffQuery = useQuery({ queryKey: ['pres', 'staff-search', structureId, teacherTerm], queryFn: () => api.searchStaff(structureId, teacherTerm), enabled: !!structureId && teacherTerm.length >= 2 });
  const choices = useMemo(() => (staffQuery.data ?? []).filter((x) => !teachers.some((y) => y.id === x.id)).slice(0, 10), [staffQuery.data, teachers]);

  const notifyMut = useMutation({
    mutationFn: (c: ListedCourse) => api.notifyCourse(c),
    onSuccess: (_r, c) => { setNotified((n) => new Set(n).add(`${c.id}|${c.startDate}`)); qc.invalidateQueries({ queryKey: ['pres', 'course-list'] }); },
  });

  if (init && !structureId) return <div className="alert alert-info" role="alert">{t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>;

  const now = new Date();
  return (
    <div>
      <h1 className="mb-16">{t('presences.register.list.title', { defaultValue: 'Liste des appels' })}</h1>
      <QueryErrors queries={[listQuery]} />

      <div className="d-flex gap-24 flex-wrap mb-12">
        <div style={{ minWidth: 260 }}>
          <label htmlFor="la-teacher" className="form-label">{t('presences.search.teacher', { defaultValue: 'Rechercher un enseignant' })}</label>
          <input id="la-teacher" className="form-control" value={teacherText} onChange={(e) => setTeacherText(e.target.value)} autoComplete="off" />
          {teacherText.trim().length >= 2 && choices.length > 0 && (
            <ul className="list-unstyled border mb-0" data-teacher-results>
              {choices.map((x) => <li key={x.id}><button type="button" className="btn btn-link" data-pick-teacher={x.id} onClick={() => { setTeachers([...teachers, { id: x.id, name: x.displayName }]); setTeacherText(''); setTeacherTerm(''); }}>{x.displayName}</button></li>)}
            </ul>
          )}
          <div className="d-flex gap-8 flex-wrap mt-8" data-chosen-teachers>
            {teachers.map((x) => <span key={x.id} className="badge bg-secondary">{x.name} <button type="button" className="btn btn-link p-0" aria-label={`Retirer ${x.name}`} onClick={() => setTeachers(teachers.filter((y) => y.id !== x.id))}>×</button></span>)}
          </div>
        </div>
        <div style={{ minWidth: 260 }}>
          <AudienceSearch id="la-class" label={t('presences.search.class', { defaultValue: 'Rechercher une classe' })} structureId={structureId} selected={groups} onChange={setGroups} />
        </div>
      </div>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-12">
        <div>
          <label htmlFor="la-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="la-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="la-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="la-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="d-flex gap-8">
          <button type="button" className={`btn btn-sm ${forgotten ? 'btn-primary' : 'btn-outline-secondary'}`} data-forgotten aria-pressed={forgotten} onClick={() => setForgotten(!forgotten)}>{t('presences.register.forgotten', { defaultValue: 'Appels oubliés' })}</button>
          <button type="button" className={`btn btn-sm ${!withTeacher ? 'btn-primary' : 'btn-outline-secondary'}`} data-no-teacher aria-pressed={!withTeacher} onClick={() => setWithTeacher(!withTeacher)}>{t('presences.register.disable.without.teacher', { defaultValue: 'Inclure les cours sans enseignant' })}</button>
        </div>
        {rights.exportCourses && (
          <a className={`btn btn-outline-primary ms-auto${courses.length === 0 ? ' disabled' : ''}`} data-export aria-disabled={courses.length === 0} href={courses.length === 0 ? undefined : coursesExportUrl(filters, String(Date.now()))}>{t('presences.export.tocsv', { defaultValue: 'Exporter (CSV)' })}</a>
        )}
      </div>

      {notifyMut.isError && <div className="alert alert-warning" role="alert" data-notify-error>{t('presences.register.notify.err', { defaultValue: "La relance de l'enseignant a échoué." })}</div>}
      {listQuery.isLoading && <p>{t('presences.register.loading.text', { defaultValue: 'Chargement…' })}</p>}
      {!listQuery.isLoading && !listQuery.isError && courses.length === 0 && <p className="text-muted" data-empty>{t('presences.registers.empty', { defaultValue: 'Aucun appel sur la période.' })}</p>}
      {days.map((d) => (
        <section key={d.day} className="mb-16" data-day={d.day}>
          <h2 style={{ fontSize: 16 }} className="mb-8">{dateFr(d.day)}</h2>
          <div className="d-flex gap-12 flex-wrap">
            {d.items.map((c) => {
              const key = `${c.id}|${c.startDate}`;
              const bell = canNotify(c, now, rights.notifyTeacher);
              const done = c.register_state_id === 3;
              return (
                <div key={key} className="card p-12" style={{ minWidth: 240 }} data-course={c.id}>
                  <div className="d-flex justify-content-between">
                    <strong>{heure(c.startDate)} – {heure(c.endDate)}</strong>
                    {bell && (
                      <button type="button" className="btn btn-link p-0" data-notify={c.id} title={t('presences.register.notify', { defaultValue: "Relancer l'enseignant" })} aria-label={t('presences.register.notify', { defaultValue: "Relancer l'enseignant" })} disabled={notifyMut.isPending || c.notified === true || notified.has(key)} onClick={() => notifyMut.mutate(c)}>
                        {c.notified || notified.has(key) ? '🔔✓' : '🔔'}
                      </button>
                    )}
                  </div>
                  <div>{(c.teachers ?? []).map((x) => x.displayName).filter(Boolean).join(', ')}</div>
                  <em className="text-muted">{c.subjectName}</em>
                  <div>{courseGroups(c).join(', ')}</div>
                  <div data-state>{done ? t('presences.register.state.done', { defaultValue: 'Appel terminé' }) : c.register_state_id === 2 ? t('presences.register.state.progress', { defaultValue: 'Appel en cours' }) : t('presences.register.state.todo', { defaultValue: 'Appel à faire' })}</div>
                  {rights.readRegister && <a href={registerLink(c)} data-open={c.id}>{t('presences.register.open', { defaultValue: "Ouvrir l'appel" })}</a>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {listQuery.hasNextPage && (
        <div className="text-center my-12"><button type="button" className="btn btn-outline-primary" data-more disabled={listQuery.isFetchingNextPage} onClick={() => listQuery.fetchNextPage()}>{t('presences.more', { defaultValue: 'Afficher la suite' })}</button></div>
      )}
    </div>
  );
}

export default ListeAppels;
