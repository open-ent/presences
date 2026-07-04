import { RouteObject, createHashRouter } from 'react-router-dom';

import { Incidents } from './screens/Incidents';
import { Punitions } from './screens/Punitions';
import { Root } from './screens/Root';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Incidents /> },
      { path: 'punitions', element: <Punitions /> },
    ],
  },
];

// Hash router : app servie sous `/incidents` (route serveur unique), routage dans le fragment. CCTP 51C.
export const router = createHashRouter(routes);
