/** Registre mensuel : requêtes, regroupement des événements d'une journée, catégories d'affichage (fonctions pures). */

export type RegistryType = 'ABSENCE' | 'LATENESS' | 'INCIDENT' | 'DEPARTURE';
export const REGISTRY_TYPES: RegistryType[] = ['ABSENCE', 'LATENESS', 'INCIDENT', 'DEPARTURE'];

export interface RegistryEvent {
  type: string;
  start_date?: string;
  end_date?: string;
  startDate?: string;
  endDate?: string;
  reason_id?: number | null;
  reason?: string | null;
  counsellor_regularisation?: boolean;
  followed?: boolean;
  incident_type?: string;
  place?: string;
  protagonist_type?: string;
}

export interface RegistryDay { date: string; events: RegistryEvent[]; exclude?: boolean; forgottenNotebook?: boolean }
export interface RegistryStudent { id: string; displayName: string; className?: string; days: RegistryDay[] }

export interface RegistryFilters { structureId: string; month: string; groupIds: string[]; types: RegistryType[]; forgottenNotebook: boolean }

/** Une seule famille d'événement doit être demandée au moins : types ou carnet oublié. */
export const hasNothingToShow = (f: RegistryFilters): boolean => f.groupIds.length === 0 || (f.types.length === 0 && !f.forgottenNotebook);

const groupsAndTypes = (f: RegistryFilters) => f.groupIds.map((g) => `&group=${g}`).join('') + f.types.map((t) => `&type=${t}`).join('');

export const registryUrl = (f: RegistryFilters): string =>
  `/presences/registry?structureId=${f.structureId}&month=${f.month}${groupsAndTypes(f)}${f.forgottenNotebook ? '&forgottenNotebook=true' : ''}`;

/** Export de la liste des événements (CSV). */
export const eventListExportUrl = (f: RegistryFilters): string =>
  `/presences/registry/export?structureId=${f.structureId}&month=${f.month}${groupsAndTypes(f)}${f.forgottenNotebook ? '&forgottenNotebook=true' : ''}`;

/** Export du registre d'appel (tableau du mois, sans filtre de type). */
export const callRegisterExportUrl = (f: RegistryFilters): string =>
  `/presences/registry/export/new?structureId=${f.structureId}&month=${f.month}${f.groupIds.map((g) => `&group=${g}`).join('')}`;

/** Mois de l'année scolaire (septembre → août) : valeur `YYYY-MM` et libellé « septembre 2026 ». */
export function schoolMonths(ref: Date = new Date()): Array<{ value: string; label: string }> {
  const names = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const y = ref.getMonth() >= 8 ? ref.getFullYear() : ref.getFullYear() - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const m = (8 + i) % 12; // 8 = septembre
    const year = m >= 8 ? y : y + 1;
    return { value: `${year}-${String(m + 1).padStart(2, '0')}`, label: `${names[m]} ${year}` };
  });
}

export const currentMonth = (ref: Date = new Date()): string => `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;

/** Événements distincts d'une journée : une absence par motif, une ligne par autre type (l'affichage empile les barres). */
export function eventsDisplay(events: RegistryEvent[]): RegistryEvent[] {
  const absences: RegistryEvent[] = [];
  const others: RegistryEvent[] = [];
  for (const e of events) {
    if (e.type === 'ABSENCE') { if (!absences.some((a) => (a.reason ?? '') === (e.reason ?? ''))) absences.push(e); }
    else if (!others.some((o) => o.type === e.type)) others.push(e);
  }
  return [...others, ...absences];
}

export type DayBar = 'absent' | 'absent-followed' | 'absent-reason-unregularized' | 'absent-reason-regularized' | 'lateness' | 'incident' | 'departure' | 'forgotten-notebook';

/** Couleur de chaque barre (celles de l'IHM AngularJS). */
export const BAR_COLOR: Record<DayBar, string> = {
  absent: '#e61610',
  'absent-followed': '#000000',
  'absent-reason-unregularized': '#ff8a84',
  'absent-reason-regularized': '#72bb53',
  lateness: '#9c29b7',
  incident: '#aaaaaa',
  departure: '#f2c9fb',
  'forgotten-notebook': '#b0ead5',
};

export const BAR_LABEL: Record<DayBar, string> = {
  absent: 'Absence sans motif',
  'absent-followed': 'Absence suivie',
  'absent-reason-unregularized': 'Absence justifiée, non régularisée',
  'absent-reason-regularized': 'Absence justifiée, régularisée',
  lateness: 'Retard',
  incident: 'Incident',
  departure: 'Départ anticipé',
  'forgotten-notebook': 'Carnet oublié',
};

const has = (events: RegistryEvent[], type: string) => events.some((e) => e.type === type);
const hasReason = (events: RegistryEvent[]) => events.some((e) => e.reason_id !== undefined && e.reason_id !== null);
const isRegularized = (events: RegistryEvent[]) => events.length > 0 && !events.some((e) => e.type === 'ABSENCE' && e.counsellor_regularisation === false);
const isFollowed = (events: RegistryEvent[]) => events.length > 0 && !events.some((e) => e.followed === false);

/** Barres d'une journée, dans l'ordre de l'IHM AngularJS (état d'absence, retard, incident, départ, carnet). */
export function dayBars(day: RegistryDay): DayBar[] {
  const ev = eventsDisplay(day.events);
  const bars: DayBar[] = [];
  if (ev.length > 0 && has(ev, 'ABSENCE')) {
    const followed = isFollowed(ev);
    if (!followed && !hasReason(ev)) bars.push('absent');
    else if (followed) bars.push('absent-followed');
    else if (!isRegularized(ev) && hasReason(ev)) bars.push('absent-reason-unregularized');
    else if (isRegularized(ev) && hasReason(ev)) bars.push('absent-reason-regularized');
  }
  if (has(ev, 'LATENESS')) bars.push('lateness');
  if (has(ev, 'INCIDENT')) bars.push('incident');
  if (has(ev, 'DEPARTURE')) bars.push('departure');
  if (day.forgottenNotebook) bars.push('forgotten-notebook');
  return bars;
}

/** Heure « 8h30 » d'une date serveur. */
export function heureCourte(d?: string): string {
  const m = /[T ](\d{2}):(\d{2})/.exec(d ?? '');
  return m ? `${Number(m[1])}h${m[2]}` : '';
}

/** Ligne de détail d'un événement pour la fiche d'une journée. */
export function eventLine(e: RegistryEvent): { kind: DayBar; title: string; detail: string } {
  const start = heureCourte(e.start_date ?? e.startDate);
  const end = heureCourte(e.end_date ?? e.endDate);
  switch (e.type) {
    case 'ABSENCE': {
      const followed = e.followed === true;
      const kind: DayBar = followed ? 'absent-followed' : !e.reason ? 'absent' : e.counsellor_regularisation ? 'absent-reason-regularized' : 'absent-reason-unregularized';
      return { kind, title: `Absence ${start}–${end}`, detail: e.reason ? `Motif : ${e.reason}` : 'Sans motif' };
    }
    case 'LATENESS': return { kind: 'lateness', title: `Retard ${end}`, detail: '' };
    case 'INCIDENT': return { kind: 'incident', title: `${e.incident_type ?? 'Incident'} ${start}`, detail: [e.place, e.protagonist_type].filter(Boolean).join(' — ') };
    default: return { kind: 'departure', title: `Départ anticipé ${start}`, detail: '' };
  }
}

/** Jours du mois (1..n) d'après la première ligne du tableau. */
export const monthDays = (students: RegistryStudent[]): number[] => (students[0]?.days ?? []).map((_, i) => i + 1);
