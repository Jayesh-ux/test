'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { 
  Building2, 
  Users, 
  Activity, 
  Plus, 
  Minus, 
  LogOut, 
  Bed, 
  Phone, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertTriangle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService } from '@/services/databaseService';
import { HospitalAdmin, Accident, Assignment } from '@/types';

export default function HospitalDashboardPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hospitalAdmin, setHospitalAdmin] = useState<HospitalAdmin | null>(null);

  const [availableBeds, setAvailableBeds] = useState(25);
  const [totalCapacity] = useState(50);

  const [nearbyEmergencies, setNearbyEmergencies] = useState<Accident[]>([]);
  const [processingEmergencies, setProcessingEmergencies] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.role === 'hospital_admin') {
      loadHospitalData();
    }
  }, [user]);

  const detectUserRegion = async () => {
    try {
      // Try to get user's approximate location for better emergency filtering
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            
            console.log('📍 User location detected:', userLocation);
            
            // You could use this to adjust the search radius or prioritize nearby emergencies
            // For now, we'll just log it
          },
          (error) => {
            console.log('ℹ️ User location not available:', error.message);
            // This is fine, we'll use hospital location only
          },
          { timeout: 5000, maximumAge: 300000 }
        );
      }
    } catch (error) {
      console.log('ℹ️ Geolocation not supported or failed');
    }
  };

  const loadHospitalData = async () => {
    try {
      setLoading(true);
      
      console.log('🏥 Loading hospital data for user:', user!.id);
      
      // Load hospital admin specific data
      const adminData = await DatabaseService.getHospitalAdmin(user!.id);
      console.log('🏥 Hospital admin data:', adminData);
      setHospitalAdmin(adminData);

      if (adminData?.hospitalLocation) {
        console.log('📍 Hospital location:', adminData.hospitalLocation);
        
        // Validate hospital location
        const isValidLocation = await DatabaseService.validateHospitalLocation(adminData.hospitalLocation);
        if (!isValidLocation) {
          toast({
            title: "Location Error",
            description: "Hospital location appears to be invalid. Please contact support.",
            variant: "destructive",
          });
          return;
        }
        
        // Load nearby emergencies using hospital location with adaptive radius
        let searchRadius = 50; // Default 50km
        
        // Adjust search radius based on location (for rural vs urban areas)
        // You could implement more sophisticated logic here
        const emergencies = await DatabaseService.getNearbyPendingAccidents(
          adminData.hospitalLocation,
          searchRadius
        );
        
        console.log('🚨 Found emergencies:', emergencies);
        console.log('🚨 Emergency count:', emergencies.length);
        
        setNearbyEmergencies(emergencies);

        // If no emergencies found in 50km, try expanding search for rural areas
        if (emergencies.length === 0 && searchRadius === 50) {
          console.log('🔍 No emergencies in 50km, expanding search to 100km...');
          const expandedEmergencies = await DatabaseService.getNearbyPendingAccidents(
            adminData.hospitalLocation,
            100
          );
          
          if (expandedEmergencies.length > 0) {
            setNearbyEmergencies(expandedEmergencies);
            toast({
              title: "Extended Search",
              description: `Found ${expandedEmergencies.length} emergencies within 100km radius.`,
            });
          }
        }

        // Detect user region for better UX
        detectUserRegion();
        
      } else {
        console.log('❌ No hospital location found for admin');
        toast({
          title: "Setup Required",
          description: "Hospital location not found. Please contact support to update your location.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('❌ Error loading hospital data:', error);
      toast({
        title: "Error",
        description: "Failed to load hospital data. Please check your internet connection.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptEmergency = async (accident: Accident) => {
    if (!hospitalAdmin) return;
    
    setProcessingEmergencies(prev => new Set(prev).add(accident.id));
    
    try {
      // Create hospital response
      await DatabaseService.createHospitalResponse({
        accidentId: accident.id,
        hospitalId: hospitalAdmin.hospitalId,
        hospitalName: hospitalAdmin.hospitalName,
        status: 'accepted',
        availableBeds: availableBeds,
        estimatedArrivalTime: 15, // minutes
        specialtyServices: hospitalAdmin.specialtyServices || [],
      });

      // Notify ambulance drivers
      await DatabaseService.notifyAmbulanceDrivers(accident.id, hospitalAdmin.hospitalId);

      toast({
        title: "Emergency Accepted",
        description: `Emergency accepted. Ambulance drivers have been notified.`,
      });

      // Refresh data
      loadHospitalData();
      
    } catch (error) {
      console.error('Error accepting emergency:', error);
      toast({
        title: "Error",
        description: "Failed to accept emergency",
        variant: "destructive",
      });
    } finally {
      setProcessingEmergencies(prev => {
        const newSet = new Set(prev);
        newSet.delete(accident.id);
        return newSet;
      });
    }
  };

  const handleRejectEmergency = async (accident: Accident) => {
    if (!hospitalAdmin) return;
    
    setProcessingEmergencies(prev => new Set(prev).add(accident.id));
    
    try {
      // Create hospital response with rejection
      await DatabaseService.createHospitalResponse({
        accidentId: accident.id,
        hospitalId: hospitalAdmin.hospitalId,
        hospitalName: hospitalAdmin.hospitalName,
        status: 'rejected',
        availableBeds: availableBeds,
        estimatedArrivalTime: 0,
        rejectionReason: 'No available beds or resources',
      });

      toast({
        title: "Emergency Rejected",
        description: "Emergency rejected. Other hospitals can still respond.",
      });

      // Remove from local list
      setNearbyEmergencies(prev => prev.filter(e => e.id !== accident.id));
      
    } catch (error) {
      console.error('Error rejecting emergency:', error);
      toast({
        title: "Error",
        description: "Failed to reject emergency",
        variant: "destructive",
      });
    } finally {
      setProcessingEmergencies(prev => {
        const newSet = new Set(prev);
        newSet.delete(accident.id);
        return newSet;
      });
    }
  };

  const updateBedCount = (change: number) => {
    const newCount = availableBeds + change;
    if (newCount >= 0 && newCount <= totalCapacity) {
      setAvailableBeds(newCount);
      toast({
        title: "Bed Count Updated",
        description: `Available beds: ${newCount}`,
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push('/'); // Navigate to homepage
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'hospital_notified': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user || user.role !== 'hospital_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Access denied. Hospital administrators only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hospital Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user.name}</p>
            </div>

            <div className="flex items-center space-x-4">
              <Button onClick={loadHospitalData} variant="outline" size="sm">
                Refresh
              </Button>

              <Button onClick={handleLogout} variant="outline">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading hospital data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hospital Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hospital Name</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {hospitalAdmin?.hospitalName || 'Loading...'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hospital Address</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {hospitalAdmin?.hospitalAddress || 'Loading...'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contact Number</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {hospitalAdmin?.hospitalPhoneNumber || 'Loading...'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bed Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bed className="h-5 w-5 mr-2" />
                  Bed Management
                </CardTitle>
                <CardDescription>
                  Manage available beds and capacity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Available Beds</p>
                      <p className="text-3xl font-bold text-green-600">{availableBeds}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Total Capacity</p>
                      <p className="text-3xl font-bold text-blue-600">{totalCapacity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Occupancy Rate</p>
                      <p className="text-3xl font-bold text-orange-600">
                        {Math.round(((totalCapacity - availableBeds) / totalCapacity) * 100)}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <Button 
                      onClick={() => updateBedCount(-1)}
                      variant="outline"
                      size="sm"
                      disabled={availableBeds <= 0}
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Decrease
                    </Button>
                    <Button 
                      onClick={() => updateBedCount(1)}
                      variant="outline"
                      size="sm"
                      disabled={availableBeds >= totalCapacity}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Increase
                    </Button>
                  </div>

                  {/* Bed Status Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(availableBeds / totalCapacity) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {availableBeds} beds available out of {totalCapacity} total capacity
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Nearby Emergency Cases */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Nearby Emergency Cases
                  <Badge variant="secondary" className="ml-2">
                    {nearbyEmergencies.length} pending
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Emergency cases within 50km that need hospital response
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nearbyEmergencies.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No nearby emergency cases</p>
                    <p className="text-sm text-gray-400">Emergency cases will appear here when reported nearby</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {nearbyEmergencies.map((accident) => (
                      <div key={accident.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Badge className={getSeverityColor(accident.severity)}>
                              {accident.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className={getStatusColor(accident.status)}>
                              {accident.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {accident.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                          </span>
                        </div>
                        
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-900 mb-2">Emergency #{accident.id.slice(-6)}</h4>
                          <p className="text-sm text-gray-700 mb-2">{accident.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600 mb-2">
                            <div className="flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              Injured: {accident.injuredCount}
                            </div>
                            <div className="flex items-center">
                              <Activity className="h-3 w-3 mr-1" />
                              Vehicles: {accident.vehiclesInvolved}
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {accident.contactNumber}
                            </div>
                            <div className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {hospitalAdmin?.hospitalLocation ? 
                                `${DatabaseService.calculateDistance(
                                  hospitalAdmin.hospitalLocation.latitude,
                                  hospitalAdmin.hospitalLocation.longitude,
                                  accident.location.latitude,
                                  accident.location.longitude
                                ).toFixed(1)} km away` : 'Distance unknown'
                              }
                            </div>
                          </div>
                          
                          {accident.additionalInfo && (
                            <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 mb-2">
                              <strong>Additional Info:</strong> {accident.additionalInfo}
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex space-x-3">
                          <Button
                            onClick={() => handleAcceptEmergency(accident)}
                            disabled={processingEmergencies.has(accident.id) || availableBeds <= 0}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {processingEmergencies.has(accident.id) ? 'Processing...' : 'Accept Emergency'}
                          </Button>
                          
                          <Button
                            onClick={() => handleRejectEmergency(accident)}
                            disabled={processingEmergencies.has(accident.id)}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            size="sm"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            {processingEmergencies.has(accident.id) ? 'Processing...' : 'Cannot Accept'}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://maps.google.com/?q=${accident.location.latitude},${accident.location.longitude}`, '_blank')}
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            View Location
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`tel:${accident.contactNumber}`, '_blank')}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call Reporter
                          </Button>
                        </div>
                        
                        {/* Bed availability warning */}
                        {availableBeds <= 0 && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            ⚠️ No available beds - Cannot accept new emergencies
                          </div>
                        )}
                        
                        {availableBeds <= 5 && availableBeds > 0 && (
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                            ⚠️ Low bed availability - Only {availableBeds} beds remaining
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hospital Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Admissions</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">+2 from yesterday</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nearby Emergencies</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{nearbyEmergencies.length}</div>
                  <p className="text-xs text-muted-foreground">Pending response</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Staff on Duty</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">Doctors & Nurses</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bed Utilization</CardTitle>
                  <Bed className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(((totalCapacity - availableBeds) / totalCapacity) * 100)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Current occupancy</p>
                </CardContent>
              </Card>
            </div>

            {/* Emergency Response Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-blue-600" />
                  Emergency Response Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                    <p><strong>Monitor Emergencies:</strong> Nearby emergency cases appear automatically based on your hospital location</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                    <p><strong>Check Capacity:</strong> Ensure you have available beds before accepting emergencies</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                    <p><strong>Accept/Reject:</strong> Accept emergencies you can handle, reject if no capacity</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</span>
                    <p><strong>Ambulance Dispatch:</strong> Accepting an emergency automatically notifies ambulance drivers</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">5</span>
                    <p><strong>Prepare Resources:</strong> Get your emergency team ready for incoming patients</p>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>✅ Best Practice:</strong> Keep your bed count updated in real-time to ensure accurate emergency response capacity.
                  </p>
                </div>

                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>🚨 Critical:</strong> Only accept emergencies you can properly handle. Patient safety is the top priority.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Hospital Location Debug Info (for development) */}
            {hospitalAdmin?.hospitalLocation && (
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="text-sm text-blue-600">Hospital Location (Debug Info)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-600">
                    <p><strong>Latitude:</strong> {hospitalAdmin.hospitalLocation.latitude}</p>
                    <p><strong>Longitude:</strong> {hospitalAdmin.hospitalLocation.longitude}</p>
                    <p><strong>Search Radius:</strong> 50km</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
