import React from 'react';
import { useReferenceItem } from '../../hooks/useReferenceData';

export default function ReferenceBadge({
  category,
  code,
  size = 'md',
  showDot = false,
  fallbackColor = '#6b7280'
}) {
  const { item, isLoading } = useReferenceItem(category, code);

  if (isLoading || !code) {
    return null;
  }

  const displayName = item?.display_name || code;
  const color = item?.color || fallbackColor;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  const bgColor = color ? `${color}15` : 'rgba(107, 114, 128, 0.15)';
  const textColor = color || '#6b7280';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {showDot && (
        <span
          className={`rounded-full ${dotSizes[size]}`}
          style={{ backgroundColor: color }}
        />
      )}
      {displayName}
    </span>
  );
}

export function ReferenceText({
  category,
  code,
  fallback = '-'
}) {
  const { item, isLoading } = useReferenceItem(category, code);

  if (isLoading) {
    return <span className="text-slate-400">...</span>;
  }

  if (!code) {
    return <span className="text-slate-400">{fallback}</span>;
  }

  return <span>{item?.display_name || code}</span>;
}

export function ReferenceColorDot({
  category,
  code,
  size = 'md',
  className = ''
}) {
  const { item } = useReferenceItem(category, code);

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const color = item?.color || '#6b7280';

  return (
    <span
      className={`inline-block rounded-full ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
