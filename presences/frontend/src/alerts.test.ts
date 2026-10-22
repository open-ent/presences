import { describe, expect, it } from 'vitest';
import { addAudiences, audienceSelection, alertKey, alertParams, mergeAlerts, punishLink, resetBody, selectedStudents, typesFromParam } from './alerts';

const a = (id: string, type: string, count = 3) => ({ student_id: id, type, count, name: `Élève ${id}`, audience: '6A' });

describe('alerts', () => {
  it('construit les paramètres de la liste et de l’export', () => {
    const f = { structureId: 's1', types: ['ABSENCE' as const, 'LATENESS' as const], studentIds: ['e1'], classIds: ['c1', 'c2'], start: '2026-09-01', end: '2026-10-22' };
    expect(alertParams(f, 2)).toBe('?type=ABSENCE&type=LATENESS&student=e1&class=c1&class=c2&start_at=2026-09-01&end_at=2026-10-22&page=2');
    expect(alertParams({ ...f, start: undefined, end: undefined })).toBe('?type=ABSENCE&type=LATENESS&student=e1&class=c1&class=c2');
  });
  it('fusionne les pages sans doublon élève + type', () => {
    expect(mergeAlerts([a('e1', 'ABSENCE')], [a('e1', 'ABSENCE'), a('e1', 'LATENESS'), a('e2', 'ABSENCE')]).map(alertKey)).toEqual(['e1|ABSENCE', 'e1|LATENESS', 'e2|ABSENCE']);
  });
  it('liste les élèves distincts des alertes cochées', () => {
    const list = [a('e1', 'ABSENCE'), a('e1', 'LATENESS'), a('e2', 'ABSENCE')];
    expect(selectedStudents(list, new Set(['e1|ABSENCE', 'e1|LATENESS', 'e2|ABSENCE'])).map((s) => s.id)).toEqual(['e1', 'e2']);
    expect(selectedStudents(list, new Set())).toEqual([]);
  });
  it('prépare la remise à zéro et le lien de punition', () => {
    expect(resetBody([a('e1', 'ABSENCE')], '2026-09-01', '2026-10-22')).toEqual({ start_at: '2026-09-01', end_at: '2026-10-22', deleted_alert: [a('e1', 'ABSENCE')] });
    expect(punishLink([{ id: 'e1' }, { id: 'e2' }])).toBe('/incidents?ui=react#/punitions?students=e1,e2');
  });
  it('lit le type demandé par une carte de l’accueil', () => {
    expect(typesFromParam('LATENESS')).toEqual(['LATENESS']);
    expect(typesFromParam('AUTRE')).toHaveLength(4);
    expect(typesFromParam(null)).toHaveLength(4);
  });
  it('remplace un regroupement par ses classes, sans doublon', () => {
    expect(audienceSelection({ id: 'g1', name: 'Niveau 6e', members: [{ id: 'c1', name: '6A' }, { id: 'c2', name: '6B' }] })).toEqual([{ id: 'c1', name: '6A' }, { id: 'c2', name: '6B' }]);
    expect(audienceSelection({ id: 'c1', name: '6A' })).toEqual([{ id: 'c1', name: '6A' }]);
    expect(audienceSelection({ id: 'g2', name: 'Vide', members: [] })).toEqual([{ id: 'g2', name: 'Vide' }]);
    expect(addAudiences([{ id: 'c1', name: '6A' }], [{ id: 'c1', name: '6A' }, { id: 'c2', name: '6B' }]).map((x) => x.id)).toEqual(['c1', 'c2']);
  });
});
