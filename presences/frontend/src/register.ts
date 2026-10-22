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

export interface RegisterStudent {
  id: string;
  name: string;
  group_name?: string | null;
  events?: RegisterEvent[];
  last_course_absent?: boolean;
  exempted?: boolean;
}

export interface RegisterDetail {
  id: number;
  state_id?: number;
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
