import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CircleCheck as CheckCircle, Truck, Package, MapPin, CircleAlert as AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { supplyDeliveryService } from '../services/supplyDeliveryService';
import { supplyOrdersService } from '../services/supplyOrdersService';
import { useAuth } from '../contexts/AuthContext';

function SignatureCanvas({ onCapture, label }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const [hasSig, setHasSig] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasSig(true);
  }, []);

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    onCapture(canvas.toDataURL('image/png'));
  }, [onCapture]);

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
    onCapture(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {hasSig && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
      <div className="relative border-2 border-dashed border-slate-600 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasSig && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-300 text-sm">Sign here</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemList({ items }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Order Items</h4>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{item.catalog_item?.name || item.free_form_description}</span>
            <span className="text-white font-medium">&times;{item.quantity_requested}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhasePickup({ delivery, onComplete, actorUserId }) {
  const [courierName, setCourierName] = useState('');
  const [signature, setSignature] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const order = delivery.order;
  const facility = order?.facility;

  async function handleConfirm() {
    setError(null);
    if (!courierName.trim()) { setError('Please enter your name.'); return; }
    if (!signature) { setError('Please sign the canvas.'); return; }

    try {
      setSubmitting(true);
      await supplyDeliveryService.confirmPickup(delivery.id, {
        courierTypedName: courierName,
        signatureBase64: signature,
        actorUserId,
      });
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
          <Package className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Confirm Pick-up</h2>
        <p className="text-slate-400 text-sm">You are collecting order <strong className="text-white">{order?.order_number}</strong> from {facility?.name}.</p>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-1">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">{facility?.name}</p>
            {facility?.address && <p className="text-slate-400 text-sm">{facility.address}</p>}
            {facility?.city && <p className="text-slate-400 text-sm">{facility.city}, {facility.state}</p>}
          </div>
        </div>
      </div>

      {order?.items && <ItemList items={order.items} />}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Your Name (Courier)</label>
          <input
            type="text"
            value={courierName}
            onChange={e => setCourierName(e.target.value)}
            placeholder="Type your full name..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <SignatureCanvas label="Courier Signature" onCapture={setSignature} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={submitting || !courierName.trim() || !signature}
        className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors"
      >
        {submitting ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Package className="w-5 h-5" /> Confirm Pick-up</>}
      </button>
    </div>
  );
}

function PhaseDelivery({ delivery, onComplete, actorUserId }) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientSig, setRecipientSig] = useState(null);
  const [courierName, setCourierName] = useState(delivery.courier_typed_name_at_pickup || '');
  const [location, setLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const order = delivery.order;
  const facility = order?.facility;

  const localTime = (() => {
    try {
      return new Date().toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'medium', timeZoneName: 'short'
      });
    } catch {
      try {
        return new Date().toLocaleString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      } catch {
        return new Date().toString();
      }
    }
  })();
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  })();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation(null),
        { timeout: 5000 }
      );
    }
  }, []);

  async function handleConfirm() {
    setError(null);
    if (!recipientName.trim()) { setError('Please enter the recipient name.'); return; }
    if (!recipientSig) { setError('Recipient signature is required.'); return; }
    if (!courierName.trim()) { setError('Please enter your name.'); return; }

    try {
      setSubmitting(true);
      await supplyDeliveryService.confirmDelivery(delivery.id, {
        recipientTypedName: recipientName,
        recipientSignature: recipientSig,
        courierTypedName: courierName,
        latitude: location?.lat,
        longitude: location?.lng,
        timezone,
        localTimestamp: localTime,
        actorUserId,
      });
      await supplyOrdersService.updateStatus(order.id, 'delivered', actorUserId || null);
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
          <Truck className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Confirm Delivery</h2>
        <p className="text-slate-400 text-sm">Deliver order <strong className="text-white">{order?.order_number}</strong> and collect recipient signature.</p>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">{facility?.name}</p>
            {facility?.address && <p className="text-slate-400 text-sm">{facility.address}</p>}
          </div>
        </div>
      </div>

      {order?.items && <ItemList items={order.items} />}

      <div className="bg-slate-700/50 rounded-xl p-3 text-sm">
        <p className="text-slate-400 text-xs mb-1">Delivery Time</p>
        <p className="text-white font-medium">{localTime}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Recipient Name</label>
          <input
            type="text"
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
            placeholder="Person receiving the delivery..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <SignatureCanvas label="Recipient Signature" onCapture={setRecipientSig} />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Your Name (Courier)</label>
          <input
            type="text"
            value={courierName}
            onChange={e => setCourierName(e.target.value)}
            placeholder="Type your full name..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={submitting || !recipientName.trim() || !recipientSig || !courierName.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors"
      >
        {submitting ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Confirm Delivery</>}
      </button>
    </div>
  );
}

function PhaseComplete({ delivery }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Delivery Complete</h2>
        <p className="text-slate-400">Order {delivery.order?.order_number} has been successfully delivered.</p>
      </div>

      <div className="bg-slate-800 rounded-xl border border-green-500/20 p-5 space-y-4">
        <h3 className="text-green-400 font-semibold text-sm uppercase tracking-wider">Delivery Receipt</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 text-xs mb-1">Recipient</p>
            <p className="text-white font-medium">{delivery.recipient_typed_name}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">Courier</p>
            <p className="text-white font-medium">{delivery.courier_typed_name}</p>
          </div>
          <div className="col-span-2">
            <p className="text-slate-500 text-xs mb-1">Delivered At</p>
            <p className="text-white">{delivery.delivery_local_timestamp || new Date(delivery.delivered_at).toLocaleString()}</p>
          </div>
        </div>
        {delivery.recipient_signature && (
          <div>
            <p className="text-slate-500 text-xs mb-2">Recipient Signature</p>
            <img src={delivery.recipient_signature} alt="Recipient signature" className="h-20 bg-white rounded-lg border border-slate-600 object-contain" />
          </div>
        )}
        {delivery.picked_up_signature && (
          <div>
            <p className="text-slate-500 text-xs mb-2">Pick-up Signature</p>
            <img src={delivery.picked_up_signature} alt="Pick-up signature" className="h-20 bg-white rounded-lg border border-slate-600 object-contain" />
          </div>
        )}
      </div>

      <Link
        to="/my-deliveries"
        className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Deliveries
      </Link>
    </div>
  );
}

export default function DeliverySignature() {
  const { qrToken } = useParams();
  const { user, isCourier, isStaff } = useAuth();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState('loading');

  useEffect(() => {
    loadDelivery();
  }, [qrToken]);

  async function loadDelivery() {
    try {
      setLoading(true);
      setError(null);
      const data = await supplyDeliveryService.getByQrToken(qrToken);
      if (!data) throw new Error('Invalid QR code. This delivery link does not exist.');
      setDelivery(data);

      if (data.qr_used && data.delivered_at) {
        setPhase('complete');
      } else if (!data.picked_up_at) {
        setPhase('pickup');
      } else if (!data.delivered_at) {
        setPhase('delivery');
      } else {
        setPhase('complete');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isCourier && !isStaff) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">You need to be logged in as a courier to use this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Invalid QR Code</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <Link to="/my-deliveries" className="mt-6 inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to deliveries
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link to="/my-deliveries" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to deliveries
        </Link>

        {phase === 'pickup' && (
          <PhasePickup
            delivery={delivery}
            onComplete={() => { loadDelivery(); setPhase('delivery'); }}
            actorUserId={user?.id}
          />
        )}

        {phase === 'delivery' && (
          <PhaseDelivery
            delivery={delivery}
            onComplete={() => { loadDelivery(); setPhase('complete'); }}
            actorUserId={user?.id}
          />
        )}

        {phase === 'complete' && delivery && (
          <PhaseComplete delivery={delivery} />
        )}
      </div>
    </div>
  );
}
