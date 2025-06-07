'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAssignmentTracking } from '@/hooks/useAssignmentTracking';
import { AssignmentMap } from '@/components/maps/AssignmentMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, CheckCircle, MapPin, Clock, Phone } from 'lucide-react';
import { useEffect } from 'react';

export default function AssignmentTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const assignmentId = params.id as string;

  const {
    assignment,
    accident,
    currentLocation,
    destination,
    phase,
    distance,
    eta,
    isNearDestination,
    loading,
    progressToNextPhase,
  } = useAssignmentTracking(assignmentId);

  useEffect(() => {
    if (!user || user.role !== 'ambulance_driver') {
      router.push('/login');
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assignment details...</p>
        </div>
      </div>
    );
  }

  if (!assignment || !accident) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Assignment Not Found</h2>
          <p className="text-gray-600 mb-6">
            The assignment you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => router.push('/ambulance-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Assignment Completed</h2>
          <p className="text-gray-600 mb-6">
            Patient has been successfully delivered to the hospital. Great work!
          </p>
          <Button onClick={() => router.push('/ambulance-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getPhaseInfo = () => {
    switch (phase) {
      case 'to_accident':
        return {
          title: 'En Route to Accident Scene',
          description: 'Navigate to the accident location',
          actionText: 'Arrived at Scene',
          color: 'bg-orange-500',
        };
      case 'to_hospital':
        return {
          title: 'Transporting to Hospital',
          description: 'Taking patient to hospital',
          actionText: 'Delivered to Hospital',
          color: 'bg-blue-500',
        };
      default:
        return {
          title: 'Assignment Active',
          description: 'Following GPS navigation',
          actionText: 'Continue',
          color: 'bg-gray-500',
        };
    }
  };

  const phaseInfo = getPhaseInfo();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Button
                onClick={() => router.push('/ambulance-dashboard')}
                variant="outline"
                size="sm"
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Live Tracking</h1>
                <p className="text-sm text-gray-500">Assignment #{assignmentId.slice(-6)}</p>
              </div>
            </div>
            <Badge className={phaseInfo.color}>
              {phaseInfo.title}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Assignment Details */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Emergency Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-700">Emergency Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium text-gray-900">{accident.description}</p>
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                    <Badge className={`${accident.severity === 'critical' ? 'bg-red-500' : 
                      accident.severity === 'high' ? 'bg-orange-500' : 
                      accident.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}>
                      {accident.severity.toUpperCase()}
                    </Badge>
                    <span>Injured: {accident.injuredCount}</span>
                    <span>Vehicles: {accident.vehiclesInvolved}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{accident.contactNumber}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`tel:${accident.contactNumber}`, '_blank')}
                  >
                    Call
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Navigation Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Distance</span>
                  </div>
                  <span className="font-medium">{distance.toFixed(1)} km</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">ETA</span>
                  </div>
                  <span className="font-medium">{eta} min</span>
                </div>

                {currentLocation && destination && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      const url = `https://www.google.com/maps/dir/${currentLocation.latitude},${currentLocation.longitude}/${destination.latitude},${destination.longitude}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Open in Google Maps
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Phase Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">{phaseInfo.description}</p>
                  
                  {isNearDestination && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800 font-medium">
                        🎯 You're near your destination!
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Click the button below when you've arrived.
                      </p>
                    </div>
                  )}
                  
                  <Button
                    onClick={progressToNextPhase}
                    disabled={!isNearDestination}
                    className={`w-full ${
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            {destination && (
              <AssignmentMap
                currentLocation={currentLocation}
                destination={destination}
                phase={phase}
                distance={distance}
                eta={eta}
                isNearDestination={isNearDestination}
                onPhaseProgress={progressToNextPhase}
                assignmentData={{
                  accidentDescription: accident.description,
                  severity: accident.severity,
                  contactNumber: accident.contactNumber,
                  hospitalName: assignment.hospitalId, // You might want to fetch hospital name
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
