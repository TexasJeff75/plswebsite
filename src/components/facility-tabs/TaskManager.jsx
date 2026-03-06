import React, { useState, useEffect } from 'react';
import { CircleCheck as CheckCircle2, Circle, Clock, Circle as XCircle, Plus, MessageSquare, Calendar, User, Flag, ChevronDown, ChevronRight, CreditCard as Edit2, Trash2, Send } from 'lucide-react';
import { format } from 'date-fns';
import { taskService } from '../../services/taskService';
import { useAuth } from '../../contexts/AuthContext';
import ReferenceSelect from '../ui/ReferenceSelect';

export default function TaskManager({ facilityId, milestoneId = null, milestones = [] }) {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    milestoneId: milestoneId || ''
  });

  const [newTask, setNewTask] = useState({
    subject: '',
    description: '',
    milestone_id: milestoneId || '',
    priority: 'medium',
    status: 'open',
    due_date: ''
  });

  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState({});

  useEffect(() => {
    loadTasks();
  }, [facilityId, filters]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await taskService.getTasksForFacility(facilityId, filters);
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (taskId) => {
    try {
      const data = await taskService.getCommentsForTask(taskId);
      setComments(prev => ({ ...prev, [taskId]: data }));
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await taskService.createTask({
        ...newTask,
        facility_id: facilityId,
        milestone_id: newTask.milestone_id || null
      });
      setNewTask({
        subject: '',
        description: '',
        milestone_id: milestoneId || '',
        priority: 'medium',
        status: 'open',
        due_date: ''
      });
      setShowNewTaskForm(false);
      loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      await taskService.updateTask(taskId, updates);
      loadTasks();
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await taskService.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleAddComment = async (taskId) => {
    if (!newComment.trim()) return;

    try {
      await taskService.addComment(taskId, newComment);
      setNewComment('');
      loadComments(taskId);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const toggleTaskExpand = (taskId) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      if (!comments[taskId]) {
        loadComments(taskId);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {!milestoneId && milestones.length > 0 && (
            <select
              value={filters.milestoneId}
              onChange={(e) => setFilters(prev => ({ ...prev, milestoneId: e.target.value }))}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Milestones</option>
              {milestones.map(milestone => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={() => setShowNewTaskForm(!showNewTaskForm)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {showNewTaskForm && (
        <form onSubmit={handleCreateTask} className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={newTask.subject}
              onChange={(e) => setNewTask(prev => ({ ...prev, subject: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Enter task subject"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Enter task description (optional)"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {!milestoneId && milestones.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Milestone
                </label>
                <select
                  value={newTask.milestone_id}
                  onChange={(e) => setNewTask(prev => ({ ...prev, milestone_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">No Milestone</option>
                  {milestones.map(milestone => (
                    <option key={milestone.id} value={milestone.id}>
                      {milestone.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Priority
              </label>
              <ReferenceSelect
                category="task_priority"
                value={newTask.priority}
                onChange={(value) => setNewTask(prev => ({ ...prev, priority: value }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewTaskForm(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            >
              Create Task
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No tasks found. Create a new task to get started.
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleTaskExpand(task.id)}
                    className="flex-shrink-0 mt-1"
                  >
                    {expandedTask === task.id ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {getStatusIcon(task.status)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{task.subject}</h4>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>

                        {editingTask === task.id ? (
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateTask(task.id, { status: e.target.value })}
                            className="px-2 py-1 border border-slate-300 rounded text-sm"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingTask(task.id)}
                            className="p-1 hover:bg-slate-100 rounded"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      {task.milestone && (
                        <span className="flex items-center gap-1">
                          <Flag className="w-3 h-3" />
                          {task.milestone.name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                      {task.assigned_user && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {task.assigned_user.full_name || task.assigned_user.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {comments[task.id]?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedTask === task.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="space-y-3">
                      {comments[task.id]?.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-slate-900">
                                {comment.user.full_name || comment.user.email}
                              </span>
                              <span className="text-xs text-slate-500">
                                {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{comment.comment}</p>
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2 mt-4">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(task.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleAddComment(task.id)}
                          className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
