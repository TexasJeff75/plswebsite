import React, { useState, useEffect } from 'react';
import { FileText, TriangleAlert as AlertTriangle, Clock, Users, ListFilter as Filter, Download, Calendar, CircleCheck as CheckCircle2, Circle, CircleAlert as AlertCircle, CreditCard as Edit2, Save, X } from 'lucide-react';
import { taskService } from '../services/taskService';
import { useAuth } from '../contexts/AuthContext';
import { format, isBefore, addDays, parseISO } from 'date-fns';

export default function TasksReport() {
  const { isAdmin, isStaff } = useAuth();
  const canEdit = isAdmin || isStaff;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    dateRange: 'all',
    assignedTo: 'all',
    milestone: 'all'
  });
  const [stats, setStats] = useState({
    total: 0,
    overdue: 0,
    dueToday: 0,
    dueThisWeek: 0,
    unassigned: 0,
    critical: 0,
    high: 0
  });

  useEffect(() => {
    loadAllTasks();
  }, []);

  const loadAllTasks = async () => {
    try {
      setLoading(true);
      const allTasks = await taskService.getAllIncompleteTasks();
      setTasks(allTasks);
      calculateStats(allTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (taskList) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = addDays(today, 7);

    const s = {
      total: taskList.length,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
      unassigned: 0,
      critical: 0,
      high: 0
    };

    taskList.forEach(task => {
      if (!task.assigned_to) s.unassigned++;
      if (task.priority === 'critical') s.critical++;
      if (task.priority === 'high') s.high++;

      if (task.due_date) {
        const dueDate = parseISO(task.due_date);
        if (isBefore(dueDate, today)) s.overdue++;
        else if (dueDate.getTime() === today.getTime()) s.dueToday++;
        else if (isBefore(dueDate, weekFromNow)) s.dueThisWeek++;
      }
    });

    setStats(s);
  };

  const getFilteredTasks = () => {
    return tasks.filter(task => {
      if (filters.status !== 'all' && task.status !== filters.status) return false;
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
      if (filters.assignedTo === 'unassigned' && task.assigned_to) return false;
      if (filters.assignedTo === 'assigned' && !task.assigned_to) return false;

      if (filters.dateRange !== 'all' && task.due_date) {
        const dueDate = parseISO(task.due_date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (filters.dateRange) {
          case 'overdue':
            if (!isBefore(dueDate, today)) return false;
            break;
          case 'today':
            if (dueDate.getTime() !== today.getTime()) return false;
            break;
          case 'week':
            if (!isBefore(dueDate, addDays(today, 7)) || isBefore(dueDate, today)) return false;
            break;
          case 'no_date':
            if (task.due_date) return false;
            break;
        }
      } else if (filters.dateRange === 'no_date' && task.due_date) {
        return false;
      }

      return true;
    });
  };

  const startEdit = (task) => {
    setEditingTask(task.id);
    setEditForm({
      status: task.status,
      priority: task.priority || 'medium',
      due_date: task.due_date ? task.due_date.substring(0, 10) : '',
    });
  };

  const cancelEdit = () => {
    setEditingTask(null);
    setEditForm({});
  };

  const saveEdit = async (taskId) => {
    try {
      setSaving(true);
      await taskService.updateTask(taskId, {
        status: editForm.status,
        priority: editForm.priority,
        due_date: editForm.due_date || null,
      });
      setEditingTask(null);
      setEditForm({});
      await loadAllTasks();
    } catch (err) {
      console.error('Error saving task:', err);
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    const filteredTasks = getFilteredTasks();
    const headers = ['Facility', 'Milestone', 'Subject', 'Status', 'Priority', 'Assigned To', 'Created By', 'Due Date', 'Created Date'];
    const rows = filteredTasks.map(task => [
      task.facility?.name || 'N/A',
      task.milestone?.name || 'General Task',
      task.subject,
      task.status,
      task.priority || 'N/A',
      task.assigned_user?.display_name || 'Unassigned',
      task.created_user?.display_name || 'N/A',
      task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : 'No due date',
      format(parseISO(task.created_at), 'MMM d, yyyy')
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incomplete-tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <Circle className="w-4 h-4 text-blue-400" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'blocked': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      default: return <Circle className="w-4 h-4 text-slate-400" />;
    }
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return isBefore(parseISO(dueDate), today);
  };

  const filteredTasks = getFilteredTasks();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-slate-400">Loading tasks report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Incomplete Tasks Report</h1>
          <p className="text-sm text-slate-400 mt-1">
            Overview of all incomplete milestone-related tasks across all facilities
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500/10 to-slate-800/50 border border-blue-500/20 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-lg" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-blue-300/80 text-xs font-medium uppercase tracking-wider">Total Incomplete</h3>
            <div className="w-8 h-8 bg-blue-500/15 rounded flex items-center justify-center ring-1 ring-blue-500/20">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-slate-800/50 border border-red-500/20 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-lg" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-red-300/80 text-xs font-medium uppercase tracking-wider">Overdue</h3>
            <div className="w-8 h-8 bg-red-500/15 rounded flex items-center justify-center ring-1 ring-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.overdue}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-slate-800/50 border border-orange-500/20 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 rounded-l-lg" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-orange-300/80 text-xs font-medium uppercase tracking-wider">Critical Priority</h3>
            <div className="w-8 h-8 bg-orange-500/15 rounded flex items-center justify-center ring-1 ring-orange-500/20">
              <AlertCircle className="w-4 h-4 text-orange-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.critical}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-slate-800/50 border border-yellow-500/20 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500 rounded-l-lg" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-yellow-300/80 text-xs font-medium uppercase tracking-wider">Unassigned</h3>
            <div className="w-8 h-8 bg-yellow-500/15 rounded flex items-center justify-center ring-1 ring-yellow-500/20">
              <Users className="w-4 h-4 text-yellow-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.unassigned}</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">All Dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="week">Due This Week</option>
              <option value="no_date">No Due Date</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Assignment</label>
            <select
              value={filters.assignedTo}
              onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">All Tasks</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                status: 'all',
                priority: 'all',
                dateRange: 'all',
                assignedTo: 'all',
                milestone: 'all'
              })}
              className="w-full px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/30 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Tasks ({filteredTasks.length})
          </h2>
          {canEdit && (
            <span className="text-xs text-slate-400">Click the edit icon on a row to update status, priority, or due date</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/30 border-b border-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Facility</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Milestone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Due Date</th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                    No incomplete tasks found
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const isEditing = editingTask === task.id;
                  return (
                    <tr key={task.id} className={`transition-colors ${isEditing ? 'bg-slate-700/40' : 'hover:bg-slate-700/30'}`}>
                      <td className="px-4 py-3 text-sm text-white">
                        {task.facility?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {task.milestone?.name || <span className="text-slate-500 italic">General Task</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-white max-w-xs">
                        <div className="font-medium">{task.subject}</div>
                        {task.description && (
                          <div className="text-slate-400 text-xs mt-1 line-clamp-1">{task.description}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        {isEditing ? (
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}
                            className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="completed">Completed</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-300">
                            {getStatusIcon(task.status)}
                            <span className="capitalize">{task.status.replace('_', ' ')}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        {isEditing ? (
                          <select
                            value={editForm.priority}
                            onChange={(e) => setEditForm(f => ({ ...f, priority: e.target.value }))}
                            className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          >
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        ) : (
                          task.priority ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-white">
                        {task.assigned_user?.display_name || (
                          <span className="text-yellow-400 font-medium">Unassigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.due_date}
                            onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                            className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          />
                        ) : (
                          task.due_date ? (
                            <div className={`flex items-center gap-2 ${isOverdue(task.due_date) ? 'text-red-400 font-medium' : 'text-slate-300'}`}>
                              <Calendar className="w-4 h-4" />
                              {format(parseISO(task.due_date), 'MMM d, yyyy')}
                              {isOverdue(task.due_date) && <span className="text-xs">(Overdue)</span>}
                            </div>
                          ) : (
                            <span className="text-slate-500">No due date</span>
                          )
                        )}
                      </td>

                      {canEdit && (
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => saveEdit(task.id)}
                                disabled={saving}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(task)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                              title="Edit task"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
