import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function FormField({
  label,
  error,
  help,
  required = false,
  children,
  className = ''
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      {help && !error && (
        <p className="text-xs text-slate-400 mb-1.5">{help}</p>
      )}

      {children}

      {error && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
