'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Search, Target, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import GoogleMapsLoader from '@/services/googleMapsLoader';

interface EmergencyLocationPickerProps {
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
}

export default function EmergencyLocationPicker({
  onLocationSelect,
  initialLocation
}: EmergencyLocationPickerProps) {
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const googleMapsLoader = GoogleMapsLoader.getInstance();

  // Default location (Mumbai, India)
  const defaultLocation = initialLocation || { latitude: 19.0760, longitude: 72.8777 };

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => `${prev}\n[${timestamp}] ${message}`);
    console.log(`🐛 [${timestamp}] ${message}`);
  };

  useEffect(() => {
    initializeGoogleMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeGoogleMaps = async () => {
    try {
      setIsLoading(true);
      setError(null);
      addDebugInfo('Initializing Google Maps...');

      const loadPromise = googleMapsLoader.load();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Google Maps loading timed out')), 30000)
      );

      await Promise.race([loadPromise, timeoutPromise]);

      const mapInstance = await initializeMap();
      setMap(mapInstance);
    } catch (error: any) {
      console.error('❌ Failed to initialize Google Maps:', error);
      addDebugInfo(`Initialization failed: ${error.message}`);
      setError(error.message || 'Failed to load Google Maps');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMap = async (): Promise<any> => {
    if (!mapRef.current || !googleMapsLoader.isGoogleMapsLoaded()) {
      throw new Error('Map container not ready or Google Maps not loaded');
    }

    addDebugInfo('Creating map instance...');

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: defaultLocation.latitude, lng: defaultLocation.longitude },
      zoom: 15,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      gestureHandling: 'cooperative',
    });

    await new Promise((resolve) => {
      const listener = window.google.maps.event.addListener(mapInstance, 'idle', () => {
        window.google.maps.event.removeListener(listener);
        resolve(true);
      });
    });

    const markerInstance = new window.google.maps.Marker({
      position: { lat: defaultLocation.latitude, lng: defaultLocation.longitude },
      map: mapInstance,
      draggable: true,
      title: 'Emergency Location',
      animation: window.google.maps.Animation.DROP,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2C10.48 2 6 6.48 6 12C6 20 16 30 16 30C16 30 26 20 26 12C26 6.48 21.52 2 16 2Z" fill="#DC2626"/>
            <circle cx="16" cy="12" r="4" fill="white"/>
            <path d="M16 8V16M12 12H20" stroke="#DC2626" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 32),
      }
    });

    mapInstance.addListener('click', (event: any) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      markerInstance.setPosition({ lat, lng });
      if (window.google.maps.Animation) {
        markerInstance.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => markerInstance.setAnimation(null), 750);
      }

      updateSelectedLocation(lat, lng);
    });

    markerInstance.addListener('dragend', (event: any) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      if (window.google.maps.Animation) {
        markerInstance.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => markerInstance.setAnimation(null), 750);
      }

      updateSelectedLocation(lat, lng);
    });

    setMarker(markerInstance);

    addDebugInfo('Map initialized successfully');
    updateSelectedLocation(defaultLocation.latitude, defaultLocation.longitude);

    return mapInstance;
  };

  // Attach Google Places Autocomplete to the input
  useEffect(() => {
    if (!window.google?.maps?.places || !inputRef.current || !map) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
      fields: ['place_id', 'name', 'formatted_address', 'geometry'],
      componentRestrictions: { country: 'IN' },
    });

    autocomplete.bindTo('bounds', map);

    let lastPlaceId: string | null = null;

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) {
        setError('No location found for the selected place.');
        return;
      }
      if (place.place_id === lastPlaceId) return;
      lastPlaceId = place.place_id ?? null;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Do NOT set inputRef.current.value here, let Google do it!
      setSearchQuery(place.name || place.formatted_address || inputRef.current?.value || '');
      updateMapAndMarker(lat, lng);
      updateSelectedLocation(lat, lng, place.formatted_address);
      setError(null);
    });

    const input = inputRef.current;
    const handleInputChange = () => { lastPlaceId = null; };
    input?.addEventListener('input', handleInputChange);

    return () => {
      window.google.maps.event.clearInstanceListeners(autocomplete);
      input?.removeEventListener('input', handleInputChange);
    };
  }, [map]);

  const updateMapAndMarker = (lat: number, lng: number) => {
    if (map && marker) {
      const newPosition = { lat, lng };
      map.setCenter(newPosition);
      map.setZoom(17);
      marker.setPosition(newPosition);

      if (window.google.maps.Animation) {
        marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => {
          try {
            marker.setAnimation(null);
          } catch (e) {
            // Ignore animation cleanup errors
          }
        }, 1500);
      }
    }
  };

  const updateSelectedLocation = async (lat: number, lng: number, providedAddress?: string) => {
    const location = { latitude: lat, longitude: lng };

    try {
      addDebugInfo('Getting address via reverse geocoding...');
      let address = providedAddress;
      if (!address) {
        address = await googleMapsLoader.reverseGeocode(lat, lng);
      }

      const locationWithAddress = { ...location, address };

      setSelectedLocation(locationWithAddress);
      onLocationSelect(locationWithAddress);
      addDebugInfo(`Location updated: ${address}`);

    } catch (error) {
      console.error('⚠️ Error getting address:', error);
      setSelectedLocation(location);
      onLocationSelect(location);
      addDebugInfo(`Location updated without address: ${lat}, ${lng}`);
    }
  };

  const handleManualSearch = async () => {
    addDebugInfo('Manual search button clicked');
    let currentQuery = inputRef.current?.value || '';
    if (!currentQuery.trim()) {
      addDebugInfo('No search query available');
      setError('Please enter a location to search for');
      return;
    }
    setSearchQuery(currentQuery);
    addDebugInfo(`Starting manual search for: "${currentQuery}"`);
    await performTextSearch(currentQuery);
  };

  const performTextSearch = async (query: string) => {
    if (!map || !query.trim()) {
      addDebugInfo('Cannot perform search: no map or empty query');
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      addDebugInfo(`Performing text search for: "${query}"`);

      const service = new window.google.maps.places.PlacesService(map);
      const request = {
        query: query
      };

      service.textSearch(request, (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
        setIsSearching(false);

        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          const place = results[0];
          const location = place.geometry?.location;

          if (location) {
            const lat = location.lat();
            const lng = location.lng();

            addDebugInfo(`Text search success: ${place.name} at ${lat}, ${lng}`);

            setSearchQuery(place.name || place.formatted_address || '');
            updateMapAndMarker(lat, lng);
            updateSelectedLocation(lat, lng, place.formatted_address);
          } else {
            addDebugInfo('Text search result has no location');
            setError('Selected location has no coordinates. Please try another search.');
          }
        } else {
          addDebugInfo(`Text search failed with status: ${status}`);
          setError(`No results found for "${query}". Please try a different search term.`);
        }
      });
    } catch (error) {
      console.error('❌ Text search error:', error);
      addDebugInfo(`Text search error: ${error}`);
      setError('Search failed. Please try again.');
      setIsSearching(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      addDebugInfo('Getting current location...');

      const location = await googleMapsLoader.getCurrentLocation();

      updateMapAndMarker(location.latitude, location.longitude);
      updateSelectedLocation(location.latitude, location.longitude);

      addDebugInfo('Current location obtained successfully');
    } catch (error: any) {
      console.error('❌ Error getting current location:', error);
      addDebugInfo(`Current location error: ${error.message}`);
      setError(error.message || 'Unable to get your current location. Please select manually on the map.');
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !map) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            Map Loading Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm mb-3">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <MapPin className="w-5 h-5 mr-2 text-red-600" />
          Select Emergency Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Section */}
        <div className="space-y-2">
          <Label htmlFor="search">Search for emergency location</Label>
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              placeholder="Search for emergency location"
            />
            <Button onClick={handleManualSearch} disabled={isLoading || isSearching}>
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
            <Button onClick={getCurrentLocation} disabled={isLoading} title="Use Current Location">
              <Target className="w-4 h-4" />
            </Button>
          </div>

          {/* Debug Info for Development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 space-y-1">
              <p>Current search query: "{inputRef.current?.value || ''}"</p>
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p>• Type address, landmark, or place name</p>
            <p>• Click suggestions or use search button</p>
            <p>• Click anywhere on map to place marker</p>
            <p>• Drag marker to adjust location</p>
          </div>
        </div>

        {/* Error Display */}
        {error && map && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-yellow-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div className="relative">
          <div
            ref={mapRef}
            className="w-full h-96 rounded-lg border"
            style={{ minHeight: '400px' }}
          />

          {(isLoading || isSearching) && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {isSearching ? 'Searching...' : !map ? 'Loading emergency map...' : 'Loading...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <div className="text-blue-600 mt-0.5">ℹ️</div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How to select emergency location:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Search:</strong> Type location and select from suggestions</li>
                <li>• <strong>Manual Search:</strong> Type and click search button</li>
                <li>• <strong>Map Click:</strong> Click anywhere on map</li>
                <li>• <strong>Drag Marker:</strong> Drag red marker to exact spot</li>
                <li>• <strong>GPS:</strong> Use target button for current location</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Selected Location Display */}
        {selectedLocation && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <div className="text-green-600 mt-0.5">✅</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 mb-1">
                  Emergency Location Selected
                </p>
                {selectedLocation.address && (
                  <p className="text-xs text-green-700 mb-2">
                    {selectedLocation.address}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs text-green-600">
                  <div>Latitude: {selectedLocation.latitude.toFixed(6)}</div>
                  <div>Longitude: {selectedLocation.longitude.toFixed(6)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Panel for Development */}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <details>
              <summary className="text-sm font-medium cursor-pointer">Debug Information</summary>
              <pre className="text-xs mt-2 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {debugInfo}
              </pre>
              <Button
                onClick={() => setDebugInfo('')}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Clear Debug Log
              </Button>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}