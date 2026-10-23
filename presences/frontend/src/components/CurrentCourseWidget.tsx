import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { api, Course } from '../api';
import { EVENT, eventOf, REGISTER_STATE, RegisterStudent, sqlDate } from '../register';
import { currentCourse } from '../currentCourse';
import { useMultipleSlot } from '../multipleSlot';
import { jour } from '../utils';

/**
 * Widget « Cours en cours » du tableau de bord (parité IHM AngularJS) : appel rapide du cours de l'enseignant
 * (absence en un clic, recherche d'élève, validation), ouverture du registre complet.
 */
export function CurrentCourseWidget({ structureId }: { structureId: string }) {
  const { t } = useTranslation(['presences', 'common']);
  const { user } = useEdificeClient();
  const qc = useQueryClient();
  const today = jour(new Date());
  const [search, setSearch] = useState('');
  const [registerId, setRegisterId] = useState<number | null>(null);

  const slots = useMultipleSlot(structureId);
  const coursesQuery = useQuery({
    queryKey: ['pres', 'widget-course', structureId, today, user?.userId, slots.value],
    queryFn: () => api.getCourses(structureId, today, user?.userId, slots.value),
    enabled: !!structureId && !!user?.userId && slots.ready,
  });
  const course = currentCourse(coursesQuery.data ?? []);

  // Le registre du cours est créé à la première ouverture du widget, comme le fait l'AngularJS.
  const openQuery = useQuery({
    queryKey: ['pres', 'widget-course-register', course?.id],
    queryFn: async () => {
      const r = course!.register_id ? { id: course!.register_id } : await api.createRegister(course!, structureId, (course!.teachers ?? []).map((x) => x.id));
      setRegisterId(r.id);
      return r.id;
    },
    enabled: !!course,
  });
  const id = registerId ?? openQuery.data ?? null;
  const registerQuery = useQuery({ queryKey: ['pres', 'widget-register', id], queryFn: () => api.getRegister(id!), enabled: id !== null });
  const register = registerQuery.data;
  const students: RegisterStudent[] = [...(register?.students ?? [])]
    .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

  const refresh = () => qc.invalidateQueries({ queryKey: ['pres', 'widget-register', id] });
  const toggle = useMutation({
    mutationFn: async (s: RegisterStudent) => {
      const existing = eventOf(s, EVENT.ABSENCE);
      if (existing) await api.deleteEvent(existing.id);
      else {
        // Un élève absent n'est ni en retard ni parti plus tôt.
        for (const ty of [EVENT.LATENESS, EVENT.DEPARTURE]) { const e = eventOf(s, ty); if (e) await api.deleteEvent(e.id); }
        await api.createEvent({ registerId: id!, studentId: s.id, typeId: EVENT.ABSENCE, startDate: sqlDate(register?.start_date), endDate: sqlDate(register?.end_date), counsellorInput: false });
      }
      if ((register?.state_id ?? REGISTER_STATE.TODO) === REGISTER_STATE.TODO) await api.setRegisterStatus(id!, REGISTER_STATE.IN_PROGRESS);
    },
    onSettled: refresh,
  });
  const validate = useMutation({ mutationFn: () => api.setRegisterStatus(id!, REGISTER_STATE.DONE), onSettled: refresh });

  return (
    <section className="card p-16 mb-24" data-current-course-widget>
      <h2 style={{ fontSize: 18 }} className="mb-12">{t('presences.widgets.current.course', { defaultValue: 'Cours en cours' })}</h2>
      {(coursesQuery.isError || openQuery.isError || registerQuery.isError) && <div className="alert alert-warning" role="alert" data-load-error>{t('presences.current.course.failed', { defaultValue: 'Impossible de charger le cours en cours.' })}</div>}
      {(toggle.isError || validate.isError) && <div className="alert alert-warning" role="alert" data-action-error>{t('presences.error', { defaultValue: "L'opération a échoué." })}</div>}
      {!coursesQuery.isLoading && !course && <p className="text-muted" data-empty>{t('presences.register.empty.state', { defaultValue: "Aucun cours en cours pour l'instant." })}</p>}
      {course && register && (
        <div data-current-course={course.id}>
          <p className="mb-8"><strong>{course.subjectName ?? t('presences.course', { defaultValue: 'Cours' })}</strong> — {(course.classes ?? course.groups ?? []).join(', ')}</p>
          <input className="form-control mb-8" aria-label={t('presences.exemptions.search.student', { defaultValue: 'Rechercher un élève' })} placeholder={t('presences.exemptions.search.student', { defaultValue: 'Rechercher un élève' })} value={search} onChange={(e) => setSearch(e.target.value)} data-student-search />
          <ul className="list-unstyled mb-12" data-student-list>
            {students.map((s) => {
              const absent = !!eventOf(s, EVENT.ABSENCE);
              return (
                <li key={s.id} className="d-flex align-items-center gap-12 py-4" data-student={s.id}>
                  <button type="button" className={`btn btn-sm ${absent ? 'btn-danger' : 'btn-outline-secondary'}`} aria-pressed={absent} disabled={toggle.isPending || !!s.exempted} onClick={() => toggle.mutate(s)} data-act="absence">
                    {absent ? t('presences.absent', { defaultValue: 'Absent' }) : t('presences.present', { defaultValue: 'Présent' })}
                  </button>
                  <span>{s.name}</span>
                  {eventOf(s, EVENT.LATENESS) && <span className="badge bg-warning text-dark">{t('presences.lateness', { defaultValue: 'Retard' })}</span>}
                  {eventOf(s, EVENT.DEPARTURE) && <span className="badge bg-warning text-dark">{t('presences.departure', { defaultValue: 'Départ' })}</span>}
                </li>
              );
            })}
          </ul>
          <div className="d-flex gap-12 align-items-center">
            <button type="button" className="btn btn-primary" disabled={validate.isPending || register.state_id === REGISTER_STATE.DONE} onClick={() => validate.mutate()} data-validate>
              {register.state_id === REGISTER_STATE.DONE ? t('presences.register.done', { defaultValue: 'Appel validé' }) : t('presences.register.validation', { defaultValue: "Valider l'appel" })}
            </button>
            <Link to={`/registre?date=${today}&course=${course.id}`} data-open-register>{t('presences.register.open', { defaultValue: 'Ouvrir le registre' })}</Link>
          </div>
        </div>
      )}
    </section>
  );
}
