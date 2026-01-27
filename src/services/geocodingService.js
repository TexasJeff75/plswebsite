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
    console.log('Using cached coordinates for:', address);
    return cached;
  }

  console.log('Geocoding address:', address);
  await new Promise(resolve => setTimeout(resolve, 1100));

  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'ProximityDeploymentTracker/1.0'
        }
      }
    );

    if (!response.ok) {
      console.error(`Geocoding failed with status ${response.status} for:`, address);
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Geocoding response for', address, ':', data);

    if (data && data.length > 0) {
      const coordinates = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };

      cacheCoordinates(address, coordinates);
      console.log('Successfully geocoded:', address, coordinates);
      return coordinates;
    }

    console.warn('No results found for address:', address);
    return null;
  } catch (error) {
    console.error('Geocoding error for address:', address, error);
    return null;
  }
}

export async function geocodeFacilities(facilities, onProgress) {
  const results = [];
  console.log(`Starting geocoding for ${facilities.length} facilities`);

  for (let i = 0; i < facilities.length; i++) {
    const facility = facilities[i];

    // Build a more specific address with all available location data
    let addressParts = [];
    if (facility.address) addressParts.push(facility.address);
    if (facility.city) addressParts.push(facility.city);
    if (facility.county) addressParts.push(facility.county);
    if (facility.state) addressParts.push(facility.state);
    addressParts.push('USA');

    const address = addressParts.join(', ');

    console.log(`Processing facility ${i + 1}/${facilities.length}:`, facility.name, '-', address);

    if (!address || address === 'USA' || (!facility.city && !facility.address)) {
      console.warn('Skipping facility with insufficient location data:', facility.name);
      if (onProgress) {
        onProgress(i + 1, facilities.length);
      }
      continue;
    }

    try {
      const coordinates = await geocodeAddress(address);

      if (coordinates) {
        results.push({
          ...facility,
          latitude: coordinates.lat,
          longitude: coordinates.lng
        });
        console.log(`✓ Geocoded ${facility.name} to [${coordinates.lat}, ${coordinates.lng}]`);
      } else {
        console.warn(`✗ Could not geocode ${facility.name}`);
      }
    } catch (error) {
      console.error(`Error geocoding ${facility.name}:`, error);
    }

    if (onProgress) {
      onProgress(i + 1, facilities.length);
    }
  }

  console.log(`Geocoding complete. Successfully geocoded ${results.length} out of ${facilities.length} facilities`);
  return results;
}

export const geocodingService = {
  geocodeAddress,
  geocodeFacilities
};
