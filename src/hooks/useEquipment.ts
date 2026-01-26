import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { equipmentService } from '../services/equipmentService';
import { Equipment } from '../types';

export function useEquipment(facilityId: string) {
  return useQuery({
    queryKey: ['equipment', facilityId],
    queryFn: () => equipmentService.getByFacility(facilityId),
    enabled: !!facilityId,
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (equipment: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>) =>
      equipmentService.create(equipment),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['equipment', data.facility_id] });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Equipment> }) =>
      equipmentService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['equipment', data.facility_id] });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => equipmentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}
