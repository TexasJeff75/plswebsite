import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supportService } from '../services/supportService';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Send, Building2, MapPin, Calendar, Clock,
  AlertCircle, CheckCircle2, User, ChevronDown
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadTicket();
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadTicket() {
    try {
      const [ticketData, messagesData, staffData] = await Promise.all([
        supportService.getTicketById(id),
        supportService.getTicketMessages(id),
        supportService.getStaffUsers()
      ]);

      setTicket(ticketData);
      setMessages(messagesData);
      setStaffUsers(staffData);
    } catch (error) {
      console.error('Error loading ticket:', error);
    } finally {
      setLoading(false);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const message = await supportService.addMessage(id, newMessage.trim());
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }

  async function handleUpdateTicket(field, value) {
    try {
      const updated = await supportService.updateTicket(id, { [field]: value });
      setTicket(prev => ({ ...prev, ...updated }));
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  }

  const getPriorityBadge = (priority) => {
    const badges = {
      critical: { label: 'Critical', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
      high: { label: 'High', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      normal: { label: 'Normal', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      low: { label: 'Low', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
    };
    return badges[priority] || badges.normal;
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: { label: 'Open', color: 'bg-blue-500 text-white' },
      in_progress: { label: 'In Progress', color: 'bg-amber-500 text-white' },
      pending_client: { label: 'Pending Client', color: 'bg-orange-500 text-white' },
      resolved: { label: 'Resolved', color: 'bg-green-500 text-white' },
      closed: { label: 'Closed', color: 'bg-slate-500 text-white' }
    };
    return badges[status] || badges.open;
  };

  const isSLABreached = () => {
    if (!ticket?.sla_deadline) return false;
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return ticket.resolved_at && new Date(ticket.resolved_at) > new Date(ticket.sla_deadline);
    }
    return new Date() > new Date(ticket.sla_deadline);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Ticket not found</p>
        <button
          onClick={() => navigate('/support')}
          className="mt-4 text-teal-400 hover:text-teal-300"
        >
          Back to Tickets
        </button>
      </div>
    );
  }

  const priorityBadge = getPriorityBadge(ticket.priority);
  const statusBadge = getStatusBadge(ticket.status);
  const breached = isSLABreached();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/support')}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-teal-400 font-mono text-sm">{ticket.ticket_number}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${priorityBadge.color}`}>
              {priorityBadge.label}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Description</h3>
            <p className="text-white whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col" style={{ height: '500px' }}>
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Messages</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No messages yet. Start the conversation below.
                </div>
              ) : (
                messages.map(message => {
                  const isCurrentUser = message.user_id === user?.id;
                  const userName = message.user?.raw_user_meta_data?.display_name ||
                                   message.user?.email?.split('@')[0] || 'Unknown';

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${isCurrentUser ? 'order-2' : ''}`}>
                        <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'justify-end' : ''}`}>
                          <span className="text-xs text-slate-400">{userName}</span>
                          <span className="text-xs text-slate-500">
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div
                          className={`px-4 py-3 rounded-xl ${
                            isCurrentUser
                              ? 'bg-teal-500 text-slate-900'
                              : 'bg-slate-700 text-white'
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm">{message.message}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Ticket Details</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <div className="relative">
                  <select
                    value={ticket.status}
                    onChange={(e) => handleUpdateTicket('status', e.target.value)}
                    className="w-full appearance-none px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending_client">Pending Client</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Priority</label>
                <div className="relative">
                  <select
                    value={ticket.priority}
                    onChange={(e) => handleUpdateTicket('priority', e.target.value)}
                    className="w-full appearance-none px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Assigned To</label>
                <div className="relative">
                  <select
                    value={ticket.assigned_to || ''}
                    onChange={(e) => handleUpdateTicket('assigned_to', e.target.value || null)}
                    className="w-full appearance-none px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {staffUsers.map(staff => (
                      <option key={staff.user_id} value={staff.user_id}>
                        {staff.display_name || staff.email}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-start gap-3 mb-3">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Client</p>
                    <Link
                      to={`/organizations/${ticket.organization_id}`}
                      className="text-teal-400 hover:text-teal-300 text-sm"
                    >
                      {ticket.organization?.name || '-'}
                    </Link>
                  </div>
                </div>

                {ticket.site && (
                  <div className="flex items-start gap-3 mb-3">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Site</p>
                      <Link
                        to={`/facilities/${ticket.site_id}`}
                        className="text-teal-400 hover:text-teal-300 text-sm"
                      >
                        {ticket.site.name}
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Category</p>
                    <p className="text-white text-sm capitalize">{ticket.category || '-'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Created</p>
                    <p className="text-white text-sm">
                      {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">SLA Deadline</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${breached ? 'text-red-400' : 'text-white'}`}>
                        {ticket.sla_deadline
                          ? format(new Date(ticket.sla_deadline), 'MMM d, yyyy h:mm a')
                          : '-'}
                      </p>
                      {breached && (
                        <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-xs rounded">
                          Breached
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {ticket.resolved_at && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Resolved</p>
                      <p className="text-green-400 text-sm">
                        {format(new Date(ticket.resolved_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
