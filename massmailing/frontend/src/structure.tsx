import { useEdificeClient } from '@open-ent/react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Établissement de travail. Le module n'utilisait que le premier établissement du compte : un usager rattaché à
 * plusieurs ne pouvait pas consulter les autres. Le choix est retenu dans le navigateur et partagé par les quatre
 * écrans du module (présences, incidents, publipostage, statistiques) ; sans choix valide, le premier établissement.
 */
const KEY = 'presences.structure';
const listeners = new Set<() => void>();
const read = () => {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useStructure() {
  const { user } = useEdificeClient();
  const chosen = useSyncExternalStore(subscribe, read);
  const structures = (user?.structures ?? []).map((id, i) => ({ id, name: user?.structureNames?.[i] ?? id }));
  const structureId = structures.some((s) => s.id === chosen) ? chosen : (structures[0]?.id ?? '');
  const setStructureId = (id: string) => {
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* stockage indisponible : le choix vaut jusqu'au rechargement */
    }
    listeners.forEach((l) => l());
  };
  return { structureId, structures, setStructureId };
}

/** Sélecteur d'établissement, affiché seulement quand le compte en a plusieurs. */
export function StructureSelect() {
  const { t } = useTranslation(['massmailing', 'common']);
  const { structureId, structures, setStructureId } = useStructure();
  if (structures.length < 2) return null;
  return (
    <div className="mb-16" style={{ maxWidth: 360 }}>
      <label htmlFor="pres-structure" className="form-label">{t('presences.structure', { defaultValue: 'Établissement' })}</label>
      <select id="pres-structure" className="form-select" value={structureId} onChange={(e) => setStructureId(e.target.value)} data-structure-select>
        {structures.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
