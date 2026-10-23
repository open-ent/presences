/** Dispenses : filtres, formulaire (ponctuelle ou récurrente), corps des requêtes (fonctions pures, testables). */

export interface ExemptionFilters {
  structureId: string;
  /** Jours « YYYY-MM-DD » (les heures de début et de fin de journée sont ajoutées). */
  start: string;
  end: string;
  studentIds: string[];
  audienceIds: string[];
  order: 'date' | 'attendance';
  reverse: boolean;
}

/** Paramètres communs à la liste et à l'export. */
export function exemptionParams(f: ExemptionFilters, page?: number): string {
  let p = `?structure_id=${f.structureId}&start_date=${f.start} 00:00:00&end_date=${f.end} 23:59:59`;
  if (f.studentIds.length > 0) p += `&student_id=${f.studentIds.join(',')}`;
  if (f.audienceIds.length > 0) p += `&audience_id=${f.audienceIds.join(',')}`;
  if (page !== undefined) p += `&page=${page}&order=${f.order}${f.reverse ? '&reverse=true' : ''}`;
  return p;
}

/** Clic sur un en-tête de colonne : même colonne = sens inversé ; autre colonne = ordre normal sur celle-ci. */
export function nextSort(current: Pick<ExemptionFilters, 'order' | 'reverse'>, field: 'date' | 'attendance'): Pick<ExemptionFilters, 'order' | 'reverse'> {
  return { order: field, reverse: current.order === field ? !current.reverse : false };
}

export interface RawExemption {
  exemption_id?: number | null;
  exemption_recursive_id?: number | null;
  recursive_id?: number | null;
  student_id?: string;
  structure_id?: string;
  subject_id?: string;
  start_date?: string;
  end_date?: string;
  attendance?: boolean;
  comment?: string;
  is_every_two_weeks?: boolean;
  day_of_week?: string[];
  subject?: { id?: string; name?: string } | null;
  student?: { id?: string; idEleve?: string; firstName?: string; lastName?: string; classeName?: string; className?: string };
}

/** Identifiant de la ligne : dispense ponctuelle ou récurrente. */
export const exemptionKey = (e: RawExemption): string => (e.exemption_id ? `p${e.exemption_id}` : `r${e.exemption_recursive_id ?? e.recursive_id ?? ''}`);
export const isRecursive = (e: RawExemption): boolean => !e.exemption_id && !!(e.exemption_recursive_id ?? e.recursive_id);

export const DAYS: Array<{ value: string; label: string; short: string }> = [
  { value: 'MONDAY', label: 'Lundi', short: 'Lun' },
  { value: 'TUESDAY', label: 'Mardi', short: 'Mar' },
  { value: 'WEDNESDAY', label: 'Mercredi', short: 'Mer' },
  { value: 'THURSDAY', label: 'Jeudi', short: 'Jeu' },
  { value: 'FRIDAY', label: 'Vendredi', short: 'Ven' },
];

export interface ExemptionStudent { id: string; name: string }
export interface SlotChoice { id: string; name: string; startHour: string; endHour: string }

export interface ExemptionForm {
  /** Présent en modification. */
  editing?: { exemptionId?: number; recursiveId?: number; studentId: string };
  mode: 'punctual' | 'recursive';
  structureId: string;
  students: ExemptionStudent[];
  subjectId: string;
  startDate: string;
  endDate: string;
  attendance: boolean;
  comment: string;
  days: string[];
  everyTwoWeeks: boolean;
  /** Créneaux de début et de fin (récurrente), « HH:mm ». */
  startHour: string;
  endHour: string;
}

export const emptyExemptionForm = (structureId: string, today: string, defaultSubjectId: string): ExemptionForm => ({
  mode: 'punctual', structureId, students: [], subjectId: defaultSubjectId, startDate: today, endDate: addDays(today, 7), attendance: false, comment: '', days: [], everyTwoWeeks: false, startHour: '', endHour: '',
});

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Matière par défaut : l'EPS si elle existe (libellés usuels), sinon la première matière. */
export function defaultSubject(subjects: Array<{ id: string; name: string }>): string {
  const eps = subjects.find((s) => {
    const l = s.name.replace(/\s+/g, '').toLowerCase();
    return l === 'eps' || l === 'educationphysiqueetsportive' || l === 'educationphysiquesportive' || l === 'educationphysique' || (l.includes('physique') && l.includes('sport'));
  });
  return (eps ?? subjects[0])?.id ?? '';
}

const day = (d?: string) => (d ?? '').slice(0, 10);
const hm = (d?: string) => /[T ](\d{2}:\d{2})/.exec(d ?? '')?.[1] ?? '';
const full = (t: string) => (t.length === 5 ? `${t}:00` : t);

/** Formulaire de modification à partir d'une ligne de la liste. */
export function formFromExemption(e: RawExemption, structureId: string, slots: SlotChoice[]): ExemptionForm {
  const student = e.student ?? {};
  const name = `${student.lastName ?? ''} ${student.firstName ?? ''}`.trim();
  const recursive = isRecursive(e);
  const startHour = hm(e.start_date);
  const endHour = hm(e.end_date);
  return {
    editing: { exemptionId: e.exemption_id ?? undefined, recursiveId: recursive ? (e.exemption_recursive_id ?? e.recursive_id ?? undefined) : undefined, studentId: e.student_id ?? student.id ?? '' },
    mode: recursive ? 'recursive' : 'punctual',
    structureId: e.structure_id ?? structureId,
    students: [{ id: e.student_id ?? student.id ?? '', name }],
    subjectId: recursive ? '' : (e.subject_id ?? e.subject?.id ?? ''),
    startDate: day(e.start_date),
    endDate: day(e.end_date),
    attendance: Boolean(e.attendance),
    comment: e.comment ?? '',
    days: e.day_of_week ?? [],
    everyTwoWeeks: Boolean(e.is_every_two_weeks),
    startHour: slots.some((s) => s.startHour.slice(0, 5) === startHour) ? startHour : '',
    endHour: slots.some((s) => s.endHour.slice(0, 5) === endHour) ? endHour : '',
  };
}

/** Erreur de saisie (clé), `null` si le formulaire est valide. */
export function exemptionError(f: ExemptionForm): 'students' | 'dates' | 'subject' | 'days' | 'slots' | null {
  if (f.students.length === 0) return 'students';
  if (!f.startDate || !f.endDate || f.startDate > f.endDate) return 'dates';
  if (f.mode === 'punctual') return f.subjectId ? null : 'subject';
  if (f.days.length === 0) return 'days';
  if (!f.startHour || !f.endHour) return 'slots';
  return null;
}

/** Corps de création (POST) ou de modification (PUT). */
export function exemptionBody(f: ExemptionForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    structure_id: f.structureId,
    subject_id: f.subjectId,
    start_date: `${f.startDate} 00:00:00`,
    end_date: `${f.endDate} 23:59:59`,
    attendance: f.attendance,
    comment: f.comment,
    student_id: f.editing ? f.editing.studentId : f.students.map((s) => s.id),
  };
  if (f.mode === 'recursive') {
    body.is_recursive = true;
    body.is_every_two_weeks = f.everyTwoWeeks;
    body.startDateRecursive = `${f.startDate} ${full(f.startHour)}`;
    body.endDateRecursive = `${f.endDate} ${full(f.endHour)}`;
    body.day_of_week = f.days;
  }
  return body;
}

/** Adresse de modification ou de suppression d'une dispense. */
export const exemptionEditUrl = (e: NonNullable<ExemptionForm['editing']>): string => `/presences/exemption/${e.exemptionId ?? e.recursiveId}`;
export const exemptionDeleteUrl = (e: RawExemption): string =>
  e.exemption_id ? `/presences/exemption?id=${e.exemption_id}` : `/presences/exemption/recursive?id=${e.exemption_recursive_id ?? e.recursive_id}`;

/** Libellé court des jours d'une dispense récurrente. */
export const daysSummary = (days?: string[]): string => DAYS.filter((d) => (days ?? []).includes(d.value)).map((d) => d.short).join(', ');

export const dateRange = (e: RawExemption): string => {
  const fr = (d?: string) => (d ?? '').replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$3/$2/$1');
  return `du ${fr(e.start_date)} au ${fr(e.end_date)}`;
};
