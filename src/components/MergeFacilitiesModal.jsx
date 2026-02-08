import { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

export default function MergeFacilitiesModal({ facilities, onClose, onMerge }) {
  const [selectedTarget, setSelectedTarget] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  if (facilities.length !== 2) {
    return null;
  }

  const handleMerge = async () => {
    if (!selectedTarget) {
      setError('Please select which facility to keep');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const targetFacility = facilities.find(f => f.id === selectedTarget);
      const sourceFacility = facilities.find(f => f.id !== selectedTarget);

      await onMerge(sourceFacility.id, targetFacility.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to merge facilities');
    } finally {
      setIsProcessing(false);
    }
  };

  const targetFacility = facilities.find(f => f.id === selectedTarget);
  const sourceFacility = facilities.find(f => f.id !== selectedTarget);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full border border-slate-700">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Merge Facilities</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="text-amber-500 flex-shrink-0" size={24} />
            <div className="text-sm text-amber-200">
              <p className="font-semibold mb-1">This action cannot be undone!</p>
              <p>All related records (milestones, equipment, documents, contacts, etc.) from the facility you remove will be transferred to the facility you keep.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select which facility to keep:
            </label>
            <div className="space-y-3">
              {facilities.map(facility => (
                <div
                  key={facility.id}
                  onClick={() => setSelectedTarget(facility.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedTarget === facility.id
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedTarget === facility.id
                        ? 'border-teal-500 bg-teal-500'
                        : 'border-slate-600'
                    }`}>
                      {selectedTarget === facility.id && (
                        <CheckCircle size={16} className="text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white mb-1">{facility.name}</div>
                      <div className="text-sm text-slate-400 space-y-1">
                        {facility.address && <div>{facility.address}</div>}
                        {facility.city && facility.state && (
                          <div>{facility.city}, {facility.state} {facility.zip}</div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-700 text-slate-300">
                            Status: {facility.status || 'N/A'}
                          </span>
                          {facility.phase && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-700 text-slate-300">
                              Phase: {facility.phase}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedTarget && sourceFacility && (
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">Summary:</span> All records from{' '}
                <span className="text-red-400 font-medium">{sourceFacility.name}</span> will be moved to{' '}
                <span className="text-teal-400 font-medium">{targetFacility.name}</span>, and then{' '}
                <span className="text-red-400 font-medium">{sourceFacility.name}</span> will be deleted.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!selectedTarget || isProcessing}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Processing...
              </>
            ) : (
              'Merge Facilities'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
