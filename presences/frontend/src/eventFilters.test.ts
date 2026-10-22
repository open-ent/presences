import { describe, expect, it } from 'vitest';
import { EventFilters, eventTypeParam, exportUrl, filterParams, hasNothingToLoad, toggleKind } from './eventFilters';

const base: EventFilters = { structureId: 's1', start: '2026-09-01', end: '2026-09-30', kinds: ['absence', 'lateness'], regularized: 'all', reasonIds: [], noReason: false };

describe('eventFilters', () => {
  it('traduit les types en identifiants serveur', () => {
    expect(eventTypeParam(['absence', 'departure'])).toBe('1,3');
  });
  it('ne filtre ni la régularisation ni les motifs par défaut', () => {
    expect(filterParams(base)).toBe('structureId=s1&startDate=2026-09-01&endDate=2026-09-30&eventType=1,2');
  });
  it('ajoute régularisation, motifs et « sans motif »', () => {
    expect(filterParams({ ...base, regularized: 'no', reasonIds: [3, 5], noReason: true })).toContain('&regularized=false&reasonIds=3,5&noReason=true&noReasonLateness=true');
    expect(filterParams({ ...base, regularized: 'yes' })).toContain('&regularized=true');
  });
  it('construit l’URL d’export', () => {
    expect(exportUrl(base, 'CSV')).toBe('/presences/events/export?type=CSV&structureId=s1&startDate=2026-09-01&endDate=2026-09-30&eventType=1,2');
  });
  it('bascule un type et détecte la sélection vide', () => {
    expect(toggleKind(['absence'], 'lateness')).toEqual(['absence', 'lateness']);
    expect(toggleKind(['absence'], 'absence')).toEqual([]);
    expect(hasNothingToLoad({ ...base, kinds: [] })).toBe(true);
  });
  it('ajoute élèves, classes, suivi et créneau horaire', () => {
    const p = filterParams({ ...base, studentIds: ['e1', 'e2'], classIds: ['c1'], followed: 'no', startTime: '08:00', endTime: '09:00:00' });
    expect(p).toContain('&userId=e1,e2&classes=c1&followed=false&startTime=08:00:00&endTime=09:00:00');
    expect(filterParams({ ...base, followed: 'all', studentIds: [] })).toBe(filterParams(base));
  });
});
