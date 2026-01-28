export const MAP_STYLES = [
  { id: 'positron', label: 'Light', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'dark-matter', label: 'Dark', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'voyager', label: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'liberty', label: 'OSM', url: 'https://tiles.openfreemap.org/styles/liberty' },
];

export const STATUS_COLORS = {
  'Live': '#10b981',
  'In Progress': '#3b82f6',
  'Not Started': '#f59e0b',
  'Blocked': '#ef4444',
  'default': '#64748b'
};

export const getStatusColor = (status) => {
  return STATUS_COLORS[status] || STATUS_COLORS.default;
};

export const DEFAULT_CENTER = [-98.5795, 39.8283];
export const DEFAULT_ZOOM = 4;
