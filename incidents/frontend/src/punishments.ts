/** Punitions et sanctions : catégories, formulaire de création, corps des requêtes (fonctions pures, testables). */

export type CategoryId = 1 | 2 | 3 | 4;
/** 1 travail supplémentaire, 2 retenue, 3 blâme, 4 exclusion. */
export const CATEGORY_LABEL: Record<CategoryId, string> = { 1: 'Travail supplémentaire', 2: 'Retenue', 3: 'Blâme', 4: 'Exclusion' };

export interface Slot { date: string; startTime: string; endTime: string; place: string }

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

/** Corps de POST /incidents/punishments (« fields » : tableau pour la retenue, objet sinon). */
export function createBody(f: PunishmentForm): Record<string, unknown> {
  const base = { structure_id: f.structureId, type_id: f.typeId, student_ids: f.studentIds, description: f.description };
  switch (f.categoryId) {
    case 1:
      return { ...base, fields: { delay_at: sec(f.delayDate, '00:00:00'), instruction: f.instruction } };
    case 2:
      return { ...base, fields: f.slots.map((s) => ({ start_at: sec(s.date, s.startTime), end_at: sec(s.date, s.endTime), place: s.place })) };
    case 4:
      return { ...base, fields: { start_at: sec(f.excludeStart, '00:00:00'), end_at: sec(f.excludeEnd, '23:59:59'), mandatory_presence: f.mandatoryPresence } };
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
export function listParams(structureId: string, start: string, end: string, process: ProcessFilter, typeIds: number[]): string {
  let p = `structure_id=${structureId}&start_at=${start}&end_at=${end}`;
  for (const id of typeIds) p += `&type_id=${id}`;
  if (process === 'processed') p += '&process=PROCESSED';
  if (process === 'not') p += '&process=NOT_PROCESSED';
  return p;
}
