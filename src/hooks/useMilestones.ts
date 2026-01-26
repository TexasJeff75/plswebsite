import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { milestoneService } from '../services/milestoneService';
import { Milestone } from '../types';

export function useMilestones(facilityId: string) {
  return useQuery({
    queryKey: ['milestones', facilityId],
    queryFn: () => milestoneService.getByFacility(facilityId),
    enabled: !!facilityId,
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Milestone> }) =>
      milestoneService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.facility_id] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
}

export function useUpdateMilestoneStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, date }: { id: string; status: string; date?: string }) =>
      milestoneService.updateStatus(id, status, date),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.facility_id] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
}
