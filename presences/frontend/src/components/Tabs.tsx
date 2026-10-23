import { ReactNode, useState } from 'react';

export interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
  /** Faux : l'onglet n'est pas proposé (droit manquant). */
  visible?: boolean;
}

/**
 * Onglets accessibles (tablist / tab / tabpanel) : seul le contenu de l'onglet actif est affiché ; le premier onglet
 * visible est actif par défaut, et un onglet devenu invisible laisse la place au premier visible.
 */
export function Tabs({ tabs, label }: { tabs: TabDef[]; label: string }) {
  const shown = tabs.filter((t) => t.visible !== false);
  const [active, setActive] = useState<string | null>(null);
  const current = shown.find((t) => t.key === active) ?? shown[0];
  if (!current) return null;
  return (
    <div data-tabs>
      <div role="tablist" aria-label={label} className="d-flex flex-wrap gap-4 mb-16 border-bottom">
        {shown.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={t.key === current.key}
            aria-controls={`panel-${t.key}`}
            data-tab={t.key}
            className={`btn btn-${t.key === current.key ? 'primary' : 'secondary'}${t.key === current.key ? ' active' : ''}`}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${current.key}`} aria-labelledby={`tab-${current.key}`} data-tab-panel={current.key}>
        {current.content}
      </div>
    </div>
  );
}
