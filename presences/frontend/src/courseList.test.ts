import { describe, expect, it } from 'vitest';
import { canNotify, courseDays, courseGroups, coursesExportUrl, coursesUrl, mergeCourses, registerLink } from './courseList';

const f = { structureId: 's1', start: '2026-10-23', end: '2026-10-23', teacherIds: ['t1'], groupNames: ['6A', '6 B'], forgotten: true, withTeacher: true };
const c = (id: string, start: string, extra = {}) => ({ id, startDate: start, endDate: start.replace(/ \d\d:\d\d/, ' 10:00'), ...extra });

describe('courseList', () => {
  it('construit les adresses', () => {
    expect(coursesUrl(f, 100)).toBe('/presences/courses?teacher=t1&group=6A&group=6%20B&structure=s1&start=2026-10-23&end=2026-10-23&forgotten_registers=true&multiple_slot=true&limit=100&offset=100&descendingDate=false&searchTeacher=true');
    expect(coursesExportUrl(f, 'T')).toBe('/presences/courses/export?teacher=t1&group=6A&group=6%20B&structure=s1&start=2026-10-23&end=2026-10-23&forgotten_registers=true&_t=T');
  });
  it('relance un appel oublié selon la règle de l’AngularJS', () => {
    const now = new Date(2026, 9, 23, 10, 0, 0);
    expect(canNotify({ startDate: '2026-10-23 08:00:00' }, now, true)).toBe(true);
    expect(canNotify({ startDate: '2026-10-23 08:00:00' }, now, false)).toBe(false);
    expect(canNotify({ startDate: '2026-10-23 08:00:00', register_state_id: 3 }, now, true)).toBe(false);
    expect(canNotify({ startDate: '2026-10-23 09:50:00' }, now, true)).toBe(false);
    expect(canNotify({ startDate: '2026-10-23 12:00:00' }, now, true)).toBe(false);
    expect(canNotify({ startDate: '2026-10-22 08:00:00' }, now, true)).toBe(true);
    expect(canNotify({ startDate: '2026-10-21 08:00:00' }, now, true)).toBe(false);
  });
  it('regroupe par jour et fusionne les pages', () => {
    const days = courseDays([c('b', '2026-10-24 09:00:00'), c('a', '2026-10-23 10:00:00'), c('d', '2026-10-23 08:00:00')]);
    expect(days.map((d) => d.day)).toEqual(['2026-10-23', '2026-10-24']);
    expect(days[0].items.map((x) => x.id)).toEqual(['d', 'a']);
    expect(mergeCourses([c('a', '2026-10-23 10:00:00')], [c('a', '2026-10-23 10:00:00'), c('b', '2026-10-23 11:00:00')]).map((x) => x.id)).toEqual(['a', 'b']);
    expect(courseGroups({ classes: ['6A'], groups: ['G1'] })).toEqual(['6A', 'G1']);
    expect(registerLink({ id: 'x y', startDate: '2026-10-23 08:00:00' })).toBe('#/registre?date=2026-10-23&course=x%20y');
  });
});
