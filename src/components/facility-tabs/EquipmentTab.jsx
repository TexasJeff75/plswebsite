import React, { useState, useEffect } from 'react';
import { Package, CheckCircle2, AlertCircle, Save, Loader2, Camera, X, Image, Eye } from 'lucide-react';
import { facilitiesService } from '../../services/facilitiesService';

const EQUIPMENT_TYPES = [
  { id: 'genexpert', name: 'Cepheid GeneXpert V2' },
  { id: 'clarity', name: 'Clarity Platinum' },
  { id: 'epoc', name: 'EPOC Blood Analysis' },
  { id: 'abacus', name: 'Abacus Cell Counter' },
];

const STATUS_FLOW = ['not_ordered', 'ordered', 'shipped', 'delivered', 'installed', 'validated', 'operational'];
const STATUS_LABELS = {
  not_ordered: 'Not Ordered',
  ordered: 'Ordered',
  shipped: 'Shipped',
  delivered: 'Delivered',
  installed: 'Installed',
  validated: 'Validated',
  operational: 'Operational',
};

export default function EquipmentTab({ facility, isEditor, onUpdate }) {
  const [equipment, setEquipment] = useState([]);
  const [editedEquipment, setEditedEquipment] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());
  const [saveSuccess, setSaveSuccess] = useState(new Set());
  const [equipmentImages, setEquipmentImages] = useState({});
  const [uploadingImage, setUploadingImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (facility?.equipment) {
      setEquipment(facility.equipment);
      const initial = {};
      facility.equipment.forEach(eq => {
        initial[eq.equipment_type] = { ...eq };
      });
      setEditedEquipment(initial);
      loadEquipmentImages(facility.equipment);
    }
  }, [facility?.equipment]);

  async function loadEquipmentImages(equipmentList) {
    const images = {};
    for (const eq of equipmentList) {
      if (eq.image_storage_path) {
        const url = await facilitiesService.getEquipmentImageUrl(eq.image_storage_path);
        if (url) {
          images[eq.id] = url;
        }
      }
    }
    setEquipmentImages(images);
  }

  async function handleImageUpload(equipmentType, file) {
    const existingEquipment = equipment.find(e => e.equipment_type === equipmentType);
    if (!existingEquipment?.id) {
      alert('Please save the equipment first before uploading an image.');
      return;
    }

    try {
      setUploadingImage(equipmentType);
      const updated = await facilitiesService.uploadEquipmentImage(
        facility.id,
        existingEquipment.id,
        file
      );

      setEquipment(prev => prev.map(e =>
        e.id === existingEquipment.id ? updated : e
      ));

      const imageUrl = await facilitiesService.getEquipmentImageUrl(updated.image_storage_path);
      setEquipmentImages(prev => ({ ...prev, [existingEquipment.id]: imageUrl }));

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(null);
    }
  }

  async function handleDeleteImage(equipmentType) {
    const existingEquipment = equipment.find(e => e.equipment_type === equipmentType);
    if (!existingEquipment?.id || !existingEquipment.image_storage_path) return;

    if (!window.confirm('Are you sure you want to remove this image?')) return;

    try {
      const updated = await facilitiesService.deleteEquipmentImage(
        existingEquipment.id,
        existingEquipment.image_storage_path
      );

      setEquipment(prev => prev.map(e =>
        e.id === existingEquipment.id ? updated : e
      ));

      setEquipmentImages(prev => {
        const newImages = { ...prev };
        delete newImages[existingEquipment.id];
        return newImages;
      });

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      not_ordered: 'bg-slate-700',
      ordered: 'bg-blue-700',
      shipped: 'bg-cyan-700',
      delivered: 'bg-teal-700',
      installed: 'bg-emerald-700',
      validated: 'bg-amber-700',
      operational: 'bg-green-700',
    };
    return colors[status] || 'bg-slate-700';
  };

  const handleFieldChange = (equipmentType, field, value) => {
    setEditedEquipment(prev => ({
      ...prev,
      [equipmentType]: {
        ...prev[equipmentType],
        [field]: value
      }
    }));
    setSaveSuccess(prev => {
      const newSet = new Set(prev);
      newSet.delete(equipmentType);
      return newSet;
    });
  };

  const handleSave = async (equipmentType) => {
    try {
      setSavingIds(prev => new Set(prev).add(equipmentType));

      const equipmentData = editedEquipment[equipmentType];
      const existingEquipment = equipment.find(e => e.equipment_type === equipmentType);

      let result;
      if (existingEquipment?.id) {
        result = await facilitiesService.updateEquipment(existingEquipment.id, equipmentData);
      } else {
        result = await facilitiesService.createEquipment({
          ...equipmentData,
          facility_id: facility.id,
          equipment_type: equipmentType,
          display_name: EQUIPMENT_TYPES.find(t => t.id === equipmentType)?.name
        });
      }

      setEquipment(prev => {
        const updated = prev.filter(e => e.equipment_type !== equipmentType);
        return [...updated, result];
      });

      setSaveSuccess(prev => new Set(prev).add(equipmentType));
      setTimeout(() => {
        setSaveSuccess(prev => {
          const newSet = new Set(prev);
          newSet.delete(equipmentType);
          return newSet;
        });
      }, 3000);

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error saving equipment:', error);
      alert('Failed to save equipment. Please try again.');
    } finally {
      setSavingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(equipmentType);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Package className="w-5 h-5 text-teal-400" />
        <h3 className="text-lg font-semibold text-white">Equipment Management</h3>
      </div>

      {EQUIPMENT_TYPES.map(type => {
        const equip = editedEquipment[type.id] || {
          equipment_type: type.id,
          display_name: type.name,
          equipment_status: 'not_ordered',
        };
        const isSaving = savingIds.has(type.id);
        const showSuccess = saveSuccess.has(type.id);

        return (
          <div key={type.id} className="bg-slate-800 rounded-lg p-6 space-y-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-white font-semibold text-lg">{type.name}</h4>
                <p className="text-slate-400 text-xs mt-1">Equipment Type: {type.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold text-white ${getStatusColor(equip.equipment_status)}`}>
                  {STATUS_LABELS[equip.equipment_status] || 'Unknown'}
                </span>
                {isEditor && (
                  <button
                    onClick={() => handleSave(type.id)}
                    disabled={isSaving}
                    className="px-4 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : showSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Status Progression */}
            <div className="mb-6">
              <p className="text-slate-400 text-sm mb-2">Deployment Lifecycle</p>
              <div className="flex gap-2 flex-wrap">
                {STATUS_FLOW.map(status => (
                  <div
                    key={status}
                    className={`text-xs px-2 py-1 rounded ${
                      STATUS_FLOW.indexOf(equip.equipment_status) >= STATUS_FLOW.indexOf(status)
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {STATUS_LABELS[status]}
                  </div>
                ))}
              </div>
            </div>

            {/* Procurement Section */}
            <div className="bg-slate-700 rounded p-4 space-y-3">
              <h5 className="text-slate-300 font-semibold text-sm">Procurement</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Procurement Method</label>
                  <select
                    value={equip.procurement_method || ''}
                    onChange={(e) => handleFieldChange(type.id, 'procurement_method', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  >
                    <option value="">Select Method</option>
                    <option value="reagent_rental">Reagent Rental</option>
                    <option value="purchase">Purchase</option>
                    <option value="lease">Lease</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Order Number</label>
                  <input
                    type="text"
                    value={equip.order_number || ''}
                    onChange={(e) => handleFieldChange(type.id, 'order_number', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Order Date</label>
                  <input
                    type="date"
                    value={equip.order_date || ''}
                    onChange={(e) => handleFieldChange(type.id, 'order_date', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Section */}
            <div className="bg-slate-700 rounded p-4 space-y-3">
              <h5 className="text-slate-300 font-semibold text-sm">Shipping</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Carrier</label>
                  <input
                    type="text"
                    value={equip.carrier || ''}
                    onChange={(e) => handleFieldChange(type.id, 'carrier', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Tracking Number</label>
                  <input
                    type="text"
                    value={equip.tracking_number || ''}
                    onChange={(e) => handleFieldChange(type.id, 'tracking_number', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Ship Date</label>
                  <input
                    type="date"
                    value={equip.ship_date || ''}
                    onChange={(e) => handleFieldChange(type.id, 'ship_date', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Delivery Date</label>
                  <input
                    type="date"
                    value={equip.delivery_date || ''}
                    onChange={(e) => handleFieldChange(type.id, 'delivery_date', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Installation Section */}
            <div className="bg-slate-700 rounded p-4 space-y-3">
              <h5 className="text-slate-300 font-semibold text-sm">Installation</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Serial Number</label>
                  <input
                    type="text"
                    value={equip.serial_number || ''}
                    onChange={(e) => handleFieldChange(type.id, 'serial_number', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Installed By</label>
                  <input
                    type="text"
                    value={equip.installed_by || ''}
                    onChange={(e) => handleFieldChange(type.id, 'installed_by', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 text-xs mb-1 block">Installation Date</label>
                  <input
                    type="date"
                    value={equip.installed_date || ''}
                    onChange={(e) => handleFieldChange(type.id, 'installed_date', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* QC & Validation Section */}
            <div className="bg-slate-700 rounded p-4 space-y-3">
              <h5 className="text-slate-300 font-semibold text-sm">Quality Control & Validation</h5>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-slate-400 text-xs mb-1 block">Initial QC Performed</label>
                    <input
                      type="checkbox"
                      checked={equip.initial_qc_performed || false}
                      onChange={(e) => handleFieldChange(type.id, 'initial_qc_performed', e.target.checked)}
                      disabled={!isEditor}
                      className="w-4 h-4"
                    />
                  </div>
                  {equip.initial_qc_performed && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">QC Date</label>
                  <input
                    type="date"
                    value={equip.initial_qc_date || ''}
                    onChange={(e) => handleFieldChange(type.id, 'initial_qc_date', e.target.value)}
                    disabled={!isEditor}
                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-slate-400 text-xs mb-1 block">QC Acceptable</label>
                    <input
                      type="checkbox"
                      checked={equip.initial_qc_acceptable || false}
                      onChange={(e) => handleFieldChange(type.id, 'initial_qc_acceptable', e.target.checked)}
                      disabled={!isEditor}
                      className="w-4 h-4"
                    />
                  </div>
                  {equip.initial_qc_acceptable ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    equip.initial_qc_performed && <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>

              {facility.site_configuration === 'moderate' && (
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-600">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-slate-400 text-xs mb-1 block">Calibration Verification Complete</label>
                      <input
                        type="checkbox"
                        checked={equip.calibration_verification_complete || false}
                        onChange={(e) => handleFieldChange(type.id, 'calibration_verification_complete', e.target.checked)}
                        disabled={!isEditor}
                        className="w-4 h-4"
                      />
                    </div>
                    {equip.calibration_verification_complete && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Verification Date</label>
                    <input
                      type="date"
                      value={equip.calibration_verification_date || ''}
                      onChange={(e) => handleFieldChange(type.id, 'calibration_verification_date', e.target.value)}
                      disabled={!isEditor}
                      className="w-full bg-slate-600 text-white px-2 py-1 rounded text-sm border border-slate-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Equipment Photo */}
            <div className="bg-slate-700 rounded p-4 space-y-3">
              <h5 className="text-slate-300 font-semibold text-sm flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Equipment Photo
              </h5>
              {(() => {
                const existingEquipment = equipment.find(e => e.equipment_type === type.id);
                const imageUrl = existingEquipment?.id ? equipmentImages[existingEquipment.id] : null;

                return (
                  <div className="flex gap-4">
                    {imageUrl ? (
                      <div className="relative group">
                        <div
                          className="w-40 h-40 rounded-lg overflow-hidden bg-slate-800 cursor-pointer"
                          onClick={() => setPreviewImage({ url: imageUrl, name: type.name })}
                        >
                          <img
                            src={imageUrl}
                            alt={`${type.name} equipment`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPreviewImage({ url: imageUrl, name: type.name })}
                            className="p-2 bg-slate-700 rounded-full text-white hover:bg-slate-600 transition-colors"
                            title="View full size"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {isEditor && (
                            <button
                              onClick={() => handleDeleteImage(type.id)}
                              className="p-2 bg-red-700 rounded-full text-white hover:bg-red-600 transition-colors"
                              title="Remove image"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-40 h-40 rounded-lg bg-slate-800 flex items-center justify-center">
                        <Image className="w-12 h-12 text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-slate-400 text-sm mb-3">
                        {imageUrl
                          ? 'Photo of the installed equipment at this facility.'
                          : 'Upload a photo of the installed equipment to document the deployment.'}
                      </p>
                      {isEditor && (
                        <div>
                          <input
                            type="file"
                            id={`equipment-image-${type.id}`}
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(type.id, file);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor={`equipment-image-${type.id}`}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                              uploadingImage === type.id
                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                : 'bg-teal-600 hover:bg-teal-700 text-white'
                            }`}
                          >
                            {uploadingImage === type.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Camera className="w-4 h-4" />
                                {imageUrl ? 'Replace Photo' : 'Upload Photo'}
                              </>
                            )}
                          </label>
                          {!existingEquipment?.id && (
                            <p className="text-amber-400 text-xs mt-2">
                              Save equipment first to enable photo upload
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Notes */}
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Notes</label>
              <textarea
                value={equip.notes || ''}
                onChange={(e) => handleFieldChange(type.id, 'notes', e.target.value)}
                disabled={!isEditor}
                rows="3"
                placeholder="Add any additional notes about this equipment..."
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
              />
            </div>
          </div>
        );
      })}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="bg-slate-800 rounded-lg overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="w-full h-auto max-h-[80vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="p-4 border-t border-slate-700">
                <h5 className="text-white font-semibold">{previewImage.name}</h5>
                <p className="text-slate-400 text-sm mt-1">Equipment Photo</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
