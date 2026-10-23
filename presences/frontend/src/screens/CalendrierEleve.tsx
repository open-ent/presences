import { useEdificeClient, useHasWorkflow } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { api } from '../api';
import { QueryErrors } from '../components/QueryErrors';
import { StudentSearch } from '../components/StudentSearch';
import { useStructure } from '../structure';
import {
  absencesOf, absencesUrl, addDays, CalCourse, courseBox, courseKey, courseName, coursesOfDay, coursesUrl, courseTone, dayBounds, dayName, eventSummary,
  exemptionLink, hasSaturday, hhmm, isoDay, latenessTimeValid, mondayOf, notebookProgress, presencesUrl, shortComment, stampOf, TONE_COLOR, TONE_LABEL, weekDays, weekLabel,
} from '../studentCalendar';
import { visibleByLabel } from '../utils';

const MANAGE = 'fr.openent.presences.controller.FakeRight|managePresences';
const NOTEBOOK = 'fr.openent.presences.controller.NotebookController|worflowManageForgottenNotebook';
const HEIGHT = 640;

/**
 * Calendrier d'un élève (parité IHM AngularJS) : emploi du temps de la semaine avec, par cours, les absences (couleur
 * selon motif, régularisation, suivi), les événements (retard, départ, remarque), la dispense, l'incident et les
 * punitions ; navigation de semaine en semaine et d'élève en élève dans la classe ; saisie d'une absence sur un cours.
 */
export function CalendrierEleve() {
  const { t } = useTranslation(['presences', 'common']);
  const { user } = useEdificeClient();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { structureId } = useStructure();
  const { studentId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const canManage = useHasWorkflow(MANAGE) === true;
  const canNotebook = useHasWorkflow(NOTEBOOK) === true;

  const today = isoDay(new Date());
  const monday = mondayOf(params.get('date') ?? today);
  const [selected, setSelected] = useState<string | null>(null);
  const [reasonId, setReasonId] = useState('');
  const [lateTime, setLateTime] = useState('');
  const [lateReason, setLateReason] = useState('');
  const [lateComment, setLateComment] = useState('');
  const [notebookDate, setNotebookDate] = useState(isoDay(new Date()));

  const stamp = String(Math.floor(Date.now() / 60000));
  const coursesQuery = useQuery({ queryKey: ['pres', 'cal-courses', structureId, studentId, monday], queryFn: () => api.getCalendarCourses(coursesUrl(structureId, studentId, monday, stamp)), enabled: !!structureId && !!studentId });
  const absencesQuery = useQuery({ queryKey: ['pres', 'cal-absences', structureId, studentId, monday], queryFn: () => api.getCalendarAbsences(absencesUrl(structureId, studentId, monday)), enabled: !!structureId && !!studentId });
  const presencesQuery = useQuery({ queryKey: ['pres', 'cal-presences', structureId, studentId, monday], queryFn: () => api.getCalendarPresences(presencesUrl(structureId, studentId, monday)), enabled: !!structureId && !!studentId });
  const reasonsQuery = useQuery({ queryKey: ['pres', 'reasons', structureId], queryFn: () => api.getReasons(structureId), enabled: !!structureId });
  const classQuery = useQuery({ queryKey: ['pres', 'student-class', structureId, studentId], queryFn: () => api.getStudentClass(structureId, studentId), enabled: !!structureId && !!studentId });
  const classmatesQuery = useQuery({ queryKey: ['pres', 'class-students', classQuery.data?.id], queryFn: () => api.getCalendarGroupStudents(classQuery.data!.id), enabled: !!classQuery.data?.id });

  const courses = coursesQuery.data ?? [];
  const absences = absencesQuery.data ?? [];
  const reasons = visibleByLabel(reasonsQuery.data ?? []).filter((r) => r.reason_type_id === undefined || r.reason_type_id === 1);
  const reasonLabel = (id?: number | null) => reasonsQuery.data?.find((r) => r.id === id)?.label ?? '';
  const classmates = classmatesQuery.data ?? [];
  const idx = classmates.findIndex((s) => s.id === studentId);
  const name = classmates[idx]?.displayName ?? studentId;
  const saturday = hasSaturday(courses, monday);
  const days = weekDays(monday, saturday);
  const bounds = dayBounds(courses);
  const hours = Array.from({ length: (bounds.to - bounds.from) / 60 + 1 }, (_, i) => bounds.from / 60 + i);
  const chosen: CalCourse | undefined = courses.find((c, i) => courseKey(c, i) === selected);
  const chosenAbsences = chosen ? absencesOf(chosen, absences) : [];

  const goWeek = (m: string) => { setParams({ date: m }); setSelected(null); };
  const goStudent = (id: string) => { navigate(`/calendrier/${id}?date=${monday}`); setSelected(null); };
  const choose = (key: string | null) => {
    setSelected(key);
    const c = courses.find((x, i) => courseKey(x, i) === key);
    const late = c?.events?.find((e) => e.type_id === 2);
    setLateTime(late ? hhmm(late.end_date) : c ? hhmm(c.startDate) : '');
    setLateReason(late?.reason_id ? String(late.reason_id) : '');
    setLateComment(late?.comment ?? '');
    if (c) setNotebookDate(c.startDate.slice(0, 10));
  };
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['pres', 'cal-courses'] }); qc.invalidateQueries({ queryKey: ['pres', 'cal-absences'] }); };
  const createMut = useMutation({
    mutationFn: () => api.createAbsence(structureId, studentId, chosen!.startDate.slice(0, 19).replace('T', ' '), chosen!.endDate.slice(0, 19).replace('T', ' '), reasonId === '' ? null : Number(reasonId)),
    onSuccess: () => { setReasonId(''); invalidate(); },
  });
  const reasonMut = useMutation({
    mutationFn: (v: { id: number; start: string; end: string; reasonId: number | null }) => api.updateAbsence(v.id, { structureId, owner: user?.userId ?? '', studentId, startDate: v.start, endDate: v.end, reasonId: v.reasonId }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({ mutationFn: (id: number) => api.deleteAbsence(id), onSuccess: invalidate });

  // Retard : l'heure d'arrivée est comprise dans le cours ; le serveur retrouve le registre du cours.
  const lateReasons = visibleByLabel(reasonsQuery.data ?? []).filter((r) => r.reason_type_id === 2);
  const chosenDay = chosen?.startDate.slice(0, 10) ?? today;
  const chosenLateness = (chosen?.events ?? []).find((e) => e.type_id === 2);
  const latenessInput = (time: string) => ({ studentId, startDate: stampOf(chosenDay, hhmm(chosen!.startDate)), endDate: stampOf(chosenDay, time), reasonId: lateReason === '' ? null : Number(lateReason), comment: lateComment, registerId: chosenLateness?.register_id });
  const lateValid = !!chosen && latenessTimeValid(lateTime, chosen.startDate, chosen.endDate);
  const latenessSaved = () => { invalidate(); };
  const latenessMut = useMutation({
    mutationFn: () => (chosenLateness?.id ? api.updateLateness(chosenLateness.id, latenessInput(lateTime)) : api.createLateness(structureId, latenessInput(lateTime))),
    onSuccess: latenessSaved,
  });
  const latenessDeleteMut = useMutation({ mutationFn: (id: number) => api.deleteEvent(id), onSuccess: latenessSaved });

  // Carnet de correspondance oublié : compteur et seuil d'alerte de l'élève.
  const notebookQuery = useQuery({ queryKey: ['pres', 'cal-notebook', structureId, studentId], queryFn: () => api.getStudentNotebookCount(structureId, studentId), enabled: !!structureId && !!studentId && canNotebook });
  const notebookMut = useMutation({ mutationFn: () => api.createForgottenNotebook(structureId, studentId, notebookDate), onSuccess: () => qc.invalidateQueries({ queryKey: ['pres', 'cal-notebook'] }) });
  const notebookResetMut = useMutation({ mutationFn: () => api.resetStudentNotebookCount(structureId, studentId), onSuccess: () => qc.invalidateQueries({ queryKey: ['pres', 'cal-notebook'] }) });
  const progress = notebookProgress(notebookQuery.data?.count ?? 0, notebookQuery.data?.threshold ?? 0);

  if (!studentId) return <div className="alert alert-info" role="alert">{t('presences.calendar.choose', { defaultValue: 'Choisissez un élève pour afficher son calendrier.' })}</div>;

  return (
    <div>
      <h1 className="mb-12">{t('presences.event.calendar.title', { defaultValue: "Calendrier de l'élève" })}</h1>
      <QueryErrors queries={[coursesQuery, absencesQuery]} />

      <div className="d-flex gap-24 flex-wrap align-items-end mb-12">
        <div style={{ minWidth: 260 }}>
          <StudentSearch id="cal-student" label={t('presences.dashboard.search.placeholder', { defaultValue: 'Rechercher un élève' })} structureId={structureId} selected={[]} hideChips onAdd={(s) => goStudent(s.id)} />
        </div>
        <div className="d-flex align-items-center gap-8" data-student-card>
          <img src={`/viescolaire/structures/${structureId}/students/${studentId}/picture`} alt="" width={48} height={48} style={{ borderRadius: '50%' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          <div>
            <strong data-student-name>{name}</strong>
            <div className="text-muted" data-student-class>{classQuery.data?.name ?? ''}</div>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" data-prev-student disabled={idx <= 0} onClick={() => goStudent(classmates[idx - 1].id)}>←</button>
          <button type="button" className="btn btn-outline-secondary btn-sm" data-next-student disabled={idx < 0 || idx >= classmates.length - 1} onClick={() => goStudent(classmates[idx + 1].id)}>→</button>
        </div>
        {classmates.length > 0 && (
          <div>
            <label htmlFor="cal-classmate" className="form-label">{t('presences.calendar.classmates', { defaultValue: 'Élèves de la classe' })}</label>
            <select id="cal-classmate" className="form-control" value={studentId} onChange={(e) => goStudent(e.target.value)}>
              {classmates.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="d-flex gap-12 align-items-center flex-wrap mb-12" data-week-nav>
        <button type="button" className="btn btn-outline-primary btn-sm" data-prev-week onClick={() => goWeek(addDays(monday, -7))}>←</button>
        <strong data-week-label>{weekLabel(monday)}</strong>
        <button type="button" className="btn btn-outline-primary btn-sm" data-next-week onClick={() => goWeek(addDays(monday, 7))}>→</button>
        <button type="button" className="btn btn-link" data-today onClick={() => goWeek(mondayOf(today))}>{t('presences.calendar.today', { defaultValue: "Aujourd'hui" })}</button>
        <input type="date" className="form-control" style={{ width: 170 }} aria-label={t('presences.calendar.date', { defaultValue: 'Aller à la date' })} data-date value={params.get('date') ?? today} onChange={(e) => e.target.value && goWeek(mondayOf(e.target.value))} />
        {canManage && (
          <span className="ms-auto d-flex gap-8">
            <a className="btn btn-outline-primary btn-sm" data-link-exemption href={exemptionLink(studentId, name, chosen ? chosen.startDate.slice(0, 10) : today)}>{t('presences.exemptions.create', { defaultValue: 'Dispense' })}</a>
            <a className="btn btn-outline-primary btn-sm" data-link-punish href={`/incidents?ui=react#/punitions?students=${studentId}~${encodeURIComponent(name)}`}>{t('presences.alerts.punish', { defaultValue: 'Punition / sanction' })}</a>
          </span>
        )}
      </div>

      <ul className="list-unstyled d-flex gap-16 flex-wrap mb-12" data-legend>
        {(['absence', 'absence-reason', 'absence-regularized', 'absence-followed'] as const).map((tone) => (
          <li key={tone}><span style={{ display: 'inline-block', width: 14, height: 14, background: TONE_COLOR[tone], marginRight: 6, verticalAlign: 'middle' }} />{TONE_LABEL[tone]}</li>
        ))}
        <li>D = {t('presences.exemption', { defaultValue: 'Dispense' })}</li>
        <li>P = {t('presence.title', { defaultValue: 'Présence' })}</li>
      </ul>

      {coursesQuery.isLoading && <p>{t('presences.register.loading.text', { defaultValue: 'Chargement…' })}</p>}
      {!coursesQuery.isLoading && !coursesQuery.isError && courses.length === 0 && <p className="text-muted" data-empty>{t('presences.calendar.empty', { defaultValue: 'Aucun cours cette semaine.' })}</p>}

      <div style={{ display: 'flex', overflowX: 'auto' }} data-calendar>
        <div style={{ width: 48, position: 'relative', height: HEIGHT, marginTop: 28 }}>
          {hours.map((h) => <div key={h} className="text-muted" style={{ position: 'absolute', top: `${((h * 60 - bounds.from) / (bounds.to - bounds.from)) * 100}%`, fontSize: 12 }}>{h}h</div>)}
        </div>
        {days.map((day) => (
          <div key={day} style={{ flex: 1, minWidth: 150, borderLeft: '1px solid #ddd' }} data-day={day}>
            <div className={`text-center fw-bold${day === today ? ' text-primary' : ''}`} style={{ height: 28 }}>{dayName(day)} {day.slice(8, 10)}</div>
            <div style={{ position: 'relative', height: HEIGHT, background: 'repeating-linear-gradient(#fff, #fff 59px, #eee 60px)' }}>
              {coursesOfDay(courses, day).map((c) => {
                const key = courseKey(c, courses.indexOf(c));
                const tone = courseTone(c, absences);
                const box = courseBox(c, bounds);
                const hasPresence = (presencesQuery.data ?? []).some((p) => (p.startDate ?? p.start_date ?? '') < c.endDate && (p.endDate ?? p.end_date ?? '') > c.startDate);
                return (
                  <button
                    key={key}
                    type="button"
                    data-course={key}
                    data-tone={tone}
                    aria-pressed={selected === key}
                    onClick={() => choose(selected === key ? null : key)}
                    className="text-start"
                    style={{ position: 'absolute', left: 2, right: 2, top: `${box.top}%`, height: `${box.height}%`, overflow: 'hidden', border: selected === key ? '2px solid #0b5ed7' : '1px solid #bbb', borderLeft: `6px solid ${tone === 'none' ? '#bbb' : TONE_COLOR[tone]}`, background: c.exempted ? '#eef6ff' : '#fff', padding: '2px 4px', fontSize: 12 }}
                  >
                    <strong>{courseName(c)}</strong>
                    <div className="text-muted">{(c.roomLabels ?? []).join(', ')}</div>
                    <div>
                      {(c.events ?? []).filter((e) => e.type_id !== 1).map((e, i) => <span key={i} className="badge bg-secondary me-4" data-event-badge>{eventSummary(e).label.slice(0, 1)}</span>)}
                      {c.exempted && <span className="badge bg-info me-4" data-exempt-badge>D</span>}
                      {hasPresence && <span className="badge bg-success me-4">P</span>}
                      {c.incident && <span className="badge bg-dark me-4" data-incident-badge>I</span>}
                      {(c.punishments?.length ?? 0) > 0 && <span className="badge bg-warning text-dark me-4" data-punishment-badge>S</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {chosen && (
        <section className="border rounded p-16 mt-16" data-course-details aria-label={courseName(chosen)}>
          <h2 style={{ fontSize: 18 }}>{courseName(chosen)} — {chosen.startDate.slice(11, 16)}–{chosen.endDate.slice(11, 16)}</h2>
          <p className="text-muted mb-8">
            {(chosen.teachers ?? []).map((x) => x.displayName).filter(Boolean).join(', ')}{(chosen.roomLabels ?? []).length > 0 ? ` · ${(chosen.roomLabels ?? []).join(', ')}` : ''}
          </p>
          {chosen.exempted && chosen.exemption && (
            <p data-exemption>{t('presences.exemption', { defaultValue: 'Dispense' })} : {chosen.exemption.start_date?.slice(0, 10)} → {chosen.exemption.end_date?.slice(0, 10)} · {chosen.exemption.attendance ? t('presences.exemptions.attendance', { defaultValue: 'présence obligatoire' }) : t('presences.exemptions.no.attendance', { defaultValue: 'présence non obligatoire' })}</p>
          )}
          {(chosen.events ?? []).length > 0 && (
            <ul data-events>
              {(chosen.events ?? []).map((e, i) => {
                const s = eventSummary(e);
                return <li key={i}>{s.label} {s.hour}{e.reason_id ? ` — ${reasonLabel(e.reason_id)}` : ''}{e.comment ? ` — ${shortComment(e.comment)}` : ''}</li>;
              })}
            </ul>
          )}
          {chosen.incident && <p data-incident>{t('presences.register.event_type.incident', { defaultValue: 'Incident' })} : {chosen.incident.description}</p>}
          {(chosen.punishments ?? []).length > 0 && <p data-punishments>{t('presences.register.event_type.punishment', { defaultValue: 'Punition' })} : {(chosen.punishments ?? []).map((p) => p.type?.label).filter(Boolean).join(', ')}</p>}
          {chosenAbsences.length > 0 ? (
            <div data-absences>
              {chosenAbsences.map((a) => (
                <div key={a.id} className="d-flex gap-12 align-items-center mb-8" data-absence={a.id}>
                  <span>{t('presences.register.event_type.absences', { defaultValue: 'Absence' })} {a.start_date.slice(11, 16)}–{a.end_date.slice(11, 16)}</span>
                  {canManage ? (
                    <>
                      <select className="form-control" style={{ maxWidth: 240 }} aria-label={t('presences.absence.reason', { defaultValue: 'Motif' })} data-absence-reason={a.id} value={a.reason?.id ?? a.reason_id ?? ''} disabled={reasonMut.isPending}
                        onChange={(e) => reasonMut.mutate({ id: a.id, start: a.start_date, end: a.end_date, reasonId: e.target.value === '' ? null : Number(e.target.value) })}>
                        <option value="">{t('presences.absence.select.empty', { defaultValue: 'Sans motif' })}</option>
                        {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                      <button type="button" className="btn btn-outline-danger btn-sm" data-absence-delete={a.id} disabled={deleteMut.isPending} onClick={() => { if (window.confirm(t('presences.absence.delete.confirm', { defaultValue: 'Supprimer cette absence ?' }))) deleteMut.mutate(a.id); }}>{t('presences.delete', { defaultValue: 'Supprimer' })}</button>
                    </>
                  ) : <span>{a.reason?.label ?? t('presences.absence.no.reason', { defaultValue: 'Sans motif' })}</span>}
                </div>
              ))}
            </div>
          ) : canManage ? (
            <div className="d-flex gap-12 align-items-end" data-absence-form>
              <div>
                <label htmlFor="cal-reason" className="form-label">{t('presences.absence.reason', { defaultValue: 'Motif' })}</label>
                <select id="cal-reason" className="form-control" value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
                  <option value="">{t('presences.absence.select.empty', { defaultValue: 'Sans motif' })}</option>
                  {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary" data-absence-create disabled={createMut.isPending} onClick={() => createMut.mutate()}>{t('presences.calendar.mark.absent', { defaultValue: 'Déclarer absent sur ce cours' })}</button>
            </div>
          ) : null}
          {canManage && (
            <div className="border-top pt-12 mt-12" data-lateness-form>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>{t('presences.register.event_type.lateness', { defaultValue: 'Retard' })}</h3>
              <div className="d-flex gap-12 align-items-end flex-wrap">
                <div>
                  <label htmlFor="cal-late-time" className="form-label">{t('presences.arrival.time', { defaultValue: "Heure d'arrivée" })}</label>
                  <input id="cal-late-time" type="time" className="form-control" value={lateTime} min={hhmm(chosen.startDate)} max={hhmm(chosen.endDate)} onChange={(e) => setLateTime(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="cal-late-reason" className="form-label">{t('presences.absence.reason', { defaultValue: 'Motif' })}</label>
                  <select id="cal-late-reason" className="form-control" value={lateReason} onChange={(e) => setLateReason(e.target.value)}>
                    <option value="">{t('presences.absence.select.empty', { defaultValue: 'Sans motif' })}</option>
                    {lateReasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div style={{ flexGrow: 1, minWidth: 200 }}>
                  <label htmlFor="cal-late-comment" className="form-label">{t('presences.comment', { defaultValue: 'Commentaire' })}</label>
                  <input id="cal-late-comment" className="form-control" value={lateComment} onChange={(e) => setLateComment(e.target.value)} />
                </div>
                <button type="button" className="btn btn-primary" data-lateness-save disabled={!lateValid || latenessMut.isPending} onClick={() => latenessMut.mutate()}>
                  {chosenLateness ? t('presences.save', { defaultValue: 'Enregistrer' }) : t('presences.calendar.mark.late', { defaultValue: 'Déclarer en retard' })}
                </button>
                {chosenLateness?.id && <button type="button" className="btn btn-outline-danger" data-lateness-delete disabled={latenessDeleteMut.isPending} onClick={() => latenessDeleteMut.mutate(chosenLateness.id!)}>{t('presences.delete', { defaultValue: 'Supprimer' })}</button>}
              </div>
              {lateTime !== '' && !lateValid && <p className="text-danger mt-4" role="alert" data-lateness-invalid>{t('presences.invalid.form', { defaultValue: "L'heure d'arrivée doit être comprise dans la durée du cours." })}</p>}
              {(latenessMut.isError || latenessDeleteMut.isError) && <div className="alert alert-warning mt-8" role="alert" data-lateness-error>{t('presences.lateness.form.create.no.register', { defaultValue: "Impossible d'enregistrer le retard : aucun appel n'existe pour ce cours." })}</div>}
            </div>
          )}
          {(createMut.isError || reasonMut.isError || deleteMut.isError) && <div className="alert alert-warning mt-8" role="alert" data-action-error>{t('presences.error', { defaultValue: "L'opération a échoué." })}</div>}
        </section>
      )}
      {canNotebook && (
        <section className="border rounded p-16 mt-16" data-notebook aria-label={t('presences.forgotten.notebook', { defaultValue: 'Carnet oublié' })}>
          <h2 style={{ fontSize: 18 }}>{t('presences.forgotten.notebook', { defaultValue: 'Carnet oublié' })}</h2>
          <p className="mb-8">{t('presences.forgotten.notebook.form.recap', { defaultValue: 'Carnets oubliés (seuil avant alerte)' })} : <span data-notebook-count>{notebookQuery.data?.count ?? 0}</span> / {progress.total}{progress.after > 0 && <strong data-notebook-after> + {progress.after}</strong>}</p>
          <div className="d-flex gap-12 align-items-end flex-wrap">
            <div>
              <label htmlFor="cal-notebook-date" className="form-label">{t('presences.the', { defaultValue: 'Le' })}</label>
              <input id="cal-notebook-date" type="date" className="form-control" value={notebookDate} onChange={(e) => setNotebookDate(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary" data-notebook-create disabled={!notebookDate || notebookMut.isPending} onClick={() => notebookMut.mutate()}>{t('presences.forgotten.notebook.declare', { defaultValue: 'Déclarer un carnet oublié' })}</button>
            <button type="button" className="btn btn-outline-secondary" data-notebook-reset disabled={(notebookQuery.data?.count ?? 0) === 0 || notebookResetMut.isPending} onClick={() => notebookResetMut.mutate()}>{t('presences.reset', { defaultValue: 'Réinitialiser' })}</button>
          </div>
          {(notebookMut.isError || notebookResetMut.isError) && <div className="alert alert-warning mt-8" role="alert" data-notebook-error>{t('presences.error', { defaultValue: "L'opération a échoué." })}</div>}
        </section>
      )}
      <p className="mt-12"><Link to="/">{t('presences.back', { defaultValue: 'Retour au tableau de bord' })}</Link></p>
    </div>
  );
}

export default CalendrierEleve;
