import { RouteObject, createHashRouter } from 'react-router-dom';

import { Absences } from './screens/Absences';
import { Dashboard } from './screens/Dashboard';
import { Dispenses } from './screens/Dispenses';
import { Regularisation } from './screens/Regularisation';
import { Registre } from './screens/Registre';
import { Root } from './screens/Root';
import { Guard } from './components/Guard';
import { Home } from './screens/Home';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      { path: 'registre', element: <Guard right="readRegister"><Registre /></Guard> },
      { path: 'absences', element: <Guard right="absences"><Absences /></Guard> },
      { path: 'regularisation', element: <Guard right="readEvent"><Regularisation /></Guard> },
      { path: 'dispenses', element: <Guard right="readExemption"><Dispenses /></Guard> },
      { path: 'parametrage', element: <Guard right="absences"><Dashboard /></Guard> },
    ],
  },
];

// Hash router : app servie sous `/presences` (route serveur unique), routage dans le fragment. CCTP 51C.
export const router = createHashRouter(routes);
