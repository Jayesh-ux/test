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
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const googleMapsLoader = GoogleMapsLoader.getInstance();

  const defaultLocation = initialLocation || { latitude: 19.0760, longitude: 72.8777 };

  useEffect(() => {
    initializeGoogleMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeGoogleMaps = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const loadPromise = googleMapsLoader.load();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Google Maps loading timed out')), 30000)
      );

      await Promise.race([loadPromise, timeoutPromise]);

      const mapInstance = await initializeMap();
      setMap(mapInstance);
    } catch (error: any) {
      setError(error.message || 'Failed to load Google Maps');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMap = async (): Promise<any> => {
    if (!mapRef.current || !googleMapsLoader.isGoogleMapsLoaded()) {
      throw new Error('Map container not ready or Google Maps not loaded');
    }

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
    updateSelectedLocation(defaultLocation.latitude, defaultLocation.longitude);

    return mapInstance;
  };

  useEffect(() => {
    if (!window.google?.maps?.places || !inputRef.current || !map) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
      componentRestrictions: { country: 'IN' },
      fields: ['place_id', 'geometry', 'formatted_address', 'name']
    });

    autocomplete.bindTo('bounds', map);

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      updateMapAndMarker(lat, lng);
      updateSelectedLocation(lat, lng, place.formatted_address);
    });

    const syncPosition = () => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const style = document.documentElement.style;
      style.setProperty('--pac-container-width', `${rect.width}px`);
      style.setProperty('--pac-container-left', `${rect.left}px`);
      style.setProperty('--pac-container-top', `${rect.bottom + window.scrollY}px`);
    };

    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);
    inputRef.current.addEventListener('focus', syncPosition);

    syncPosition();

    return () => {
      window.google.maps.event.clearInstanceListeners(autocomplete);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
      if (inputRef.current) {
        inputRef.current.removeEventListener('focus', syncPosition);
      }
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
          } catch (e) {}
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
      setSelectedLocation(location);
      onLocationSelect(location);
    }
  };

  const handleManualSearch = async () => {
    let currentQuery = inputRef.current?.value || '';
    if (!currentQuery.trim()) {
      setError('Please enter a location to search for');
      return;
    }
    await performTextSearch(currentQuery);
  };

  const performTextSearch = async (query: string) => {
    if (!map || !query.trim()) return;

    try {
      setIsSearching(true);
      setError(null);

      const service = new window.google.maps.places.PlacesService(map);
      const request = { query: query };

      service.textSearch(request, (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
        setIsSearching(false);

        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          const place = results[0];
          const location = place.geometry?.location;

          if (location) {
            const lat = location.lat();
            const lng = location.lng();
            updateMapAndMarker(lat, lng);
            updateSelectedLocation(lat, lng, place.formatted_address);
          } else {
            setError('Selected location has no coordinates. Please try another search.');
          }
        } else {
          setError(`No results found for "${query}". Please try a different search term.`);
        }
      });
    } catch (error) {
      setError('Search failed. Please try again.');
      setIsSearching(false);
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
            <div className="relative w-full">
              <Input
                ref={inputRef}
                placeholder="Search for emergency location"
                className="w-full"
              />
            </div>
            <Button onClick={handleManualSearch} disabled={isLoading || isSearching}>
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
            <Button onClick={getCurrentLocation} disabled={isLoading} title="Use Current Location">
              <Target className="w-4 h-4" />
            </Button>
          </div>
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
      </CardContent>
    </Card>
  );
}