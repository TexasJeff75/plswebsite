import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, CircleCheck as CheckCircle, Clock, MapPin, ChevronRight, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react';
import { supplyDeliveryService } from '../services/supplyDeliveryService';
import { useAuth } from '../contexts/AuthContext';

function DeliveryCard({ delivery }) {
  const order = delivery.order;
  const facility = order?.facility;
  const isPending = !delivery.picked_up_at || !delivery.delivered_at;
  const isPickedUp = delivery.picked_up_at && !delivery.delivered_at;
  const isDelivered = !!delivery.delivered_at;

  return (
    <div className={`bg-slate-800 border rounded-xl p-5 space-y-4 ${isDelivered ? 'border-green-500/20' : 'border-slate-700'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-semibold">{order?.order_number}</span>
            {isDelivered ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                <CheckCircle className="w-3 h-3" />
                Delivered
              </span>
            ) : isPickedUp ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Truck className="w-3 h-3" />
                In Transit
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Clock className="w-3 h-3" />
                Awaiting Pick-up
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-sm">
            <MapPin className="w-3.5 h-3.5" />
            <span>{facility?.name}</span>
            {facility?.city && <span>&mdash; {facility.city}, {facility.state}</span>}
          </div>
        </div>

        {!isDelivered && (
          <Link
            to={`/delivery/${delivery.qr_token}`}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            {isPickedUp ? 'Confirm Delivery' : 'Confirm Pick-up'}
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {delivery.estimated_delivery_date && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Estimated Delivery</p>
            <p className="text-white">{new Date(delivery.estimated_delivery_date + 'T00:00:00').toLocaleDateString()}</p>
          </div>
        )}
        {delivery.tracking_number && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Tracking #</p>
            <p className="text-white">{delivery.tracking_number}</p>
          </div>
        )}
        {delivery.picked_up_at && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Picked Up</p>
            <p className="text-green-400">{new Date(delivery.picked_up_at).toLocaleString()}</p>
          </div>
        )}
        {delivery.delivered_at && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Delivered</p>
            <p className="text-green-400">{delivery.delivery_local_timestamp || new Date(delivery.delivered_at).toLocaleString()}</p>
          </div>
        )}
      </div>

      {facility?.address && (
        <div className="pt-2 border-t border-slate-700">
          <p className="text-slate-500 text-xs">{facility.address}{facility.city ? `, ${facility.city}, ${facility.state}` : ''}</p>
        </div>
      )}
    </div>
  );
}

export default function MyDeliveries() {
  const { user, isCourier, isStaff } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.id) loadDeliveries();
  }, [user?.id]);

  async function loadDeliveries() {
    try {
      setLoading(true);
      setError(null);
      const data = await supplyDeliveryService.getByCourier(user.id);
      setDeliveries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isCourier && !isStaff) {
    return (
      <div className="text-center py-12">
        <Truck className="w-16 h-16 mx-auto text-slate-700 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">This page is for couriers only.</p>
      </div>
    );
  }

  const pending = deliveries.filter(d => !d.delivered_at);
  const completed = deliveries.filter(d => !!d.delivered_at);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Deliveries</h1>
          <p className="text-slate-400 text-sm mt-1">{pending.length} active, {completed.length} completed</p>
        </div>
        <button onClick={loadDeliveries} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
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
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Active</h2>
              <div className="space-y-3">
                {pending.map(d => <DeliveryCard key={d.id} delivery={d} />)}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Completed</h2>
              <div className="space-y-3">
                {completed.map(d => <DeliveryCard key={d.id} delivery={d} />)}
              </div>
            </div>
          )}

          {deliveries.length === 0 && (
            <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
              <Truck className="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400">No deliveries assigned yet</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
