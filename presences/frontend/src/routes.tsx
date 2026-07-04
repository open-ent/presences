import { RouteObject, createHashRouter } from 'react-router-dom';

import { Absences } from './screens/Absences';
import { Accueil } from './screens/Accueil';
import { Dashboard } from './screens/Dashboard';
import { Dispenses } from './screens/Dispenses';
import { Regularisation } from './screens/Regularisation';
import { Registre } from './screens/Registre';
import { Root } from './screens/Root';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Accueil /> },
      { path: 'registre', element: <Registre /> },
      { path: 'absences', element: <Absences /> },
      { path: 'regularisation', element: <Regularisation /> },
      { path: 'dispenses', element: <Dispenses /> },
      { path: 'parametrage', element: <Dashboard /> },
    ],
  },
];

// Hash router : app servie sous `/presences` (route serveur unique), routage dans le fragment. CCTP 51C.
export const router = createHashRouter(routes);
