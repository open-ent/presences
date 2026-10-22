/** Indicateurs statistiques (Global, Mensuel, Hebdomadaire) : filtres, corps de requête, tableaux (fonctions pures, testables). */

export type IndicatorName = 'Global' | 'Monthly' | 'Weekly';
export const INDICATORS: IndicatorName[] = ['Global', 'Monthly', 'Weekly'];
export const INDICATOR_LABEL: Record<IndicatorName, string> = { Global: 'Global', Monthly: 'Mensuel', Weekly: 'Hebdomadaire' };

export type EventType = 'NO_REASON' | 'UNREGULARIZED' | 'REGULARIZED' | 'LATENESS' | 'DEPARTURE' | 'PUNISHMENT' | 'SANCTION';
const ABSENCE_TYPES: string[] = ['NO_REASON', 'UNREGULARIZED', 'REGULARIZED'];
/** Types sur lesquels le taux d'absentéisme s'applique. */
const RATE_TYPES = ['ABSENCE_TOTAL', 'NO_REASON', 'UNREGULARIZED', 'REGULARIZED'];

/** Un motif (absence ou retard) ; l'identifiant 0 représente les retards sans motif. */
export interface Reason { id: number; label: string; proving?: boolean; reason_type_id?: number }
export interface PunishmentType { id: number; label: string; type?: string; hidden?: boolean }

/** Les types proposés par indicateur ; punitions et sanctions n'existent pas en 1D pour le global. */
export function indicatorTypes(name: IndicatorName, oneD = false): EventType[] {
  const base: EventType[] = ['NO_REASON', 'UNREGULARIZED', 'REGULARIZED', 'LATENESS', 'DEPARTURE'];
  if (name === 'Weekly') return base;
  if (name === 'Global' && oneD) return base;
  return [...base, 'PUNISHMENT', 'SANCTION'];
}

export interface Filters {
  types: EventType[];
  /** Motifs retenus : tous cochés au départ. */
  reasons: Record<number, boolean>;
  punishmentTypes: Record<number, boolean>;
  from: { on: boolean; value: number };
  to: { on: boolean; value: number };
  hourDetail: boolean;
}

export const NO_LATENESS_REASON: Reason = { id: 0, label: 'Sans motif', reason_type_id: 2 };
const ABSENCE = 1;
const LATENESS = 2;

export function initialFilters(name: IndicatorName, reasons: Reason[], punishmentTypes: PunishmentType[], oneD = false): Filters {
  return {
    types: indicatorTypes(name, oneD),
    reasons: Object.fromEntries(reasons.map((r) => [r.id, true])),
    punishmentTypes: Object.fromEntries(punishmentTypes.map((t) => [t.id, true])),
    from: { on: false, value: 0 },
    to: { on: false, value: 0 },
    hourDetail: false,
  };
}

/** Coche ou décoche un type d'événement et les motifs qui lui sont liés (comme l'AngularJS). */
export function toggleType(f: Filters, type: EventType, reasons: Reason[], punishmentTypes: PunishmentType[]): Filters {
  const on = !f.types.includes(type);
  const types = on ? [...f.types, type] : f.types.filter((x) => x !== type);
  const r = { ...f.reasons };
  const p = { ...f.punishmentTypes };
  if (type === 'UNREGULARIZED') reasons.filter((x) => x.reason_type_id === ABSENCE && x.proving === false).forEach((x) => (r[x.id] = on));
  if (type === 'REGULARIZED') reasons.filter((x) => x.reason_type_id === ABSENCE).forEach((x) => (r[x.id] = on));
  if (type === 'LATENESS') reasons.filter((x) => x.reason_type_id === LATENESS || x.id === 0).forEach((x) => (r[x.id] = on));
  if (type === 'PUNISHMENT') punishmentTypes.filter((x) => x.type === 'PUNISHMENT').forEach((x) => (p[x.id] = on));
  if (type === 'SANCTION') punishmentTypes.filter((x) => x.type === 'SANCTION').forEach((x) => (p[x.id] = on));
  return { ...f, types, reasons: r, punishmentTypes: p };
}

/** Coche un motif : le type d'événement correspondant est coché d'office. */
export function toggleReason(f: Filters, reason: Reason): Filters {
  const on = !f.reasons[reason.id];
  const reasons = { ...f.reasons, [reason.id]: on };
  let types = f.types;
  if (on) {
    const add = (t: EventType) => { if (!types.includes(t)) types = [...types, t]; };
    if (reason.reason_type_id === LATENESS || reason.id === 0) add('LATENESS');
    else {
      add('REGULARIZED');
      if (!reason.proving) add('UNREGULARIZED');
    }
  }
  return { ...f, reasons, types };
}

/** Vue mensuelle en tableau : une seule famille d'événements (les absences, ou un seul autre type). */
export function monthlyTableTypes(types: EventType[]): EventType[] {
  const absences = types.filter((t) => ABSENCE_TYPES.includes(t));
  if (absences.length > 0) return absences;
  const others = types.filter((t) => !ABSENCE_TYPES.includes(t));
  return others.length === 1 ? others : ['NO_REASON'];
}

export const absenceSelected = (types: EventType[]): boolean => types.some((t) => ABSENCE_TYPES.includes(t));

const iso = (d: string, time: string) => `${d}T${time}`;

export interface IndicatorBody {
  start: string;
  end: string;
  types: string[];
  filters: Record<string, unknown>;
  reasons: number[];
  punishmentTypes: number[];
  sanctionTypes: number[];
  noLatenessReason: boolean;
  users: string[];
  audiences: string[];
}

/** Corps commun des requêtes d'indicateur et de graphique. */
export function indicatorBody(f: Filters, start: string, end: string, users: string[], audiences: string[], punishmentTypes: PunishmentType[], types: EventType[] = f.types): IndicatorBody {
  const picked = (kind: string) => punishmentTypes.filter((t) => t.type === kind && f.punishmentTypes[t.id]).map((t) => t.id);
  const filters: Record<string, unknown> = {};
  if (f.from.on) filters.FROM = f.from.value;
  if (f.to.on) filters.TO = f.to.value;
  if (f.hourDetail) filters.HOUR_DETAIL = true;
  return {
    start: iso(start, '00:00:00'),
    end: iso(end, '23:59:59'),
    types,
    filters,
    reasons: Object.keys(f.reasons).map(Number).filter((id) => id !== 0 && f.reasons[id]),
    punishmentTypes: picked('PUNISHMENT'),
    sanctionTypes: picked('SANCTION'),
    noLatenessReason: Boolean(f.reasons[0]),
    users,
    audiences,
  };
}

/** URL d'export CSV (téléchargement direct), mêmes critères que l'affichage. */
export function exportUrl(structureId: string, name: IndicatorName, body: IndicatorBody, exportOption?: 'ALL' | 'AUDIENCES'): string {
  let url = `/statistics-presences/structures/${structureId}/indicators/${name}/export?start=${body.start}&end=${body.end}`;
  body.users.forEach((u) => (url += `&users=${u}`));
  body.audiences.forEach((a) => (url += `&audiences=${a}`));
  if (exportOption) url += `&export_option=${exportOption}`;
  body.types.forEach((t) => (url += `&types=${t}`));
  Object.entries(body.filters).forEach(([k, v]) => (url += `&${k}=${v}`));
  if (body.noLatenessReason) url += '&noLatenessReason=true';
  body.punishmentTypes.forEach((t) => (url += `&punishmentTypes=${t}`));
  body.sanctionTypes.forEach((t) => (url += `&sanctionTypes=${t}`));
  body.reasons.forEach((r) => (url += `&reasons=${r}`));
  return url;
}

/** Valeur affichée d'un compteur global : taux (%) pour les absences en mode « taux », nombre sinon. */
export function displayCount(type: string, count: number | undefined, rate: number | undefined, rateMode: boolean): string {
  if (rateMode && RATE_TYPES.includes(type)) return `${rate ?? 0}%`;
  return String(count ?? 0);
}

export const isRateType = (type: string): boolean => RATE_TYPES.includes(type);

// ── Mensuel ──────────────────────────────────────────────────────────────────────
export interface MonthStat { count: number; slots?: number; max?: boolean }
export interface MonthlyStudent { name: string; months: Array<Record<string, MonthStat>>; total?: number }
export interface MonthlyAudience { audience: string; months: Array<Record<string, MonthStat>>; students: MonthlyStudent[]; total?: number }

/** Libellés de mois (dans l'ordre) de la première classe qui en a, dédoublonnés avec ceux déjà connus. */
export function monthLabels(data: MonthlyAudience[], known: string[] = []): string[] {
  const first = data.find((a) => a.months && a.months.length > 0);
  const fresh = first ? first.months.map((m) => Object.keys(m)[0]) : [];
  return [...known, ...fresh.filter((m) => !known.includes(m))];
}

/** Valeur d'un mois (absente = null) dans la liste `months` d'une classe ou d'un élève. */
export function monthStat(months: Array<Record<string, MonthStat>>, label: string): MonthStat | null {
  const found = months.find((m) => m[label] !== undefined);
  return found ? found[label] : null;
}

/** Ajoute une page de résultats aux précédentes, sans doublon de classe. */
export function mergeMonthly(previous: MonthlyAudience[], page: MonthlyAudience[]): MonthlyAudience[] {
  const seen = new Set(previous.map((a) => a.audience));
  return [...previous, ...page.filter((a) => !seen.has(a.audience))];
}

// ── Graphique mensuel ────────────────────────────────────────────────────────────
export interface Series { type: string; points: number[] }

/** Une série par type : les compteurs de chaque mois, dans l'ordre des mois. */
export function graphSeries(data: Record<string, Array<Record<string, { count: number }>>> | null, months: string[]): Series[] {
  if (!data) return [];
  return Object.keys(data).map((type) => ({ type, points: months.map((m, i) => data[type][i]?.[m]?.count ?? 0) }));
}

// ── Hebdomadaire ─────────────────────────────────────────────────────────────────
export interface WeeklyRow { dayOfWeek: number; slot_id: string; rate: number; max?: boolean }
export interface Slot { id?: string; _id?: string; name: string; startHour: string; endHour: string }

const slotKey = (s: Slot) => s._id ?? s.id ?? '';

export interface WeeklyGrid { days: number[]; slots: Slot[]; cell: (day: number, slot: Slot) => WeeklyRow | undefined }

/** Grille créneaux × jours : seuls les créneaux connus (avec heures) sont conservés. */
export function weeklyGrid(rows: WeeklyRow[], slots: Slot[]): WeeklyGrid {
  const known = slots.filter((s) => s.startHour && s.endHour);
  const ids = new Set(known.map(slotKey));
  const kept = rows.filter((r) => ids.has(r.slot_id));
  const lastDay = Math.max(5, ...kept.map((r) => r.dayOfWeek));
  return {
    days: Array.from({ length: lastDay }, (_, i) => i + 1),
    slots: [...known].sort((a, b) => a.startHour.localeCompare(b.startHour)),
    cell: (day, slot) => kept.find((r) => r.dayOfWeek === day && r.slot_id === slotKey(slot)),
  };
}

export const DAY_LABEL = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Libellé court d'un mois « YYYY-MM… » ou « YYYY-MM-DD » → « sept. 2026 ». */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(month);
  if (!m) return month;
  const names = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${names[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}
