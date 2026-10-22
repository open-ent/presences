import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, Course } from '../api';
import { QueryErrors } from '../components/QueryErrors';
import {
  EVENT,
  eventOf,
  nowOnDay,
  REGISTER_STATE,
  RegisterStudent,
  shiftDay,
  sqlDate,
  stateKey,
  summary,
  timeOf,
  withTime,
} from '../register';
import { heure, todayIso } from '../utils';
import { useStructure } from '../structure';

/**
 * Registre d'appel : pour une date, les cours (source EDT) → ouverture de l'appel d'un cours (le registre existant est
 * repris, sinon il est créé) → pour chaque élève : absent, en retard (heure d'arrivée), départ anticipé (heure) et
 * remarque. Chaque action est enregistrée tout de suite ; le registre passe « en cours » à la première saisie et
 * « terminé » avec « Valider l'appel ». Un enseignant voit ses cours par défaut.
 */
export function Registre() {
  const { t } = useTranslation(['presences', 'common']);
  const { user } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const isTeacher = user?.type === 'ENSEIGNANT';

  const [date, setDate] = useState(todayIso());
  const [mineOnly, setMineOnly] = useState<boolean | null>(null);
  const [openCourse, setOpenCourse] = useState<Course | null>(null);
  const [registerId, setRegisterId] = useState<number | null>(null);
  const [remarkOpen, setRemarkOpen] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState(false);
  const filterMine = mineOnly ?? isTeacher;

  const coursesQuery = useQuery({
    queryKey: ['presences', 'courses', structureId, date, filterMine ? user?.userId : null],
    queryFn: () => api.getCourses(structureId, date, filterMine ? user?.userId : undefined),
    enabled: !!structureId && !!date,
  });
  const courses = coursesQuery.data ?? [];

  const registerQuery = useQuery({
    queryKey: ['presences', 'register', registerId],
    queryFn: () => api.getRegister(registerId!),
    enabled: registerId !== null,
  });
  const register = registerQuery.data;
  const students = register?.students ?? [];
  const found = summary(students);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['presences', 'register', registerId] });
    await qc.invalidateQueries({ queryKey: ['presences', 'courses'] });
  };

  const openMut = useMutation({
    mutationFn: (course: Course) =>
      course.register_id
        ? Promise.resolve({ id: course.register_id })
        : api.createRegister(course, structureId, (course.teachers ?? []).map((x) => x.id)),
    onSuccess: (r) => {
      setRegisterId(r.id);
      void qc.invalidateQueries({ queryKey: ['presences', 'courses'] });
    },
  });

  const openAppel = (course: Course) => {
    setOpenCourse(course);
    setRegisterId(null);
    setRemarkOpen(new Set());
    setActionError(false);
    openMut.mutate(course);
  };

  /** Enregistre une action puis relit le registre ; un échec est signalé, jamais passé sous silence. */
  const act = useMutation({
    mutationFn: async (run: () => Promise<void>) => {
      await run();
      // Première saisie : le registre passe « en cours » (l'appel oublié disparaît de la liste des oublis à terme).
      if (registerId !== null && (register?.state_id ?? REGISTER_STATE.TODO) === REGISTER_STATE.TODO) {
        await api.setRegisterStatus(registerId, REGISTER_STATE.IN_PROGRESS);
      }
    },
    onMutate: () => setActionError(false),
    onError: () => setActionError(true),
    onSettled: () => void refresh(),
  });

  const body = (s: RegisterStudent, typeId: number, startDate: string, endDate: string, comment?: string) => ({
    registerId: registerId!,
    studentId: s.id,
    typeId,
    startDate,
    endDate,
    comment,
    counsellorInput: !isTeacher,
  });
  const rStart = sqlDate(register?.start_date);
  const rEnd = sqlDate(register?.end_date);
  const drop = (s: RegisterStudent, ...types: number[]) =>
    Promise.all(types.map((ty) => eventOf(s, ty)).filter((e) => !!e).map((e) => api.deleteEvent(e!.id))).then(() => undefined);

  const toggleAbsence = (s: RegisterStudent) =>
    act.mutate(async () => {
      const existing = eventOf(s, EVENT.ABSENCE);
      if (existing) return api.deleteEvent(existing.id);
      // Un élève absent n'est ni en retard ni parti plus tôt.
      await drop(s, EVENT.LATENESS, EVENT.DEPARTURE);
      await api.createEvent(body(s, EVENT.ABSENCE, rStart, rEnd));
    });
  const toggleLateness = (s: RegisterStudent) =>
    act.mutate(async () => {
      const existing = eventOf(s, EVENT.LATENESS);
      if (existing) return api.deleteEvent(existing.id);
      await drop(s, EVENT.ABSENCE);
      await api.createEvent(body(s, EVENT.LATENESS, rStart, nowOnDay(register?.start_date)));
    });
  const toggleDeparture = (s: RegisterStudent) =>
    act.mutate(async () => {
      const existing = eventOf(s, EVENT.DEPARTURE);
      if (existing) return api.deleteEvent(existing.id);
      await drop(s, EVENT.ABSENCE);
      await api.createEvent(body(s, EVENT.DEPARTURE, nowOnDay(register?.start_date), rEnd));
    });
  const setLatenessTime = (s: RegisterStudent, hhmm: string) =>
    act.mutate(async () => {
      const existing = eventOf(s, EVENT.LATENESS);
      if (existing && hhmm) await api.updateEvent(existing.id, body(s, EVENT.LATENESS, rStart, withTime(register?.start_date, hhmm)));
    });
  const setDepartureTime = (s: RegisterStudent, hhmm: string) =>
    act.mutate(async () => {
      const existing = eventOf(s, EVENT.DEPARTURE);
      if (existing && hhmm) await api.updateEvent(existing.id, body(s, EVENT.DEPARTURE, withTime(register?.start_date, hhmm), rEnd));
    });
  const saveRemark = (s: RegisterStudent, text: string) =>
    act.mutate(async () => {
      const existing = eventOf(s, EVENT.REMARK);
      const comment = text.trim();
      if (!comment) {
        if (existing) await api.deleteEvent(existing.id);
        return;
      }
      if (existing) {
        if ((existing.comment ?? '') !== comment) await api.updateEvent(existing.id, body(s, EVENT.REMARK, rStart, rEnd, comment));
      } else await api.createEvent(body(s, EVENT.REMARK, rStart, rEnd, comment));
    });

  const validate = useMutation({
    mutationFn: () => api.setRegisterStatus(registerId!, REGISTER_STATE.DONE),
    onSettled: () => void refresh(),
  });
  const done = register?.state_id === REGISTER_STATE.DONE;

  const changeDay = (next: string) => {
    setDate(next);
    setOpenCourse(null);
    setRegisterId(null);
  };

  const stateLabel = (stateId?: number | null) =>
    ({
      done: t('presences.registre.state.done', { defaultValue: 'Appel fait' }),
      inProgress: t('presences.registre.state.progress', { defaultValue: 'En cours' }),
      todo: t('presences.registre.state.todo', { defaultValue: 'À faire' }),
    })[stateKey(stateId)];

  return (
    <div>
      <h1 className="mb-16">{t('presences.registre.title', { defaultValue: "Registre d'appel" })}</h1>
      <QueryErrors queries={[coursesQuery, registerQuery]} />

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <button type="button" className="btn btn-outline-secondary" aria-label={t('presences.registre.previous.day', { defaultValue: 'Jour précédent' })} onClick={() => changeDay(shiftDay(date, -1))} data-day-prev>
          ←
        </button>
        <div style={{ maxWidth: 200 }}>
          <label htmlFor="reg-date" className="form-label">{t('presences.registre.date', { defaultValue: 'Date' })}</label>
          <input id="reg-date" type="date" className="form-control" value={date} onChange={(e) => changeDay(e.target.value)} />
        </div>
        <button type="button" className="btn btn-outline-secondary" aria-label={t('presences.registre.next.day', { defaultValue: 'Jour suivant' })} onClick={() => changeDay(shiftDay(date, 1))} data-day-next>
          →
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={() => changeDay(todayIso())}>
          {t('presences.registre.today', { defaultValue: "Aujourd'hui" })}
        </button>
        <div className="form-check mb-8">
          <input id="reg-mine" type="checkbox" className="form-check-input" checked={filterMine} onChange={(e) => setMineOnly(e.target.checked)} />
          <label htmlFor="reg-mine" className="form-check-label">{t('presences.registre.mine', { defaultValue: 'Mes cours seulement' })}</label>
        </div>
      </div>

      <div className="d-flex gap-16 flex-wrap align-items-start">
        {/* Cours du jour */}
        <section className="card p-16" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 16 }} className="mb-12">{t('presences.registre.courses', { defaultValue: 'Cours du jour' })}</h2>
          {coursesQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!coursesQuery.isLoading && !coursesQuery.isError && courses.length === 0 && (
            <p className="text-muted mb-0">{t('presences.registre.nocourse', { defaultValue: 'Aucun cours ce jour.' })}</p>
          )}
          <ul className="list-unstyled mb-0">
            {courses.map((c) => (
              <li key={c.id} className="py-8 border-bottom d-flex justify-content-between align-items-center gap-12" data-course={c.id}>
                <span>
                  <strong>{heure(c.startDate)}–{heure(c.endDate)}</strong>{' '}
                  {c.subjectName ?? c.subjectId} · {(c.classes ?? []).join(', ')}
                  {c.roomLabels && c.roomLabels.length > 0 && <span className="text-muted"> · {c.roomLabels.join(', ')}</span>}
                  {c.register_id ? <span className="badge bg-secondary ms-8">{stateLabel(c.register_state_id)}</span> : null}
                </span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openAppel(c)} data-open-call>
                  {c.register_id ? t('presences.registre.resume', { defaultValue: "Reprendre l'appel" }) : t('presences.registre.doCall', { defaultValue: "Faire l'appel" })}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Appel du cours ouvert */}
        {openCourse && (
          <section className="card p-16 flex-grow-1" style={{ minWidth: 340 }} data-register>
            <h2 style={{ fontSize: 16 }} className="mb-4">
              {t('presences.registre.call', { defaultValue: 'Appel' })} · {(openCourse.classes ?? []).join(', ')}
              {done && <span className="badge bg-success ms-8">{stateLabel(REGISTER_STATE.DONE)}</span>}
            </h2>
            <p className="text-muted" style={{ fontSize: 13 }}>
              {heure(openCourse.startDate)}–{heure(openCourse.endDate)} · {openCourse.subjectName ?? openCourse.subjectId}
            </p>

            {openMut.isPending && <p>{t('presences.registre.opening', { defaultValue: "Ouverture de l'appel…" })}</p>}
            {openMut.isError && (
              <div className="alert alert-danger" role="alert">
                {t('presences.registre.open.error', { defaultValue: "L'appel n'a pas pu être ouvert : rien n'a été enregistré. Réessayez." })}
              </div>
            )}
            {actionError && (
              <div className="alert alert-danger" role="alert" data-action-error>
                {t('presences.registre.action.error', { defaultValue: "Cette saisie n'a pas pu être enregistrée. La liste a été relue : vérifiez l'état de l'élève puis recommencez." })}
              </div>
            )}
            {validate.isError && (
              <div className="alert alert-danger" role="alert">
                {t('presences.registre.validate.error', { defaultValue: "L'appel n'a pas pu être validé. Réessayez." })}
              </div>
            )}
            {registerQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}

            {register && (
              <>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  {t('presences.registre.hint2', { defaultValue: 'Pointez les absences, retards, départs et remarques. Les autres élèves sont comptés présents.' })}
                </p>
                <p role="status" data-summary>
                  {found.absent} {t('presences.registre.absents', { defaultValue: 'absent(s)' })} · {found.late} {t('presences.registre.lates', { defaultValue: 'retard(s)' })} · {found.departed}{' '}
                  {t('presences.registre.departures', { defaultValue: 'départ(s)' })} · {found.remarks} {t('presences.registre.remarks', { defaultValue: 'remarque(s)' })}
                </p>
                <ul className="list-unstyled mb-12">
                  {students.map((s) => {
                    const absent = eventOf(s, EVENT.ABSENCE);
                    const late = eventOf(s, EVENT.LATENESS);
                    const left = eventOf(s, EVENT.DEPARTURE);
                    const remark = eventOf(s, EVENT.REMARK);
                    const showRemark = remarkOpen.has(s.id) || !!remark;
                    const btn = (on: boolean, color: string) => `btn btn-sm btn-${on ? color : 'outline-secondary'}`;
                    return (
                      <li key={s.id} className="py-8 border-bottom" data-student={s.id}>
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-8">
                          <span>
                            {s.name}
                            {s.exempted && <span className="badge bg-info ms-8">{t('presences.registre.exempted', { defaultValue: 'Dispensé(e)' })}</span>}
                            {s.last_course_absent && <span className="badge bg-warning text-dark ms-8">{t('presences.registre.last.absent', { defaultValue: 'Absent au cours précédent' })}</span>}
                          </span>
                          <span className="d-flex gap-4 flex-wrap">
                            <button type="button" className={btn(!!absent, 'danger')} aria-pressed={!!absent} disabled={act.isPending} onClick={() => toggleAbsence(s)} data-act="absence">
                              {t('presences.registre.absent', { defaultValue: 'Absent' })}
                            </button>
                            <button type="button" className={btn(!!late, 'warning')} aria-pressed={!!late} disabled={act.isPending} onClick={() => toggleLateness(s)} data-act="lateness">
                              {t('presences.registre.late', { defaultValue: 'Retard' })}
                            </button>
                            <button type="button" className={btn(!!left, 'warning')} aria-pressed={!!left} disabled={act.isPending} onClick={() => toggleDeparture(s)} data-act="departure">
                              {t('presences.registre.departure', { defaultValue: 'Départ' })}
                            </button>
                            <button
                              type="button"
                              className={btn(showRemark, 'primary')}
                              aria-pressed={showRemark}
                              onClick={() => setRemarkOpen((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                              data-act="remark"
                            >
                              {t('presences.registre.remark', { defaultValue: 'Remarque' })}
                            </button>
                          </span>
                        </div>
                        {(late || left) && (
                          <div className="d-flex gap-12 mt-8 flex-wrap">
                            {late && (
                              <label className="d-flex align-items-center gap-8">
                                {t('presences.registre.arrival', { defaultValue: 'Arrivée à' })}
                                <input type="time" className="form-control form-control-sm" style={{ width: 120 }} defaultValue={timeOf(late.end_date)} key={`l-${late.id}-${late.end_date}`} onBlur={(e) => e.target.value !== timeOf(late.end_date) && setLatenessTime(s, e.target.value)} data-time="lateness" />
                              </label>
                            )}
                            {left && (
                              <label className="d-flex align-items-center gap-8">
                                {t('presences.registre.leaving', { defaultValue: 'Départ à' })}
                                <input type="time" className="form-control form-control-sm" style={{ width: 120 }} defaultValue={timeOf(left.start_date)} key={`d-${left.id}-${left.start_date}`} onBlur={(e) => e.target.value !== timeOf(left.start_date) && setDepartureTime(s, e.target.value)} data-time="departure" />
                              </label>
                            )}
                          </div>
                        )}
                        {showRemark && (
                          <div className="mt-8">
                            <label className="visually-hidden" htmlFor={`rem-${s.id}`}>{t('presences.registre.remark', { defaultValue: 'Remarque' })} {s.name}</label>
                            <input
                              id={`rem-${s.id}`}
                              className="form-control form-control-sm"
                              placeholder={t('presences.registre.remark.placeholder', { defaultValue: 'Remarque sur cet élève (enregistrée en quittant le champ)' })}
                              defaultValue={remark?.comment ?? ''}
                              key={`r-${remark?.id ?? 'new'}-${remark?.comment ?? ''}`}
                              maxLength={250}
                              onBlur={(e) => saveRemark(s, e.target.value)}
                              data-remark={s.id}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <button type="button" className="btn btn-primary" disabled={validate.isPending || done} onClick={() => validate.mutate()} data-validate>
                  {done ? t('presences.registre.validated', { defaultValue: 'Appel validé' }) : t('presences.registre.validate', { defaultValue: "Valider l'appel" })}
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default Registre;
