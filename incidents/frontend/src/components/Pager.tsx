import { useTranslation } from 'react-i18next';

/**
 * Pagination des listes (le serveur renvoie 20 lignes par page) : sans elle, seules les 20 premières lignes étaient
 * visibles, sans indication qu'il en existait d'autres.
 */
export function Pager({ page, hasNext, onChange }: { page: number; hasNext: boolean; onChange: (page: number) => void }) {
  const { t } = useTranslation(['incidents', 'common']);
  if (page === 0 && !hasNext) return null;
  return (
    <nav className="d-flex align-items-center justify-content-center gap-12 my-12" aria-label={t('presences.pager', { defaultValue: 'Pagination' })} data-pager>
      <button type="button" className="btn btn-outline-primary btn-sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
        {t('presences.page.previous', { defaultValue: 'Précédent' })}
      </button>
      <span role="status">{t('presences.page.number', { defaultValue: 'Page' })} {page + 1}</span>
      <button type="button" className="btn btn-outline-primary btn-sm" disabled={!hasNext} onClick={() => onChange(page + 1)}>
        {t('presences.page.next', { defaultValue: 'Suivant' })}
      </button>
    </nav>
  );
}

export default Pager;
