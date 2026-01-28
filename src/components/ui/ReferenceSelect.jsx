import React from 'react';
import { useReferenceData } from '../../hooks/useReferenceData';
import { ChevronDown, X, Loader2 } from 'lucide-react';

export default function ReferenceSelect({
  category,
  value,
  onChange,
  placeholder = 'Select...',
  includeInactive = false,
  disabled = false,
  required = false,
  showColors = false,
  allowClear = false,
  className = ''
}) {
  const { data: options, isLoading } = useReferenceData(category, { includeInactive });

  const selectedOption = options.find(opt => opt.code === value);

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue || null);
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {showColors && selectedOption?.color && (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
            style={{ backgroundColor: selectedOption.color }}
          />
        )}
        <select
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className={`w-full py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white appearance-none focus:outline-none focus:border-teal-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            showColors && selectedOption?.color ? 'pl-8' : 'px-4'
          } ${allowClear && value ? 'pr-16' : 'pr-10'}`}
        >
          <option value="">{placeholder}</option>
          {options.map(option => (
            <option key={option.id} value={option.code}>
              {option.display_name}
            </option>
          ))}
        </select>
        <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none ${
          allowClear && value ? 'right-10' : 'right-3'
        }`} />
        {allowClear && value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ReferenceSelectMulti({
  category,
  value = [],
  onChange,
  placeholder = 'Select...',
  includeInactive = false,
  disabled = false,
  showColors = false,
  className = ''
}) {
  const { data: options, isLoading } = useReferenceData(category, { includeInactive });

  const handleToggle = (code) => {
    if (value.includes(code)) {
      onChange(value.filter(v => v !== code));
    } else {
      onChange([...value, code]);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-lg max-h-48 overflow-y-auto ${className}`}>
      {options.length === 0 ? (
        <p className="p-4 text-slate-400 text-sm text-center">{placeholder}</p>
      ) : (
        <div className="divide-y divide-slate-700/50">
          {options.map(option => (
            <label
              key={option.id}
              className={`flex items-center gap-3 px-4 py-2 hover:bg-slate-800 cursor-pointer ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={value.includes(option.code)}
                onChange={() => !disabled && handleToggle(option.code)}
                disabled={disabled}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
              />
              {showColors && option.color && (
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: option.color }}
                />
              )}
              <span className="text-white text-sm">{option.display_name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
