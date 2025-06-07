'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, AlertCircle, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MapLocationPicker from '@/components/maps/MapLocationPicker';
import { EmergencyModalProps } from '@/types';
import EmergencyLocationPicker from '@/components/maps/EmergencyLocationPicker';

export function EmergencyModal({ isOpen, onClose, onSubmit }: EmergencyModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationMethod, setLocationMethod] = useState<'auto' | 'manual'>('auto');
  const [autoLocationFailed, setAutoLocationFailed] = useState(false);
  
  const [formData, setFormData] = useState({
    location: { latitude: 0, longitude: 0 },
    locationAddress: '',
    description: '',
    severity: '' as 'low' | 'medium' | 'high' | 'critical',
    injuredCount: 1,
    vehiclesInvolved: 1,
    additionalInfo: '',
    contactNumber: '',
  });

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setAutoLocationFailed(false);
    
    if (!navigator.geolocation) {
      toast({
        title: "Location Not Supported",
        description: "Geolocation is not supported by this browser. Please select location manually.",
        variant: "destructive",
      });
      setGettingLocation(false);
      setAutoLocationFailed(true);
      setLocationMethod('manual');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        setFormData(prev => ({
          ...prev,
          location,
          locationAddress: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
        }));
        
        setGettingLocation(false);
        toast({
          title: "Location Detected",
          description: `Location captured with ${position.coords.accuracy?.toFixed(0)}m accuracy`,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = "Unable to get your location. ";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Location access was denied. Please select manually.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable. Please select manually.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out. Please select manually.";
            break;
          default:
            errorMessage += "Please select your location manually on the map.";
            break;
        }
        
        toast({
          title: "Location Detection Failed",
          description: errorMessage,
          variant: "destructive",
        });
        
        setGettingLocation(false);
        setAutoLocationFailed(true);
        setLocationMethod('manual');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleLocationSelect = (location: { latitude: number; longitude: number; address?: string }) => {
    setFormData(prev => ({
      ...prev,
      location: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      locationAddress: location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description || !formData.severity || !formData.contactNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.location.latitude === 0 && formData.location.longitude === 0) {
      toast({
        title: "Location Required",
        description: "Please select your emergency location using GPS or the map",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        location: formData.location,
        description: formData.description,
        severity: formData.severity,
        injuredCount: formData.injuredCount,
        vehiclesInvolved: formData.vehiclesInvolved,
        additionalInfo: formData.additionalInfo,
        contactNumber: formData.contactNumber,
      });
      
      // Reset form
      setFormData({
        location: { latitude: 0, longitude: 0 },
        locationAddress: '',
        description: '',
        severity: '' as any,
        injuredCount: 1,
        vehiclesInvolved: 1,
        additionalInfo: '',
        contactNumber: '',
      });
      setLocationMethod('auto');
      setAutoLocationFailed(false);
    } catch (error) {
      console.error('Error submitting emergency:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-get location when modal opens
  useEffect(() => {
    if (isOpen && formData.location.latitude === 0 && locationMethod === 'auto') {
      getCurrentLocation();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            Report Emergency
          </DialogTitle>
          <DialogDescription>
            Please provide accurate location and emergency details to ensure quick response from nearby hospitals and ambulance services.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Emergency Location *</Label>
            
            <Tabs value={locationMethod} onValueChange={(value) => setLocationMethod(value as 'auto' | 'manual')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="auto" className="flex items-center">
                  <Target className="w-4 h-4 mr-2" />
                  Auto Detect
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Select on Map
                </TabsTrigger>
              </TabsList>

              <TabsContent value="auto" className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900">Automatic Location Detection</p>
                      <p className="text-sm text-blue-700">
                        {gettingLocation 
                          ? "Getting your current location..." 
                          : formData.location.latitude !== 0 
                            ? "Location detected successfully" 
                            : "Click to detect your current location"
                        }
                      </p>
                      {formData.locationAddress && (
                        <p className="text-xs text-blue-600 mt-1">{formData.locationAddress}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={gettingLocation}
                      variant="outline"
                      className="flex items-center"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      {gettingLocation ? 'Detecting...' : 'Get Location'}
                    </Button>
                  </div>
                  
                  {autoLocationFailed && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Automatic location detection failed. This could be due to:
                      </p>
                      <ul className="text-xs text-yellow-700 mt-1 ml-4 list-disc">
                        <li>Location permissions not granted</li>
                        <li>GPS not available on this device</li>
                        <li>Network-based location is inaccurate</li>
                      </ul>
                      <p className="text-sm text-yellow-800 mt-2">
                        Please use the "Select on Map" tab for accurate location selection.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                {/* Use the new dedicated emergency location picker */}
                <EmergencyLocationPicker
                  onLocationSelect={handleLocationSelect}
                  initialLocation={formData.location.latitude !== 0 ? formData.location : undefined}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Emergency Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Description */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Emergency Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the emergency situation in detail..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
                className="min-h-20"
              />
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label>Severity Level *</Label>
              <Select
                value={formData.severity}
                onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => 
                  setFormData(prev => ({ ...prev, severity: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Low - Minor injuries</SelectItem>
                  <SelectItem value="medium">🟡 Medium - Moderate injuries</SelectItem>
                  <SelectItem value="high">🟠 High - Serious injuries</SelectItem>
                  <SelectItem value="critical">🔴 Critical - Life threatening</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number *</Label>
              <Input
                id="contactNumber"
                type="tel"
                placeholder="Your phone number"
                value={formData.contactNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                required
              />
            </div>

            {/* Injured Count */}
            <div className="space-y-2">
              <Label htmlFor="injuredCount">Number of Injured People</Label>
              <Input
                id="injuredCount"
                type="number"
                min="0"
                max="50"
                value={formData.injuredCount}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  injuredCount: parseInt(e.target.value) || 0 
                }))}
              />
            </div>

            {/* Vehicles Involved */}
            <div className="space-y-2">
              <Label htmlFor="vehiclesInvolved">Vehicles Involved</Label>
              <Input
                id="vehiclesInvolved"
                type="number"
                min="0"
                max="20"
                value={formData.vehiclesInvolved}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  vehiclesInvolved: parseInt(e.target.value) || 0 
                }))}
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-2">
            <Label htmlFor="additionalInfo">Additional Information</Label>
            <Textarea
              id="additionalInfo"
              placeholder="Any additional details that might help emergency responders..."
              value={formData.additionalInfo}
              onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: e.target.value }))}
              className="min-h-16"
            />
          </div>

          {/* Current Location Display */}
          {formData.location.latitude !== 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Selected Location:</p>
                  <p className="text-sm text-green-700">{formData.locationAddress}</p>
                  <p className="text-xs text-green-600">
                    Coordinates: {formData.location.latitude.toFixed(6)}, {formData.location.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || formData.location.latitude === 0}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Reporting...
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Report Emergency
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
