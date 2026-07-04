import { RouteObject, createHashRouter } from 'react-router-dom';

import { Historique } from './screens/Historique';
import { Publipostage } from './screens/Publipostage';
import { Root } from './screens/Root';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Publipostage /> },
      { path: 'historique', element: <Historique /> },
    ],
  },
];

// Hash router : app servie sous `/massmailing` (route serveur unique), routage dans le fragment. CCTP 51C.
export const router = createHashRouter(routes);
