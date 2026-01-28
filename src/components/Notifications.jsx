import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsService } from '../services/notificationsService';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Bell, Shield, ClipboardCheck, GraduationCap, Clock,
  AlertTriangle, Ticket, CheckCheck, Trash2, ChevronDown,
  ChevronLeft, ChevronRight, Check, Filter, X
} from 'lucide-react';

const iconMap = {
  Shield, ClipboardCheck, GraduationCap, Clock, AlertTriangle, Ticket, Bell
};

const NOTIFICATION_TYPES = [
  { id: 'all', label: 'All Types' },
  { id: 'clia_expiring', label: 'CLIA Expiring' },
  { id: 'pt_due', label: 'PT Due' },
  { id: 'competency_due', label: 'Competency Due' },
  { id: 'sla_warning', label: 'SLA Warning' },
  { id: 'milestone_blocked', label: 'Milestone Blocked' },
  { id: 'ticket_assigned', label: 'Ticket Assigned' },
  { id: 'general', label: 'General' },
];

const READ_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
];

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [page, typeFilter, readFilter]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const readStatus = readFilter === 'all' ? null : readFilter === 'read';
      const type = typeFilter === 'all' ? null : typeFilter;

      const result = await notificationsService.getAll({
        page,
        limit: 20,
        type,
        readStatus
      });

      setNotifications(result.notifications);
      setTotalPages(result.totalPages);
      setTotal(result.total);
      setSelectedIds([]);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  function getIcon(type) {
    const typeInfo = notificationsService.getTypeIcon(type);
    const IconComponent = iconMap[typeInfo.icon] || Bell;
    return { Icon: IconComponent, ...typeInfo };
  }

  async function handleNotificationClick(notification) {
    if (!notification.read) {
      try {
        await notificationsService.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }

    if (notification.link) {
      navigate(notification.link);
    }
  }

  async function handleMarkSelectedRead() {
    if (selectedIds.length === 0) return;
    try {
      await notificationsService.markMultipleAsRead(selectedIds);
      setNotifications(prev =>
        prev.map(n => selectedIds.includes(n.id) ? { ...n, read: true } : n)
      );
      setSelectedIds([]);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} notification(s)?`)) return;

    try {
      await notificationsService.deleteMultiple(selectedIds);
      loadNotifications();
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map(n => n.id));
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} notification{total !== 1 ? 's' : ''}
            {unreadCount > 0 && ` (${unreadCount} unread)`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters || typeFilter !== 'all' || readFilter !== 'all'
                ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                : 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(typeFilter !== 'all' || readFilter !== 'all') && (
              <span className="w-2 h-2 bg-teal-400 rounded-full" />
            )}
          </button>

          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-400">Type:</label>
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                  className="appearance-none px-4 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                >
                  {NOTIFICATION_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-400">Status:</label>
              <div className="flex gap-1">
                {READ_FILTERS.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => { setReadFilter(filter.id); setPage(1); }}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      readFilter === filter.id
                        ? 'bg-teal-500 text-slate-900'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {(typeFilter !== 'all' || readFilter !== 'all') && (
              <button
                onClick={() => { setTypeFilter('all'); setReadFilter('all'); setPage(1); }}
                className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
          <span className="text-white text-sm">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkSelectedRead}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-teal-400 hover:text-teal-300 transition-colors"
            >
              <Check className="w-4 h-4" />
              Mark as Read
            </button>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg">No notifications</p>
            <p className="text-slate-500 text-sm mt-1">
              {typeFilter !== 'all' || readFilter !== 'all'
                ? 'Try adjusting your filters'
                : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-700 px-4 py-3 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.length === notifications.length && notifications.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-400">Select all</span>
              </label>
            </div>

            <div className="divide-y divide-slate-700/50">
              {notifications.map(notification => {
                const { Icon, color, bg } = getIcon(notification.type);
                const isSelected = selectedIds.includes(notification.id);

                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-4 px-4 py-4 hover:bg-slate-700/20 transition-colors ${
                      !notification.read ? 'bg-slate-700/10' : ''
                    } ${isSelected ? 'bg-teal-500/5' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(notification.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 mt-1 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                    />

                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className="flex-1 flex items-start gap-4 text-left"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`font-medium ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-teal-400 rounded-full" />
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              {notification.message}
                            </p>

                            <div className="flex items-center gap-4 mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${bg} ${color}`}>
                                {notificationsService.getTypeLabel(notification.type)}
                              </span>
                              {notification.facility && (
                                <span className="text-xs text-slate-500">
                                  {notification.facility.name}
                                </span>
                              )}
                              {notification.organization && (
                                <span className="text-xs text-slate-500">
                                  {notification.organization.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-500">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                      page === pageNum
                        ? 'bg-teal-500 text-slate-900 font-medium'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
