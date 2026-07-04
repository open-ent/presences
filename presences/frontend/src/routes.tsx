import { RouteObject, createHashRouter } from 'react-router-dom';

import { Absences } from './screens/Absences';
import { Dashboard } from './screens/Dashboard';
import { Registre } from './screens/Registre';
import { Root } from './screens/Root';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'registre', element: <Registre /> },
      { path: 'absences', element: <Absences /> },
    ],
  },
];

// Hash router : app servie sous `/presences` (route serveur unique), routage dans le fragment. CCTP 51C.
export const router = createHashRouter(routes);
