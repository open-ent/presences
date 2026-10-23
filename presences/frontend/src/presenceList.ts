/** Présences saisies (1er degré) : filtres, regroupement par jour, formulaire, corps des requêtes (fonctions pures). */

export interface PresenceFilters {
  structureId: string;
  start: string;
  end: string;
  studentIds: string[];
  ownerIds: string[];
  audienceIds: string[];
  /** Seulement mes présences (ajoute l'utilisateur courant aux auteurs). */
  mine: boolean;
}

/** Paramètres communs à la liste et à l'export ; `mine` ajoute l'utilisateur courant sans doublon. */
export function presenceParams(f: PresenceFilters, userId: string): string {
  const owners = f.mine && userId && !f.ownerIds.includes(userId) ? [...f.ownerIds, userId] : f.ownerIds;
  let p = `?structureId=${f.structureId}&startDate=${f.start}&endDate=${f.end}`;
  f.studentIds.forEach((s) => (p += `&studentId=${s}`));
  owners.forEach((o) => (p += `&ownerId=${o}`));
  f.audienceIds.forEach((a) => (p += `&audienceId=${a}`));
  return p;
}

export interface MarkedStudent { student: { id: string; displayName?: string; classeName?: string }; comment?: string }

export interface PresenceRecord {
  id: number;
  structureId: string;
  startDate: string;
  endDate: string;
  discipline?: { id?: number | null; label?: string } | null;
  owner?: { id?: string; displayName?: string };
  markedStudents: MarkedStudent[];
}

/** Jours (récents d'abord) et présences de chaque jour triées par heure de début. */
export function groupByDay(presences: PresenceRecord[]): Array<{ day: string; items: PresenceRecord[] }> {
  const map = new Map<string, PresenceRecord[]>();
  for (const p of presences) {
    const day = p.startDate.slice(0, 10);
    map.set(day, [...(map.get(day) ?? []), p]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({ day, items: [...items].sort((a, b) => a.startDate.localeCompare(b.startDate)) }));
}

export const studentsLabel = (n: number): string => (n === 1 ? '1 élève' : `${n} élèves`);

export interface PresenceForm {
  id?: number;
  structureId: string;
  date: string;
  startTime: string;
  endTime: string;
  disciplineId: number | null;
  owner: { id: string; displayName: string };
  students: Array<{ id: string; displayName: string; classeName?: string; comment: string }>;
}

export const emptyPresenceForm = (structureId: string, today: string, owner: { id: string; displayName: string }): PresenceForm => ({
  structureId, date: today, startTime: '', endTime: '', disciplineId: null, owner, students: [],
});

const hm = (d: string) => /[T ](\d{2}:\d{2})/.exec(d)?.[1] ?? '';

export function formFromPresence(p: PresenceRecord): PresenceForm {
  return {
    id: p.id,
    structureId: p.structureId,
    date: p.startDate.slice(0, 10),
    startTime: hm(p.startDate),
    endTime: hm(p.endDate),
    disciplineId: p.discipline?.id ?? null,
    owner: { id: p.owner?.id ?? '', displayName: p.owner?.displayName ?? '' },
    students: p.markedStudents.map((m) => ({ id: m.student.id, displayName: m.student.displayName ?? m.student.id, classeName: m.student.classeName, comment: m.comment ?? '' })),
  };
}

const full = (t: string) => (t.length === 5 ? `${t}:00` : t);

/** Erreur de saisie (clé), `null` si valide : discipline choisie, au moins un élève, horaires cohérents. */
export function presenceError(f: PresenceForm): 'discipline' | 'students' | 'times' | null {
  if (!f.disciplineId) return 'discipline';
  if (f.students.length === 0) return 'students';
  if (!f.startTime || !f.endTime || f.startTime >= f.endTime) return 'times';
  return null;
}

/** Corps de création (POST) ou de modification (PUT, avec identifiant). */
export function presenceBody(f: PresenceForm): Record<string, unknown> {
  return {
    ...(f.id ? { id: f.id } : {}),
    structureId: f.structureId,
    startDate: `${f.date} ${full(f.startTime)}`,
    endDate: `${f.date} ${full(f.endTime)}`,
    disciplineId: f.disciplineId,
    markedStudents: f.students.map((s) => ({ studentId: s.id, comment: s.comment })),
  };
}

/** Ajoute des élèves sans doublon. */
export function addStudents(current: PresenceForm['students'], added: PresenceForm['students']): PresenceForm['students'] {
  const seen = new Set(current.map((s) => s.id));
  return [...current, ...added.filter((a) => !seen.has(a.id))];
}
