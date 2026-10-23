/**
 * Bouton de bascule ancienne / nouvelle interface — COPIE LOCALE du composant du socle (`@open-ent/react`, Layout/UiSwitchFab),
 * limitée à l'adresse `/presences` : le registre des modules à double interface du socle publié ne contient pas ce module.
 * À supprimer quand le socle republié le connaîtra (le composant s'efface alors de lui-même).
 */
import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';


/**
 * Entrées du menu : style explicite, et non `btn-link` — ce style est invisible (texte sur fond clair) dans
 * le thème du premier degré. Ex. entrée « Ancienne version » lisible en 1D comme en 2D.
 */
const ITEM_STYLE = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 0,
  background: 'transparent',
  color: '#243242',
  padding: '8px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  font: 'inherit',
} as const;

/** Bandeaux d'invitation / de retour d'expérience des modules : le bouton leur laisse la place. */
const BANNERS = '[class*="-ui-switch"], [data-ui-banner]';

/**
 * Un bandeau est « affiché » s'il n'est ni masqué ni sans boîte. `offsetParent` vaut null pour tout élément
 * en position fixe (cas des bandeaux) : il ne peut pas servir de test.
 */
const bannerVisible = (): boolean =>
  Array.from(document.querySelectorAll<HTMLElement>(BANNERS)).some((el) => {
    if (el.hidden || el.classList.contains('openent-ui-fab')) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
  });

async function readUi(key: string): Promise<string | undefined> {
  try {
    const res = await fetch(`/userbook/preference/${key}`, { credentials: 'include' });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { preference?: string | null } | null;
    if (!body?.preference) return undefined;
    return (JSON.parse(body.preference) as { ui?: string })?.ui;
  } catch {
    return undefined;
  }
}

/**
 * Bascule PERMANENTE entre la nouvelle et l'ancienne interface d'un module à double interface :
 * bouton flottant en bas à droite, sans compteur — on peut aller et venir autant qu'on veut.
 *
 *  - n'écrit AUCUNE préférence (dérogation d'URL `?ui=` seule) ;
 *  - n'apparaît que si l'usager n'a fait aucun choix dans les paramètres du compte (« Choix de la
 *    plateforme ») : dès qu'une préférence y est posée, la page de réglages gouverne ;
 *  - laisse la place au bandeau d'invitation ou de retour d'expérience du module tant qu'il est
 *    affiché, puis prend le relais.
 * Ex. sur `/diary` sans préférence : « ⇄ Version de l'interface » → « Ancienne version » → `/diary?ui=angular`.
 */
export const UiSwitchFab = () => {
  const { t } = useTranslation();
  const app = 'presences';
  const dual = window.location.pathname.split('/')[1] === app;

  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [banner, setBanner] = useState(true);

  useEffect(() => {
    if (!dual) return;
    let alive = true;
    void readUi(`${app.replace(/[^a-zA-Z0-9]/g, '')}Ui`).then((ui) => {
      if (alive) setAllowed(ui !== 'react' && ui !== 'angular');
    });
    return () => {
      alive = false;
    };
  }, [dual, app]);

  useEffect(() => {
    if (!dual || !allowed) return;
    // Le bandeau du module apparaît après sa propre lecture de la préférence : on laisse un instant,
    // puis on suit ses apparitions et disparitions.
    const refresh = () => setBanner(bannerVisible());
    const timer = window.setTimeout(refresh, 1200);
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { attributes: true, attributeFilter: ['hidden', 'class'], childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [dual, allowed]);

  // Le socle publié ne connaît pas encore ce module ; s'il l'affiche un jour, on s'efface (jamais deux boutons).
  if (!dual || !allowed || banner || document.querySelector('[data-ui-fab]:not([data-ui-fab-local])')) return null;

  return (
    <div className="openent-ui-fab" data-ui-fab data-ui-fab-local style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1040 }}>
      {open && (
        <div
          role="menu"
          className="card shadow p-4"
          style={{ position: 'absolute', right: 0, bottom: 48, minWidth: 220, background: '#fff' }}
        >
          <button type="button" role="menuitem" style={ITEM_STYLE} aria-current="true" onClick={() => setOpen(false)}>
            <strong>{t('ui.switch.new', { defaultValue: 'Nouvelle version' })}</strong> ({t('ui.switch.current', { defaultValue: 'actuelle' })})
          </button>
          <button
            type="button"
            role="menuitem"
            style={ITEM_STYLE}
            onClick={() => {
              window.location.href = `${window.location.pathname}?ui=angular`;
            }}
          >
            {t('ui.switch.old', { defaultValue: 'Ancienne version' })}
          </button>
        </div>
      )}
      <button
        type="button"
        className="btn btn-secondary rounded-pill shadow"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⇄ {t('ui.switch.label', { defaultValue: "Version de l'interface" })}
      </button>
    </div>
  );
};

export default UiSwitchFab;
