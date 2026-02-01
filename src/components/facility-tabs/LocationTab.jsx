import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Edit2, Save, X, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import FacilityMapEmbed from '../maps/FacilityMapEmbed';
import FormField from '../FormField';
import FormError from '../FormError';
import { facilitiesService } from '../../services/facilitiesService';
import { geocodingService } from '../../services/geocodingService';
import { validateForm, validators } from '../../utils/formValidation';

export default function LocationTab({ facility, isEditor, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [nearbyFacilities, setNearbyFacilities] = useState([]);

  useEffect(() => {
    loadNearbyFacilities();
  }, [facility.id]);

  async function loadNearbyFacilities() {
    if (!facility.latitude || !facility.longitude) return;

    try {
      const allFacilities = await facilitiesService.getAll();
      const nearby = allFacilities
        .filter(f => f.id !== facility.id && f.latitude && f.longitude)
        .map(f => ({
          ...f,
          distance: calculateDistance(
            facility.latitude, facility.longitude,
            f.latitude, f.longitude
          )
        }))
        .filter(f => f.distance <= 100)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

      setNearbyFacilities(nearby);
    } catch (err) {
      console.error('Error loading nearby facilities:', err);
    }
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function startEditing() {
    setError(null);
    setEditedData({
      address: facility.address || '',
      city: facility.city || '',
      state: facility.state || '',
      county: facility.county || '',
      region: facility.region || '',
      latitude: facility.latitude || '',
      longitude: facility.longitude || ''
    });
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditedData({});
    setError(null);
  }

  async function saveChanges() {
    const rules = {
      address: (val) => validators.required(val, 'Street address'),
      city: (val) => validators.required(val, 'City'),
      state: (val) => validators.required(val, 'State'),
      latitude: (val) => {
        if (val && editedData.longitude) {
          return validators.coordinates(val, editedData.longitude);
        }
        return null;
      },
      longitude: (val) => {
        if (val && editedData.latitude) {
          return validators.coordinates(editedData.latitude, val);
        }
        return null;
      }
    };

    const { isValid, errors } = validateForm(editedData, rules);

    if (!isValid) {
      setValidationErrors(errors);
      setError('Please fix the errors below');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setValidationErrors({});

      const dataToSave = {
        ...editedData,
        latitude: editedData.latitude ? parseFloat(editedData.latitude) : null,
        longitude: editedData.longitude ? parseFloat(editedData.longitude) : null
      };

      await facilitiesService.update(facility.id, dataToSave);
      setIsEditing(false);
      setSuccess('Location updated successfully');
      setTimeout(() => setSuccess(null), 3000);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error saving changes:', err);
      setError(err.message || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  }

  async function geocodeAddress() {
    const address = isEditing ? editedData : facility;
    const fullAddress = [address.address, address.city, address.county, address.state, 'USA']
      .filter(Boolean)
      .join(', ');

    if (!fullAddress || fullAddress === 'USA') {
      setError('Please enter an address to geocode');
      return;
    }

    try {
      setGeocoding(true);
      setError(null);
      const coords = await geocodingService.geocodeAddress(fullAddress);

      if (coords) {
        if (isEditing) {
          setEditedData(prev => ({
            ...prev,
            latitude: coords.lat.toFixed(8),
            longitude: coords.lon.toFixed(8)
          }));
        } else {
          await facilitiesService.update(facility.id, {
            latitude: coords.lat,
            longitude: coords.lon
          });
          if (onUpdate) onUpdate();
        }
      } else {
        setError('Could not find coordinates for this address');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setError('Failed to geocode address');
    } finally {
      setGeocoding(false);
    }
  }

  const hasCoordinates = facility.latitude && facility.longitude;

  return (
    <div className="space-y-6">
      {isEditor && (
        <div className="flex justify-end gap-2">
          {!isEditing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Location
            </button>
          ) : (
            <>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      )}

      <FormError message={error} onDismiss={() => setError(null)} />

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-200">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-400" />
            Address Information
          </h3>

          {isEditing ? (
            <div className="space-y-4">
              <FormField
                label="Street Address"
                error={validationErrors.address}
                required
              >
                <input
                  type="text"
                  value={editedData.address}
                  onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                  className={`w-full bg-slate-700 text-white px-3 py-2 rounded border ${
                    validationErrors.address ? 'border-red-500' : 'border-slate-600'
                  } focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm`}
                  placeholder="123 Main Street"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="City"
                  error={validationErrors.city}
                  required
                >
                  <input
                    type="text"
                    value={editedData.city}
                    onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                    className={`w-full bg-slate-700 text-white px-3 py-2 rounded border ${
                      validationErrors.city ? 'border-red-500' : 'border-slate-600'
                    } focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm`}
                  />
                </FormField>

                <FormField
                  label="State"
                  error={validationErrors.state}
                  required
                >
                  <input
                    type="text"
                    value={editedData.state}
                    onChange={(e) => setEditedData({ ...editedData, state: e.target.value })}
                    className={`w-full bg-slate-700 text-white px-3 py-2 rounded border ${
                      validationErrors.state ? 'border-red-500' : 'border-slate-600'
                    } focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm`}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="County"
                  help="Optional"
                >
                  <input
                    type="text"
                    value={editedData.county}
                    onChange={(e) => setEditedData({ ...editedData, county: e.target.value })}
                    className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
                  />
                </FormField>

                <FormField
                  label="Region"
                  help="Optional"
                >
                  <input
                    type="text"
                    value={editedData.region}
                    onChange={(e) => setEditedData({ ...editedData, region: e.target.value })}
                    className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
                  />
                </FormField>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-4 space-y-2">
              <p className="text-white">{facility.address || 'No address'}</p>
              <p className="text-slate-300">
                {[facility.city, facility.state].filter(Boolean).join(', ')}
              </p>
              {facility.county && (
                <p className="text-slate-400 text-sm">{facility.county} County</p>
              )}
              {facility.region && (
                <p className="text-slate-400 text-sm">Region: {facility.region}</p>
              )}
            </div>
          )}

          <h3 className="text-white font-semibold flex items-center gap-2 pt-4">
            <Navigation className="w-4 h-4 text-teal-400" />
            Coordinates
          </h3>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Latitude"
                  help="Range: -90 to 90"
                  error={validationErrors.latitude}
                >
                  <input
                    type="text"
                    value={editedData.latitude}
                    onChange={(e) => setEditedData({ ...editedData, latitude: e.target.value })}
                    className={`w-full bg-slate-700 text-white px-3 py-2 rounded border ${
                      validationErrors.latitude ? 'border-red-500' : 'border-slate-600'
                    } focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm font-mono`}
                    placeholder="39.8283"
                  />
                </FormField>

                <FormField
                  label="Longitude"
                  help="Range: -180 to 180"
                  error={validationErrors.longitude}
                >
                  <input
                    type="text"
                    value={editedData.longitude}
                    onChange={(e) => setEditedData({ ...editedData, longitude: e.target.value })}
                    className={`w-full bg-slate-700 text-white px-3 py-2 rounded border ${
                      validationErrors.longitude ? 'border-red-500' : 'border-slate-600'
                    } focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm font-mono`}
                    placeholder="-98.5795"
                  />
                </FormField>
              </div>

              <button
                onClick={geocodeAddress}
                disabled={geocoding || !editedData.address}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {geocoding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {geocoding ? 'Geocoding...' : 'Auto-fill from Address'}
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-4">
              {hasCoordinates ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-mono text-sm">
                      {parseFloat(facility.latitude).toFixed(6)}, {parseFloat(facility.longitude).toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${facility.latitude},${facility.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 text-xs mt-1 inline-block"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-slate-400 text-sm">No coordinates set</p>
                  {isEditor && (
                    <button
                      onClick={geocodeAddress}
                      disabled={geocoding}
                      className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {geocoding ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Geocode
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-white font-semibold">Map View</h3>
          <FacilityMapEmbed
            facility={isEditing ? { ...facility, ...editedData } : facility}
            height={280}
            showStylePicker
            interactive
          />
        </div>
      </div>

      {nearbyFacilities.length > 0 && (
        <div className="pt-4">
          <h3 className="text-white font-semibold mb-4">Nearby Facilities (within 100 miles)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {nearbyFacilities.map(f => (
              <div key={f.id} className="bg-slate-800 rounded-lg p-3 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{f.name}</p>
                    <p className="text-slate-400 text-xs">{f.city}, {f.state}</p>
                  </div>
                  <span className="text-teal-400 text-xs font-medium">
                    {f.distance.toFixed(1)} mi
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: f.status === 'Live' ? '#10b981' : f.status === 'In Progress' ? '#3b82f6' : f.status === 'Blocked' ? '#ef4444' : '#f59e0b' }}
                  />
                  <span className="text-slate-400 text-xs">{f.status || 'Unknown'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
