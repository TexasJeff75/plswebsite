import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function useDirtyForm(isDirty, onDiscard) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const unblock = navigate(location => {
      if (isDirty && location.pathname !== window.location.pathname) {
        setShowWarning(true);
        setPendingNavigation(location);
        return false;
      }
      return true;
    });

    return () => {
      if (typeof unblock === 'function') unblock();
    };
  }, [isDirty, navigate]);

  const handleDiscard = () => {
    onDiscard?.();
    if (pendingNavigation) {
      navigate(pendingNavigation.pathname);
    }
    setShowWarning(false);
    setPendingNavigation(null);
  };

  const handleCancel = () => {
    setShowWarning(false);
    setPendingNavigation(null);
  };

  return {
    showWarning,
    handleDiscard,
    handleCancel
  };
}

export function DirtyFormWarning({ isOpen, onDiscard, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-sm">
        <h3 className="text-lg font-semibold text-white mb-2">Unsaved Changes</h3>
        <p className="text-slate-400 mb-6">
          You have unsaved changes. Do you want to discard them?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            Keep Editing
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}
