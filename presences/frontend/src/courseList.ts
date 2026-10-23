/** Liste des appels : filtres, requêtes, règle de relance des oublis, regroupement par jour (fonctions pures). */

export interface CourseFilters {
  structureId: string;
  start: string;
  end: string;
  teacherIds: string[];
  /** Les classes sont filtrées par NOM (comme l'AngularJS). */
  groupNames: string[];
  forgotten: boolean;
  /** Ne pas limiter aux cours qui ont un enseignant (vrai par défaut = avec enseignant). */
  withTeacher: boolean;
}

export const PAGE = 100;

const common = (f: CourseFilters) =>
  f.teacherIds.map((t) => `teacher=${t}&`).join('') + f.groupNames.map((g) => `group=${encodeURIComponent(g)}&`).join('') + `structure=${f.structureId}&start=${f.start}&end=${f.end}`;

/** Adresse de la liste paginée (limite et décalage). */
export const coursesUrl = (f: CourseFilters, offset: number): string =>
  `/presences/courses?${common(f)}&forgotten_registers=${f.forgotten}&multiple_slot=true&limit=${PAGE}&offset=${offset}&descendingDate=false&searchTeacher=${f.withTeacher}`;

export const coursesExportUrl = (f: CourseFilters, stamp: string): string => `/presences/courses/export?${common(f)}&forgotten_registers=${f.forgotten}&_t=${stamp}`;

export interface ListedCourse {
  id: string;
  subjectName?: string;
  startDate: string;
  endDate: string;
  classes?: string[];
  groups?: string[];
  roomLabels?: string[];
  teachers?: Array<{ id: string; displayName?: string }>;
  register_id?: number | null;
  registerId?: number | null;
  register_state_id?: number | null;
  notified?: boolean;
}

const DONE = 3;

/** Un appel oublié se relance si le cours a commencé depuis plus de 15 min, n'est pas futur, n'est pas fait, et date de moins de 2 jours. */
export function canNotify(c: Pick<ListedCourse, 'startDate' | 'register_state_id'>, now: Date, hasRight: boolean): boolean {
  if (!hasRight) return false;
  if (c.register_state_id === DONE) return false;
  const start = new Date(c.startDate.replace(' ', 'T'));
  if (Number.isNaN(start.getTime())) return false;
  if (now.getTime() <= start.getTime() + 15 * 60_000) return false;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return (day(now) - day(start)) / 86_400_000 < 2;
}

/** Jours (dans l'ordre) et cours de chaque jour triés par heure de début. */
export function courseDays(courses: ListedCourse[]): Array<{ day: string; items: ListedCourse[] }> {
  const map = new Map<string, ListedCourse[]>();
  for (const c of courses) {
    const day = c.startDate.slice(0, 10);
    map.set(day, [...(map.get(day) ?? []), c]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, items]) => ({ day, items: [...items].sort((a, b) => a.startDate.localeCompare(b.startDate)) }));
}

/** Classes et groupes d'un cours, sur une seule liste. */
export const courseGroups = (c: Pick<ListedCourse, 'classes' | 'groups'>): string[] => [...(c.classes ?? []), ...(c.groups ?? [])];

/** Ajoute une page de cours sans doublon (même cours, même début). */
export function mergeCourses(previous: ListedCourse[], page: ListedCourse[]): ListedCourse[] {
  const seen = new Set(previous.map((c) => `${c.id}|${c.startDate}`));
  return [...previous, ...page.filter((c) => !seen.has(`${c.id}|${c.startDate}`))];
}

/** Adresse du registre d'un cours : jour et cours ouverts d'emblée. */
export const registerLink = (c: Pick<ListedCourse, 'id' | 'startDate'>): string => `#/registre?date=${c.startDate.slice(0, 10)}&course=${encodeURIComponent(c.id)}`;
