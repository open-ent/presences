import { describe, expect, it } from 'vitest';
import { currentCourse } from './currentCourse';

describe('currentCourse', () => {
  const now = new Date('2026-10-23T09:30:00');
  const c = (id: string, s: string, e: string) => ({ id, startDate: `2026-10-23T${s}`, endDate: `2026-10-23T${e}` });
  it('retient le cours dont l’intervalle contient l’heure courante', () => {
    expect(currentCourse([c('a', '08:00:00', '09:00:00'), c('b', '09:00:00', '10:00:00')], now)?.id).toBe('b');
  });
  it('renvoie undefined hors cours, ou si les bornes sont exclusives', () => {
    expect(currentCourse([c('a', '08:00:00', '09:30:00'), c('b', '09:30:00', '10:00:00')], now)).toBeUndefined();
    expect(currentCourse([], now)).toBeUndefined();
  });
});
