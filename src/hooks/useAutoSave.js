import { useEffect, useRef, useCallback } from 'react';

export function useAutoSave(data, saveFunction, delay = 1500) {
  const timeoutRef = useRef(null);
  const previousDataRef = useRef(data);
  const isSavingRef = useRef(false);

  const save = useCallback(async () => {
    if (isSavingRef.current) return;

    try {
      isSavingRef.current = true;
      await saveFunction(data);
      previousDataRef.current = data;
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [data, saveFunction]);

  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify(previousDataRef.current)) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      save();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, save]);

  return { isSaving: isSavingRef.current };
}

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    function handleKeyDown(e) {
      for (const shortcut of shortcuts) {
        const { key, ctrlKey = false, shiftKey = false, callback } = shortcut;

        if (
          e.key.toLowerCase() === key.toLowerCase() &&
          e.ctrlKey === ctrlKey &&
          e.shiftKey === shiftKey
        ) {
          e.preventDefault();
          callback(e);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
