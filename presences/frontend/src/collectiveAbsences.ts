/** Absences collectives : liste, formulaire (classes, élèves, période), règles de sélection (fonctions pures, testables). */

export interface CollectiveStudent { id: string; displayName: string; isAbsent?: boolean; isUpdated?: boolean }
export interface CollectiveAudience { id: string; name: string; countStudents?: number; students: CollectiveStudent[] }

export interface CollectiveAbsence {
  id: number;
  startDate: string;
  endDate: string;
  reasonId?: number | null;
  reason?: { id?: number; label?: string } | null;
  counsellorRegularisation?: boolean;
  comment?: string | null;
  countStudent?: number;
  audiences: Array<{ id: string; name: string; students?: Array<{ id: string; displayName?: string }> }>;
}

/** Paramètres de la liste : les classes sont filtrées par NOM (`audienceName`), comme l'AngularJS. */
export function collectiveListParams(start: string, end: string, audienceNames: string[], page?: number): string {
  let p = `?startDate=${start} 00:00:00&endDate=${end} 23:59:59`;
  for (const n of audienceNames) p += `&audienceName=${encodeURIComponent(n)}`;
  if (page !== undefined) p += `&page=${page}`;
  return p;
}

export const exportParams = (start: string, end: string): string => `?startDate=${start} 00:00:00&endDate=${end} 23:59:59`;

/** Un élève présent dans plusieurs classes n'est pris en compte que dans la première où il apparaît. */
export function isMultiple(audiences: CollectiveAudience[], audienceId: string, studentId: string): boolean {
  const owner = audiences.find((a) => a.students.some((s) => s.id === studentId));
  return !!owner && owner.id !== audienceId;
}

/** Élèves concernés, sans doublon entre classes. */
export function distinctStudents(audiences: CollectiveAudience[]): CollectiveStudent[] {
  const seen = new Set<string>();
  const out: CollectiveStudent[] = [];
  for (const a of audiences) for (const s of a.students) if (!seen.has(s.id)) { seen.add(s.id); out.push(s); }
  return out;
}

/** Nombre d'élèves à qui l'absence sera réellement ajoutée : ni en double, ni déjà absents. */
export const nbStudentsSubmit = (audiences: CollectiveAudience[]): number => distinctStudents(audiences).filter((s) => !s.isAbsent).length;

/** Élèves concernés par un problème (déjà absents ou absence modifiée individuellement). */
export const nbStudentIssues = (audiences: CollectiveAudience[]): number => distinctStudents(audiences).filter((s) => s.isAbsent || s.isUpdated).length;

export function studentIssue(s: CollectiveStudent): string {
  if (s.isUpdated) return 'Modifiée individuellement';
  if (s.isAbsent) return 'Déjà absent sur la période';
  return '';
}

/** Identifiants à envoyer pour une classe : ni en double, ni déjà absents, ni déjà rattachés à l'absence collective. */
export function submitIds(audiences: CollectiveAudience[], audienceId: string, loadedIds: string[]): string[] {
  const a = audiences.find((x) => x.id === audienceId);
  if (!a) return [];
  return a.students.filter((s) => !isMultiple(audiences, audienceId, s.id) && !s.isAbsent && !loadedIds.includes(s.id)).map((s) => s.id);
}

export interface CollectiveForm {
  id?: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reasonId: number | null;
  counsellorRegularisation: boolean;
  comment: string;
  audiences: CollectiveAudience[];
}

export const emptyCollectiveForm = (today: string): CollectiveForm => ({
  startDate: today, endDate: today, startTime: '08:00', endTime: '17:00', reasonId: null, counsellorRegularisation: false, comment: '', audiences: [],
});

const withSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t);
export const collectiveInstant = (date: string, time: string): string => `${date} ${withSeconds(time)}`;

/** Corps de création / modification : les classes sans élève à ajouter sont omises. */
export function collectiveBody(f: CollectiveForm, loadedIds: string[]): Record<string, unknown> {
  const audiences = f.audiences.map((a) => ({ id: a.id, studentIds: submitIds(f.audiences, a.id, loadedIds) })).filter((a) => a.studentIds.length > 0);
  return {
    ...(f.id ? { id: f.id } : {}),
    startDate: collectiveInstant(f.startDate, f.startTime),
    endDate: collectiveInstant(f.endDate, f.endTime),
    counsellorRegularisation: f.counsellorRegularisation || false,
    reasonId: f.reasonId ?? null,
    comment: f.comment,
    audiences,
  };
}

/** Période valide : la fin suit le début. */
export const isPeriodValid = (f: Pick<CollectiveForm, 'startDate' | 'endDate' | 'startTime' | 'endTime'>): boolean =>
  collectiveInstant(f.startDate, f.startTime) < collectiveInstant(f.endDate, f.endTime);

/** Le formulaire est enregistrable : période valide, au moins une classe, au moins un élève à ajouter. */
export const isCollectiveValid = (f: CollectiveForm): boolean => isPeriodValid(f) && f.audiences.length > 0 && nbStudentsSubmit(f.audiences) > 0;

/** Règle liée au motif : un motif justifiant régularise d'office ; sinon la régularisation peut être cochée. */
export function reasonRule(reason?: { proving?: boolean } | null): { canRegularize: boolean; counsellorRegularisation: boolean } {
  return { canRegularize: !!reason && !reason.proving, counsellorRegularisation: !!reason && !!reason.proving };
}

/** Ajoute une classe entière (ses élèves) à la sélection, sans doublon. */
export function addGroup(audiences: CollectiveAudience[], group: { id: string; name: string }, students: CollectiveStudent[]): CollectiveAudience[] {
  const existing = audiences.find((a) => a.id === group.id);
  if (!existing) return [...audiences, { id: group.id, name: group.name, countStudents: students.length, students: [...students] }];
  const known = new Set(existing.students.map((s) => s.id));
  return audiences.map((a) => (a.id === group.id ? { ...a, countStudents: students.length, students: [...a.students, ...students.filter((s) => !known.has(s.id))] } : a));
}

/** Ajoute un élève seul (dans sa classe) à la sélection. */
export function addStudent(audiences: CollectiveAudience[], group: { id: string; name: string; countStudents?: number }, student: CollectiveStudent): CollectiveAudience[] {
  const existing = audiences.find((a) => a.id === group.id);
  if (!existing) return [...audiences, { id: group.id, name: group.name, countStudents: group.countStudents, students: [student] }];
  if (existing.students.some((s) => s.id === student.id)) return audiences;
  return audiences.map((a) => (a.id === group.id ? { ...a, students: [...a.students, student] } : a));
}

/** Retire un élève ; une classe sans élève disparaît. */
export function removeStudent(audiences: CollectiveAudience[], studentId: string): CollectiveAudience[] {
  return audiences.map((a) => ({ ...a, students: a.students.filter((s) => s.id !== studentId) })).filter((a) => a.students.length > 0);
}

export const removeAudience = (audiences: CollectiveAudience[], audienceId: string): CollectiveAudience[] => audiences.filter((a) => a.id !== audienceId);

/** Applique l'état « déjà absent / modifié » reçu du serveur aux élèves de la sélection. */
export function applyStatuses(audiences: CollectiveAudience[], statuses: Array<{ studentId: string; isAbsent?: boolean; isUpdated?: boolean }>): CollectiveAudience[] {
  const map = new Map(statuses.map((s) => [s.studentId, s]));
  return audiences.map((a) => ({ ...a, students: a.students.map((s) => (map.has(s.id) ? { ...s, isAbsent: !!map.get(s.id)!.isAbsent, isUpdated: !!map.get(s.id)!.isUpdated } : s)) }));
}

/** Formulaire d'édition à partir d'une absence collective reçue du serveur. */
export function formFromCollective(c: CollectiveAbsence, reasons: Array<{ id: number; proving?: boolean }>): { form: CollectiveForm; loadedIds: string[] } {
  const audiences: CollectiveAudience[] = c.audiences.map((a) => ({ id: a.id, name: a.name, students: (a.students ?? []).map((s) => ({ id: s.id, displayName: s.displayName ?? s.id })) }));
  const hm = (d: string) => /[T ](\d{2}:\d{2})/.exec(d)?.[1] ?? '';
  const rule = reasonRule(reasons.find((r) => r.id === c.reasonId));
  return {
    form: {
      id: c.id, startDate: c.startDate.slice(0, 10), endDate: c.endDate.slice(0, 10), startTime: hm(c.startDate), endTime: hm(c.endDate),
      reasonId: c.reasonId ?? null, counsellorRegularisation: c.counsellorRegularisation ?? rule.counsellorRegularisation, comment: c.comment ?? '', audiences,
    },
    loadedIds: audiences.flatMap((a) => a.students.map((s) => s.id)),
  };
}
