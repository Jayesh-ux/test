'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Search, Target, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import GoogleMapsLoader from '@/services/googleMapsLoader';

interface MapLocationPickerProps {
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
  hospitalName?: string;
  hospitalAddress?: string;
}

export default function MapLocationPicker({
  onLocationSelect,
  initialLocation,
  hospitalName = '',
  hospitalAddress = ''
}: MapLocationPickerProps) {
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState(
    hospitalName && hospitalAddress && hospitalName !== '' && hospitalAddress !== '' 
      ? `${hospitalName} ${hospitalAddress}`.trim() 
      : ''
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autocompleteElement, setAutocompleteElement] = useState<google.maps.places.PlaceAutocompleteElement | google.maps.places.Autocomplete | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const googleMapsLoader = GoogleMapsLoader.getInstance();

  // Default location (Mumbai, India)
  const defaultLocation = initialLocation || { latitude: 19.0760, longitude: 72.8777 };

  useEffect(() => {
    initializeGoogleMaps();
    
    return () => {
      cleanup();
    };
  }, [retryCount]);

  const cleanup = () => {
    if (autocompleteElement) {
      try {
        if (autocompleteElement instanceof HTMLElement) {
          // New API cleanup
          const element = autocompleteElement as any;
          element.removeEventListener?.('gmp-placeselect', handlePlaceSelect);
        } else {
          // Legacy API cleanup
          window.google?.maps?.event?.clearInstanceListeners(autocompleteElement);
        }
      } catch (e) {
        console.warn('Error cleaning up autocomplete:', e);
      }
    }
  };

  const initializeGoogleMaps = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Initializing Google Maps...');
      
      const loadPromise = googleMapsLoader.load();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Google Maps loading timed out')), 30000)
      );
      
      await Promise.race([loadPromise, timeoutPromise]);
      
      const mapInstance = await initializeMap();
      await initializeAutocomplete(mapInstance);
      
    } catch (error: any) {
      console.error('❌ Failed to initialize Google Maps:', error);
      setError(error.message || 'Failed to load Google Maps');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMap = async (): Promise<any> => {
    if (!mapRef.current || !googleMapsLoader.isGoogleMapsLoaded()) {
      throw new Error('Map container not ready or Google Maps not loaded');
    }

    try {
      console.log('🗺️ Creating map instance...');
      
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
        title: 'Hospital Location',
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

      setMap(mapInstance);
      setMarker(markerInstance);

      console.log('✅ Map initialized successfully');

      updateSelectedLocation(defaultLocation.latitude, defaultLocation.longitude);

      if (searchQuery.trim()) {
        setTimeout(() => performTextSearch(searchQuery), 2000);
      }

      return mapInstance;

    } catch (error) {
      console.error('❌ Error creating map:', error);
      throw error;
    }
  };

  const initializeAutocomplete = async (mapInstance: any) => {
    if (!autocompleteRef.current) {
      console.warn('⚠️ Autocomplete container ref not available');
      return;
    }

    try {
      console.log('🔍 Initializing hospital autocomplete...');

      const placesAPI = googleMapsLoader.getAvailablePlacesAPI();
      
      if (placesAPI === 'new') {
        await initializeNewAutocomplete(mapInstance);
      } else if (placesAPI === 'legacy') {
        await initializeLegacyAutocomplete(mapInstance);
      } else {
        console.warn('⚠️ No Places API available for hospital search');
      }

    } catch (error) {
      console.error('❌ Error initializing hospital autocomplete:', error);
    }
  };

  const initializeNewAutocomplete = async (mapInstance: any) => {
    try {
      const autocompleteElement = document.createElement('gmp-place-autocomplete') as any;
      autocompleteElement.setAttribute('placeholder', 'Search for hospital (e.g., Tharwani Meghna, Mumbai)');
      autocompleteElement.setAttribute('country-restriction', 'IN');
      autocompleteElement.value = searchQuery;
      
      Object.assign(autocompleteElement.style, {
        width: '100%',
        height: '40px',
        fontSize: '14px',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        outline: 'none'
      });

      autocompleteElement.addEventListener('focus', () => {
        autocompleteElement.style.borderColor = '#ef4444';
        autocompleteElement.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
      });

      autocompleteElement.addEventListener('blur', () => {
        autocompleteElement.style.borderColor = '#d1d5db';
        autocompleteElement.style.boxShadow = 'none';
      });

      autocompleteElement.addEventListener('input', (e: any) => {
        setSearchQuery(e.target.value);
      });

      autocompleteElement.addEventListener('gmp-placeselect', handlePlaceSelect);

      if (autocompleteRef.current) {
        autocompleteRef.current.innerHTML = '';
        autocompleteRef.current.appendChild(autocompleteElement);
      }

      setAutocompleteElement(autocompleteElement);
      console.log('✅ New PlaceAutocompleteElement initialized for hospital search');

    } catch (error) {
      console.error('❌ Error initializing new hospital autocomplete:', error);
      await initializeLegacyAutocomplete(mapInstance);
    }
  };

  const initializeLegacyAutocomplete = async (mapInstance: any) => {
    try {
      console.log('🔍 Initializing legacy Autocomplete for hospital search...');

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Search for hospital (e.g., Tharwani Meghna, Mumbai)';
      input.value = searchQuery;
      
      Object.assign(input.style, {
        width: '100%',
        height: '40px',
        fontSize: '14px',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        outline: 'none'
      });

      input.addEventListener('focus', () => {
        input.style.borderColor = '#ef4444';
        input.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
      });

      input.addEventListener('blur', () => {
        input.style.borderColor = '#d1d5db';
        input.style.boxShadow = 'none';
      });

      input.addEventListener('input', (e: any) => {
        setSearchQuery(e.target.value);
      });

      if (autocompleteRef.current) {
        autocompleteRef.current.innerHTML = '';
        autocompleteRef.current.appendChild(input);
      }

      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        types: ['establishment', 'geocode'],
        fields: ['place_id', 'name', 'formatted_address', 'geometry'],
        componentRestrictions: { country: 'IN' },
      });

      if (mapInstance) {
        autocomplete.bindTo('bounds', mapInstance);
      }

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        handleLegacyPlaceSelect(place);
      });

      setAutocompleteElement(autocomplete);
      console.log('✅ Legacy Autocomplete initialized for hospital search');

    } catch (error) {
      console.error('❌ Error initializing legacy hospital autocomplete:', error);
      throw error;
    }
  };

  const handlePlaceSelect = (event: any) => {
    try {
      console.log('🎯 New API - Hospital location selected:', event);
      
      const place = event.detail.place;
      if (!place || !place.location) {
        console.error('❌ Selected hospital place has no location');
        setError('Unable to find location for the selected place. Please try another search.');
        return;
      }

      const lat = place.location.lat();
      const lng = place.location.lng();
      
      console.log('📍 Hospital coordinates:', { lat, lng });
      console.log('📍 Hospital address:', place.formattedAddress);

      setSearchQuery(place.displayName || place.formattedAddress || '');
      updateMapAndMarker(lat, lng);
      updateSelectedLocation(lat, lng, place.formattedAddress);
      setError(null);
      
      console.log('✅ Hospital location selection completed successfully');

    } catch (error) {
      console.error('❌ Error handling hospital location selection:', error);
      setError('Error processing selected location. Please try again.');
    }
  };

  const handleLegacyPlaceSelect = (place: google.maps.places.PlaceResult) => {
    try {
      console.log('🎯 Legacy API - Hospital location selected:', place);

      if (!place.geometry || !place.geometry.location) {
        console.error('❌ Selected hospital place has no geometry');
        setError('Unable to find location for the selected place. Please try another search.');
        return;
      }

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      
      console.log('📍 Hospital coordinates:', { lat, lng });
      console.log('📍 Hospital address:', place.formatted_address);

      setSearchQuery(place.name || place.formatted_address || '');
      updateMapAndMarker(lat, lng);
      updateSelectedLocation(lat, lng, place.formatted_address);
      setError(null);
      
      console.log('✅ Hospital location selection completed successfully');

    } catch (error) {
      console.error('❌ Error handling legacy hospital location selection:', error);
      setError('Error processing selected location. Please try again.');
    }
  };

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
      let address = providedAddress;
      if (!address) {
        address = await googleMapsLoader.reverseGeocode(lat, lng);
      }
      
      const locationWithAddress = { ...location, address };
      
      setSelectedLocation(locationWithAddress);
      onLocationSelect(locationWithAddress);

    } catch (error) {
      console.error('⚠️ Error getting address:', error);
      setSelectedLocation(location);
      onLocationSelect(location);
    }
  };

  const performTextSearch = async (query: string) => {
    if (!map || !query.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔍 Performing text search for:', query);

      const service = new window.google.maps.places.PlacesService(map);
      const request = {
        query: query,
        location: map.getCenter(),
        radius: 50000,
      };

      // Fix the TypeScript error by properly typing the callback parameters
      service.textSearch(request, (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus, pagination: google.maps.places.PlaceSearchPagination | null) => {
        setIsLoading(false);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          const place = results[0];
          const location = place.geometry?.location;
          
          if (location) {
            const lat = location.lat();
            const lng = location.lng();
            
            console.log('✅ Text search result:', place.name, place.formatted_address);
            
            setSearchQuery(place.name || place.formatted_address || '');
            updateMapAndMarker(lat, lng);
            updateSelectedLocation(lat, lng, place.formatted_address);
          } else {
            setError('Selected location has no coordinates. Please try another search.');
          }
        } else {
          console.log('❌ Text search failed:', status);
          setError(`No results found for "${query}". Please try a different search term.`);
        }
      });
    } catch (error) {
      console.error('❌ Text search error:', error);
      setError('Search failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleManualSearch = () => {
    setError(null);
    
    // If we have an autocomplete element and it's the legacy type (not an HTMLElement)
    if (autocompleteElement && !(autocompleteElement instanceof HTMLElement)) {
      // For legacy autocomplete, we need to trigger the place_changed event
      // by getting the place directly if available
      try {
        const autocomplete = autocompleteElement as google.maps.places.Autocomplete;
        const place = autocomplete.getPlace();
        
        // If we have a valid place with geometry, use it
        if (place && place.geometry && place.geometry.location) {
          handleLegacyPlaceSelect(place);
          return;
        }
      } catch (error) {
        console.error('Error getting place from autocomplete:', error);
      }
    }
    
    // Fall back to text search if autocomplete selection isn't available
    performTextSearch(searchQuery);
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📍 Getting current location...');
      
      const location = await googleMapsLoader.getCurrentLocation();
      
      updateMapAndMarker(location.latitude, location.longitude);
      updateSelectedLocation(location.latitude, location.longitude);
      
      console.log('✅ Current location obtained');
    } catch (error: any) {
      console.error('❌ Error getting current location:', error);
      setError(error.message || 'Unable to get your current location. Please select manually on the map.');
    } finally {
      setIsLoading(false);
    }
  };

  const retryMapLoad = () => {
    setError(null);
    setMap(null);
    setMarker(null);
    setAutocompleteElement(null);
    setRetryCount((prev: number) => prev + 1);
    
    googleMapsLoader.cleanup();
  };

  const forceReload = async () => {
    setError(null);
    setIsLoading(true);
    setMap(null);
    setMarker(null);
    setAutocompleteElement(null);
    
    try {
      if (typeof googleMapsLoader.forceReload === 'function') {
        await googleMapsLoader.forceReload();
      } else {
        googleMapsLoader.cleanup();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await googleMapsLoader.load();
      }
      const mapInstance = await initializeMap();
      await initializeAutocomplete(mapInstance);
    } catch (error: any) {
      setError(error.message || 'Failed to reload Google Maps');
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
            <div className="space-y-2">
              <p className="text-xs text-red-600">
                <strong>Troubleshooting steps:</strong>
              </p>
              <ul className="text-xs text-red-600 space-y-1 ml-4">
                <li>• Check your internet connection</li>
                <li>• Verify Google Maps API key is configured</li>
                <li>• Ensure the API key has Places API enabled</li>
                <li>• Check browser console for additional errors</li>
                <li>• Try refreshing the page</li>
              </ul>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={retryMapLoad} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Loading
            </Button>
            <Button onClick={forceReload} variant="outline" className="flex-1">
              <Loader2 className="w-4 h-4 mr-2" />
              Force Reload
            </Button>
          </div>
          
          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-2 block">
              Manual Coordinate Entry (Fallback)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Latitude"
                type="number"
                step="any"
                onChange={(e) => {
                  const lat = parseFloat(e.target.value);
                  if (!isNaN(lat) && lat >= -90 && lat <= 90) {
                    const currentLng = selectedLocation?.longitude || 0;
                    updateSelectedLocation(lat, currentLng);
                  }
                }}
              />
              <Input
                placeholder="Longitude"
                type="number"
                step="any"
                onChange={(e) => {
                  const lng = parseFloat(e.target.value);
                  if (!isNaN(lng) && lng >= -180 && lng <= 180) {
                    const currentLat = selectedLocation?.latitude || 0;
                    updateSelectedLocation(currentLat, lng);
                  }
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter coordinates manually if map fails to load
            </p>
          </div>

          <div className="border-t pt-4">
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer font-medium">Debug Information</summary>
              <div className="mt-2 space-y-1">
                <p>Retry Count: {retryCount}</p>
                <p>API Key Present: {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Yes' : 'No'}</p>
                <p>Window Google: {typeof window !== 'undefined' && window.google ? 'Available' : 'Not Available'}</p>
                <p>Maps Loader State: {googleMapsLoader.isGoogleMapsLoaded() ? 'Loaded' : 'Not Loaded'}</p>
              </div>
            </details>
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
          Select Hospital Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Section */}
        <div className="space-y-2">
          <Label htmlFor="search">Search for your hospital</Label>
          <div className="flex space-x-2">
            <div 
              ref={autocompleteRef}
              className="flex-1"
              style={{ minHeight: '40px' }}
            />
            <Button 
              onClick={handleManualSearch} 
              variant="outline" 
              size="sm"
              disabled={isLoading || !searchQuery.trim()}
              title="Manual Search"
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button 
              onClick={getCurrentLocation} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
              title="Use Current Location"
            >
              <Target className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Start typing to see autocomplete suggestions</p>
            <p>• Click on any suggestion to select it</p>
            <p>• Use the search button for manual search</p>
            <p>• Click the target button to use your current location</p>
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
          
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {!map ? 'Loading map...' : 'Searching...'}
                </p>
                {!map && (
                  <p className="text-xs text-gray-500 mt-1">
                    This may take a few moments...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <div className="text-blue-600 mt-0.5">ℹ️</div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How to select location:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Autocomplete:</strong> Type in the search box and click on suggestions</li>
                <li>• <strong>Manual Search:</strong> Type location and click the search button</li>
                <li>• <strong>Map Click:</strong> Click anywhere on the map to place marker</li>
                <li>• <strong>Drag Marker:</strong> Drag the red marker to fine-tune location</li>
                <li>• <strong>Current Location:</strong> Use target button for GPS location</li>
                <li>• <strong>Zoom:</strong> Use map controls for precise positioning</li>
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
                  Location Selected
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

        {/* Map Controls */}
        {map && (
          <div className="flex justify-between items-center text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                Map Ready
              </span>
              {autocompleteElement && (
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                  Search Ready ({googleMapsLoader.getAvailablePlacesAPI()})
                </span>
              )}
            </div>
            <Button 
              onClick={forceReload} 
              variant="ghost" 
              size="sm"
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reload Map
            </Button>
          </div>
        )}

        {/* API Key Status (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
            <p className="text-xs text-gray-600">
              <strong>Debug Info:</strong> Google Maps API Key: {
                process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 
                `${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.substring(0, 10)}...` : 
                'Not configured'
              }
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <strong>Search Status:</strong> {autocompleteElement ? `Ready (${googleMapsLoader.getAvailablePlacesAPI()})` : 'Not Ready'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}