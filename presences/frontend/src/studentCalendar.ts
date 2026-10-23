/** Calendrier d'un élève : semaine, cours, événements, absences, exemptions (fonctions pures, testables). */

export interface CalEvent {
  id?: number;
  type_id?: number;
  start_date?: string;
  end_date?: string;
  reason_id?: number | null;
  counsellor_regularisation?: boolean;
  followed?: boolean;
  comment?: string | null;
}

export interface CalAbsence {
  id: number;
  start_date: string;
  end_date: string;
  reason_id?: number | null;
  reason?: { id?: number | null; label?: string } | null;
  counsellor_regularisation?: boolean;
  followed?: boolean;
}

export interface CalCourse {
  _id?: string;
  id?: string;
  subjectName?: string;
  subject_name?: string;
  startDate: string;
  endDate: string;
  roomLabels?: string[];
  teachers?: Array<{ id?: string; displayName?: string }>;
  events?: CalEvent[];
  exempted?: boolean;
  exemption?: { start_date?: string; end_date?: string; attendance?: boolean } | null;
  incident?: { description?: string; date?: string } | null;
  punishments?: Array<{ type?: { label?: string } }>;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (day: string): Date => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };

/** Lundi de la semaine qui contient le jour donné. */
export function mondayOf(day: string): string {
  const d = parse(day);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return isoDay(d);
}

export function addDays(day: string, n: number): string {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/** Les jours affichés : lundi → vendredi, plus samedi si un cours y tombe. */
export function weekDays(monday: string, withSaturday = false): string[] {
  return Array.from({ length: withSaturday ? 6 : 5 }, (_, i) => addDays(monday, i));
}

export const coursesUrl = (structureId: string, studentId: string, monday: string, stamp: string): string =>
  `/presences/calendar/courses?structure=${structureId}&start=${monday}&end=${addDays(monday, 7)}&user=${studentId}&_t=${stamp}`;

export const absencesUrl = (structureId: string, studentId: string, monday: string): string =>
  `/presences/absences?structure=${structureId}&start=${monday}&end=${addDays(monday, 7)}&student=${studentId}&noReason=false`;

export const presencesUrl = (structureId: string, studentId: string, monday: string): string =>
  `/presences/presences?structureId=${structureId}&startDate=${monday}&endDate=${addDays(monday, 7)}&studentId=${studentId}`;

const t = (d: string) => d.replace('T', ' ').slice(0, 19);
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => t(aStart) < t(bEnd) && t(aEnd) > t(bStart);

/** Absences (liste du serveur) qui recouvrent un cours. */
export function absencesOf(course: CalCourse, absences: CalAbsence[]): CalAbsence[] {
  return absences.filter((a) => overlaps(a.start_date, a.end_date, course.startDate, course.endDate));
}

export type CourseTone = 'none' | 'absence' | 'absence-reason' | 'absence-regularized' | 'absence-followed';

/** Couleur d'un cours selon ses absences (événements d'appel et absences saisies). */
export function courseTone(course: CalCourse, absences: CalAbsence[]): CourseTone {
  const evs = (course.events ?? []).filter((e) => e.type_id === 1);
  const abs = absencesOf(course, absences);
  if (evs.length === 0 && abs.length === 0) return 'none';
  if (evs.some((e) => e.followed) || abs.some((a) => a.followed)) return 'absence-followed';
  const regularized = evs.some((e) => e.counsellor_regularisation === true) || abs.some((a) => a.counsellor_regularisation === true);
  if (regularized) return 'absence-regularized';
  const withReason = evs.some((e) => e.reason_id !== null && e.reason_id !== undefined) || abs.some((a) => a.reason_id !== null && a.reason_id !== undefined);
  return withReason ? 'absence-reason' : 'absence';
}

export const TONE_COLOR: Record<CourseTone, string> = {
  none: '#ffffff',
  absence: '#e61610',
  'absence-reason': '#ff8a84',
  'absence-regularized': '#72bb53',
  'absence-followed': '#000000',
};

export const TONE_LABEL: Record<CourseTone, string> = {
  none: '',
  absence: 'Absence sans motif',
  'absence-reason': 'Absence justifiée, non régularisée',
  'absence-regularized': 'Absence justifiée, régularisée',
  'absence-followed': 'Absence suivie',
};

const EVENT_LABEL: Record<number, string> = { 1: 'Absence', 2: 'Retard', 3: 'Départ anticipé', 4: 'Remarque' };

/** Libellé et heure d'un événement du cours (retard : heure d'arrivée ; départ et remarque : heure de début). */
export function eventSummary(e: CalEvent): { label: string; hour: string } {
  const src = e.type_id === 2 ? e.end_date : e.start_date;
  const m = /[T ](\d{2}:\d{2})/.exec(src ?? '');
  return { label: EVENT_LABEL[e.type_id ?? 0] ?? 'Événement', hour: m?.[1] ?? '' };
}

/** Texte tronqué à 200 caractères avec points de suspension. */
export const shortComment = (c?: string | null): string => (!c ? '' : c.length > 200 ? `${c.slice(0, 200)}...` : c);

const minutes = (d: string) => { const m = /[T ](\d{2}):(\d{2})/.exec(d); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
const dayOf = (d: string) => d.slice(0, 10);

/** Bornes de la grille horaire (en minutes) : du premier cours au dernier, arrondies à l'heure ; 8 h–18 h au minimum. */
export function dayBounds(courses: CalCourse[]): { from: number; to: number } {
  if (courses.length === 0) return { from: 8 * 60, to: 18 * 60 };
  const from = Math.min(8 * 60, ...courses.map((c) => minutes(c.startDate)));
  const to = Math.max(18 * 60, ...courses.map((c) => minutes(c.endDate)));
  return { from: Math.floor(from / 60) * 60, to: Math.ceil(to / 60) * 60 };
}

/** Position verticale d'un cours dans sa colonne, en pourcentage de la grille. */
export function courseBox(c: CalCourse, bounds: { from: number; to: number }): { top: number; height: number } {
  const span = bounds.to - bounds.from;
  return { top: ((minutes(c.startDate) - bounds.from) / span) * 100, height: Math.max(2, ((minutes(c.endDate) - minutes(c.startDate)) / span) * 100) };
}

/** Cours d'un jour, triés par heure. */
export const coursesOfDay = (courses: CalCourse[], day: string): CalCourse[] =>
  courses.filter((c) => dayOf(c.startDate) === day).sort((a, b) => t(a.startDate).localeCompare(t(b.startDate)));

export const hasSaturday = (courses: CalCourse[], monday: string): boolean => courses.some((c) => dayOf(c.startDate) === addDays(monday, 5));

export const courseName = (c: CalCourse): string => c.subjectName ?? c.subject_name ?? '';
export const courseKey = (c: CalCourse, i: number): string => `${c._id ?? c.id ?? i}-${c.startDate}`;

/** Libellé de la semaine : « 19 → 25 octobre 2026 ». */
export function weekLabel(monday: string): string {
  const names = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const s = parse(monday);
  const e = parse(addDays(monday, 6));
  return s.getMonth() === e.getMonth() ? `${s.getDate()} → ${e.getDate()} ${names[e.getMonth()]} ${e.getFullYear()}` : `${s.getDate()} ${names[s.getMonth()]} → ${e.getDate()} ${names[e.getMonth()]} ${e.getFullYear()}`;
}

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const dayName = (day: string): string => DAY_NAMES[(parse(day).getDay() + 6) % 7];

/** Lien vers le calendrier d'un élève à une date. */
export const calendarLink = (studentId: string, date: string): string => `#/calendrier/${studentId}?date=${date.slice(0, 10)}`;
