import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, QrCode, Activity, CircleAlert as AlertCircle, Check, X, Printer, Clock } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { supplyOrdersService } from '../services/supplyOrdersService';
import { supplyDeliveryService } from '../services/supplyDeliveryService';
import { courierAssignmentService } from '../services/courierAssignmentService';
import { useAuth } from '../contexts/AuthContext';

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', next: 'processing' },
  processing: { label: 'Processing', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', next: 'ready' },
  ready: { label: 'Ready', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', next: 'out_for_delivery' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', next: 'delivered' },
  delivered: { label: 'Delivered', color: 'bg-green-500/20 text-green-400 border-green-500/30', next: null },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30', next: null },
};

const NEXT_LABELS = {
  processing: 'Start Processing',
  ready: 'Mark Ready',
  out_for_delivery: 'Dispatch',
  delivered: 'Mark Delivered',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${cfg.color}`}>{cfg.label}</span>;
}

function QRCodeDisplay({ token }) {
  const deliveryUrl = `${window.location.origin}/tracker#/delivery/${token}`;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl inline-block">
        <QRCodeCanvas value={deliveryUrl} size={200} level="H" />
      </div>
      <div className="space-y-2">
        <p className="text-slate-400 text-sm">Delivery URL:</p>
        <code className="block text-xs text-teal-400 bg-slate-800 px-3 py-2 rounded-lg break-all">{deliveryUrl}</code>
      </div>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
      >
        <Printer className="w-4 h-4" />
        Print Packing Slip
      </button>
    </div>
  );
}

export default function SupplyOrderDetail() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

  const [dispatchForm, setDispatchForm] = useState({
    tracking_number: '',
    estimated_delivery_date: '',
    courier_user_id: '',
  });
  const [activeCourier, setActiveCourier] = useState(null);
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function loadOrder() {
    try {
      setLoading(true);
      setError(null);
      const data = await supplyOrdersService.getById(id);
      if (!data) throw new Error('Order not found');
      setOrder(data);

      if (data.facility_id) {
        const courier = await courierAssignmentService.getActiveCourierForFacility(data.facility_id);
        setActiveCourier(courier);
        if (courier) setDispatchForm(f => ({ ...f, courier_user_id: courier.courier_user_id }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusTransition(toStatus) {
    try {
      setTransitioning(true);
      await supplyOrdersService.updateStatus(id, toStatus, user.id);
      await loadOrder();
    } catch (err) {
      alert(err.message);
    } finally {
      setTransitioning(false);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      alert('Please enter a cancellation reason');
      return;
    }
    try {
      setTransitioning(true);
      await supplyOrdersService.updateStatus(id, 'cancelled', user.id, { cancel_reason: cancelReason });
      setShowCancelForm(false);
      setCancelReason('');
      await loadOrder();
    } catch (err) {
      alert(err.message);
    } finally {
      setTransitioning(false);
    }
  }

  async function handleDispatch() {
    if (!dispatchForm.courier_user_id) {
      alert('Please select a courier before dispatching.');
      return;
    }
    try {
      setDispatching(true);

      await supplyDeliveryService.create({
        order_id: id,
        assigned_courier_user_id: dispatchForm.courier_user_id,
        tracking_number: dispatchForm.tracking_number || '',
        estimated_delivery_date: dispatchForm.estimated_delivery_date || null,
      });

      await supplyOrdersService.updateStatus(id, 'out_for_delivery', user.id);
      await loadOrder();
      setActiveTab('qr');
    } catch (err) {
      alert(err.message);
    } finally {
      setDispatching(false);
    }
  }

  if (!isStaff) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 mx-auto text-slate-700 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">Proximity staff only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <p className="text-white font-medium mb-2">Failed to load order</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status];
  const nextStatus = cfg?.next;
  const canTransition = nextStatus && order.status !== 'out_for_delivery';
  const canCancel = !['delivered', 'cancelled'].includes(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/supply-orders" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            {order.facility?.name} &mdash; {order.organization?.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canTransition && order.status !== 'ready' && (
            <button
              onClick={() => handleStatusTransition(nextStatus)}
              disabled={transitioning}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm"
            >
              {transitioning ? 'Saving...' : NEXT_LABELS[nextStatus]}
            </button>
          )}
          {order.status === 'ready' && !order.delivery && (
            <button
              onClick={() => setActiveTab('dispatch')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              Dispatch
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setShowCancelForm(!showCancelForm)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors text-sm"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {showCancelForm && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 space-y-3">
          <h3 className="text-red-400 font-medium">Cancel Order</h3>
          <textarea
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="Enter the reason for cancellation..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleCancel} disabled={transitioning} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              Confirm Cancellation
            </button>
            <button onClick={() => { setShowCancelForm(false); setCancelReason(''); }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
              Keep Order
            </button>
          </div>
        </div>
      )}

      <div className="border-b border-slate-700">
        <div className="flex gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: Package },
            { id: 'dispatch', label: 'Dispatch', icon: Truck },
            { id: 'qr', label: 'QR / Print', icon: QrCode },
            { id: 'activity', label: 'Activity', icon: Activity },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === tab.id ? 'border-teal-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-white font-semibold mb-4">Order Items</h3>
              {order.items && order.items.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="pb-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Item</th>
                      <th className="pb-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Qty Requested</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Qty Fulfilled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {order.items.map(item => (
                      <tr key={item.id}>
                        <td className="py-3 text-sm text-white">{item.catalog_item?.name || <span className="italic text-slate-300">{item.free_form_description}</span>}</td>
                        <td className="py-3 text-sm text-slate-400">{item.catalog_item?.category || 'Custom'}</td>
                        <td className="py-3 text-sm text-white text-right">{item.quantity_requested} {item.catalog_item?.unit || ''}</td>
                        <td className="py-3 text-sm text-slate-400 text-right">{item.quantity_fulfilled ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-slate-400 text-sm">No items</p>
              )}
            </div>

            {order.notes && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-white font-semibold mb-2">Order Notes</h3>
                <p className="text-slate-300 text-sm">{order.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-3">
              <h3 className="text-white font-semibold">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Requested By</span>
                  <span className="text-white">{order.requester?.display_name || order.requester?.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Submitted</span>
                  <span className="text-white">{new Date(order.created_at).toLocaleString()}</span>
                </div>
                {order.approved_by && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Approved By</span>
                    <span className="text-white">{order.approver?.display_name || order.approver?.email}</span>
                  </div>
                )}
                {order.delivery && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Courier</span>
                      <span className="text-white">{order.delivery.courier?.display_name || order.delivery.courier?.email || '—'}</span>
                    </div>
                    {order.delivery.tracking_number && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tracking #</span>
                        <span className="text-white">{order.delivery.tracking_number}</span>
                      </div>
                    )}
                    {order.delivery.estimated_delivery_date && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Est. Delivery</span>
                        <span className="text-white">{new Date(order.delivery.estimated_delivery_date + 'T00:00:00').toLocaleDateString()}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-2">
              <h3 className="text-white font-semibold">Facility</h3>
              <div className="text-sm space-y-1">
                <p className="text-white">{order.facility?.name}</p>
                {order.facility?.address && <p className="text-slate-400">{order.facility.address}</p>}
                {order.facility?.city && <p className="text-slate-400">{order.facility.city}, {order.facility.state} {order.facility.zip}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dispatch' && (
        <div className="max-w-lg space-y-5">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
            <h3 className="text-white font-semibold">Dispatch Settings</h3>

            {order.status === 'out_for_delivery' || order.status === 'delivered' ? (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
                <Check className="w-4 h-4 flex-shrink-0" />
                This order has been dispatched.
              </div>
            ) : (
              <>
                {!activeCourier && order.status !== 'out_for_delivery' && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>No courier is assigned to this facility. <Link to={`/facilities/${order.facility_id}`} className="underline hover:text-amber-300">Go assign one</Link> before dispatching.</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Assigned Courier</label>
                  <p className="text-white text-sm">{activeCourier?.courier?.display_name || activeCourier?.courier?.email || 'None assigned'}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tracking Number (optional)</label>
                  <input
                    type="text"
                    value={dispatchForm.tracking_number}
                    onChange={e => setDispatchForm(f => ({ ...f, tracking_number: e.target.value }))}
                    placeholder="Enter tracking number..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Estimated Delivery Date (optional)</label>
                  <input
                    type="date"
                    value={dispatchForm.estimated_delivery_date}
                    onChange={e => setDispatchForm(f => ({ ...f, estimated_delivery_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  onClick={handleDispatch}
                  disabled={dispatching || !activeCourier || !['ready', 'processing', 'submitted'].includes(order.status)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
                >
                  {dispatching ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Truck className="w-4 h-4" /> Dispatch Order</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'qr' && (
        <div className="space-y-4">
          {order.delivery?.qr_token ? (
            <div className="flex gap-8">
              <QRCodeDisplay token={order.delivery.qr_token} />
              <div className="space-y-3">
                <h3 className="text-white font-semibold">QR Code Instructions</h3>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>1. Print this packing slip and include it with the delivery.</p>
                  <p>2. The courier scans the QR code <strong className="text-white">at the facility</strong> before leaving to confirm pick-up.</p>
                  <p>3. The courier scans the same QR code <strong className="text-white">at the destination</strong> to confirm delivery with recipient signature.</p>
                </div>
                <div className="pt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {order.delivery.picked_up_at ? <Check className="w-4 h-4 text-green-400 flex-shrink-0" /> : <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                    <span className={order.delivery.picked_up_at ? 'text-green-400' : 'text-slate-500'}>
                      Pick-up {order.delivery.picked_up_at ? `confirmed ${new Date(order.delivery.picked_up_at).toLocaleString()}` : 'pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.delivery.delivered_at ? <Check className="w-4 h-4 text-green-400 flex-shrink-0" /> : <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                    <span className={order.delivery.delivered_at ? 'text-green-400' : 'text-slate-500'}>
                      Delivery {order.delivery.delivered_at ? `confirmed ${new Date(order.delivery.delivered_at).toLocaleString()}` : 'pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
              <QrCode className="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400">QR code is generated when the order is dispatched.</p>
              <p className="text-slate-500 text-sm mt-1">Go to the Dispatch tab to send this order out.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="max-w-2xl">
          {order.activity && order.activity.length > 0 ? (
            <div className="space-y-3">
              {[...order.activity].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(entry => (
                <div key={entry.id} className="flex items-start gap-3 p-4 bg-slate-800 border border-slate-700 rounded-xl">
                  <div className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm font-medium">{entry.action}</p>
                      <p className="text-slate-500 text-xs">{new Date(entry.created_at).toLocaleString()}</p>
                    </div>
                    {entry.actor && <p className="text-slate-400 text-xs mt-0.5">{entry.actor.display_name || entry.actor.email}</p>}
                    {entry.from_status && entry.to_status && (
                      <p className="text-slate-500 text-xs mt-0.5">{entry.from_status} &rarr; {entry.to_status}</p>
                    )}
                    {entry.notes && <p className="text-slate-400 text-xs mt-1">{entry.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
              <Activity className="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400">No activity logged yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
