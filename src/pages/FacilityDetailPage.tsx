import { useParams, Link } from 'react-router-dom';
import { useFacility } from '../hooks/useFacilities';
import { useMilestones, useUpdateMilestoneStatus } from '../hooks/useMilestones';
import { useEquipment } from '../hooks/useEquipment';
import { useNotes, useCreateNote } from '../hooks/useNotes';
import { ArrowLeft, MapPin, Calendar, CheckCircle2, Circle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: facility, isLoading: facilityLoading } = useFacility(id!);
  const { data: milestones, isLoading: milestonesLoading } = useMilestones(id!);
  const { data: equipment, isLoading: equipmentLoading } = useEquipment(id!);
  const { data: notes, isLoading: notesLoading } = useNotes(id!);
  const updateMilestone = useUpdateMilestoneStatus();
  const createNote = useCreateNote();

  const [newNote, setNewNote] = useState('');

  if (facilityLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-teal-400">Loading facility details...</div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Facility not found</p>
        <Link to="/facilities" className="text-teal-400 hover:text-teal-300 mt-4 inline-block">
          Back to Facilities
        </Link>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Complete':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'In Progress':
        return <Clock className="w-5 h-5 text-blue-400" />;
      case 'Blocked':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Circle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Complete':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Blocked':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const handleMilestoneStatusChange = async (milestoneId: string, newStatus: string) => {
    const date = newStatus === 'Complete' || newStatus === 'In Progress' ? new Date().toISOString().split('T')[0] : undefined;
    await updateMilestone.mutateAsync({ id: milestoneId, status: newStatus, date });
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    await createNote.mutateAsync({
      facility_id: id!,
      milestone_id: null,
      content: newNote,
      created_by: null,
    });

    setNewNote('');
  };

  const completedMilestones = milestones?.filter(m => m.status === 'Complete').length || 0;
  const totalMilestones = milestones?.length || 0;
  const progress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/facilities"
          className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Facilities
        </Link>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{facility.name}</h1>
              <div className="flex items-center gap-4 text-slate-400 text-sm">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {facility.address}, {facility.city}, {facility.state} {facility.zip}
                </div>
              </div>
            </div>
            <span className={`px-3 py-1 border text-sm font-medium rounded ${getStatusColor(facility.status)}`}>
              {facility.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div>
              <div className="text-sm text-slate-400 mb-1">Region</div>
              <div className="text-white font-medium">{facility.region}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">Phase</div>
              <div className="text-white font-medium">{facility.phase}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">County</div>
              <div className="text-white font-medium">{facility.county || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">Projected Go-Live</div>
              <div className="text-white font-medium">
                {facility.projected_go_live ? format(new Date(facility.projected_go_live), 'MMM d, yyyy') : 'Not set'}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-400">Overall Progress</div>
              <div className="text-sm text-teal-400">{completedMilestones} of {totalMilestones} milestones complete</div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3">
              <div
                className="bg-teal-400 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Deployment Milestones</h2>
          {milestonesLoading ? (
            <div className="text-slate-400">Loading milestones...</div>
          ) : (
            <div className="space-y-3">
              {milestones?.map((milestone, index) => (
                <div key={milestone.id} className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg">
                  <div className="mt-0.5">{getStatusIcon(milestone.status)}</div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{milestone.milestone_name}</div>
                    <div className="text-sm text-slate-400 mt-1">
                      {milestone.completion_date && (
                        <span>Completed: {format(new Date(milestone.completion_date), 'MMM d, yyyy')}</span>
                      )}
                      {milestone.start_date && !milestone.completion_date && (
                        <span>Started: {format(new Date(milestone.start_date), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <select
                    value={milestone.status}
                    onChange={(e) => handleMilestoneStatusChange(milestone.id, e.target.value)}
                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Complete">Complete</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Equipment Status</h2>
          {equipmentLoading ? (
            <div className="text-slate-400">Loading equipment...</div>
          ) : equipment && equipment.length > 0 ? (
            <div className="space-y-3">
              {equipment?.map((item) => (
                <div key={item.id} className="p-3 bg-slate-800 rounded-lg">
                  <div className="font-medium text-white mb-1">{item.device_name}</div>
                  <div className="text-sm text-slate-400 mb-2">{item.device_type}</div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 border text-xs font-medium rounded ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                    {item.serial_number && (
                      <span className="text-xs text-slate-400">SN: {item.serial_number}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">No equipment assigned yet</div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Notes & Comments</h2>

        <form onSubmit={handleAddNote} className="mb-6">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note or comment..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          />
          <button
            type="submit"
            disabled={!newNote.trim() || createNote.isPending}
            className="mt-2 px-4 py-2 bg-teal-400 hover:bg-teal-500 text-slate-950 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createNote.isPending ? 'Adding...' : 'Add Note'}
          </button>
        </form>

        {notesLoading ? (
          <div className="text-slate-400">Loading notes...</div>
        ) : notes && notes.length > 0 ? (
          <div className="space-y-3">
            {notes?.map((note) => (
              <div key={note.id} className="p-4 bg-slate-800 rounded-lg">
                <div className="text-white">{note.content}</div>
                <div className="text-xs text-slate-400 mt-2">
                  {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-400 text-sm">No notes yet</div>
        )}
      </div>
    </div>
  );
}
