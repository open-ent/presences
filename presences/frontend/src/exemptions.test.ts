import { describe, expect, it } from 'vitest';
import {
  dateRange, daysSummary, defaultSubject, emptyExemptionForm, exemptionBody, exemptionDeleteUrl, exemptionEditUrl, exemptionError, exemptionKey, exemptionParams,
  formFromExemption, isRecursive, nextSort,
} from './exemptions';

const f = { structureId: 's1', start: '2026-09-23', end: '2026-10-23', studentIds: ['e1', 'e2'], audienceIds: ['c1'], order: 'date' as const, reverse: false };
const slots = [{ id: 'a', name: 'M1', startHour: '08:00:00', endHour: '09:00:00' }, { id: 'b', name: 'M2', startHour: '09:00:00', endHour: '10:00:00' }];

describe('exemptions', () => {
  it('construit les paramètres de liste et d’export', () => {
    expect(exemptionParams(f, 1)).toBe('?structure_id=s1&start_date=2026-09-23 00:00:00&end_date=2026-10-23 23:59:59&student_id=e1,e2&audience_id=c1&page=1&order=date');
    expect(exemptionParams({ ...f, order: 'attendance', reverse: true }, 0)).toContain('&order=attendance&reverse=true');
    expect(exemptionParams({ ...f, studentIds: [], audienceIds: [] })).toBe('?structure_id=s1&start_date=2026-09-23 00:00:00&end_date=2026-10-23 23:59:59');
  });
  it('inverse le tri sur la même colonne', () => {
    expect(nextSort({ order: 'date', reverse: false }, 'date')).toEqual({ order: 'date', reverse: true });
    expect(nextSort({ order: 'date', reverse: true }, 'attendance')).toEqual({ order: 'attendance', reverse: false });
  });
  it('distingue ponctuelle et récurrente', () => {
    expect(exemptionKey({ exemption_id: 4 })).toBe('p4');
    expect(exemptionKey({ exemption_recursive_id: 9 })).toBe('r9');
    expect(isRecursive({ exemption_recursive_id: 9 })).toBe(true);
    expect(isRecursive({ exemption_id: 4, recursive_id: 9 })).toBe(false);
    expect(exemptionDeleteUrl({ exemption_id: 4 })).toBe('/presences/exemption?id=4');
    expect(exemptionDeleteUrl({ exemption_recursive_id: 9 })).toBe('/presences/exemption/recursive?id=9');
    expect(exemptionEditUrl({ exemptionId: 4, studentId: 'e' })).toBe('/presences/exemption/4');
    expect(exemptionEditUrl({ recursiveId: 9, studentId: 'e' })).toBe('/presences/exemption/9');
  });
  it('choisit l’EPS par défaut', () => {
    expect(defaultSubject([{ id: '1', name: 'Maths' }, { id: '2', name: 'Éducation Physique et Sportive' }])).toBe('2');
    expect(defaultSubject([{ id: '1', name: 'Maths' }, { id: '3', name: 'EPS' }])).toBe('3');
    expect(defaultSubject([{ id: '1', name: 'Maths' }])).toBe('1');
    expect(defaultSubject([])).toBe('');
  });
  it('contrôle le formulaire', () => {
    const base = { ...emptyExemptionForm('s1', '2026-10-23', 'sub'), students: [{ id: 'e1', name: 'Léa' }] };
    expect(exemptionError(emptyExemptionForm('s1', '2026-10-23', 'sub'))).toBe('students');
    expect(exemptionError({ ...base, endDate: '2026-10-01' })).toBe('dates');
    expect(exemptionError({ ...base, subjectId: '' })).toBe('subject');
    expect(exemptionError(base)).toBeNull();
    const rec = { ...base, mode: 'recursive' as const };
    expect(exemptionError(rec)).toBe('days');
    expect(exemptionError({ ...rec, days: ['MONDAY'] })).toBe('slots');
    expect(exemptionError({ ...rec, days: ['MONDAY'], startHour: '08:00', endHour: '10:00' })).toBeNull();
  });
  it('construit le corps ponctuel puis récurrent', () => {
    const base = { ...emptyExemptionForm('s1', '2026-10-23', 'sub'), students: [{ id: 'e1', name: 'Léa' }, { id: 'e2', name: 'Paul' }], comment: 'Certificat' };
    expect(exemptionBody(base)).toEqual({ structure_id: 's1', subject_id: 'sub', start_date: '2026-10-23 00:00:00', end_date: '2026-10-30 23:59:59', attendance: false, comment: 'Certificat', student_id: ['e1', 'e2'] });
    const rec = exemptionBody({ ...base, mode: 'recursive', days: ['MONDAY', 'WEDNESDAY'], everyTwoWeeks: true, startHour: '08:00', endHour: '10:00' });
    expect(rec).toMatchObject({ is_recursive: true, is_every_two_weeks: true, startDateRecursive: '2026-10-23 08:00:00', endDateRecursive: '2026-10-30 10:00:00', day_of_week: ['MONDAY', 'WEDNESDAY'] });
  });
  it('remplit la modification d’une récurrente et d’une ponctuelle', () => {
    const rec = formFromExemption({ exemption_recursive_id: 9, student_id: 'e1', structure_id: 's1', start_date: '2026-10-05 08:00:00', end_date: '2026-11-30 10:00:00', day_of_week: ['MONDAY'], is_every_two_weeks: true, attendance: true, comment: 'x', student: { lastName: 'DUPONT', firstName: 'Léa' } }, 's1', slots);
    expect(rec).toMatchObject({ mode: 'recursive', startHour: '08:00', endHour: '10:00', everyTwoWeeks: true, days: ['MONDAY'], subjectId: '', startDate: '2026-10-05', endDate: '2026-11-30', editing: { recursiveId: 9, studentId: 'e1' } });
    expect(rec.students).toEqual([{ id: 'e1', name: 'DUPONT Léa' }]);
    expect(exemptionBody(rec).student_id).toBe('e1');
    const p = formFromExemption({ exemption_id: 4, student_id: 'e2', subject_id: 'sub', start_date: '2026-10-05 00:00:00', end_date: '2026-10-09 23:59:59' }, 's1', slots);
    expect(p).toMatchObject({ mode: 'punctual', subjectId: 'sub', startHour: '', editing: { exemptionId: 4 } });
  });
  it('résume jours et dates', () => {
    expect(daysSummary(['WEDNESDAY', 'MONDAY'])).toBe('Lun, Mer');
    expect(dateRange({ start_date: '2026-10-05 00:00:00', end_date: '2026-10-09 23:59:59' })).toBe('du 05/10/2026 au 09/10/2026');
  });
});
