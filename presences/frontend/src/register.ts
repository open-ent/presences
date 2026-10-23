/** Registre d'appel : fonctions pures (formats de date, événements d'un élève, synthèse), testables. */

/** Types d'événement du registre (`EventTypeEnum` côté serveur). */
export const EVENT = { ABSENCE: 1, LATENESS: 2, DEPARTURE: 3, REMARK: 4 } as const;

/** États d'un registre (`RegisterStatus`) : à faire, en cours, terminé. */
export const REGISTER_STATE = { TODO: 1, IN_PROGRESS: 2, DONE: 3 } as const;

export interface RegisterEvent {
  id: number;
  type_id: number;
  start_date?: string;
  end_date?: string;
  comment?: string | null;
  reason_id?: number | null;
  counsellor_input?: boolean;
}

export interface HistorySlot {
  name?: string;
  start: string;
  end: string;
  events: Array<{ id?: number; type_id: number }>;
}

export interface StudentExemption {
  subject_id?: string | null;
  recursive_id?: number | null;
  attendance?: boolean;
}

export interface RegisterStudent {
  id: string;
  name: string;
  group_name?: string | null;
  events?: RegisterEvent[];
  last_course_absent?: boolean;
  exempted?: boolean;
  exemptions?: StudentExemption[];
  forgotten_notebook?: boolean;
  day_history?: HistorySlot[];
}

export interface RegisterDetail {
  id: number;
  state_id?: number;
  subject_id?: string;
  groups?: string[];
  teachers?: Array<{ id: string; displayName?: string }>;
  notified?: boolean;
  start_date: string;
  end_date: string;
  students?: RegisterStudent[];
}

/** « 2026-10-22T08:00:00.000 » ou « 2026-10-22 08:00:00 » → « 2026-10-22 08:00:00 » (format des événements). */
export function sqlDate(value: string | undefined): string {
  return (value ?? '').replace('T', ' ').slice(0, 19);
}

/** « HH:mm » d'une date de cours ou d'événement ; vide si illisible. */
export function timeOf(value: string | undefined): string {
  const m = /[ T](\d{2}):(\d{2})/.exec(value ?? '');
  return m ? `${m[1]}:${m[2]}` : '';
}

/** Remplace l'heure d'une date par `HH:mm` (secondes à 00) : « 2026-10-22 08:00:00 », « 09:15 » → « 2026-10-22 09:15:00 ». */
export function withTime(value: string | undefined, hhmm: string): string {
  const day = sqlDate(value).slice(0, 10);
  return `${day} ${hhmm}:00`;
}

/** Jour du registre à l'heure courante (arrondie à la minute) : l'heure d'arrivée d'un retard, ou de départ. */
export function nowOnDay(registerStart: string | undefined, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return withTime(registerStart, `${pad(now.getHours())}:${pad(now.getMinutes())}`);
}

/** Événement d'un type donné pour un élève (le premier). */
export function eventOf(student: RegisterStudent, typeId: number): RegisterEvent | undefined {
  return (student.events ?? []).find((e) => e.type_id === typeId);
}

export interface RegisterSummary {
  absent: number;
  late: number;
  departed: number;
  remarks: number;
}

/** Synthèse de l'appel : combien d'absents, de retards, de départs et de remarques. */
export function summary(students: RegisterStudent[]): RegisterSummary {
  const count = (typeId: number) => students.filter((s) => !!eventOf(s, typeId)).length;
  return { absent: count(EVENT.ABSENCE), late: count(EVENT.LATENESS), departed: count(EVENT.DEPARTURE), remarks: count(EVENT.REMARK) };
}

/** Jour précédent ou suivant d'une date `YYYY-MM-DD` (sans passer par l'UTC). */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Libellé de l'avancement d'un registre pour la liste des cours. */
export function stateKey(stateId: number | null | undefined): 'done' | 'inProgress' | 'todo' {
  if (stateId === REGISTER_STATE.DONE) return 'done';
  if (stateId === REGISTER_STATE.IN_PROGRESS) return 'inProgress';
  return 'todo';
}

/**
 * Classe de couleur d'un créneau de l'historique du jour : l'événement le plus grave l'emporte
 * (absence, puis retard, départ, remarque) ; vide sans événement.
 */
export function historyClass(events: Array<{ type_id: number }>): '' | 'absence' | 'lateness' | 'departure' | 'remark' {
  const order = [EVENT.ABSENCE, EVENT.LATENESS, EVENT.DEPARTURE, EVENT.REMARK];
  const names = ['absence', 'lateness', 'departure', 'remark'] as const;
  const best = Math.min(...events.map((e) => order.indexOf(e.type_id as 1 | 2 | 3 | 4)).filter((i) => i >= 0), 4);
  return names[best] ?? '';
}

/**
 * Un créneau de l'historique est « courant » s'il recouvre la durée du registre.
 * (La condition AngularJS d'origine est presque toujours vraie ; on retient le recouvrement strict.)
 */
export function isCurrentSlot(slot: { start: string; end: string }, registerStart: string, registerEnd: string): boolean {
  return sqlDate(slot.start) < sqlDate(registerEnd) && sqlDate(slot.end) > sqlDate(registerStart);
}

/** Élèves regroupés par nom de groupe, triés par nom ; un seul bloc sans titre si le registre n'a pas plusieurs groupes. */
export function groupStudents(students: RegisterStudent[], groups: string[] | undefined): Array<{ name: string | null; students: RegisterStudent[] }> {
  const sort = (list: RegisterStudent[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  if ((groups ?? []).length <= 1) return [{ name: null, students: sort(students) }];
  const map = new Map<string, RegisterStudent[]>();
  students.forEach((s) => map.set(s.group_name ?? '', [...(map.get(s.group_name ?? '') ?? []), s]));
  return [...map.entries()].map(([name, list]) => ({ name, students: sort(list) }));
}

/** Absence non modifiable : l'élève est dispensé (sans présence obligatoire) pour la matière du cours ou en dispense récurrente. */
export function absenceBlocked(student: RegisterStudent, subjectId: string | undefined, canManage: boolean): boolean {
  const absence = eventOf(student, EVENT.ABSENCE);
  if (absence?.counsellor_input) return !canManage;
  return exemptionBlocks(student, subjectId);
}

export function exemptionBlocks(student: RegisterStudent, subjectId: string | undefined): boolean {
  const hit = (student.exemptions ?? []).find((e) => (e.subject_id === subjectId || (e.recursive_id !== null && e.recursive_id !== undefined)) && !e.attendance);
  return !!hit && !!student.exempted;
}

/** Nombre d'élèves présents sur le total (absents déduits). */
export const attenders = (students: RegisterStudent[]): { present: number; total: number } => ({
  present: students.length - students.filter((s) => !!eventOf(s, EVENT.ABSENCE)).length,
  total: students.length,
});

/**
 * Notification de l'enseignant d'un appel oublié : droit de notifier, appel non terminé, cours commencé depuis plus de
 * 15 minutes et au plus hier (écart de jours calendaires strictement inférieur à 2).
 */
export function canNotify(startDate: string | undefined, stateId: number | undefined, hasRight: boolean, now: Date = new Date()): boolean {
  if (!hasRight || !startDate || stateId === REGISTER_STATE.DONE) return false;
  const start = new Date(startDate);
  if (now.getTime() <= start.getTime() + 15 * 60_000) return false;
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(start)) / 86_400_000) < 2;
}

/** Un cours ne peut pas être appelé plus de 15 minutes avant son début. */
export const isFutureCourse = (startDate: string | undefined, now: Date = new Date()): boolean =>
  !startDate || now.getTime() + 15 * 60_000 <= new Date(startDate).getTime();

/**
 * Valeur du paramètre `multiple_slot` des cours : le personnel reçoit toujours les créneaux découpés ; un enseignant
 * suit sa préférence (activée par défaut tant qu'il ne l'a pas posée). Le serveur combine ce paramètre avec le réglage
 * « appels multiples » de l'établissement.
 */
export function multipleSlotParam(isStaff: boolean, preference: boolean | undefined): boolean {
  return isStaff ? true : preference ?? true;
}
