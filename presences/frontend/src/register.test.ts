import { describe, expect, it } from 'vitest';

import { EVENT, eventOf, nowOnDay, shiftDay, sqlDate, stateKey, summary, timeOf, withTime } from './register';

describe('formats de date du registre', () => {
  it('sqlDate normalise le format ISO', () => {
    expect(sqlDate('2026-10-22T08:00:00.000')).toBe('2026-10-22 08:00:00');
    expect(sqlDate('2026-10-22 08:00:00')).toBe('2026-10-22 08:00:00');
    expect(sqlDate(undefined)).toBe('');
  });
  it('timeOf et withTime', () => {
    expect(timeOf('2026-10-22 08:05:00')).toBe('08:05');
    expect(timeOf('illisible')).toBe('');
    expect(withTime('2026-10-22T08:00:00', '09:15')).toBe('2026-10-22 09:15:00');
  });
  it('nowOnDay : jour du registre, heure courante à la minute', () => {
    expect(nowOnDay('2026-10-22T08:00:00', new Date(2030, 0, 1, 9, 7, 45))).toBe('2026-10-22 09:07:00');
  });
  it('shiftDay franchit mois et année', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('événements d’un élève', () => {
  const s = (events: Array<{ id: number; type_id: number }>) => ({ id: 'x', name: 'N', events });
  it('eventOf cherche par type', () => {
    expect(eventOf(s([{ id: 1, type_id: 2 }]), EVENT.LATENESS)?.id).toBe(1);
    expect(eventOf(s([{ id: 1, type_id: 2 }]), EVENT.ABSENCE)).toBeUndefined();
    expect(eventOf({ id: 'x', name: 'N' }, EVENT.ABSENCE)).toBeUndefined();
  });
  it('summary compte chaque type', () => {
    const students = [s([{ id: 1, type_id: 1 }]), s([{ id: 2, type_id: 2 }, { id: 3, type_id: 4 }]), s([]), s([{ id: 4, type_id: 3 }])];
    expect(summary(students)).toEqual({ absent: 1, late: 1, departed: 1, remarks: 1 });
  });
  it('stateKey', () => {
    expect(stateKey(3)).toBe('done');
    expect(stateKey(2)).toBe('inProgress');
    expect(stateKey(1)).toBe('todo');
    expect(stateKey(null)).toBe('todo');
  });
});
