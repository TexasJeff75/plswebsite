import React, { useState, useEffect } from 'react';
import { Package, Plus, ChevronDown, ChevronUp, Truck, Clock, CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react';
import { supplyOrdersService } from '../../services/supplyOrdersService';
import { useAuth } from '../../contexts/AuthContext';
import SupplyOrderModal from '../SupplyOrderModal';

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  processing: { label: 'Processing', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  ready: { label: 'Ready', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  delivered: { label: 'Delivered', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  draft: { label: 'Draft', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function OrderRow({ order, onRefresh }) {
  const [expanded, setExpanded] = useState(false);

  const itemCount = order.items?.length || 0;
  const courier = order.delivery?.courier;

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30 transition-colors text-left"
      >
        <div className="flex-1 grid grid-cols-4 gap-4 items-center">
          <div>
            <p className="text-white font-medium text-sm">{order.order_number}</p>
            <p className="text-slate-500 text-xs">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <StatusBadge status={order.status} />
          </div>
          <div>
            <p className="text-slate-400 text-sm">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
            {courier && <p className="text-slate-500 text-xs truncate">{courier.display_name || courier.email}</p>}
          </div>
          <div>
            {order.delivery?.estimated_delivery_date && (
              <p className="text-slate-400 text-xs">Est. {new Date(order.delivery.estimated_delivery_date + 'T00:00:00').toLocaleDateString()}</p>
            )}
            {order.delivery?.delivered_at && (
              <p className="text-green-400 text-xs">Delivered {new Date(order.delivery.delivered_at).toLocaleDateString()}</p>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-700/50 bg-slate-800/30">
          <div className="pt-4 space-y-4">
            {order.items && order.items.length > 0 && (
              <div>
                <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Items</h4>
                <div className="space-y-1">
                  {order.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-slate-300">
                        {item.catalog_item?.name || item.free_form_description}
                        {item.catalog_item?.unit && <span className="text-slate-500 ml-1">({item.catalog_item.unit})</span>}
                      </span>
                      <span className="text-white font-medium">&times;{item.quantity_requested}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.notes && (
              <div>
                <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Notes</h4>
                <p className="text-slate-300 text-sm">{order.notes}</p>
              </div>
            )}

            {order.status === 'delivered' && order.delivery && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-2">
                <h4 className="text-green-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Delivery Confirmed
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {order.delivery.recipient_typed_name && (
                    <div>
                      <p className="text-slate-500 text-xs">Received By</p>
                      <p className="text-white text-sm font-medium">{order.delivery.recipient_typed_name}</p>
                    </div>
                  )}
                  {order.delivery.courier_typed_name && (
                    <div>
                      <p className="text-slate-500 text-xs">Courier</p>
                      <p className="text-white text-sm font-medium">{order.delivery.courier_typed_name}</p>
                    </div>
                  )}
                  {order.delivery.delivery_local_timestamp && (
                    <div>
                      <p className="text-slate-500 text-xs">Delivered At</p>
                      <p className="text-white text-sm">{order.delivery.delivery_local_timestamp}</p>
                    </div>
                  )}
                </div>
                {order.delivery.recipient_signature && (
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Recipient Signature</p>
                    <img src={order.delivery.recipient_signature} alt="Recipient signature" className="h-16 bg-white rounded border border-slate-600" />
                  </div>
                )}
              </div>
            )}

            {order.status === 'cancelled' && order.cancel_reason && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-xs font-semibold mb-1">Cancellation Reason</p>
                <p className="text-slate-300 text-sm">{order.cancel_reason}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupplyOrdersTab({ facility }) {
  const { user, isStaff, isCustomerAdmin, isCustomerViewer, isCourier } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const canCreateOrder = isStaff || isCustomerAdmin || isCustomerViewer;

  useEffect(() => {
    loadOrders();
  }, [facility.id]);

  async function loadOrders() {
    try {
      setLoading(true);
      setError(null);
      const data = await supplyOrdersService.getByFacility(facility.id);
      setOrders(data);
    } catch (err) {
      console.error('Error loading supply orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (isCourier) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
        <p className="text-slate-400">Access not available. Use your delivery QR link.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Supply Orders</h3>
          <p className="text-slate-400 text-sm mt-0.5">
            {orders.length} order{orders.length !== 1 ? 's' : ''} for this facility
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadOrders}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canCreateOrder && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Order
            </button>
          )}
        </div>
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
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 mb-2">No supply orders yet</p>
          {canCreateOrder && (
            <button
              onClick={() => setShowModal(true)}
              className="text-teal-400 hover:text-teal-300 text-sm transition-colors"
            >
              Create the first order
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <OrderRow key={order.id} order={order} onRefresh={loadOrders} />
          ))}
        </div>
      )}

      {showModal && (
        <SupplyOrderModal
          facility={facility}
          onClose={() => setShowModal(false)}
          onSuccess={loadOrders}
        />
      )}
    </div>
  );
}
