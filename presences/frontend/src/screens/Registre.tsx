import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, Course } from '../api';
import { heure } from '../utils';

/**
 * Registre d'appel : pour une date, liste des cours (source EDT) → ouverture de l'appel d'un cours
 * (création du registre) → élèves de la classe pointés **présent / absent**. Une absence est
 * enregistrée comme événement (`POST /presences/events`, type 1). Nécessite le droit de faire l'appel.
 */
export function Registre() {
  const { t } = useTranslation(['presences', 'common']);
  const { user } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  // Date par défaut : jour du cours de démonstration (données EDT provisionnées).
  const [date, setDate] = useState('2025-10-14');
  const [openCourse, setOpenCourse] = useState<Course | null>(null);
  const [registerId, setRegisterId] = useState<number | null>(null);
  const [absents, setAbsents] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  const coursesQuery = useQuery({
    queryKey: ['presences', 'courses', structureId, date],
    queryFn: () => api.getCourses(structureId, date),
    enabled: !!structureId && !!date,
  });
  const courses = coursesQuery.data ?? [];

  // Résolution nom de classe (porté par le cours) → identifiant (pour l'annuaire).
  const classesQuery = useQuery({
    queryKey: ['presences', 'classes', structureId],
    queryFn: () => api.getClasses(structureId),
    enabled: !!structureId,
  });
  const classIdByName = new Map((classesQuery.data ?? []).map((c) => [c.name, c.id]));
  const classId = openCourse ? classIdByName.get(openCourse.classes?.[0] ?? '') ?? '' : '';
  const studentsQuery = useQuery({
    queryKey: ['presences', 'class-students', classId],
    queryFn: () => api.getClassStudents(classId),
    enabled: !!classId,
  });
  const students = studentsQuery.data ?? [];

  const openMut = useMutation({
    mutationFn: (course: Course) => api.createRegister(course, structureId),
    onSuccess: (r) => { setRegisterId(r.id); setAbsents(new Set()); setDone(false); },
  });

  const openAppel = (course: Course) => {
    setOpenCourse(course);
    setRegisterId(null);
    openMut.mutate(course);
  };

  const toggleAbsent = (id: string) =>
    setAbsents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const validateMut = useMutation({
    mutationFn: async () => {
      if (registerId == null || !openCourse) return;
      const start = (openCourse.startDate ?? '').replace('T', ' ').slice(0, 19);
      const end = (openCourse.endDate ?? '').replace('T', ' ').slice(0, 19);
      // Une absence par élève pointé absent (les autres sont présents par défaut).
      await Promise.all([...absents].map((sid) => api.createEvent(registerId, sid, start, end)));
    },
    onSuccess: () => setDone(true),
  });

  return (
    <div>
      <h1 className="mb-16">{t('presences.registre.title', { defaultValue: "Registre d'appel" })}</h1>

      <div className="mb-16" style={{ maxWidth: 240 }}>
        <label htmlFor="reg-date" className="form-label">{t('presences.registre.date', { defaultValue: 'Date' })}</label>
        <input id="reg-date" type="date" className="form-control" value={date} onChange={(e) => { setDate(e.target.value); setOpenCourse(null); setRegisterId(null); }} />
      </div>

      <div className="d-flex gap-16 flex-wrap align-items-start">
        {/* Cours du jour */}
        <section className="card p-16" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 16 }} className="mb-12">{t('presences.registre.courses', { defaultValue: 'Cours du jour' })}</h2>
          {coursesQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!coursesQuery.isLoading && courses.length === 0 && (
            <p className="text-muted mb-0">{t('presences.registre.nocourse', { defaultValue: 'Aucun cours ce jour.' })}</p>
          )}
          <ul className="list-unstyled mb-0">
            {courses.map((c) => (
              <li key={c.id} className="py-8 border-bottom d-flex justify-content-between align-items-center gap-12">
                <span>
                  <strong>{heure(c.startDate)}–{heure(c.endDate)}</strong>{' '}
                  {c.subjectName ?? c.subjectId} · {(c.classes ?? []).join(', ')}
                  {c.roomLabels && c.roomLabels.length > 0 && <span className="text-muted"> · {c.roomLabels.join(', ')}</span>}
                </span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openAppel(c)}>
                  {t('presences.registre.doCall', { defaultValue: "Faire l'appel" })}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Appel du cours ouvert */}
        {openCourse && (
          <section className="card p-16 flex-grow-1" style={{ minWidth: 340 }}>
            <h2 style={{ fontSize: 16 }} className="mb-4">
              {t('presences.registre.call', { defaultValue: 'Appel' })} · {(openCourse.classes ?? []).join(', ')}
            </h2>
            <p className="text-muted" style={{ fontSize: 13 }}>
              {heure(openCourse.startDate)}–{heure(openCourse.endDate)} · {openCourse.subjectName ?? openCourse.subjectId}
            </p>

            {openMut.isPending && <p>{t('presences.registre.opening', { defaultValue: "Ouverture de l'appel…" })}</p>}
            {studentsQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}

            {registerId != null && students.length > 0 && (
              <>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  {t('presences.registre.hint', { defaultValue: 'Cochez les élèves absents. Les autres sont comptés présents.' })}
                </p>
                <ul className="list-unstyled mb-12">
                  {students.map((s) => {
                    const absent = absents.has(s.id);
                    return (
                      <li key={s.id} className="py-4 border-bottom d-flex justify-content-between align-items-center">
                        <span>{s.displayName}</span>
                        <button
                          type="button"
                          className={`btn btn-sm btn-${absent ? 'danger' : 'secondary'}`}
                          aria-pressed={absent}
                          onClick={() => toggleAbsent(s.id)}
                        >
                          {absent ? t('presences.registre.absent', { defaultValue: 'Absent' }) : t('presences.registre.present', { defaultValue: 'Présent' })}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {done && <div className="alert alert-success" role="status">{t('presences.registre.saved', { defaultValue: "Appel enregistré." })}</div>}
                <button type="button" className="btn btn-primary" disabled={validateMut.isPending} onClick={() => validateMut.mutate()}>
                  {t('presences.registre.validate', { defaultValue: "Valider l'appel" })}
                  {absents.size > 0 ? ` (${absents.size} ${t('presences.registre.absents', { defaultValue: 'absent(s)' })})` : ''}
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
