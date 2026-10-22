/** Filtres de la liste des événements (absences, retards, départs) et construction des URL serveur. */
export type EventKind = 'absence' | 'lateness' | 'departure';
export type RegularizedFilter = 'all' | 'yes' | 'no';
export type FollowedFilter = 'all' | 'yes' | 'no';

export interface EventFilters {
  structureId: string;
  start: string;
  end: string;
  kinds: EventKind[];
  regularized: RegularizedFilter;
  /** Motifs retenus (identifiants). */
  reasonIds: number[];
  /** Inclut les événements sans motif. */
  noReason: boolean;
  /** Élèves et classes retenus (vide = tous). */
  studentIds?: string[];
  classIds?: string[];
  /** Suivi (une action a été engagée) : tous / suivis / non suivis. */
  followed?: FollowedFilter;
  /** Créneau horaire : heures « HH:mm » ou « HH:mm:ss ». */
  startTime?: string;
  endTime?: string;
}

/** Identifiants serveur des types d'événement. */
export const KIND_TYPE_ID: Record<EventKind, number> = { absence: 1, lateness: 2, departure: 3 };

export const eventTypeParam = (kinds: EventKind[]): string => kinds.map((k) => KIND_TYPE_ID[k]).join(',');

const full = (t: string) => (t.length === 5 ? `${t}:00` : t);

/** Paramètres communs à la liste (GET /events) et à l'export (GET /events/export). */
export function filterParams(f: EventFilters): string {
  let p = `structureId=${f.structureId}&startDate=${f.start}&endDate=${f.end}&eventType=${eventTypeParam(f.kinds)}`;
  if (f.regularized !== 'all') p += `&regularized=${f.regularized === 'yes'}`;
  if (f.reasonIds.length > 0) p += `&reasonIds=${f.reasonIds.join(',')}`;
  // Le serveur distingue le « sans motif » des absences de celui des retards.
  if (f.noReason) p += `&noReason=true&noReasonLateness=true`;
  if (f.studentIds && f.studentIds.length > 0) p += `&userId=${f.studentIds.join(',')}`;
  if (f.classIds && f.classIds.length > 0) p += `&classes=${f.classIds.join(',')}`;
  if (f.followed && f.followed !== 'all') p += `&followed=${f.followed === 'yes'}`;
  if (f.startTime) p += `&startTime=${full(f.startTime)}`;
  if (f.endTime) p += `&endTime=${full(f.endTime)}`;
  return p;
}

export const exportUrl = (f: EventFilters, type: 'CSV' | 'PDF'): string => `/presences/events/export?type=${type}&${filterParams(f)}`;

/** Libellé de la sélection de types vide : aucun appel serveur n'est utile. */
export const hasNothingToLoad = (f: EventFilters): boolean => f.kinds.length === 0;

export const toggleKind = (kinds: EventKind[], k: EventKind): EventKind[] => (kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]);
