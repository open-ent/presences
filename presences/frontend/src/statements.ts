/** Déclarations d'absence des parents : requêtes, saisie et validation (fonctions pures, testables). */

export interface StatementFilters {
  structureId: string;
  /** Jour de début (YYYY-MM-DD) et de fin (YYYY-MM-DD, la fin de journée est ajoutée). */
  start: string;
  end: string;
  studentIds: string[];
  /** Afficher aussi les déclarations déjà traitées (sinon seulement celles à traiter). */
  includeTreated: boolean;
}

/**
 * Paramètres communs à la liste et à l'export. Comme l'AngularJS, `is_treated=false` n'est envoyé que pour masquer
 * les déclarations traitées : cocher « afficher les traitées » retire le filtre (toutes les déclarations).
 */
export function statementParams(f: StatementFilters, page?: number): string {
  let p = `?structure_id=${f.structureId}&start_at=${f.start}&end_at=${f.end} 23:59:59`.replace(' ', '%20');
  for (const id of f.studentIds) p += `&student_id=${id}`;
  if (!f.includeTreated) p += '&is_treated=false';
  if (page !== undefined) p += `&page=${page}`;
  return p;
}

/** Déclaration telle que renvoyée par le serveur (champs utiles). */
export interface RawStatement {
  id: number;
  structure_id?: string;
  student?: { id?: string; name?: string; displayName?: string; className?: string; classeName?: string };
  start_at: string;
  end_at: string;
  description?: string;
  attachment_id?: string | null;
  treated_at?: string | null;
}

export const isTreated = (s: RawStatement): boolean => s.treated_at != null;

/** Lien de téléchargement de la pièce jointe d'une déclaration. */
export const attachmentUrl = (s: RawStatement): string => `/presences/statements/absences/${s.id}/attachment/${s.attachment_id}?structure_id=${s.structure_id ?? ''}`;

export interface StatementForm {
  structureId: string;
  studentId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  fullDay: boolean;
  description: string;
  file: File | null;
}

export const emptyStatementForm = (structureId: string, studentId: string, today: string): StatementForm => ({
  structureId, studentId, startDate: today, endDate: today, startTime: '08:00', endTime: '17:00', fullDay: false, description: '', file: null,
});

const full = (t: string) => (t.length === 5 ? `${t}:00` : t);

/** Début et fin envoyés au serveur : la journée entière prend les bornes des créneaux de l'établissement. */
export function statementPeriod(f: StatementForm, firstStart?: string, lastEnd?: string): { start: string; end: string } {
  const st = f.fullDay && firstStart ? firstStart : f.startTime;
  const en = f.fullDay && lastEnd ? lastEnd : f.endTime;
  return { start: `${f.startDate} ${full(st)}`, end: `${f.endDate} ${full(en)}` };
}

/** Erreur de saisie (clé), `null` si la déclaration est valide : période cohérente et non passée. */
export function statementError(f: StatementForm, today: string, firstStart?: string, lastEnd?: string): 'student' | 'past' | 'period' | null {
  if (!f.studentId) return 'student';
  if (f.startDate < today || f.endDate < today) return 'past';
  const { start, end } = statementPeriod(f, firstStart, lastEnd);
  return start < end ? null : 'period';
}

/** Champs du formulaire multipart (le fichier ajoute `/attachment` à l'adresse). */
export function statementFormData(f: StatementForm, firstStart?: string, lastEnd?: string): FormData {
  const { start, end } = statementPeriod(f, firstStart, lastEnd);
  const data = new FormData();
  data.append('structure_id', f.structureId);
  data.append('student_id', f.studentId);
  data.append('start_at', start);
  data.append('end_at', end);
  data.append('description', f.description);
  if (f.file) data.append('file', f.file);
  return data;
}

export const STATEMENT_ERRORS: Record<string, string> = {
  student: 'Choisissez un enfant.',
  past: 'La déclaration ne peut pas porter sur une date passée.',
  period: "L'heure de fin doit suivre l'heure de début.",
};
