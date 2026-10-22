import { useHasWorkflow } from '@open-ent/react';

/**
 * Droits de workflow du module Présences — mêmes clés que l'IHM AngularJS (`public/ts/rights.ts`), pour que les deux
 * interfaces accordent les mêmes accès. Sans ce filtrage, un enseignant, un élève ou un parent voyait toute l'IHM du
 * personnel de vie scolaire, et chaque lecture refusée par le serveur s'y affichait comme une panne.
 */
export const WORKFLOW = {
  readRegister: 'fr.openent.presences.controller.RegisterController|getRegister',
  readEvent: 'fr.openent.presences.controller.events.EventController|getEvents',
  readExemption: 'fr.openent.presences.controller.ExemptionController|getExemptions',
  manageExemption: 'fr.openent.presences.controller.ExemptionController|createExemptions',
  createEvent: 'fr.openent.presences.controller.events.EventController|postEvent',
  widgetAlerts: 'fr.openent.presences.controller.FakeRight|widgetAlerts',
  widgetForgottenRegisters: 'fr.openent.presences.controller.FakeRight|widgetForgottenRegisters',
  widgetStatements: 'fr.openent.presences.controller.FakeRight|widgetStatements',
  manageStatements: 'fr.openent.presences.controller.StatementAbsenceController|validate',
  manageStatementsRestricted: 'fr.openent.presences.controller.FakeRight|manageAbsenceStatementsRestricted',
  viewStatements: 'fr.openent.presences.controller.FakeRight|AbsenceStatementsView',
  createStatement: 'fr.openent.presences.controller.FakeRight|AbsenceStatementsCreate',
  widgetDayCourses: 'fr.openent.presences.controller.FakeRight|widgetDayCourses',
  widgetDayPresences: 'fr.openent.presences.controller.FakeRight|widgetDayPresences',
  widgetAbsences: 'fr.openent.presences.controller.FakeRight|widgetAbsences',
  viewCalendar: 'fr.openent.presences.controller.CalendarController|getCalendarCourses',
  managePresences: 'fr.openent.presences.controller.FakeRight|managePresences',
  readPresences: 'fr.openent.presences.controller.FakeRight|readPresence',
} as const;

export interface Rights {
  /** Les droits sont chargés (sinon tout est `false` et rien ne doit être demandé au serveur). */
  ready: boolean;
  readRegister: boolean;
  readEvent: boolean;
  readExemption: boolean;
  manageExemption: boolean;
  createEvent: boolean;
  widgetAlerts: boolean;
  widgetForgottenRegisters: boolean;
  widgetStatements: boolean;
  /** Consulter et traiter les déclarations d'absence des parents (droit complet, restreint ou de lecture). */
  statements: boolean;
  /** Déposer une déclaration d'absence (responsable légal). */
  createStatement: boolean;
  widgetDayCourses: boolean;
  widgetDayPresences: boolean;
  /** Droit d'accès aux absences et aux motifs (`AbsenceRight` côté serveur : un des trois droits). */
  absences: boolean;
  /** Au moins un droit du personnel : l'usager voit l'IHM de vie scolaire. */
  staff: boolean;
}

const has = (workflow: string) => useHasWorkflow(workflow) as boolean | undefined;

/** Droits de la session. `undefined` (chargement) est traité comme « pas encore » : aucune requête ne part. */
export function useRights(): Rights {
  const flags = {
    readRegister: has(WORKFLOW.readRegister),
    readEvent: has(WORKFLOW.readEvent),
    readExemption: has(WORKFLOW.readExemption),
    manageExemption: has(WORKFLOW.manageExemption),
    createEvent: has(WORKFLOW.createEvent),
    widgetAlerts: has(WORKFLOW.widgetAlerts),
    widgetForgottenRegisters: has(WORKFLOW.widgetForgottenRegisters),
    widgetStatements: has(WORKFLOW.widgetStatements),
    manageStatements: has(WORKFLOW.manageStatements),
    manageStatementsRestricted: has(WORKFLOW.manageStatementsRestricted),
    viewStatements: has(WORKFLOW.viewStatements),
    createStatement: has(WORKFLOW.createStatement),
    widgetDayCourses: has(WORKFLOW.widgetDayCourses),
    widgetDayPresences: has(WORKFLOW.widgetDayPresences),
    widgetAbsences: has(WORKFLOW.widgetAbsences),
    viewCalendar: has(WORKFLOW.viewCalendar),
    managePresences: has(WORKFLOW.managePresences),
  };
  const ready = Object.values(flags).every((v) => v !== undefined);
  const b = (v: boolean | undefined) => v === true;
  const out = {
    readRegister: b(flags.readRegister),
    readEvent: b(flags.readEvent),
    readExemption: b(flags.readExemption),
    manageExemption: b(flags.manageExemption),
    createEvent: b(flags.createEvent),
    widgetAlerts: b(flags.widgetAlerts),
    widgetForgottenRegisters: b(flags.widgetForgottenRegisters),
    widgetStatements: b(flags.widgetStatements),
    widgetDayCourses: b(flags.widgetDayCourses),
    widgetDayPresences: b(flags.widgetDayPresences),
  };
  const statements = b(flags.manageStatements) || b(flags.manageStatementsRestricted) || b(flags.viewStatements);
  const absences = b(flags.widgetAbsences) || b(flags.viewCalendar) || b(flags.managePresences);
  return { ready, ...out, statements, createStatement: b(flags.createStatement), absences, staff: absences || statements || Object.values(out).some(Boolean) };
}
