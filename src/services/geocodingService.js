const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const CACHE_KEY = 'geocoding_cache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

function getCache() {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    return cache ? JSON.parse(cache) : {};
  } catch (error) {
    console.error('Error reading geocoding cache:', error);
    return {};
  }
}

function setCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error writing geocoding cache:', error);
  }
}

function getCachedCoordinates(address) {
  const cache = getCache();
  const cached = cache[address];

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.coordinates;
  }

  return null;
}

function cacheCoordinates(address, coordinates) {
  const cache = getCache();
  cache[address] = {
    coordinates,
    timestamp: Date.now()
  };
  setCache(cache);
}

async function geocodeAddress(address) {
  const cached = getCachedCoordinates(address);
  if (cached) {
    return cached;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'DeploymentTracker/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const coordinates = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };

      cacheCoordinates(address, coordinates);
      return coordinates;
    }

    return null;
  } catch (error) {
    console.error('Geocoding error for address:', address, error);
    return null;
  }
}

export async function geocodeFacilities(facilities) {
  const results = [];

  for (const facility of facilities) {
    const address = facility.address || `${facility.city}, ${facility.state}`;

    if (!address || address === ', ') {
      continue;
    }

    const coordinates = await geocodeAddress(address);

    if (coordinates) {
      results.push({
        ...facility,
        latitude: coordinates.lat,
        longitude: coordinates.lng
      });
    }
  }

  return results;
}

export const geocodingService = {
  geocodeAddress,
  geocodeFacilities
};
