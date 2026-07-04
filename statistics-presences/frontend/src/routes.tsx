import { RouteObject, createHashRouter } from 'react-router-dom';

import { Root } from './screens/Root';
import { Statistiques } from './screens/Statistiques';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [{ index: true, element: <Statistiques /> }],
  },
];

// Hash router : app servie sous `/statistics-presences` (route serveur unique). CCTP 51C.
export const router = createHashRouter(routes);
