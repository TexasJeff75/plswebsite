import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Search, ListFilter as Filter, RefreshCw, ChevronRight, CircleAlert as AlertCircle } from 'lucide-react';
import { supplyOrdersService } from '../services/supplyOrdersService';
import { useAuth } from '../contexts/AuthContext';

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  processing: { label: 'Processing', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  ready: { label: 'Ready', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  delivered: { label: 'Delivered', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const STATUSES = ['submitted', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>{cfg.label}</span>;
}

export default function SupplyOrders() {
  const { isStaff } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {});
  const pendingCount = (counts.submitted || 0) + (counts.processing || 0);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      setError(null);
      const data = await supplyOrdersService.getAll();
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isStaff) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 mx-auto text-slate-700 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">You need Proximity staff privileges to access this page.</p>
      </div>
    );
  }

  const filtered = orders.filter(order => {
    const matchesSearch = !search ||
      order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      order.facility?.name?.toLowerCase().includes(search.toLowerCase()) ||
      order.organization?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Supply Orders</h1>
          <p className="text-slate-400 text-sm mt-1">
            {pendingCount > 0 ? `${pendingCount} order${pendingCount !== 1 ? 's' : ''} need attention` : 'All orders up to date'}
          </p>
        </div>
        <button onClick={loadOrders} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUSES.map(status => {
          const cfg = STATUS_CONFIG[status];
          const count = counts[status] || 0;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(prev => prev === status ? '' : status)}
              className={`p-3 rounded-xl border text-left transition-all ${statusFilter === status ? 'ring-2 ring-teal-500 ' + cfg.color : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
            >
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-xs text-slate-400 mt-0.5">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order number, facility, or organization..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="px-3 py-2 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-lg text-sm hover:bg-teal-500/20 transition-colors flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" />
            {STATUS_CONFIG[statusFilter]?.label}
            <span className="text-teal-500">&times;</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400">No orders found</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Order</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Facility</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Organization</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Items</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Courier</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-white font-medium text-sm">{order.order_number}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-slate-300 text-sm">{order.facility?.name || '—'}</p>
                    {order.facility?.city && <p className="text-slate-500 text-xs">{order.facility.city}, {order.facility.state}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-slate-300 text-sm">{order.organization?.name || '—'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-slate-400 text-sm">{order.items?.length || 0}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-slate-400 text-sm">{order.delivery?.courier?.display_name || order.delivery?.courier?.email || '—'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-slate-400 text-sm">{new Date(order.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="px-2 py-4">
                    <Link to={`/supply-orders/${order.id}`} className="p-1.5 text-slate-400 hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
