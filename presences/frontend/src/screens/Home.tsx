import { LoadingScreen, useEdificeClient } from '@open-ent/react';

import { Accueil } from './Accueil';
import { isFamilyProfile, MonSuivi } from './MonSuivi';

/** Page d'accueil selon le profil : suivi de l'élève ou de son enfant pour la famille, tableau de bord pour le personnel. */
export function Home() {
  const { user, init } = useEdificeClient();
  if (!init) return <LoadingScreen position={false} />;
  return isFamilyProfile(user?.type) ? <MonSuivi /> : <Accueil />;
}

export default Home;
