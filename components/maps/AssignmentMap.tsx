'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation, Clock, Phone, AlertCircle, Building2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AssignmentMapProps {
  currentLocation: { latitude: number; longitude: number } | null;
  destination: { latitude: number; longitude: number };
  phase: 'to_accident' | 'to_hospital' | 'completed';
  distance: number;
  eta: number;
  isNearDestination: boolean;
  onPhaseProgress: () => void;
  assignmentData: {
    accidentDescription: string;
    severity: string;
    contactNumber: string;
    hospitalName?: string;
  };
}

export function AssignmentMap({
  currentLocation,
  destination,
  phase,
  distance,
  eta,
  isNearDestination,
  onPhaseProgress,
  assignmentData
}: AssignmentMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [currentMarker, setCurrentMarker] = useState<google.maps.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<google.maps.Marker | null>(null);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getPhaseInfo = () => {
    switch (phase) {
      case 'to_accident':
        return {
          title: 'En Route to Accident',
          description: 'Navigate to the accident location',
          color: 'bg-red-500',
          icon: AlertCircle,
          actionText: 'Arrived at Scene',
        };
      case 'to_hospital':
        return {
          title: 'Transporting to Hospital',
          description: 'Patient on board, heading to hospital',
          color: 'bg-blue-500',
          icon: Building2,
          actionText: 'Arrived at Hospital',
        };
      case 'completed':
        return {
          title: 'Assignment Completed',
          description: 'Patient successfully delivered',
          color: 'bg-green-500',
          icon: CheckCircle,
          actionText: 'Complete',
        };
    }
  };

  const phaseInfo = getPhaseInfo();
  const PhaseIcon = phaseInfo.icon;

  // Initialize map
  useEffect(() => {
    const initializeMap = async () => {
      try {
        if (!mapRef.current) return;

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error('Google Maps API key not found');
        }

        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry']
        });

        await loader.load();

        const destinationLatLng = { 
          lat: destination.latitude, 
          lng: destination.longitude 
        };

        const mapInstance = new google.maps.Map(mapRef.current, {
          center: destinationLatLng,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        const directionsServiceInstance = new google.maps.DirectionsService();
        const directionsRendererInstance = new google.maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: phase === 'to_accident' ? '#ef4444' : '#3b82f6',
            strokeWeight: 6,
            strokeOpacity: 0.8,
          },
        });

        directionsRendererInstance.setMap(mapInstance);

        // Create destination marker
        const destMarker = new google.maps.Marker({
          position: destinationLatLng,
          map: mapInstance,
          title: phase === 'to_accident' ? 'Accident Location' : 'Hospital',
          icon: {
            url: phase === 'to_accident' 
              ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="16" fill="#ef4444"/>
                  <path d="M16 8L20 12H18V20H14V12H12L16 8Z" fill="white"/>
                </svg>
              `)
              : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="16" fill="#3b82f6"/>
                  <path d="M16 6C18.2091 6 20 7.79086 20 10V12H22C23.1046 12 24 12.8954 24 14V24C24 25.1046 23.1046 26 22 26H10C8.89543 26 8 25.1046 8 24V14C8 12.8954 8.89543 12 10 12H12V10C12 7.79086 13.7909 6 16 6ZM18 12V10C18 8.89543 17.1046 8 16 8C14.8954 8 14 8.89543 14 10V12H18Z" fill="white"/>
                </svg>
              `),
            scaledSize: new google.maps.Size(32, 32),
          },
        });

        setMap(mapInstance);
        setDestinationMarker(destMarker);
        setDirectionsService(directionsServiceInstance);
        setDirectionsRenderer(directionsRendererInstance);
        setIsLoading(false);

      } catch (error: any) {
        console.error('Error initializing map:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    initializeMap();
  }, [destination, phase]);

  // Update current location marker and route
  useEffect(() => {
    if (!map || !directionsService || !directionsRenderer || !currentLocation) return;

    const currentLatLng = { 
      lat: currentLocation.latitude, 
      lng: currentLocation.longitude 
    };
    const destinationLatLng = { 
      lat: destination.latitude, 
      lng: destination.longitude 
    };

    // Update or create current location marker
    if (currentMarker) {
      currentMarker.setPosition(currentLatLng);
    } else {
      const marker = new google.maps.Marker({
        position: currentLatLng,
        map,
        title: 'Your Location',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="12" fill="#10b981"/>
              <circle cx="12" cy="12" r="6" fill="white"/>
              <circle cx="12" cy="12" r="3" fill="#10b981"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(24, 24),
        },
        zIndex: 1000,
      });
      setCurrentMarker(marker);
    }

    // Calculate and display route
    directionsService.route(
      {
        origin: currentLatLng,
        destination: destinationLatLng,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result);
          
          // Fit map to show both points
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(currentLatLng);
          bounds.extend(destinationLatLng);
          map.fitBounds(bounds);
          
          // Ensure minimum zoom level
          const listener = google.maps.event.addListener(map, 'bounds_changed', () => {
            if (map.getZoom()! > 16) map.setZoom(16);
            google.maps.event.removeListener(listener);
          });
        } else {
          console.error('Directions request failed:', status);
        }
      }
    );
  }, [map, directionsService, directionsRenderer, currentLocation, destination, currentMarker]);

  if (error) {
    return (
      <Card className="h-96">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Failed to load map: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${phaseInfo.color}`}>
                <PhaseIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{phaseInfo.title}</h1>
                <p className="text-sm text-gray-600">{phaseInfo.description}</p>
              </div>
            </div>
            <Badge className={phaseInfo.color}>
              {phase.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Map Status Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Navigation className="h-5 w-5 text-blue-600" />
                <span className="font-medium">{distance.toFixed(1)} km</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-green-600" />
                <span className="font-medium">{eta} min</span>
              </div>
            </div>
            
            {isNearDestination && (
              <Badge className="bg-green-100 text-green-800 animate-pulse">
                Near Destination
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Map Container */}
      <Card>
        <CardContent className="p-0">
          <div className="relative">
            <div
              ref={mapRef}
              className="w-full h-96 rounded-lg"
              style={{ minHeight: '400px' }}
            />
            
            {isLoading && (
              <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading map...</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Info */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Emergency Details</h4>
            <p className="text-sm text-gray-600">{assignmentData.accidentDescription}</p>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                {assignmentData.severity.toUpperCase()}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`tel:${assignmentData.contactNumber}`)}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Reporter
              </Button>
            </div>
            {assignmentData.hospitalName && (
              <div className="flex items-center text-sm text-gray-500 mt-2">
                <Building2 className="h-4 w-4 mr-2" />
                {assignmentData.hospitalName}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      {phase !== 'completed' && (
        <Button
          onClick={onPhaseProgress}
          disabled={!isNearDestination}
          className={`w-full py-4 text-lg font-medium ${
            isNearDestination 
              ? 'bg-green-600 hover:bg-green-700 animate-pulse' 
              : 'bg-gray-400'
          }`}
        >
          {isNearDestination ? (
            <>
              <CheckCircle className="h-5 w-5 mr-2" />
              {phaseInfo.actionText}
            </>
          ) : (
            <>
              <MapPin className="h-5 w-5 mr-2" />
              Navigate to Destination
            </>
          )}
        </Button>
      )}
    </div>
  );
}