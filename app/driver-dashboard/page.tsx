'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Clock, Phone, LogOut, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService } from '@/services/databaseService';
import { Accident } from '@/types';
import { EmergencyModal } from '@/components/emergency/EmergencyModal';
import { useEmergencyAlert } from '@/hooks/useEmergencyAlert';
import { LiveNotifications } from '@/components/notifications/LiveNotifications';

export default function DriverDashboardPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [accidents, setAccidents] = useState<Accident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [deletingAccidents, setDeletingAccidents] = useState<Set<string>>(new Set());
  
  const { state: emergencyState, reportEmergency, clearEmergencyState } = useEmergencyAlert();

  useEffect(() => {
    if (!user || user.role !== 'vehicle_driver') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const userAccidents = await DatabaseService.getAccidentsByReporter(user!.id);
      setAccidents(userAccidents);
    } catch (error) {
      console.error('Error loading accidents:', error);
      toast({
        title: "Error",
        description: "Failed to load your accident reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyReport = async (emergencyData: {
    location: { latitude: number; longitude: number };
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    injuredCount: number;
    vehiclesInvolved: number;
    additionalInfo?: string;
    contactNumber: string;
  }) => {
    try {
      await reportEmergency(emergencyData);
      setShowEmergencyModal(false);
      loadData(); // Refresh the accidents list
    } catch (error) {
      console.error('Error reporting emergency:', error);
    }
  };

  const handleDeleteAccident = async (accidentId: string) => {
    if (!confirm('Are you sure you want to delete this accident report? This action cannot be undone.')) {
      return;
    }

    setDeletingAccidents(prev => new Set(prev).add(accidentId));
    
    try {
      await DatabaseService.deleteAccident(accidentId);
      
      toast({
        title: "Accident Deleted",
        description: "The accident report has been successfully deleted.",
      });
      
      // Remove from local state
      setAccidents(prev => prev.filter(acc => acc.id !== accidentId));
      
    } catch (error: any) {
      console.error('Error deleting accident:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete accident report",
        variant: "destructive",
      });
    } finally {
      setDeletingAccidents(prev => {
        const newSet = new Set(prev);
        newSet.delete(accidentId);
        return newSet;
      });
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
      case 'in_progress': return 'bg-blue-500';
      case 'assigned': return 'bg-purple-500';
      case 'hospital_accepted': return 'bg-indigo-500';
      case 'hospital_notified': return 'bg-yellow-500';
      case 'pending': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const canDeleteAccident = (accident: Accident) => {
    return accident.status === 'pending' || accident.status === 'hospital_notified';
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
              <Truck className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Driver Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <LiveNotifications />
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
        {/* Emergency Alert Button */}
        <div className="mb-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-600 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-900">Emergency Reporting</h3>
                    <p className="text-red-700">Report accidents and emergencies immediately</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowEmergencyModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  size="lg"
                  disabled={emergencyState.isReporting}
                >
                  {emergencyState.isReporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Reporting...
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      Report Emergency
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Emergency Alert */}
        {emergencyState.isEmergencyActive && emergencyState.accidentId && (
          <div className="mb-8">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="animate-pulse bg-green-500 rounded-full h-3 w-3 mr-3"></div>
                    <div>
                      <h3 className="text-lg font-semibold text-green-900">Emergency Active</h3>
                      <p className="text-green-700">Your emergency has been reported. Help is on the way!</p>
                      <p className="text-sm text-green-600">Emergency ID: {emergencyState.accidentId.slice(-6)}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={clearEmergencyState}
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Accident Reports */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Accident Reports</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
          ) : accidents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Accident Reports</h3>
                <p className="text-gray-500 mb-6">You haven't reported any accidents yet.</p>
                <Button 
                  onClick={() => setShowEmergencyModal(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Report Your First Emergency
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {accidents.map((accident) => (
                <Card key={accident.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          Accident Report #{accident.id.slice(-6)}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {new Date(accident.timestamp.seconds * 1000).toLocaleString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(accident.severity)}>
                          {accident.severity.toUpperCase()}
                        </Badge>
                        <Badge className={getStatusColor(accident.status)}>
                          {accident.status.replace('_', ' ').toUpperCase()}
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
                          <span>Location: {accident.location.latitude.toFixed(4)}, {accident.location.longitude.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-gray-500 mr-2" />
                          <span>{accident.contactNumber}</span>
                        </div>
                        <div>Injured: {accident.injuredCount}</div>
                        <div>Vehicles: {accident.vehiclesInvolved}</div>
                      </div>

                      {accident.additionalInfo && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-600">
                            <strong>Additional Info:</strong> {accident.additionalInfo}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-4 border-t">
                        <div className="flex space-x-2">
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
                            Call
                          </Button>
                        </div>
                        
                        {canDeleteAccident(accident) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAccident(accident.id)}
                            disabled={deletingAccidents.has(accident.id)}
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            {deletingAccidents.has(accident.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Emergency Modal */}
      <EmergencyModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        onSubmit={handleEmergencyReport}
      />
    </div>
  );
}
