import { describe, expect, it } from 'vitest';
import { absenceDates, exportUrl, followedParam, initialPlannedFilters, listUrl, plannedParams, plannedPeriod, regularizedParam, regularizeState } from './plannedAbsences';

const f = initialPlannedFilters('s1', '2026-10-23', '2026-11-23', [1, 2]);

describe('plannedAbsences', () => {
  it('ne restreint ni la régularisation ni le suivi quand tout est coché', () => {
    expect(regularizedParam(f)).toBeNull();
    expect(followedParam(f)).toBeNull();
    expect(plannedParams(f)).toBe('start=2026-10-23 00:00:00&end=2026-11-23 23:59:59&reason=1&reason=2&noReason=true');
  });
  it('restreint à régularisées ou non régularisées seulement', () => {
    expect(regularizedParam({ noReasons: false, regularized: true, notRegularized: false })).toBe(true);
    expect(regularizedParam({ noReasons: false, regularized: false, notRegularized: true })).toBe(false);
    expect(regularizedParam({ noReasons: true, regularized: false, notRegularized: false })).toBeNull();
    expect(followedParam({ followed: false, notFollowed: true })).toBe(false);
  });
  it('construit la période avec les créneaux choisis', () => {
    expect(plannedPeriod({ start: '2026-10-23', end: '2026-10-23', startHour: '08:00', endHour: '10:00:00' })).toEqual({ start: '2026-10-23 08:00:00', end: '2026-10-23 10:00:00' });
  });
  it('ajoute élèves, classes, demi-pensionnaires, internes, suivi', () => {
    const p = plannedParams({ ...f, studentIds: ['e1'], classIds: ['c1'], halfBoarders: true, interns: true, followed: true, notFollowed: false, regularized: false, notRegularized: true, noReasons: false });
    expect(p).toContain('&regularized=false&student=e1&classes=c1&reason=1&reason=2&noReason=false&followed=true&halfBoarder=true&internal=true');
  });
  it('construit les adresses de liste et d’export', () => {
    expect(listUrl(f, 2)).toBe('/presences/absences?structure=s1&start=2026-10-23 00:00:00&end=2026-11-23 23:59:59&reason=1&reason=2&noReason=true&page=2');
    expect(exportUrl(f, 'PDF')).toBe('/presences/structures/s1/absences/export/pdf?start=2026-10-23 00:00:00&end=2026-11-23 23:59:59&reason=1&reason=2&noReason=true');
    expect(exportUrl(f, 'CSV')).toContain('/export/csv?');
  });
  it('formate les dates', () => {
    expect(absenceDates({ start_date: '2026-10-22 08:00:00', end_date: '2026-10-22 17:00:00' })).toBe('le 22/10/2026');
    expect(absenceDates({ start_date: '2026-10-22 08:00:00', end_date: '2026-10-24 17:00:00' })).toBe('du 22/10/2026 au 24/10/2026');
  });
  it('n’offre la régularisation que pour un motif non justifiant', () => {
    const proving = { 1: true, 2: false };
    expect(regularizeState({ id: 1, start_date: '', end_date: '', reason: { id: 2 } }, proving)).toEqual({ visible: true, disabled: false });
    expect(regularizeState({ id: 1, start_date: '', end_date: '', reason: { id: 1 } }, proving)).toEqual({ visible: false, disabled: false });
    expect(regularizeState({ id: 1, start_date: '', end_date: '', reason: null, counsellor_regularisation: true }, proving)).toEqual({ visible: false, disabled: true });
  });
});
