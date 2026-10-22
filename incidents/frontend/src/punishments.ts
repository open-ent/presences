/** Punitions et sanctions : catégories, formulaire de création, corps des requêtes (fonctions pures, testables). */

export type CategoryId = 1 | 2 | 3 | 4;
/** 1 travail supplémentaire, 2 retenue, 3 blâme, 4 exclusion. */
export const CATEGORY_LABEL: Record<CategoryId, string> = { 1: 'Travail supplémentaire', 2: 'Retenue', 3: 'Blâme', 4: 'Exclusion' };

export interface Slot { date: string; startTime: string; endTime: string; place: string; /** Identifiant de la retenue existante (édition). */ id?: string }

/** Absence déclarée en même temps qu'une exclusion. */
export interface AbsenceChoice { enabled: boolean; reasonId: number | null; followed: boolean }

/** Punition en cours d'édition : l'élève, le type et l'auteur ne changent pas. */
export interface Editing { id: string; groupedId?: string; ownerId: string; studentId: string; studentName: string; processed: boolean }

export interface PunishmentForm {
  typeId: number | null;
  categoryId: CategoryId | null;
  structureId: string;
  studentIds: string[];
  description: string;
  /** Travail supplémentaire : date de remise (YYYY-MM-DD) et consigne. */
  delayDate: string;
  instruction: string;
  /** Retenue : créneaux. */
  slots: Slot[];
  /** Exclusion : début/fin (YYYY-MM-DD) et présence obligatoire. */
  excludeStart: string;
  excludeEnd: string;
  mandatoryPresence: boolean;
  absence: AbsenceChoice;
  editing?: Editing;
}

export const emptySlot = (): Slot => ({ date: '', startTime: '', endTime: '', place: '' });

export const emptyForm = (structureId: string): PunishmentForm => ({
  typeId: null,
  categoryId: null,
  structureId,
  studentIds: [],
  description: '',
  delayDate: '',
  instruction: '',
  slots: [emptySlot()],
  excludeStart: '',
  excludeEnd: '',
  mandatoryPresence: false,
  absence: { enabled: false, reasonId: null, followed: true },
});

const sec = (date: string, time: string) => `${date} ${time.length === 5 ? `${time}:00` : time}`;

/** Message d'erreur du formulaire (clé d'affichage), `null` si la saisie est complète. */
export function formError(f: PunishmentForm): string | null {
  if (f.typeId === null || f.categoryId === null) return 'type';
  if (f.studentIds.length === 0) return 'students';
  if (f.categoryId === 1 && !f.delayDate) return 'delay';
  if (f.categoryId === 2) {
    if (f.slots.length === 0) return 'slots';
    for (const s of f.slots) {
      if (!s.date || !s.startTime || !s.endTime) return 'slots';
      if (s.endTime <= s.startTime) return 'slot-order';
    }
  }
  if (f.categoryId === 4) {
    if (!f.excludeStart || !f.excludeEnd) return 'period';
    if (f.excludeEnd < f.excludeStart) return 'period-order';
  }
  return null;
}

const absencePart = (f: PunishmentForm) => (f.absence.enabled ? { absence: { reason_id: f.absence.reasonId, followed: f.absence.followed } } : {});

/** Corps de POST /incidents/punishments (« fields » : tableau pour la retenue, objet sinon). */
export function createBody(f: PunishmentForm): Record<string, unknown> {
  const base = { structure_id: f.structureId, type_id: f.typeId, student_ids: f.studentIds, description: f.description };
  switch (f.categoryId) {
    case 1:
      return { ...base, fields: { delay_at: sec(f.delayDate, '00:00:00'), instruction: f.instruction } };
    case 2:
      return { ...base, fields: f.slots.map((s) => ({ start_at: sec(s.date, s.startTime), end_at: sec(s.date, s.endTime), place: s.place })) };
    case 4:
      return {
        ...base,
        fields: { start_at: sec(f.excludeStart, '00:00:00'), end_at: sec(f.excludeEnd, '23:59:59'), mandatory_presence: f.mandatoryPresence },
        ...absencePart(f),
      };
    default:
      return { ...base, fields: {} };
  }
}

/** Une punition telle que renvoyée par GET /punishments (champs utiles). */
export interface RawPunishment {
  id: string;
  grouped_punishment_id?: string;
  structure_id?: string;
  description?: string;
  fields?: unknown;
  processed?: boolean;
  type?: { id?: number; label?: string; type?: string; punishment_category_id?: number };
  owner?: { id?: string; displayName?: string };
  student?: { id?: string; displayName?: string; classeName?: string };
  created_at?: string;
}

/** Corps de PUT /incidents/punishments pour marquer une punition traitée / non traitée (renvoie l'objet complet). */
export function processBody(p: RawPunishment, processed: boolean): Record<string, unknown> {
  return {
    id: p.id,
    grouped_punishment_id: p.grouped_punishment_id,
    structure_id: p.structure_id,
    description: p.description,
    fields: p.fields,
    type_id: p.type?.id,
    type: p.type,
    owner_id: p.owner?.id,
    student_id: p.student?.id,
    processed,
  };
}

const fr = (d: string) => (/^(\d{4})-(\d{2})-(\d{2})/.exec(d) ? d.replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$3/$2/$1') : '');
const hm = (d: string) => /[T ](\d{2}:\d{2})/.exec(d)?.[1] ?? '';

/** Détail lisible des champs d'une punition : échéance, créneaux de retenue, période d'exclusion. */
export function fieldsSummary(fields: unknown): string {
  if (Array.isArray(fields)) {
    return fields
      .map((s: { start_at?: string; end_at?: string; place?: string }) => {
        const d = fr(s.start_at ?? '');
        return d ? `${d} ${hm(s.start_at ?? '')}–${hm(s.end_at ?? '')}${s.place ? ` (${s.place})` : ''}` : '';
      })
      .filter(Boolean)
      .join(' ; ');
  }
  const f = (fields ?? {}) as { delay_at?: string; instruction?: string; start_at?: string; end_at?: string };
  if (f.delay_at) return `${fr(f.delay_at)}${f.instruction ? ` — ${f.instruction}` : ''}`;
  if (f.start_at && f.end_at) return `${fr(f.start_at)} → ${fr(f.end_at)}`;
  return '';
}

export type ProcessFilter = 'all' | 'processed' | 'not';

/** Paramètres de filtre communs à la liste et à l'export. */
export function listParams(structureId: string, start: string, end: string, process: ProcessFilter, typeIds: number[], studentIds: string[] = [], groupIds: string[] = []): string {
  let p = `structure_id=${structureId}&start_at=${start}&end_at=${end}`;
  for (const id of typeIds) p += `&type_id=${id}`;
  for (const id of studentIds) p += `&student_id=${id}`;
  for (const id of groupIds) p += `&group_id=${id}`;
  if (process === 'processed') p += '&process=PROCESSED';
  if (process === 'not') p += '&process=NOT_PROCESSED';
  return p;
}

/** Remplit le formulaire d'édition à partir d'une punition (et, pour une retenue, de toutes celles de son groupe). */
export function formFromPunishment(p: RawPunishment, group: RawPunishment[] = []): PunishmentForm {
  const f = emptyForm(p.structure_id ?? '');
  const cat = (p.type?.punishment_category_id ?? null) as CategoryId | null;
  const out: PunishmentForm = {
    ...f,
    typeId: p.type?.id ?? null,
    categoryId: cat,
    studentIds: p.student?.id ? [p.student.id] : [],
    description: p.description ?? '',
    editing: { id: p.id, groupedId: p.grouped_punishment_id, ownerId: p.owner?.id ?? '', studentId: p.student?.id ?? '', studentName: p.student?.displayName ?? '', processed: Boolean(p.processed) },
  };
  const fields = (p.fields ?? {}) as { delay_at?: string; instruction?: string; start_at?: string; end_at?: string; mandatory_presence?: boolean };
  if (cat === 1) {
    out.delayDate = (fields.delay_at ?? '').slice(0, 10);
    out.instruction = fields.instruction ?? '';
  } else if (cat === 2) {
    const all = group.length > 0 ? group : [p];
    out.slots = all
      .map((g) => {
        const sf = (g.fields ?? {}) as { start_at?: string; end_at?: string; place?: string };
        return { id: g.id, date: (sf.start_at ?? '').slice(0, 10), startTime: hm(sf.start_at ?? ''), endTime: hm(sf.end_at ?? ''), place: sf.place ?? '' };
      })
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  } else if (cat === 4) {
    out.excludeStart = (fields.start_at ?? '').slice(0, 10);
    out.excludeEnd = (fields.end_at ?? '').slice(0, 10);
    out.mandatoryPresence = Boolean(fields.mandatory_presence);
  }
  return out;
}

/** Corps de PUT /incidents/punishments pour une modification (les créneaux existants gardent leur identifiant). */
export function updateBody(f: PunishmentForm): Record<string, unknown> {
  const e = f.editing as Editing;
  const created = createBody(f);
  const fields = Array.isArray(created.fields) ? (created.fields as Array<Record<string, unknown>>).map((x, i) => (f.slots[i]?.id ? { ...x, id: f.slots[i].id } : x)) : created.fields;
  const body: Record<string, unknown> = {
    id: e.id,
    grouped_punishment_id: e.groupedId,
    structure_id: f.structureId,
    description: f.description,
    fields,
    type_id: f.typeId,
    owner_id: e.ownerId,
    student_id: e.studentId,
    processed: e.processed,
  };
  if (created.absence) body.absence = created.absence;
  return body;
}

/** Une absence d'élève (extrait des champs utiles). */
export interface AbsenceInfo { id?: number; start_date: string; end_date: string; reason_id?: number | null; followed?: boolean }

const sameInstant = (a: string, b: string) => a.replace('T', ' ').slice(0, 19) === b.replace('T', ' ').slice(0, 19);

/**
 * Situation d'un élève vis-à-vis des absences de la période d'exclusion :
 * `none` (rien, on peut en déclarer une), `matching` (une absence exactement sur la période, déjà liée),
 * `anomaly` (plusieurs absences ou une absence qui ne correspond pas : aucune déclaration automatique).
 */
export function absenceStatus(absences: AbsenceInfo[], start: string, end: string): 'none' | 'matching' | 'anomaly' {
  if (absences.length === 0) return 'none';
  if (absences.length === 1 && sameInstant(absences[0].start_date, start) && sameInstant(absences[0].end_date, end)) return 'matching';
  return 'anomaly';
}

/** Élèves qui ont déjà au moins une absence sur la période (pas de nouvelle absence pour eux). */
export const anomalyStudents = (byStudent: Record<string, AbsenceInfo[]>): string[] => Object.keys(byStudent).filter((id) => (byStudent[id] ?? []).length > 0);
