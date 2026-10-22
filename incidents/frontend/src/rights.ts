import { useHasWorkflow } from '@open-ent/react';

/** Droits de workflow du module (noms Angular `fr.openent.incidents.controller.FakeRight|…`). */
export const WORKFLOW = {
  readPunishment: 'fr.openent.incidents.controller.FakeRight|punishmentsView',
  readSanction: 'fr.openent.incidents.controller.FakeRight|sanctionsView',
  createPunishment: 'fr.openent.incidents.controller.FakeRight|punishmentCreate',
  createSanction: 'fr.openent.incidents.controller.FakeRight|sanctionCreate',
};

export interface Rights { ready: boolean; readPunishment: boolean; readSanction: boolean; createPunishment: boolean; createSanction: boolean }

/** `undefined` (chargement) = « pas encore » : l'écran attend avant de proposer des actions. */
export function useRights(): Rights {
  const a = useHasWorkflow(WORKFLOW.readPunishment) as boolean | undefined;
  const b = useHasWorkflow(WORKFLOW.readSanction) as boolean | undefined;
  const c = useHasWorkflow(WORKFLOW.createPunishment) as boolean | undefined;
  const d = useHasWorkflow(WORKFLOW.createSanction) as boolean | undefined;
  return { ready: [a, b, c, d].every((v) => v !== undefined), readPunishment: a === true, readSanction: b === true, createPunishment: c === true, createSanction: d === true };
}

/** Un type « PUNISHMENT »/« SANCTION » est-il créable avec ces droits ? */
export const canCreateType = (r: Rights, kind?: string): boolean => (kind === 'SANCTION' ? r.createSanction : r.createPunishment);
