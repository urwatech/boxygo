/**
 * Location Service - Handles both OpenStreetMap and Google Maps
 * Configuration should be passed from Inertia middleware
 */

// Track active requests for cancellation
let activeSearchController = null;

/**
 * Cancel any active location search requests
 */
export const cancelActiveSearch = () => {
  if (activeSearchController) {
    activeSearchController.abort();
    activeSearchController = null;
  }
};

/**
 * Search locations using specified provider
 * @param {string} query - Search query
 * @param {Object} options - Options object
 * @param {string} options.provider - Provider: 'openstreetmap' or 'google'
 * @param {string} options.googlePlacesApiKey - Google Places API key (required for Google)
 * @param {string} options.useDirectGoogleApi - Use direct Google API (frontend) instead of backend proxy
 * @param {string} options.countryCode - Country code for search restriction
 * @param {string} options.city - City name for search restriction
 * @param {Array} options.viewbox - Bounding box [south, north, west, east]
 * @param {number} options.limit - Maximum results to return
 */
export const searchLocations = async (query, options = {}) => {
  const {
    provider = 'google',
    googlePlacesApiKey,
    useDirectGoogleApi = false,
    ...restOptions
  } = options;

  // Cancel any existing search request
  cancelActiveSearch();

  // Create new abort controller for this request
  activeSearchController = new AbortController();

  try {
    if (provider === 'google') {
      if (!googlePlacesApiKey) {
        console.warn('Google Places API key not provided, falling back to OpenStreetMap');
        return searchLocationsOSM(query, { ...restOptions, signal: activeSearchController.signal });
      }

      // Use direct Google API (frontend) or backend proxy
      if (useDirectGoogleApi) {
        return searchLocationsGoogleDirect(query, googlePlacesApiKey, {
          ...restOptions,
          signal: activeSearchController.signal,
        });
      }

      return searchLocationsGoogle(query, googlePlacesApiKey, {
        ...restOptions,
        signal: activeSearchController.signal,
      });
    }

    return searchLocationsOSM(query, { ...restOptions, signal: activeSearchController.signal });
  } finally {
    activeSearchController = null;
  }
};

/**
 * Search using OpenStreetMap Nominatim API
 */
export const searchLocationsOSM = async (query, options = {}) => {
  try {
    const {
      countryCode = 'sy',
      city = '',
      viewbox = null,
      limit = 6,
      signal,
    } = options;

    const params = new URLSearchParams({
      format: 'jsonv2',
      q: query,
      addressdetails: '1',
      limit: limit.toString(),
    });

    if (countryCode) {
      params.append('countrycodes', countryCode.toLowerCase());
    }

    if (city) {
      params.append('city', city);
    }

    if (viewbox && Array.isArray(viewbox) && viewbox.length === 4) {
      const [south, north, west, east] = viewbox.map(parseFloat);
      params.append('viewbox', `${west},${north},${east},${south}`);
      params.append('bounded', '1');
    }

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
      signal,
    });

    if (!res.ok) throw new Error('Failed to fetch locations');

    const data = await res.json();
    const results = (data || []).map((d) => ({
      address: d.display_name,
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
      components: d.address || {},
      source: 'osm',
    }));

    // STRICT FILTERING: Only return results from the specified country
    // OSM's countrycodes parameter is not always strict, so we enforce it client-side
    if (countryCode) {
      return results.filter((result) => {
        const resultCountryCode = result.components?.country_code?.toLowerCase();
        return resultCountryCode === countryCode.toLowerCase();
      });
    }

    return results;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('OSM search cancelled');
      return [];
    }
    console.error('OSM search error:', error);
    throw new Error('Unable to search locations');
  }
};

/**
 * Search using Google Places Autocomplete API via backend endpoint
 * This avoids CORS issues by using a server-side proxy
 */
export const searchLocationsGoogle = async (query, apiKey, options = {}) => {
  try {
    const { countryCode = 'sy', limit = 6, signal } = options;

    // Call backend endpoint instead of Google API directly to avoid CORS
    const params = new URLSearchParams({
      q: query,
      country_code: countryCode,
      limit: limit.toString(),
    });

    const url = `/api/v1/locations/search/google?${params.toString()}`;
    const res = await fetch(url, { signal });

    if (!res.ok) {
      throw new Error('Failed to fetch suggestions from backend');
    }

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || 'Unable to search locations');
    }

    // STRICT FILTERING: Only return results from the specified country
    // Google's components filter is not strict, so we enforce it client-side
    const results = data.results || [];
    const filtered = results.filter((result) => {
      const resultCountryCode = result.components?.country_code?.toLowerCase();
      return resultCountryCode === countryCode.toLowerCase();
    });

    return filtered;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Google search cancelled');
      return [];
    }
    console.error('Google Places search error:', error);
    throw new Error('Unable to search locations');
  }
};

/**
 * Search using Google Geocoding API directly from frontend
 * Note: This may encounter CORS issues. Backend proxy (searchLocationsGoogle) is recommended.
 * @param {string} query - Search query
 * @param {string} apiKey - Google Geocoding API key
 * @param {Object} options - Options including signal for cancellation
 */
export const searchLocationsGoogleDirect = async (query, apiKey, options = {}) => {
  try {
    const { countryCode = 'sy', limit = 6, signal } = options;

    // Construct Google Geocoding API request
    let geocodeQuery = query;
    if (countryCode) {
      geocodeQuery = `${query}, ${countryCode}`;
    }

    const params = new URLSearchParams({
      address: geocodeQuery,
      key: apiKey,
      language: 'en',
    });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    const res = await fetch(url, { signal });

    if (!res.ok) {
      throw new Error('Failed to fetch from Google Geocoding API');
    }

    const data = await res.json();

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        return [];
      }
      throw new Error(`Google Geocoding API error: ${data.status}`);
    }

    // Parse results and limit them
    const results = (data.results || []).slice(0, limit).map((result) => {
      const { geometry, formatted_address, address_components } = result;
      const { location } = geometry;

      // Parse address components
      const components = {};
      (address_components || []).forEach((component) => {
        const types = component.types || [];
        if (types.includes('locality')) {
          components.city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          components.state = component.long_name;
        }
        if (types.includes('administrative_area_level_2')) {
          components.governorate = component.long_name;
        }
        if (types.includes('country')) {
          components.country = component.long_name;
          components.country_code = component.short_name;
        }
      });

      return {
        address: formatted_address,
        lat: location.lat,
        lon: location.lng,
        components,
        source: 'google',
      };
    });

    // STRICT FILTERING: Only return results from the specified country
    // Google's components filter is not strict, so we enforce it client-side
    if (countryCode) {
      return results.filter((result) => {
        const resultCountryCode = result.components?.country_code?.toLowerCase();
        return resultCountryCode === countryCode.toLowerCase();
      });
    }

    return results;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Google direct search cancelled');
      return [];
    }
    console.error('Google Geocoding direct search error:', error);
    throw new Error('Unable to search locations');
  }
};

/**
 * Generate a session token for Google Places API
 */
export const generateSessionToken = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get Google Maps embed URL with Syria bounds restriction
 * @param {Array} center - [lat, lon] center coordinates
 * @param {number} zoom - Zoom level
 * @param {Array} marker - [lat, lon] marker coordinates
 * @param {string} apiKey - Google Maps API key
 * @param {Array} viewbox - Bounding box [south, north, west, east] for Syria
 */
export const getGoogleMapEmbedUrl = (center, zoom, marker, apiKey, viewbox = null) => {
  if (!apiKey) {
    console.warn('Google Maps API key not configured, falling back to OSM');
    return getOSMEmbedUrl(center, zoom, marker, viewbox);
  }

  // Syria boundaries: [minLat, maxLat, minLon, maxLon]
  const syriaViewbox = viewbox || [32.31, 37.31, 35.73, 42.45];
  const [minLat, maxLat, minLon, maxLon] = syriaViewbox;

  // Calculate center of Syria if not provided
  let mapCenter = center;
  if (!center || center[0] === 0 || center[1] === 0) {
    mapCenter = [
      (minLat + maxLat) / 2,
      (minLon + maxLon) / 2
    ];
  }

  // Use the marker coordinates if available, otherwise use calculated center
  const displayLat = marker ? marker[0] : mapCenter[0];
  const displayLon = marker ? marker[1] : mapCenter[1];

  // Calculate appropriate zoom for Syria bounds (roughly 6-7 shows most of Syria)
  let mapZoom = zoom;
  if (!mapZoom || mapZoom < 5) {
    mapZoom = 6;
  }

  // Google Maps Embed API format for placing a pin at specific coordinates
  const locationParam = `${displayLat},${displayLon}`;

  return `https://www.google.com/maps/embed/v1/place?q=${locationParam}&zoom=${mapZoom}&key=${apiKey}`;
};

/**
 * Reverse geocode coordinates to get address
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} options - Options object
 * @param {string} options.provider - Provider: 'openstreetmap' or 'google'
 * @param {string} options.googleGeocodingApiKey - Google Geocoding API key (required for Google)
 */
export const reverseGeocode = async (lat, lon, options = {}) => {
  const {
    provider = 'google',
    googleGeocodingApiKey,
  } = options;

  try {
    if (provider === 'google' && googleGeocodingApiKey) {
      return reverseGeocodeGoogle(lat, lon, googleGeocodingApiKey);
    }

    return reverseGeocodeOSM(lat, lon);
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw new Error('Unable to get address for this location');
  }
};

/**
 * Reverse geocode using OpenStreetMap Nominatim API
 */
export const reverseGeocodeOSM = async (lat, lon) => {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: lat.toString(),
      lon: lon.toString(),
      addressdetails: '1',
      zoom: '18',
    });

    const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });

    if (!res.ok) throw new Error('Failed to reverse geocode');

    const data = await res.json();

    if (!data || data.error) {
      throw new Error('No address found for this location');
    }

    return {
      address: data.display_name,
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      components: data.address || {},
      source: 'osm',
    };
  } catch (error) {
    console.error('OSM reverse geocode error:', error);
    throw new Error('Unable to get address for this location');
  }
};

/**
 * Reverse geocode using Google Geocoding API
 */
export const reverseGeocodeGoogle = async (lat, lon, apiKey) => {
  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lon}`,
      key: apiKey,
      language: 'en',
    });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error('Failed to reverse geocode with Google');
    }

    const data = await res.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error('No address found for this location');
    }

    const result = data.results[0];
    const { geometry, formatted_address, address_components } = result;

    // Parse address components
    const components = {};
    (address_components || []).forEach((component) => {
      const types = component.types || [];
      if (types.includes('locality')) {
        components.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        components.state = component.long_name;
      }
      if (types.includes('administrative_area_level_2')) {
        components.governorate = component.long_name;
      }
      if (types.includes('country')) {
        components.country = component.long_name;
        components.country_code = component.short_name;
      }
    });

    return {
      address: formatted_address,
      lat: geometry.location.lat,
      lon: geometry.location.lng,
      components,
      source: 'google',
    };
  } catch (error) {
    console.error('Google reverse geocode error:', error);
    throw new Error('Unable to get address for this location');
  }
};

/**
 * Get OpenStreetMap embed URL
 */
export const getOSMEmbedUrl = (center, zoom, marker) => {
  const span = 360 / Math.pow(2, zoom);
  const halfLat = span / 2;
  const halfLon = span / 2;

  const bbox = {
    minLon: center[1] - halfLon,
    minLat: center[0] - halfLat,
    maxLon: center[1] + halfLon,
    maxLat: center[0] + halfLat,
  };

  const mark = marker || center;
  const params = new URLSearchParams({
    bbox: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
    layer: 'mapnik',
    marker: `${mark[0]},${mark[1]}`,
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
};
