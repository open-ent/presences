import { describe, expect, it } from 'vitest';

import { multipleSlotParam } from './register';

describe('multipleSlotParam', () => {
  it('le personnel reçoit toujours les créneaux découpés', () => {
    expect(multipleSlotParam(true, false)).toBe(true);
    expect(multipleSlotParam(true, undefined)).toBe(true);
  });
  it('un enseignant suit sa préférence, activée par défaut', () => {
    expect(multipleSlotParam(false, false)).toBe(false);
    expect(multipleSlotParam(false, true)).toBe(true);
    expect(multipleSlotParam(false, undefined)).toBe(true);
  });
});
