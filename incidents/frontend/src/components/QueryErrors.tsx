import { useTranslation } from 'react-i18next';

/**
 * Lectures en échec : message et « Réessayer ». Avant, une panne du serveur (session expirée, droit manquant, 5xx)
 * s'affichait comme « aucune donnée » (« Aucun appel oublié », « Aucune absence à régulariser »…).
 */
export function QueryErrors({ queries }: { queries: Array<{ isError: boolean; refetch: () => unknown }> }) {
  const { t } = useTranslation(['incidents', 'common']);
  const failed = queries.filter((q) => q.isError);
  if (failed.length === 0) return null;
  return (
    <div className="alert alert-warning d-flex align-items-center justify-content-between gap-12" role="alert" data-load-error>
      <span>{t('presences.load.error', { defaultValue: "Certaines données n'ont pas pu être chargées. Ce qui s'affiche peut être incomplet." })}</span>
      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => failed.forEach((q) => void q.refetch())}>
        {t('presences.retry', { defaultValue: 'Réessayer' })}
      </button>
    </div>
  );
}

export default QueryErrors;
