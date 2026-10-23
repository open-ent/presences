import {
  AppHeader,
  Breadcrumb,
  Layout,
  LoadingScreen,
  useEdificeClient,
} from '@open-ent/react';
import { NavLink, Outlet } from 'react-router-dom';

import { useRights } from '../rights';
import { StructureSelect } from '../structure';
import { UiSwitchFab } from '../components/UiSwitchFab';

/** Gabarit commun : bandeau ENT (Layout + AppHeader + fil d'Ariane) + navigation + contenu. */
export function Root() {
  const { currentApp, init, user } = useEdificeClient();
  const rights = useRights();
  if (!init) return <LoadingScreen />;

  const tab = (to: string, label: string, end?: boolean) => (
    <NavLink to={to} end={end} className={({ isActive }) => `btn btn-${isActive ? 'primary' : 'secondary'} text-start${isActive ? ' active' : ''}`}>{label}</NavLink>
  );

  return (
    <div className="d-flex flex-column vh-100">
      <Layout>
        <div className="d-print-none">
          <AppHeader>{currentApp && <Breadcrumb app={currentApp} />}</AppHeader>
        </div>
        <div className="flex-grow-1 overflow-auto">
          <div className="py-16 pe-24">
            <StructureSelect />
            <div className="pres-shell">
            {!(user?.type === 'ELEVE' || user?.type === 'PERSRELELEVE') && <nav className="pres-side" aria-label="Navigation présences" data-side-nav>
              {tab('/', 'Tableau de bord', true)}
              {rights.readRegister && tab('/registre', "Registre d'appel")}
              {rights.readRegister && tab('/appels', 'Liste des appels')}
              {rights.presencesList && tab('/presences-saisies', 'Présences')}
              {rights.registry && tab('/registre-mensuel', 'Registre mensuel')}
              {rights.calendar && tab('/calendrier', 'Saisir un événement')}
              {rights.absences && tab('/absences', 'Saisie des absences')}
              {rights.absences && tab('/absences-prevues', 'Absences prévues')}
              {rights.readEvent && tab('/regularisation', 'Régularisation')}
              {rights.collectiveAbsences && tab('/absences-collectives', 'Absences collectives')}
              {rights.widgetAlerts && tab('/alertes', 'Alertes')}
              {rights.statements && tab('/declarations', "Déclarations d'absence")}
              {rights.readExemption && tab('/dispenses', 'Dispenses')}
              {rights.absences && tab('/parametrage', 'Paramétrage')}
            </nav>}
            <main className="pres-main"><Outlet /></main>
            </div>
          </div>
        </div>
      </Layout>
      <UiSwitchFab />
    </div>
  );
}

export default Root;
