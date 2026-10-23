import { describe, expect, it } from 'vitest';
import {
  absencesOf, absencesUrl, addDays, calendarLink, courseBox, coursesOfDay, coursesUrl, courseTone, dayBounds, dayName, eventSummary, hasSaturday, mondayOf, shortComment, weekDays, weekLabel, hhmm, latenessTimeValid, notebookProgress, exemptionLink, stampOf,
} from './studentCalendar';

const course = (start: string, end: string, extra = {}) => ({ startDate: start, endDate: end, subjectName: 'Maths', ...extra });

describe('studentCalendar', () => {
  it('trouve le lundi et les jours de la semaine', () => {
    expect(mondayOf('2026-10-23')).toBe('2026-10-19');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(weekDays('2026-10-19')).toHaveLength(5);
    expect(weekDays('2026-10-19', true)[5]).toBe('2026-10-24');
    expect(dayName('2026-10-23')).toBe('Vendredi');
    expect(weekLabel('2026-10-19')).toBe('19 → 25 octobre 2026');
    expect(weekLabel('2026-10-26')).toBe('26 octobre → 1 novembre 2026');
  });
  it('construit les adresses', () => {
    expect(coursesUrl('s1', 'e1', '2026-10-19', 'T')).toBe('/presences/calendar/courses?structure=s1&start=2026-10-19&end=2026-10-26&user=e1&_t=T');
    expect(absencesUrl('s1', 'e1', '2026-10-19')).toContain('&student=e1');
    expect(calendarLink('e1', '2026-10-22 08:00:00')).toBe('#/calendrier/e1?date=2026-10-22');
  });
  it('rattache les absences aux cours qu’elles recouvrent', () => {
    const c = course('2026-10-20 08:00:00', '2026-10-20 09:00:00');
    expect(absencesOf(c, [{ id: 1, start_date: '2026-10-20 07:00:00', end_date: '2026-10-20 08:30:00' }])).toHaveLength(1);
    expect(absencesOf(c, [{ id: 2, start_date: '2026-10-20 09:00:00', end_date: '2026-10-20 10:00:00' }])).toHaveLength(0);
    expect(absencesOf(c, [{ id: 3, start_date: '2026-10-20T08:15:00', end_date: '2026-10-20T08:45:00' }])).toHaveLength(1);
  });
  it('choisit la couleur du cours', () => {
    const c = course('2026-10-20 08:00:00', '2026-10-20 09:00:00');
    const abs = (extra = {}) => [{ id: 1, start_date: '2026-10-20 08:00:00', end_date: '2026-10-20 09:00:00', ...extra }];
    expect(courseTone(c, [])).toBe('none');
    expect(courseTone(c, abs())).toBe('absence');
    expect(courseTone(c, abs({ reason_id: 2 }))).toBe('absence-reason');
    expect(courseTone(c, abs({ reason_id: 2, counsellor_regularisation: true }))).toBe('absence-regularized');
    expect(courseTone(c, abs({ followed: true }))).toBe('absence-followed');
    expect(courseTone({ ...c, events: [{ type_id: 1, reason_id: 1 }] }, [])).toBe('absence-reason');
    expect(courseTone({ ...c, events: [{ type_id: 2 }] }, [])).toBe('none');
  });
  it('décrit les événements', () => {
    expect(eventSummary({ type_id: 2, end_date: '2026-10-20 08:12:00' })).toEqual({ label: 'Retard', hour: '08:12' });
    expect(eventSummary({ type_id: 3, start_date: '2026-10-20 15:30:00' })).toEqual({ label: 'Départ anticipé', hour: '15:30' });
    expect(shortComment('x'.repeat(250))).toHaveLength(203);
    expect(shortComment(null)).toBe('');
  });
  it('place les cours dans la grille', () => {
    const cs = [course('2026-10-20 07:30:00', '2026-10-20 09:00:00'), course('2026-10-20 17:00:00', '2026-10-20 18:30:00')];
    expect(dayBounds(cs)).toEqual({ from: 420, to: 1140 });
    expect(dayBounds([])).toEqual({ from: 480, to: 1080 });
    const box = courseBox(course('2026-10-20 09:00:00', '2026-10-20 10:00:00'), { from: 480, to: 1080 });
    expect(Math.round(box.top)).toBe(10);
    expect(Math.round(box.height)).toBe(10);
    expect(coursesOfDay([cs[1], cs[0]], '2026-10-20').map((c) => c.startDate.slice(11, 16))).toEqual(['07:30', '17:00']);
    expect(hasSaturday([course('2026-10-24 08:00:00', '2026-10-24 09:00:00')], '2026-10-19')).toBe(true);
  });
});

describe('studentCalendar — retard, carnet, dispense', () => {
  it('extrait et compose les heures', () => {
    expect(hhmm('2026-10-23T08:05:00')).toBe('08:05');
    expect(hhmm('2026-10-23 08:05:00')).toBe('08:05');
    expect(hhmm(undefined)).toBe('');
    expect(stampOf('2026-10-23', '08:15')).toBe('2026-10-23 08:15:00');
  });
  it('valide l’heure d’arrivée dans les bornes du cours', () => {
    expect(latenessTimeValid('08:15', '2026-10-23T08:00:00', '2026-10-23T09:00:00')).toBe(true);
    expect(latenessTimeValid('09:01', '2026-10-23T08:00:00', '2026-10-23T09:00:00')).toBe(false);
    expect(latenessTimeValid('', '2026-10-23T08:00:00', '2026-10-23T09:00:00')).toBe(false);
  });
  it('calcule les pastilles du carnet oublié', () => {
    expect(notebookProgress(2, 3)).toEqual({ filled: 2, total: 3, after: 0 });
    expect(notebookProgress(5, 3)).toEqual({ filled: 3, total: 3, after: 2 });
    expect(notebookProgress(0, 0)).toEqual({ filled: 0, total: 0, after: 0 });
  });
  it('construit le lien de dispense', () => {
    expect(exemptionLink('e1', 'DUPONT Léa', '2026-10-23')).toBe('#/dispenses?student=e1~DUPONT%20L%C3%A9a&start=2026-10-23&end=2026-10-23');
  });
});
