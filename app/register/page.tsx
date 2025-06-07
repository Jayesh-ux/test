'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { VehicleDriverData, AmbulanceDriverData, HospitalAdminData } from '@/types';
import MapLocationPicker from '@/components/maps/MapLocationPicker';
import Link from 'next/link';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') as 'vehicle_driver' | 'ambulance_driver' | 'hospital_admin' | null;
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    // Common fields
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: initialRole || '' as 'vehicle_driver' | 'ambulance_driver' | 'hospital_admin' | '',
    
    // Vehicle driver specific
    vehicleNumber: '',
    vehicleType: '',
    emergencyContactNumber: '',
    clinicalHistory: '',
    
    // Ambulance driver specific
    ambulanceVehicleNumber: '',
    
    // Hospital admin specific
    hospitalName: '',
    hospitalAddress: '',
    hospitalPhoneNumber: '',
    hospitalLatitude: '',
    hospitalLongitude: '',
  });

  const [locationSelected, setLocationSelected] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationSelect = (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      hospitalLatitude: location.latitude.toString(),
      hospitalLongitude: location.longitude.toString(),
    }));
    setLocationSelected(true);
    
    toast({
      title: "Location Selected",
      description: `Coordinates: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
    });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.phoneNumber || !formData.password || !formData.role) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return;
      }
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate hospital admin location
    if (formData.role === 'hospital_admin') {
      if (!formData.hospitalLatitude || !formData.hospitalLongitude) {
        toast({
          title: "Error",
          description: "Please select hospital location on the map",
          variant: "destructive",
        });
        return;
      }
      
      const lat = parseFloat(formData.hospitalLatitude);
      const lng = parseFloat(formData.hospitalLongitude);
      
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        toast({
          title: "Error",
          description: "Invalid location coordinates. Please select location on the map.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setLoading(true);

    try {
      let userData: VehicleDriverData | AmbulanceDriverData | HospitalAdminData;
      
      const baseData = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
        role: formData.role,
      };

      switch (formData.role) {
        case 'vehicle_driver':
          userData = {
            ...baseData,
            role: 'vehicle_driver',
            vehicleNumber: formData.vehicleNumber,
            vehicleType: formData.vehicleType,
            emergencyContactNumber: formData.emergencyContactNumber,
            clinicalHistory: formData.clinicalHistory,
          } as VehicleDriverData;
          break;
          
        case 'ambulance_driver':
          userData = {
            ...baseData,
            role: 'ambulance_driver',
            vehicleNumber: formData.ambulanceVehicleNumber,
          } as AmbulanceDriverData;
          break;
          
        case 'hospital_admin':
          userData = {
            ...baseData,
            role: 'hospital_admin',
            hospitalName: formData.hospitalName,
            hospitalAddress: formData.hospitalAddress,
            hospitalPhoneNumber: formData.hospitalPhoneNumber,
            hospitalLatitude: parseFloat(formData.hospitalLatitude),
            hospitalLongitude: parseFloat(formData.hospitalLongitude),
          } as HospitalAdminData;
          break;
          
        default:
          throw new Error('Invalid role role');
      }

      await register(userData);
      toast({
        title: "Success",
        description: "Registration successful! Please log in.",
      });
      router.push('/login');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Registration failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Full Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          required
          placeholder="Enter your full name"
        />
      </div>
      
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          required
          placeholder="Enter your email"
        />
      </div>
      
      <div>
        <Label htmlFor="phoneNumber">Phone Number *</Label>
        <Input
          id="phoneNumber"
          value={formData.phoneNumber}
          onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
          required
          placeholder="Enter your phone number"
        />
      </div>
      
      <div>
        <Label htmlFor="role">Role *</Label>
        <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vehicle_driver">Vehicle Driver</SelectItem>
            <SelectItem value="ambulance_driver">Ambulance Driver</SelectItem>
            <SelectItem value="hospital_admin">Hospital Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => handleInputChange('password', e.target.value)}
          required
          placeholder="Enter your password"
        />
      </div>
      
      <div>
        <Label htmlFor="confirmPassword">Confirm Password *</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          required
          placeholder="Confirm your password"
        />
      </div>
      
      <Button onClick={handleNext} className="w-full">
        Next
      </Button>
    </div>
  );

  const renderStep2 = () => {
    switch (formData.role) {
      case 'vehicle_driver':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="vehicleNumber">Vehicle Number *</Label>
              <Input
                id="vehicleNumber"
                value={formData.vehicleNumber}
                onChange={(e) => handleInputChange('vehicleNumber', e.target.value)}
                required
                placeholder="Enter vehicle number"
              />
            </div>
            
            <div>
              <Label htmlFor="vehicleType">Vehicle Type *</Label>
              <Select value={formData.vehicleType} onValueChange={(value) => handleInputChange('vehicleType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="bus">Bus</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="emergencyContactNumber">Emergency Contact *</Label>
              <Input
                id="emergencyContactNumber"
                value={formData.emergencyContactNumber}
                onChange={(e) => handleInputChange('emergencyContactNumber', e.target.value)}
                required
                placeholder="Emergency contact number"
              />
            </div>
            
            <div>
              <Label htmlFor="clinicalHistory">Clinical History (Optional)</Label>
              <Textarea
                id="clinicalHistory"
                value={formData.clinicalHistory}
                onChange={(e) => handleInputChange('clinicalHistory', e.target.value)}
                placeholder="Any medical conditions or allergies"
              />
            </div>
          </div>
        );
        
      case 'ambulance_driver':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ambulanceVehicleNumber">Ambulance Vehicle Number *</Label>
              <Input
                id="ambulanceVehicleNumber"
                value={formData.ambulanceVehicleNumber}
                onChange={(e) => handleInputChange('ambulanceVehicleNumber', e.target.value)}
                required
                placeholder="Enter ambulance vehicle number"
              />
            </div>
          </div>
        );
        
      case 'hospital_admin':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="hospitalName">Hospital Name *</Label>
                <Input
                  id="hospitalName"
                  value={formData.hospitalName}
                  onChange={(e) => handleInputChange('hospitalName', e.target.value)}
                  required
                  placeholder="Enter hospital name"
                />
              </div>
              
              <div>
                <Label htmlFor="hospitalAddress">Hospital Address *</Label>
                <Textarea
                  id="hospitalAddress"
                  value={formData.hospitalAddress}
                  onChange={(e) => handleInputChange('hospitalAddress', e.target.value)}
                  required
                  placeholder="Enter hospital address"
                />
              </div>
              
              <div>
                <Label htmlFor="hospitalPhoneNumber">Hospital Phone *</Label>
                <Input
                  id="hospitalPhoneNumber"
                  value={formData.hospitalPhoneNumber}
                  onChange={(e) => handleInputChange('hospitalPhoneNumber', e.target.value)}
                  required
                  placeholder="Hospital phone number"
                />
              </div>
            </div>

            {/* Map Location Picker */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Hospital Location *</Label>
              <p className="text-sm text-gray-600 mb-4">
                Please select your hospital's exact location on the map. This is crucial for emergency response coordination.
              </p>
              
              <MapLocationPicker
                onLocationSelect={handleLocationSelect}
                hospitalName={formData.hospitalName}
                hospitalAddress={formData.hospitalAddress}
                initialLocation={
                  formData.hospitalLatitude && formData.hospitalLongitude
                    ? {
                        latitude: parseFloat(formData.hospitalLatitude),
                        longitude: parseFloat(formData.hospitalLongitude)
                      }
                    : undefined
                }
              />
              
              {/* Manual coordinate input as backup */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Label className="text-sm font-medium mb-2 block">
                  Manual Coordinates (if map doesn't work)
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hospitalLatitude" className="text-xs">Latitude *</Label>
                    <Input
                      id="hospitalLatitude"
                      type="number"
                      step="any"
                      value={formData.hospitalLatitude}
                      onChange={(e) => handleInputChange('hospitalLatitude', e.target.value)}
                      placeholder="Latitude"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hospitalLongitude" className="text-xs">Longitude *</Label>
                    <Input
                      id="hospitalLongitude"
                      type="number"
                      step="any"
                      value={formData.hospitalLongitude}
                      onChange={(e) => handleInputChange('hospitalLongitude', e.target.value)}
                      placeholder="Longitude"
                      className="text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  You can find your coordinates using Google Maps or GPS devices
                </p>
              </div>

              {/* Location validation feedback */}
              {formData.hospitalLatitude && formData.hospitalLongitude && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center text-green-800">
                    <div className="text-green-600 mr-2">✅</div>
                    <div>
                      <p className="text-sm font-medium">Location Set</p>
                      <p className="text-xs">
                        Lat: {parseFloat(formData.hospitalLatitude).toFixed(6)}, 
                        Lng: {parseFloat(formData.hospitalLongitude).toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-4xl"> {/* Increased max width for hospital admin */}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Register - Step {step} of 2
          </CardTitle>
          <CardDescription>
            {step === 1 ? 'Basic Information' : 'Role-specific Information'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {step === 1 ? renderStep1() : renderStep2()}
            
            {step === 2 && (
              <div className="flex gap-2 mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep(1)}
                  className="flex-1"
                  disabled={loading}
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={loading || (formData.role === 'hospital_admin' && !locationSelected && (!formData.hospitalLatitude || !formData.hospitalLongitude))}
                >
                  {loading ? 'Registering...' : 'Register'}
                </Button>
              </div>
            )}
          </form>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Registration Tips */}
          {step === 2 && formData.role === 'hospital_admin' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                📍 Location Selection Tips
              </h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Use the search box to find your hospital quickly</li>
                <li>• Click and drag the red marker for precise positioning</li>
                <li>• Zoom in for better accuracy</li>
                <li>• The location is used to match nearby emergencies</li>
                <li>• You can update this later in your dashboard</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
