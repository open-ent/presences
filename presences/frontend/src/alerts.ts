/** Alertes (seuils franchis par élève) : requêtes, sélection, remise à zéro, lien vers les punitions (fonctions pures). */

export type AlertType = 'ABSENCE' | 'LATENESS' | 'INCIDENT' | 'FORGOTTEN_NOTEBOOK';
export const ALERT_TYPES_LIST: AlertType[] = ['ABSENCE', 'LATENESS', 'INCIDENT', 'FORGOTTEN_NOTEBOOK'];

/** Une alerte : un élève qui franchit le seuil d'un type, avec son nombre d'événements. */
export interface StudentAlert {
  student_id: string;
  type: string;
  count: number;
  name: string;
  audience: string;
}

export const alertKey = (a: StudentAlert): string => `${a.student_id}|${a.type}`;

export interface AlertFilters {
  structureId: string;
  types: AlertType[];
  studentIds: string[];
  classIds: string[];
  /** Jours « YYYY-MM-DD » (la liste), absents pour l'export. */
  start?: string;
  end?: string;
}

/** Paramètres de la liste (avec dates et page) ou de l'export (sans). */
export function alertParams(f: AlertFilters, page?: number): string {
  let p = `?${f.types.map((t) => `type=${t}`).join('&')}`;
  for (const s of f.studentIds) p += `&student=${s}`;
  for (const c of f.classIds) p += `&class=${c}`;
  if (f.start) p += `&start_at=${f.start}`;
  if (f.end) p += `&end_at=${f.end}`;
  if (page !== undefined) p += `&page=${page}`;
  return p;
}

/** Corps de la remise à zéro des alertes cochées. */
export function resetBody(selected: StudentAlert[], start: string, end: string): { start_at: string; end_at: string; deleted_alert: StudentAlert[] } {
  return { start_at: start, end_at: end, deleted_alert: selected };
}

/** Ajoute une page à la liste sans doublon (même élève et même type). */
export function mergeAlerts(previous: StudentAlert[], page: StudentAlert[]): StudentAlert[] {
  const seen = new Set(previous.map(alertKey));
  return [...previous, ...page.filter((a) => !seen.has(alertKey(a)))];
}

/** Élèves distincts des alertes cochées (pour la punition). */
export function selectedStudents(alerts: StudentAlert[], selected: Set<string>): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const a of alerts) if (selected.has(alertKey(a)) && !seen.has(a.student_id)) seen.set(a.student_id, a.name);
  return [...seen].map(([id, name]) => ({ id, name }));
}

/** Lien vers la saisie d'une punition (application Incidents), élèves présélectionnés. */
export const punishLink = (students: Array<{ id: string; name?: string }>): string =>
  `/incidents?ui=react#/punitions?students=${students.map((s) => (s.name ? `${s.id}~${encodeURIComponent(s.name)}` : s.id)).join(',')}`;

/** Types demandés par le lien d'une carte de l'accueil (`?type=ABSENCE`) : ce type seul, sinon tous. */
export function typesFromParam(param: string | null): AlertType[] {
  return ALERT_TYPES_LIST.includes(param as AlertType) ? [param as AlertType] : ALERT_TYPES_LIST;
}

/** Un résultat de recherche d'audience : une classe ou un groupe, ou un regroupement (avec les classes qui le composent). */
export interface AudienceHit { id: string; name: string; members?: Array<{ id: string; name: string }> }

/** Un regroupement choisi est remplacé par ses classes (comme l'AngularJS) ; une classe ou un groupe reste tel quel. */
export function audienceSelection(hit: AudienceHit): Array<{ id: string; name: string }> {
  return hit.members && hit.members.length > 0 ? hit.members.map((m) => ({ id: m.id, name: m.name })) : [{ id: hit.id, name: hit.name }];
}

/** Ajoute des audiences à la sélection sans doublon. */
export function addAudiences(current: Array<{ id: string; name: string }>, added: Array<{ id: string; name: string }>): Array<{ id: string; name: string }> {
  const seen = new Set(current.map((c) => c.id));
  return [...current, ...added.filter((a) => !seen.has(a.id))];
}
