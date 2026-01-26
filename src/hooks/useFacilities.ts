import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilityService } from '../services/facilityService';
import { Facility } from '../types';

export function useFacilities() {
  return useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilityService.getAll(),
  });
}

export function useFacility(id: string) {
  return useQuery({
    queryKey: ['facilities', id],
    queryFn: () => facilityService.getById(id),
    enabled: !!id,
  });
}

export function useCreateFacility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (facility: Omit<Facility, 'id' | 'created_at' | 'updated_at'>) =>
      facilityService.create(facility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
}

export function useUpdateFacility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Facility> }) =>
      facilityService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['facilities', data.id] });
    },
  });
}

export function useDeleteFacility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => facilityService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
}

export function useFacilityMetrics() {
  return useQuery({
    queryKey: ['facility-metrics'],
    queryFn: () => facilityService.getMetrics(),
  });
}
