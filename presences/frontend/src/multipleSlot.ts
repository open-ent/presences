import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api';
import { multipleSlotParam } from './register';

/**
 * Appels multiples : réglage de l'établissement, préférence de l'utilisateur et valeur à envoyer au serveur.
 * `ready` est faux tant que la préférence n'est pas lue : les cours ne doivent pas être demandés avant.
 */
export function useMultipleSlot(structureId: string) {
  const { user } = useEdificeClient();
  const qc = useQueryClient();
  const isStaff = user?.type === 'PERSEDUCNAT';
  const settingQuery = useQuery({ queryKey: ['pres', 'settings', structureId], queryFn: () => api.getSettings(structureId), enabled: !!structureId });
  const prefQuery = useQuery({ queryKey: ['pres', 'multiple-slot-pref'], queryFn: api.getMultipleSlotPreference, enabled: !isStaff });
  const value = multipleSlotParam(isStaff, prefQuery.data);
  const setMut = useMutation({
    mutationFn: (v: boolean) => api.setMultipleSlotPreference(v),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pres', 'multiple-slot-pref'] });
      await qc.invalidateQueries({ queryKey: ['presences', 'courses'] });
      await qc.invalidateQueries({ queryKey: ['pres', 'courses-today'] });
    },
  });
  return {
    ready: isStaff || !prefQuery.isLoading,
    /** Réglage de l'établissement : l'interrupteur n'est proposé qu'aux enseignants et si l'établissement l'autorise. */
    canChoose: !isStaff && settingQuery.data?.allow_multiple_slots === true,
    value,
    setValue: (v: boolean) => setMut.mutate(v),
    saving: setMut.isPending,
    error: setMut.isError,
  };
}
