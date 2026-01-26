import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noteService } from '../services/noteService';
import { Note } from '../types';

export function useNotes(facilityId: string) {
  return useQuery({
    queryKey: ['notes', facilityId],
    queryFn: () => noteService.getByFacility(facilityId),
    enabled: !!facilityId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) =>
      noteService.create(note),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes', data.facility_id] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => noteService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
