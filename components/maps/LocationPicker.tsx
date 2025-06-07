'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Target, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import GoogleMapsLoader from '@/services/googleMapsLoader';

interface LocationPickerProps {
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

export function LocationPicker({
  onLocationSelect,
  initialLocation
}: LocationPickerProps) {
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autocompleteElement, setAutocompleteElement] = useState<google.maps.places.PlaceAutocompleteElement | google.maps.places.Autocomplete | null>(null);
  
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
  }, []);

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
      
      console.log('🔄 Initializing Emergency Location Picker...');
      
      await googleMapsLoader.load();
      const mapInstance = await initializeMap();
      await initializeAutocomplete(mapInstance);
      
    } catch (error: any) {
      console.error('❌ Failed to initialize location picker:', error);
      setError(error.message || 'Failed to load location picker');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMap = async (): Promise<any> => {
    if (!mapRef.current || !googleMapsLoader.isGoogleMapsLoaded()) {
      throw new Error('Map container not ready');
    }

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: defaultLocation.latitude, lng: defaultLocation.longitude },
      zoom: 15,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
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
    });

    mapInstance.addListener('click', (event: any) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      markerInstance.setPosition({ lat, lng });
      updateSelectedLocation(lat, lng);
    });

    markerInstance.addListener('dragend', (event: any) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      updateSelectedLocation(lat, lng);
    });

    setMap(mapInstance);
    setMarker(markerInstance);
    updateSelectedLocation(defaultLocation.latitude, defaultLocation.longitude);
    
    return mapInstance;
  };

  const initializeAutocomplete = async (mapInstance: any) => {
    if (!autocompleteRef.current) {
      console.warn('⚠️ Autocomplete container ref not available');
      return;
    }

    try {
      console.log('🔍 Initializing emergency autocomplete...');

      const placesAPI = googleMapsLoader.getAvailablePlacesAPI();
      
      if (placesAPI === 'new') {
        await initializeNewAutocomplete(mapInstance);
      } else if (placesAPI === 'legacy') {
        await initializeLegacyAutocomplete(mapInstance);
      } else {
        console.warn('⚠️ No Places API available for emergency search');
      }

    } catch (error) {
      console.error('❌ Error initializing emergency autocomplete:', error);
    }
  };

  const initializeNewAutocomplete = async (mapInstance: any) => {
    try {
      const autocompleteElement = document.createElement('gmp-place-autocomplete') as any;
      autocompleteElement.setAttribute('placeholder', 'Search emergency location (e.g., Tharwani Meghna, Mumbai)');
      autocompleteElement.setAttribute('country-restriction', 'IN');
      
      Object.assign(autocompleteElement.style, {
        width: '100%',
        height: '40px',
        fontSize: '14px',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        outline: 'none'
      });

      // Use standard addEventListener for focus/blur events
      autocompleteElement.addEventListener('focus', () => {
        autocompleteElement.style.borderColor = '#ef4444';
        autocompleteElement.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
      });

      autocompleteElement.addEventListener('blur', () => {
        autocompleteElement.style.borderColor = '#d1d5db';
        autocompleteElement.style.boxShadow = 'none';
      });

      // Use custom event listener for place selection
      autocompleteElement.addEventListener('gmp-placeselect', handlePlaceSelect);

      if (autocompleteRef.current) {
        autocompleteRef.current.innerHTML = '';
        autocompleteRef.current.appendChild(autocompleteElement);
      }

      setAutocompleteElement(autocompleteElement);
      console.log('✅ New PlaceAutocompleteElement initialized for emergency search');

    } catch (error) {
      console.error('❌ Error initializing new emergency autocomplete:', error);
      await initializeLegacyAutocomplete(mapInstance);
    }
  };

  const initializeLegacyAutocomplete = async (mapInstance: any) => {
    try {
      console.log('🔍 Initializing legacy Autocomplete for emergency search...');

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Search emergency location (e.g., Tharwani Meghna, Mumbai)';
      
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
      console.log('✅ Legacy Autocomplete initialized for emergency search');

    } catch (error) {
      console.error('❌ Error initializing legacy emergency autocomplete:', error);
      throw error;
    }
  };

  const handlePlaceSelect = (event: any) => {
    try {
      console.log('🎯 New API - Emergency location selected:', event);
      
      const place = event.detail.place;
      if (!place || !place.location) {
        console.error('❌ Selected emergency place has no location');
        setError('Unable to find location for the selected place. Please try another search.');
        return;
      }

      const lat = place.location.lat();
      const lng = place.location.lng();
      
      console.log('📍 Emergency coordinates:', { lat, lng });
      console.log('📍 Emergency address:', place.formattedAddress);

      updateMapAndMarker(lat, lng);
      updateSelectedLocation(lat, lng, place.formattedAddress);
      setError(null);
      
      console.log('✅ Emergency location selection completed successfully');

    } catch (error) {
      console.error('❌ Error handling emergency location selection:', error);
      setError('Error processing selected location. Please try again.');
    }
  };

  const handleLegacyPlaceSelect = (place: google.maps.places.PlaceResult) => {
    try {
      console.log('🎯 Legacy API - Emergency location selected:', place);

      if (!place.geometry || !place.geometry.location) {
        console.error('❌ Selected emergency place has no geometry');
        setError('Unable to find location for the selected place. Please try another search.');
        return;
      }

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      
      console.log('📍 Emergency coordinates:', { lat, lng });
      console.log('📍 Emergency address:', place.formatted_address);

      updateMapAndMarker(lat, lng);
      updateSelectedLocation(lat, lng, place.formatted_address);
      setError(null);
      
      console.log('✅ Emergency location selection completed successfully');

    } catch (error) {
      console.error('❌ Error handling legacy emergency location selection:', error);
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

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const location = await googleMapsLoader.getCurrentLocation();
      
      updateMapAndMarker(location.latitude, location.longitude);
      updateSelectedLocation(location.latitude, location.longitude);
      
    } catch (error: any) {
      console.error('❌ Error getting current location:', error);
      setError(error.message || 'Unable to get your current location.');
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !map) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
          <Button 
            onClick={initializeGoogleMaps} 
            className="w-full mt-4"
          >
                      <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="space-y-2">
        <Label htmlFor="emergency-search">Search Emergency Location</Label>
        <div className="flex space-x-2">
          <div 
            ref={autocompleteRef}
            className="flex-1"
            style={{ minHeight: '40px' }}
          />
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
        <p className="text-xs text-gray-500">
          Start typing to see location suggestions, or click the target button for GPS location
        </p>
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
          className="w-full h-80 rounded-lg border"
          style={{ minHeight: '320px' }}
        />
        
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {!map ? 'Loading emergency location picker...' : 'Getting location...'}
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
              <li>• <strong>Search:</strong> Type location name and click on suggestions</li>
              <li>• <strong>GPS:</strong> Click target button for current location</li>
              <li>• <strong>Click Map:</strong> Click anywhere on map to place marker</li>
              <li>• <strong>Drag:</strong> Drag the marker to adjust position</li>
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
                <div>Lat: {selectedLocation.latitude.toFixed(6)}</div>
                <div>Lng: {selectedLocation.longitude.toFixed(6)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
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
        </div>
      )}
    </div>
  );
}
