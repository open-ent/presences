import { describe, expect, it } from 'vitest';
import { callRegisterExportUrl, currentMonth, dayBars, eventLine, eventListExportUrl, eventsDisplay, hasNothingToShow, heureCourte, monthDays, registryUrl, schoolMonths } from './registry';

const f = { structureId: 's1', month: '2026-10', groupIds: ['c1', 'c2'], types: ['ABSENCE' as const, 'LATENESS' as const], forgottenNotebook: false };

describe('registry', () => {
  it('construit les adresses', () => {
    expect(registryUrl(f)).toBe('/presences/registry?structureId=s1&month=2026-10&group=c1&group=c2&type=ABSENCE&type=LATENESS');
    expect(registryUrl({ ...f, forgottenNotebook: true })).toContain('&forgottenNotebook=true');
    expect(eventListExportUrl(f)).toContain('/presences/registry/export?structureId=s1');
    expect(callRegisterExportUrl(f)).toBe('/presences/registry/export/new?structureId=s1&month=2026-10&group=c1&group=c2');
  });
  it('n’interroge rien sans classe ni famille d’événement', () => {
    expect(hasNothingToShow(f)).toBe(false);
    expect(hasNothingToShow({ ...f, groupIds: [] })).toBe(true);
    expect(hasNothingToShow({ ...f, types: [] })).toBe(true);
    expect(hasNothingToShow({ ...f, types: [], forgottenNotebook: true })).toBe(false);
  });
  it('liste les mois de l’année scolaire', () => {
    const m = schoolMonths(new Date(2026, 9, 23));
    expect(m[0]).toEqual({ value: '2026-09', label: 'septembre 2026' });
    expect(m[4]).toEqual({ value: '2027-01', label: 'janvier 2027' });
    expect(m[11]).toEqual({ value: '2027-08', label: 'août 2027' });
    expect(schoolMonths(new Date(2027, 2, 1))[0].value).toBe('2026-09');
    expect(currentMonth(new Date(2026, 9, 23))).toBe('2026-10');
  });
  it('regroupe les événements d’une journée', () => {
    const ev = eventsDisplay([
      { type: 'ABSENCE', reason: 'Maladie' }, { type: 'ABSENCE', reason: 'Maladie' }, { type: 'ABSENCE', reason: null }, { type: 'LATENESS' }, { type: 'LATENESS' },
    ]);
    expect(ev.map((e) => e.type)).toEqual(['LATENESS', 'ABSENCE', 'ABSENCE']);
  });
  it('choisit les barres d’une journée', () => {
    const day = (events: any[], extra = {}) => ({ date: '2026-10-05', events, ...extra });
    expect(dayBars(day([{ type: 'ABSENCE', reason_id: null, followed: false }]))).toEqual(['absent']);
    expect(dayBars(day([{ type: 'ABSENCE', followed: true }]))).toEqual(['absent-followed']);
    expect(dayBars(day([{ type: 'ABSENCE', reason_id: 2, reason: 'Transport', counsellor_regularisation: false, followed: false }]))).toEqual(['absent-reason-unregularized']);
    expect(dayBars(day([{ type: 'ABSENCE', reason_id: 1, reason: 'Maladie', counsellor_regularisation: true, followed: false }]))).toEqual(['absent-reason-regularized']);
    expect(dayBars(day([{ type: 'LATENESS' }, { type: 'DEPARTURE' }], { forgottenNotebook: true }))).toEqual(['lateness', 'departure', 'forgotten-notebook']);
    expect(dayBars(day([]))).toEqual([]);
  });
  it('décrit un événement', () => {
    expect(heureCourte('2026-10-05 08:05:00')).toBe('8h05');
    expect(eventLine({ type: 'ABSENCE', start_date: '2026-10-05 08:00:00', end_date: '2026-10-05 10:00:00', reason: 'Maladie', counsellor_regularisation: true })).toEqual({ kind: 'absent-reason-regularized', title: 'Absence 8h00–10h00', detail: 'Motif : Maladie' });
    expect(eventLine({ type: 'INCIDENT', start_date: '2026-10-05 11:00:00', incident_type: 'Violence', place: 'Cour', protagonist_type: 'Auteur' })).toEqual({ kind: 'incident', title: 'Violence 11h00', detail: 'Cour — Auteur' });
    expect(eventLine({ type: 'LATENESS', end_date: '2026-10-05 08:12:00' }).title).toBe('Retard 8h12');
  });
  it('donne les jours du mois', () => {
    expect(monthDays([{ id: 'e', displayName: 'x', days: [{ date: 'a', events: [] }, { date: 'b', events: [] }] }])).toEqual([1, 2]);
    expect(monthDays([])).toEqual([]);
  });
});
