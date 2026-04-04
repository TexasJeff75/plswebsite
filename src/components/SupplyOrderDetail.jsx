import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, QrCode, Activity, CircleAlert as AlertCircle, Check, X, Printer, Clock } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { supplyOrdersService } from '../services/supplyOrdersService';
import { supplyDeliveryService } from '../services/supplyDeliveryService';
import { courierAssignmentService } from '../services/courierAssignmentService';
import { organizationsService } from '../services/organizationsService';
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

function PackingSlip({ order, token }) {
  const deliveryUrl = `${window.location.origin}/tracker#/delivery/${token}`;
  const courier = order.delivery?.courier;
  const requester = order.requester;
  const qrCanvasRef = useRef(null);

  function printPackingSlip() {
    const qrDataUrl = qrCanvasRef.current ? qrCanvasRef.current.querySelector('canvas')?.toDataURL('image/png') : '';

    const statusLabel = (order.status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const printDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const submittedDate = new Date(order.created_at).toLocaleDateString();
    const estDelivery = order.delivery?.estimated_delivery_date
      ? new Date(order.delivery.estimated_delivery_date + 'T00:00:00').toLocaleDateString()
      : null;

    const orgLogoUrl = order.organization?.logo_storage_path
      ? organizationsService.getLogoPublicUrl(order.organization.logo_storage_path)
      : null;
    const proximityLogoUrl = `${window.location.origin}/proximity_logo_updated_11-25-24.svg`;

    const orgLogoHtml = orgLogoUrl
      ? `<img src="${orgLogoUrl}" alt="${order.organization?.name || ''}" style="max-height:72px;max-width:240px;object-fit:contain;" />`
      : `<div style="font-size:20px;font-weight:700;color:#111;">${order.organization?.name || 'Packing Slip'}</div>`;

    const itemRows = (order.items || []).map((item, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#fff'};border-bottom:1px solid #e5e7eb;">
        <td style="padding:9px 12px;font-size:13px;">${item.catalog_item?.name || item.free_form_description || '—'}</td>
        <td style="padding:9px 12px;font-size:12px;color:#555;">${item.catalog_item?.category || 'Custom'}</td>
        <td style="padding:9px 12px;font-size:13px;text-align:center;">${item.quantity_requested}${item.catalog_item?.unit ? ' ' + item.catalog_item.unit : ''}</td>
        <td style="padding:9px 12px;font-size:13px;text-align:center;color:#555;">${item.quantity_fulfilled ?? '—'}</td>
        <td style="padding:9px 12px;text-align:center;"><div style="width:16px;height:16px;border:1.5px solid #999;border-radius:3px;display:inline-block;"></div></td>
      </tr>
    `).join('');

    const notesSection = order.notes ? `
      <div style="margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:6px;background:#fffbeb;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#92400e;margin-bottom:4px;">Order Notes</div>
        <div style="font-size:12px;color:#444;">${order.notes}</div>
      </div>
    ` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Packing Slip — ${order.order_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { zoom: 1 !important; }
    body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 28px 32px; max-width: 680px; margin: 0 auto; font-size: 13px; }
    @media print {
      html, body { zoom: 1 !important; transform: none !important; }
      body { padding: 0; max-width: 100%; }
      @page { size: A4 portrait; margin: 0.5in; }
    }
  </style>
</head>
<body>

  <!-- ORG LOGO HEADER -->
  <div style="text-align:center;padding-bottom:18px;margin-bottom:18px;border-bottom:3px solid #0f766e;">
    ${orgLogoHtml}
    ${order.organization?.name && orgLogoUrl ? `<div style="font-size:13px;color:#555;margin-top:6px;">${order.organization.name}</div>` : ''}
  </div>

  <!-- PACKING SLIP TITLE + ORDER NUMBER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
    <div>
      <div style="font-size:24px;font-weight:700;color:#0f766e;letter-spacing:-0.5px;">PACKING SLIP</div>
      <div style="font-size:15px;font-weight:600;color:#111;margin-top:3px;">${order.order_number}</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#555;">
      <div>Printed: ${printDate}</div>
      <div style="margin-top:2px;">Status: <strong style="color:#111;">${statusLabel}</strong></div>
      <div style="margin-top:2px;">Submitted: ${submittedDate}</div>
      ${order.delivery?.tracking_number ? `<div style="margin-top:2px;">Tracking: ${order.delivery.tracking_number}</div>` : ''}
      ${estDelivery ? `<div style="margin-top:2px;">Est. Delivery: ${estDelivery}</div>` : ''}
    </div>
  </div>

  <!-- DELIVER TO / REQUESTED BY / COURIER -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:20px;padding:14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0f766e;margin-bottom:5px;">Deliver To</div>
      <div style="font-size:13px;font-weight:600;">${order.facility?.name || '—'}</div>
      ${order.facility?.address ? `<div style="font-size:11px;color:#444;margin-top:2px;">${order.facility.address}</div>` : ''}
      ${order.facility?.city ? `<div style="font-size:11px;color:#444;">${order.facility.city}, ${order.facility.state} ${order.facility.zip || ''}</div>` : ''}
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0f766e;margin-bottom:5px;">Requested By</div>
      <div style="font-size:13px;font-weight:600;">${requester?.display_name || requester?.email || '—'}</div>
      ${requester?.email && requester?.display_name ? `<div style="font-size:11px;color:#444;margin-top:2px;">${requester.email}</div>` : ''}
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0f766e;margin-bottom:5px;">Courier</div>
      <div style="font-size:13px;font-weight:600;">${courier?.display_name || courier?.email || '—'}</div>
      ${courier?.email && courier?.display_name ? `<div style="font-size:11px;color:#444;margin-top:2px;">${courier.email}</div>` : ''}
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#0f766e;color:#fff;">
        <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Item Description</th>
        <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Category</th>
        <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Qty Req.</th>
        <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Qty Fulfilled</th>
        <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Received</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  ${notesSection}

  <!-- SIGNATURE LINES -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:24px;">
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin-bottom:6px;">Received By (Print)</div>
      <div style="border-bottom:1px solid #999;height:26px;"></div>
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin-bottom:6px;">Signature</div>
      <div style="border-bottom:1px solid #999;height:26px;"></div>
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin-bottom:6px;">Date Received</div>
      <div style="border-bottom:1px solid #999;height:26px;"></div>
    </div>
  </div>

  <!-- QR CODE — PROMINENT -->
  <div style="text-align:center;margin-bottom:24px;padding:20px;border:2px dashed #0f766e;border-radius:12px;background:#f0fdfa;">
    ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:160px;height:160px;" />` : ''}
    <div style="font-size:12px;font-weight:700;color:#0f766e;margin-top:10px;">Scan to Confirm Delivery Electronically</div>
    <div style="font-size:10px;color:#888;margin-top:4px;">Use your phone camera or QR scanner app</div>
  </div>

  <!-- PROXIMITY LOGO FOOTER -->
  <div style="border-top:1px solid #e5e7eb;padding-top:14px;display:flex;align-items:center;justify-content:center;gap:12px;">
    <img src="${proximityLogoUrl}" alt="Proximity Lab Services" style="height:28px;opacity:0.7;" />
    <div style="font-size:10px;color:#aaa;">proximitylabservices.com</div>
  </div>

  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  return (
    <div className="space-y-4">
      <div ref={qrCanvasRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <QRCodeCanvas value={deliveryUrl} size={160} level="H" />
      </div>
      <div className="flex items-center gap-4">
        <div className="bg-white p-4 rounded-xl inline-block">
          <QRCodeCanvas value={deliveryUrl} size={160} level="H" />
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-sm">Delivery URL:</p>
          <code className="block text-xs text-teal-400 bg-slate-800 px-3 py-2 rounded-lg break-all">{deliveryUrl}</code>
        </div>
      </div>
      <button
        onClick={printPackingSlip}
        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-sm font-medium"
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

  const [fulfillmentEdits, setFulfillmentEdits] = useState({});
  const [savingFulfillment, setSavingFulfillment] = useState({});

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

  async function handleSaveFulfillment(item) {
    const val = fulfillmentEdits[item.id];
    if (val === undefined || val === '') return;
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 0) return;
    try {
      setSavingFulfillment(s => ({ ...s, [item.id]: true }));
      await supplyOrdersService.updateItemFulfillment(item.id, parsed, id, user.id);
      setFulfillmentEdits(e => { const n = { ...e }; delete n[item.id]; return n; });
      await loadOrder();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingFulfillment(s => ({ ...s, [item.id]: false }));
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
                    {order.items.map(item => {
                      const isEditing = fulfillmentEdits[item.id] !== undefined;
                      const isSaving = savingFulfillment[item.id];
                      const editVal = fulfillmentEdits[item.id] ?? '';
                      return (
                        <tr key={item.id}>
                          <td className="py-3 text-sm text-white">{item.catalog_item?.name || <span className="italic text-slate-300">{item.free_form_description}</span>}</td>
                          <td className="py-3 text-sm text-slate-400">{item.catalog_item?.category || 'Custom'}</td>
                          <td className="py-3 text-sm text-white text-right">{item.quantity_requested} {item.catalog_item?.unit || ''}</td>
                          <td className="py-3 text-sm text-right">
                            {isStaff ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={isEditing ? editVal : (item.quantity_fulfilled ?? '')}
                                  placeholder="—"
                                  onChange={e => setFulfillmentEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') handleSaveFulfillment(item); if (e.key === 'Escape') setFulfillmentEdits(prev => { const n = { ...prev }; delete n[item.id]; return n; }); }}
                                  disabled={isSaving}
                                  className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                                />
                                {isEditing && (
                                  <button
                                    onClick={() => handleSaveFulfillment(item)}
                                    disabled={isSaving}
                                    className="text-xs px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors disabled:opacity-50"
                                  >
                                    {isSaving ? '...' : 'Save'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">{item.quantity_fulfilled ?? '—'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
        <div className="space-y-6">
          {order.delivery?.qr_token ? (
            <>
              <PackingSlip order={order} token={order.delivery.qr_token} />
              <div className="space-y-3 max-w-sm">
                <h3 className="text-white font-semibold">Delivery Status</h3>
                <div className="space-y-2 text-sm">
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
                <div className="pt-2 space-y-1 text-xs text-slate-500">
                  <p>1. Print and include with the delivery package.</p>
                  <p>2. Courier scans QR at pickup to confirm collection.</p>
                  <p>3. Courier scans QR at destination for recipient signature.</p>
                </div>
              </div>
            </>
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
