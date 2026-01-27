import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';

const MILESTONE_NAMES = [
  'Site Assessment',
  'CLIA Certificate Obtained',
  'Lab Director Assigned',
  'Equipment Ordered',
  'Equipment Installed',
  'Network/LIS Integration',
  'Staff Training Complete',
  'Competency Assessment Done',
  'Go-Live'
];

const EQUIPMENT_DEVICES = [
  { name: 'Siemens epoc', type: 'blood_gas' },
  { name: 'Diatron Abacus 3', type: 'cbc' },
  { name: 'Clarity Platinum', type: 'urinalysis' },
  { name: 'Cepheid GeneXpert', type: 'molecular' }
];

export default function ImportData({ onImportComplete, onClose }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importMode, setImportMode] = useState('merge');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);

  const validateFacilityData = (facility) => {
    const errors = [];
    if (!facility.name) errors.push('Missing facility name');
    if (!facility.address) errors.push('Missing address');
    if (!facility.city) errors.push('Missing city');
    if (!facility.state) errors.push('Missing state');
    if (!facility.zip) errors.push('Missing ZIP code');
    if (facility.latitude === undefined) errors.push('Missing latitude');
    if (facility.longitude === undefined) errors.push('Missing longitude');
    if (!facility.region) errors.push('Missing region');
    return errors;
  };

  const validateData = (jsonData) => {
    if (!Array.isArray(jsonData)) {
      return { valid: false, errors: ['JSON must contain an array of facilities'] };
    }

    const errors = [];
    jsonData.forEach((facility, idx) => {
      const facilityErrors = validateFacilityData(facility);
      if (facilityErrors.length > 0) {
        facilityErrors.forEach(err => {
          errors.push(`Facility ${idx + 1} (${facility.name || 'Unknown'}): ${err}`);
        });
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        const validation = validateData(jsonData);

        if (validation.valid) {
          setFile(selectedFile);
          setData(jsonData);
          setValidationErrors([]);
          setStep('preview');
        } else {
          setValidationErrors(validation.errors);
          setFile(null);
          setData(null);
        }
      } catch (error) {
        setValidationErrors([`Invalid JSON: ${error.message}`]);
        setFile(null);
        setData(null);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!data) return;

    setImporting(true);
    setImportProgress({ current: 0, total: data.length });

    try {
      if (importMode === 'replace') {
        const existing = await facilitiesService.getAll({});
        for (const facility of existing) {
          await facilitiesService.delete(facility.id);
        }
      }

      for (let i = 0; i < data.length; i++) {
        const facilityData = data[i];

        const facility = await facilitiesService.create({
          name: facilityData.name,
          address: facilityData.address,
          city: facilityData.city,
          state: facilityData.state,
          zip: facilityData.zip,
          latitude: parseFloat(facilityData.latitude),
          longitude: parseFloat(facilityData.longitude),
          region: facilityData.region,
          status: facilityData.status || 'not_started',
          projected_go_live: facilityData.projected_go_live || null,
          contact_name: facilityData.contact_name || null,
          contact_email: facilityData.contact_email || null,
          contact_phone: facilityData.contact_phone || null,
          general_notes: facilityData.general_notes || null
        });

        if (facilityData.milestones && Array.isArray(facilityData.milestones)) {
          for (let j = 0; j < facilityData.milestones.length && j < MILESTONE_NAMES.length; j++) {
            const milestone = facilityData.milestones[j];
            await facilitiesService.createMilestone({
              facility_id: facility.id,
              milestone_number: j + 1,
              name: MILESTONE_NAMES[j],
              status: milestone.status || 'not_started',
              completion_date: milestone.completion_date || null,
              notes: milestone.notes || null
            });
          }
        } else {
          for (let j = 0; j < MILESTONE_NAMES.length; j++) {
            await facilitiesService.createMilestone({
              facility_id: facility.id,
              milestone_number: j + 1,
              name: MILESTONE_NAMES[j],
              status: 'not_started',
              completion_date: null,
              notes: null
            });
          }
        }

        if (facilityData.equipment && Array.isArray(facilityData.equipment)) {
          for (const equipItem of facilityData.equipment) {
            await facilitiesService.createEquipment({
              facility_id: facility.id,
              device_name: equipItem.device_name,
              device_type: equipItem.device_type || '',
              status: equipItem.status || 'not_ordered',
              order_date: equipItem.order_date || null,
              delivery_date: equipItem.delivery_date || null
            });
          }
        } else {
          for (const device of EQUIPMENT_DEVICES) {
            await facilitiesService.createEquipment({
              facility_id: facility.id,
              device_name: device.name,
              device_type: device.type,
              status: 'not_ordered',
              order_date: null,
              delivery_date: null
            });
          }
        }

        setImportProgress({ current: i + 1, total: data.length });
      }

      setStep('complete');
      setImporting(false);
      setTimeout(() => {
        onImportComplete?.();
        onClose?.();
      }, 2000);
    } catch (error) {
      console.error('Import error:', error);
      setValidationErrors([`Import failed: ${error.message}`]);
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Import Facility Data</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-500/5 transition-all"
              >
                <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-white font-medium mb-1">Click to upload JSON file</p>
                <p className="text-sm text-slate-400">or drag and drop your file here</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Expected JSON Format</h3>
                <pre className="bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto">
{`[
  {
    "name": "Facility Name",
    "address": "123 Main St",
    "city": "Kansas City",
    "state": "MO",
    "zip": "64101",
    "latitude": 39.0997,
    "longitude": -94.5786,
    "region": "Kansas City Area",
    "status": "in_progress",
    "projected_go_live": "2026-03-15",
    "contact_name": "John Doe",
    "contact_email": "john@facility.com",
    "contact_phone": "555-1234",
    "general_notes": "Notes here"
  }
]`}
                </pre>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <h3 className="font-medium text-red-400">Validation Errors</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-red-300">
                    {validationErrors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && data && (
            <div className="space-y-4">
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <h3 className="font-medium text-teal-400">File validated successfully</h3>
                </div>
                <p className="text-sm text-teal-300">{data.length} facilities ready to import</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Import Mode</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/50">
                    <input
                      type="radio"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">Merge with existing data</p>
                      <p className="text-xs text-slate-400">Add new facilities, keep existing ones</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/50">
                    <input
                      type="radio"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">Replace all data</p>
                      <p className="text-xs text-slate-400">Delete all existing facilities and import new ones</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Preview</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.map((facility, idx) => (
                    <div key={idx} className="bg-slate-800/50 rounded p-2 text-xs">
                      <p className="font-medium text-white">{facility.name}</p>
                      <p className="text-slate-400">{facility.city}, {facility.state}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-teal-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Import Complete</h3>
              <p className="text-slate-400">{data?.length} facilities imported successfully</p>
            </div>
          )}

          {importing && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="text-white font-medium mb-2">Importing data...</h3>
              <p className="text-slate-400 text-sm">
                {importProgress.current} of {importProgress.total} facilities
              </p>
              <div className="w-64 bg-slate-800 rounded-full h-2 mt-4">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          {step === 'preview' && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Import {data?.length} Facilities
            </button>
          )}
          {step === 'upload' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium transition-colors"
            >
              Select File
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
