import { describe, expect, it } from 'vitest';
import {
  MonthlyAudience, Reason, absenceSelected, displayCount, exportUrl, graphSeries, indicatorBody, indicatorTypes, initialFilters, mergeMonthly, monthLabel,
  monthLabels, monthStat, monthlyTableTypes, toggleReason, toggleType, weeklyGrid,
} from './indicators';

const reasons: Reason[] = [
  { id: 0, label: 'Sans motif', reason_type_id: 2 },
  { id: 1, label: 'Maladie', proving: true, reason_type_id: 1 },
  { id: 2, label: 'Transport', proving: false, reason_type_id: 1 },
  { id: 3, label: 'Retard bus', reason_type_id: 2 },
];
const ptypes = [{ id: 10, label: 'Blâme', type: 'PUNISHMENT' }, { id: 11, label: 'Exclusion', type: 'SANCTION' }];

describe('types par indicateur', () => {
  it('propose punitions et sanctions sauf pour le global en 1D et le hebdomadaire', () => {
    expect(indicatorTypes('Global')).toContain('PUNISHMENT');
    expect(indicatorTypes('Global', true)).not.toContain('PUNISHMENT');
    expect(indicatorTypes('Monthly', true)).toContain('SANCTION');
    expect(indicatorTypes('Weekly')).toEqual(['NO_REASON', 'UNREGULARIZED', 'REGULARIZED', 'LATENESS', 'DEPARTURE']);
  });
});

describe('filtres', () => {
  it('décocher les non régularisées décoche les motifs non justifiants seulement', () => {
    const f = toggleType(initialFilters('Global', reasons, ptypes), 'UNREGULARIZED', reasons, ptypes);
    expect(f.types).not.toContain('UNREGULARIZED');
    expect(f.reasons[2]).toBe(false);
    expect(f.reasons[1]).toBe(true);
  });
  it('décocher les retards décoche aussi « sans motif »', () => {
    const f = toggleType(initialFilters('Global', reasons, ptypes), 'LATENESS', reasons, ptypes);
    expect(f.reasons[0]).toBe(false);
    expect(f.reasons[3]).toBe(false);
  });
  it('décocher les sanctions décoche leurs types', () => {
    const f = toggleType(initialFilters('Global', reasons, ptypes), 'SANCTION', reasons, ptypes);
    expect(f.punishmentTypes[11]).toBe(false);
    expect(f.punishmentTypes[10]).toBe(true);
  });
  it('cocher un motif de retard rétablit le type retard', () => {
    let f = toggleType(initialFilters('Global', reasons, ptypes), 'LATENESS', reasons, ptypes);
    f = toggleReason(f, reasons[3]);
    expect(f.types).toContain('LATENESS');
  });
  it('cocher un motif non justifiant rétablit les deux types d’absence', () => {
    let f = toggleType(initialFilters('Global', reasons, ptypes), 'REGULARIZED', reasons, ptypes);
    f = toggleType(f, 'UNREGULARIZED', reasons, ptypes);
    f = toggleReason(f, reasons[2]);
    expect(f.types).toEqual(expect.arrayContaining(['REGULARIZED', 'UNREGULARIZED']));
  });
});

describe('vue mensuelle en tableau', () => {
  it('garde les absences, ou un seul autre type, sinon « sans motif »', () => {
    expect(monthlyTableTypes(['LATENESS', 'NO_REASON', 'REGULARIZED'])).toEqual(['NO_REASON', 'REGULARIZED']);
    expect(monthlyTableTypes(['LATENESS'])).toEqual(['LATENESS']);
    expect(monthlyTableTypes(['LATENESS', 'DEPARTURE'])).toEqual(['NO_REASON']);
    expect(monthlyTableTypes([])).toEqual(['NO_REASON']);
    expect(absenceSelected(['LATENESS'])).toBe(false);
  });
});

describe('corps de requête et export', () => {
  const f0 = initialFilters('Global', reasons, ptypes);
  it('construit les bornes, les motifs et les types de punition', () => {
    const b = indicatorBody({ ...f0, from: { on: true, value: 2 }, hourDetail: true }, '2026-09-01', '2026-10-31', ['u1'], ['c1'], ptypes);
    expect(b).toMatchObject({ start: '2026-09-01T00:00:00', end: '2026-10-31T23:59:59', users: ['u1'], audiences: ['c1'], reasons: [1, 2, 3], punishmentTypes: [10], sanctionTypes: [11], noLatenessReason: true });
    expect(b.filters).toEqual({ FROM: 2, HOUR_DETAIL: true });
  });
  it('n’envoie pas les motifs décochés ni « sans motif » dans les identifiants', () => {
    const f = toggleType(f0, 'UNREGULARIZED', reasons, ptypes);
    const b = indicatorBody(f, 'a', 'b', [], [], ptypes);
    expect(b.reasons).toEqual([1, 3]);
  });
  it('construit l’URL d’export', () => {
    const b = indicatorBody({ ...f0, types: ['LATENESS'], to: { on: true, value: 5 } }, '2026-09-01', '2026-10-31', ['u1'], ['c1'], ptypes);
    const url = exportUrl('S1', 'Monthly', b, 'AUDIENCES');
    expect(url).toContain('/statistics-presences/structures/S1/indicators/Monthly/export?start=2026-09-01T00:00:00&end=2026-10-31T23:59:59');
    expect(url).toContain('&users=u1&audiences=c1&export_option=AUDIENCES&types=LATENESS&TO=5&noLatenessReason=true&punishmentTypes=10&sanctionTypes=11&reasons=1&reasons=2&reasons=3');
  });
});

describe('affichage', () => {
  it('le mode taux ne concerne que les absences', () => {
    expect(displayCount('UNREGULARIZED', 4, 12, true)).toBe('12%');
    expect(displayCount('LATENESS', 4, 12, true)).toBe('4');
    expect(displayCount('UNREGULARIZED', 4, undefined, true)).toBe('0%');
    expect(displayCount('NO_REASON', 4, 12, false)).toBe('4');
  });
});

describe('mensuel', () => {
  const data: MonthlyAudience[] = [
    { audience: '6A', months: [{ '2026-09': { count: 2 } }, { '2026-10': { count: 1, max: true } }], students: [], total: 3 },
    { audience: '6B', months: [], students: [], total: 0 },
  ];
  it('lit les mois et les valeurs', () => {
    expect(monthLabels(data)).toEqual(['2026-09', '2026-10']);
    expect(monthLabels(data, ['2026-09'])).toEqual(['2026-09', '2026-10']);
    expect(monthStat(data[0].months, '2026-10')).toEqual({ count: 1, max: true });
    expect(monthStat(data[1].months, '2026-09')).toBeNull();
    expect(monthLabel('2026-09')).toBe('sept. 2026');
  });
  it('fusionne les pages sans doublon', () => {
    expect(mergeMonthly(data.slice(0, 1), data).map((a) => a.audience)).toEqual(['6A', '6B']);
  });
  it('construit les séries du graphique', () => {
    const s = graphSeries({ LATENESS: [{ '2026-09': { count: 2 } }, { '2026-10': { count: 5 } }], NO_REASON: [{ '2026-09': { count: 1 } }] }, ['2026-09', '2026-10']);
    expect(s).toEqual([{ type: 'LATENESS', points: [2, 5] }, { type: 'NO_REASON', points: [1, 0] }]);
    expect(graphSeries(null, [])).toEqual([]);
  });
});

describe('hebdomadaire', () => {
  it('ne garde que les créneaux connus et étend la semaine si besoin', () => {
    const slots = [{ _id: 'a', name: 'M1', startHour: '08:00', endHour: '09:00' }, { id: 'b', name: 'M2', startHour: '', endHour: '' }];
    const g = weeklyGrid([{ dayOfWeek: 1, slot_id: 'a', rate: 12, max: true }, { dayOfWeek: 6, slot_id: 'a', rate: 3 }, { dayOfWeek: 2, slot_id: 'b', rate: 9 }], slots);
    expect(g.slots).toHaveLength(1);
    expect(g.days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(g.cell(1, slots[0])?.rate).toBe(12);
    expect(g.cell(2, slots[0])).toBeUndefined();
  });
});
