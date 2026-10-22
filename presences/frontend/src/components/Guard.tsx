import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingScreen } from '@open-ent/react';

import { Rights, useRights } from '../rights';

/**
 * Garde d'un écran par un droit de workflow : sans le droit, un message clair plutôt qu'un écran dont chaque lecture est
 * refusée par le serveur. Tant que les droits ne sont pas chargés, rien n'est affiché (ni requête envoyée).
 */
export function Guard({ right, children }: { right: Exclude<keyof Rights, 'ready'>; children: ReactNode }) {
  const { t } = useTranslation(['presences', 'common']);
  const rights = useRights();
  if (!rights.ready) return <LoadingScreen position={false} />;
  if (!rights[right]) {
    return (
      <div className="alert alert-warning" role="alert" data-no-right>
        {t('presences.no.right', { defaultValue: "Votre compte n'a pas le droit d'accéder à cette fonction." })}
      </div>
    );
  }
  return <>{children}</>;
}

export default Guard;
