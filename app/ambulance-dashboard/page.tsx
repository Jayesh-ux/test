'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Clock, Phone, LogOut, AlertTriangle, CheckCircle, XCircle, Navigation } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService } from '@/services/databaseService';
import { Accident, Assignment, HospitalResponse } from '@/types';
import { NotificationService } from '@/services/notificationService';

export default function AmbulanceDashboardPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [availableEmergencies, setAvailableEmergencies] = useState<Array<{
    accident: Accident;
    hospitalResponse: HospitalResponse;
  }>>([]);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || user.role !== 'ambulance_driver') {
      router.push('/login');
      return;
    }
    loadData();
    
    // Set up real-time updates
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get emergencies that hospitals have accepted and need ambulance drivers
      const emergencies = await DatabaseService.getHospitalAcceptedEmergencies();
      setAvailableEmergencies(emergencies);
      
      // Get current driver's active assignments
      const assignments = await DatabaseService.getAssignmentsByAmbulanceDriver(user!.id);
      setActiveAssignments(assignments.filter(a => 
        a.status !== 'completed' && a.status !== 'cancelled'
      ));
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptEmergency = async (accidentId: string, hospitalId: string) => {
    setProcessingRequests(prev => new Set(prev).add(accidentId));
    
    try {
      console.log('🚑 Creating assignment for:', { accidentId, hospitalId, driverId: user!.id });
      
      // Create assignment
      const assignmentId = await DatabaseService.createAssignment({
        accidentId,
        ambulanceDriverId: user!.id,
        hospitalId,
        status: 'accepted',
        estimatedArrivalTime: 10, // minutes
        driverLocation: await getCurrentLocation()
      });
      console.log('✅ Assignment created with ID:', assignmentId);

      // Update accident status
      await DatabaseService.updateAccidentStatus(accidentId, 'assigned');

      // Notify hospital and accident reporter
      await DatabaseService.notifyAssignmentAccepted(assignmentId, accidentId, hospitalId);
      
      // Send real-time notification to vehicle driver
      const accident = await DatabaseService.getAccident(accidentId);
      if (accident) {
        await NotificationService.notifyVehicleDriver(
          accident.reporterId,
          'An ambulance has been dispatched to your location. ETA: 10 minutes.',
          'ambulance_dispatched'
        );
      }

      toast({
        title: "Emergency Accepted",
        description: "You have accepted this emergency. Navigate to the location immediately.",
      });

      // Refresh data
      loadData();
      
    } catch (error) {
      console.error('Error accepting emergency:', error);
      toast({
        title: "Error",
        description: "Failed to accept emergency assignment",
        variant: "destructive",
      });
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(accidentId);
        return newSet;
      });
    }
  };

  const handleRejectEmergency = async (accidentId: string) => {
    setProcessingRequests(prev => new Set(prev).add(accidentId));
    
    try {
      // Record rejection (other drivers can still accept)
      await DatabaseService.recordAmbulanceRejection({
        accidentId,
        ambulanceDriverId: user!.id,
        rejectionReason: 'Not available',
        timestamp: new Date()
      });

      // Remove from available list for this driver
      setAvailableEmergencies(prev => 
        prev.filter(item => item.accident.id !== accidentId)
      );

      toast({
        title: "Emergency Rejected",
        description: "Other ambulance drivers can still respond to this emergency.",
      });
      
    } catch (error) {
      console.error('Error rejecting emergency:', error);
      toast({
        title: "Error",
        description: "Failed to reject emergency",
        variant: "destructive",
      });
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(accidentId);
        return newSet;
      });
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, newStatus: Assignment['status']) => {
    try {
      await DatabaseService.updateAssignmentStatus(assignmentId, newStatus);
      
      // Update accident status based on assignment status
      const assignment = activeAssignments.find(a => a.id === assignmentId);
      if (assignment) {
        let accidentStatus: Accident['status'] = 'assigned';
        
        switch (newStatus) {
          case 'en_route':
            accidentStatus = 'in_progress';
            break;
          case 'arrived':
            accidentStatus = 'in_progress';
            break;
          case 'completed':
            accidentStatus = 'completed';
            break;
        }
        
        await DatabaseService.updateAccidentStatus(assignment.accidentId, accidentStatus);
      }

      toast({
        title: "Status Updated",
        description: `Assignment status updated to ${newStatus.replace('_', ' ')}`,
      });

      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleCancelAssignment = async (assignmentId: string, accidentId: string) => {
    const reason = prompt('Please provide a reason for canceling this assignment (e.g., vehicle breakdown, emergency, etc.):');
    
    if (!reason || reason.trim() === '') {
      toast({
        title: "Cancellation Aborted",
        description: "A reason is required to cancel the assignment.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to cancel this assignment? Reason: "${reason}"\n\nThis will make the emergency available to other ambulance drivers.`)) {
      return;
    }

    try {
      console.log('🚫 Canceling assignment:', { assignmentId, accidentId, reason });

      // Update assignment status to cancelled
      await DatabaseService.updateAssignmentStatus(assignmentId, 'cancelled');

      // Add cancellation reason to assignment
      await DatabaseService.addAssignmentCancellationReason(assignmentId, reason);

      // Revert accident status back to hospital_accepted so other ambulances can see it
      await DatabaseService.updateAccidentStatus(accidentId, 'hospital_accepted');

      // Notify hospital about the cancellation
      await DatabaseService.notifyAssignmentCancellation(assignmentId, accidentId, reason);

      // Send notification to vehicle driver about the cancellation
      const accident = await DatabaseService.getAccident(accidentId);
      if (accident) {
        await NotificationService.notifyVehicleDriver(
          accident.reporterId,
          `Your assigned ambulance had to cancel due to: ${reason}. We are finding another ambulance for you.`,
          'ambulance_cancelled'
        );
      }

      toast({
        title: "Assignment Cancelled",
        description: "The assignment has been cancelled and is now available for other ambulance drivers.",
      });

      // Refresh data to update the UI
      loadData();

    } catch (error) {
      console.error('Error cancelling assignment:', error);
      toast({
        title: "Error",
        description: "Failed to cancel assignment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getCurrentLocation = (): Promise<{latitude: number, longitude: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const getDistanceFromDriver = async (accidentLat: number, accidentLng: number) => {
    try {
      const driverLocation = await getCurrentLocation();
      const R = 6371; // Earth's radius in km
      const dLat = (accidentLat - driverLocation.latitude) * Math.PI / 180;
      const dLon = (accidentLng - driverLocation.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(driverLocation.latitude * Math.PI / 180) * 
        Math.cos(accidentLat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      return `${distance.toFixed(1)} km`;
    } catch {
      return 'Unknown';
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'arrived': return 'bg-blue-500';
      case 'en_route': return 'bg-purple-500';
      case 'accepted': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-red-600 mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Ambulance Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={loadData} variant="outline" size="sm">
                Refresh
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Active Assignments */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Active Assignments</h2>
              {activeAssignments.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No active assignments</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {activeAssignments.map((assignment) => (
                    <Card key={assignment.id} className="border-l-4 border-l-red-500">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">Assignment #{assignment.id.slice(-6)}</CardTitle>
                          <Badge className={getStatusColor(assignment.status)}>
                            {assignment.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-gray-500 mr-2" />
                            <span className="text-sm text-gray-600">
                              {new Date(assignment.createdAt.seconds * 1000).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                            <span className="text-sm text-gray-600">Location Available</span>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 flex-wrap">
                          {/* Status Update Buttons */}
                          {assignment.status === 'accepted' && (
                            <Button 
                              size="sm"
                              onClick={() => updateAssignmentStatus(assignment.id, 'en_route')}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              <Navigation className="h-4 w-4 mr-2" />
                              En Route
                            </Button>
                          )}
                          
                          {assignment.status === 'en_route' && (
                            <Button 
                              size="sm"
                              onClick={() => updateAssignmentStatus(assignment.id, 'arrived')}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <MapPin className="h-4 w-4 mr-2" />
                              Arrived
                            </Button>
                          )}
                          
                          {assignment.status === 'arrived' && (
                            <Button 
                              size="sm"
                              onClick={() => updateAssignmentStatus(assignment.id, 'completed')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete
                            </Button>
                          )}
                          
                          {/* Live Tracking Button */}
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/assignment/${assignment.id}`)}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            Live Tracking
                          </Button>

                          {/* Cancel Assignment Button - Only show if not completed */}
                          {assignment.status !== 'completed' && (
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelAssignment(assignment.id, assignment.accidentId)}
                              className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel Assignment
                            </Button>
                          )}
                        </div>

                        {/* Emergency Cancellation Notice */}
                        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                          <strong>Emergency Cancellation:</strong> If you cannot reach the location due to vehicle issues, 
                          traffic, or other emergencies, use "Cancel Assignment" to make this emergency available to other ambulances.
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Available Emergency Requests */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Available Emergency Requests
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (Approved by hospitals)
                </span>
              </h2>
              {availableEmergencies.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No emergency requests available</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Emergency requests will appear here after hospitals approve them
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6">
                  {availableEmergencies.map(({ accident, hospitalResponse }) => (
                    <Card key={accident.id} className="border-l-4 border-l-orange-500">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              Emergency #{accident.id.slice(-6)}
                            </CardTitle>
                            <CardDescription>
                              Reported: {new Date(accident.timestamp.seconds * 1000).toLocaleString()}
                            </CardDescription>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getSeverityColor(accident.severity)}>
                              {accident.severity.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <p className="text-gray-700">{accident.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                              <span>
                                {getDistanceFromDriver(accident.location.latitude, accident.location.longitude)}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 text-gray-500 mr-2" />
                              <span>{accident.contactNumber}</span>
                            </div>
                            <div>Injured: {accident.injuredCount}</div>
                            <div>Vehicles: {accident.vehiclesInvolved}</div>
                          </div>

                          {/* Hospital Information */}
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Hospital Assignment</h4>
                            <div className="text-sm text-blue-800">
                              <p><strong>Hospital:</strong> {hospitalResponse.hospitalName}</p>
                              {hospitalResponse.availableBeds && (
                                <p><strong>Available Beds:</strong> {hospitalResponse.availableBeds}</p>
                              )}
                              {hospitalResponse.estimatedArrivalTime && (
                                <p><strong>Hospital ETA:</strong> {hospitalResponse.estimatedArrivalTime} minutes</p>
                              )}
                              {hospitalResponse.specialtyServices && hospitalResponse.specialtyServices.length > 0 && (
                                <p><strong>Specialty Services:</strong> {hospitalResponse.specialtyServices.join(', ')}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex space-x-3">
                            <Button
                              onClick={() => handleAcceptEmergency(accident.id, hospitalResponse.hospitalId)}
                              disabled={processingRequests.has(accident.id)}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              {processingRequests.has(accident.id) ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Accepting...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Accept Emergency
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleRejectEmergency(accident.id)}
                              disabled={processingRequests.has(accident.id)}
                              className="flex-1"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Not Available
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => window.open(`https://maps.google.com/?q=${accident.location.latitude},${accident.location.longitude}`, '_blank')}
                              className="flex-1"
                            >
                              <MapPin className="h-4 w-4 mr-2" />
                              View Location
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
