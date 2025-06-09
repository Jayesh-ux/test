'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, MapPin, Phone, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService } from '@/services/databaseService';
import { Timestamp } from 'firebase/firestore';

export default function EmergencyReportPage() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { toast } = useToast();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    severity: '',
    injuredCount: '',
    vehiclesInvolved: '',
    additionalInfo: '',
    contactNumber: user?.phoneNumber || '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!position) {
      toast({
        title: "Location Required",
        description: "Please enable location services to report an emergency.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.description || !formData.severity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await DatabaseService.createAccident({
        reporterId: user!.id,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        description: formData.description,
        severity: formData.severity as 'low' | 'medium' | 'high' | 'critical',
        injuredCount: parseInt(formData.injuredCount) || 0,
        vehiclesInvolved: parseInt(formData.vehiclesInvolved) || 1,
        additionalInfo: formData.additionalInfo,
        contactNumber: formData.contactNumber,
        status: 'pending', // FIXED: Use 'pending' instead of 'reported'
        timestamp: Timestamp.now(), // FIXED: Use Timestamp.now() instead of new Date()
      });

      toast({
        title: "Emergency Reported",
        description: "Your emergency report has been submitted successfully. Help is on the way!",
      });

      router.push('/driver-dashboard');
    } catch (error) {
      console.error('Error reporting emergency:', error);
      toast({
        title: "Error",
        description: "Failed to submit emergency report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button 
            onClick={() => router.back()} 
            variant="outline" 
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Emergency Report</h1>
            <p className="text-gray-600">Provide detailed information about the emergency</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-700">Emergency Details</CardTitle>
            <CardDescription>
              Fill out this form with as much detail as possible to help emergency responders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Location Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="font-medium text-blue-900">Location Information</h3>
                </div>
                {position ? (
                  <p className="text-sm text-blue-700">
                    Latitude: {position.coords.latitude.toFixed(6)}<br/>
                    Longitude: {position.coords.longitude.toFixed(6)}<br/>
                    <span className="text-xs text-blue-600">Location automatically detected</span>
                  </p>
                ) : (
                  <p className="text-sm text-red-600">Location not available. Please enable GPS.</p>
                )}
              </div>

              {/* Emergency Description */}
              <div>
                <Label htmlFor="description">Emergency Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                  placeholder="Describe what happened (e.g., car accident, medical emergency, etc.)"
                  rows={4}
                />
              </div>

              {/* Severity Level */}
              <div>
                <Label htmlFor="severity">Severity Level *</Label>
                <Select value={formData.severity} onValueChange={(value) => handleInputChange('severity', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor injuries, no immediate danger</SelectItem>
                    <SelectItem value="medium">Medium - Moderate injuries, some danger</SelectItem>
                    <SelectItem value="high">High - Serious injuries, significant danger</SelectItem>
                    <SelectItem value="critical">Critical - Life-threatening, immediate response needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="injuredCount">Number of Injured People</Label>
                  <Input
                    id="injuredCount"
                    type="number"
                    min="0"
                    value={formData.injuredCount}
                    onChange={(e) => handleInputChange('injuredCount', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="vehiclesInvolved">Vehicles Involved</Label>
                  <Input
                    id="vehiclesInvolved"
                    type="number"
                    min="1"
                    value={formData.vehiclesInvolved}
                    onChange={(e) => handleInputChange('vehiclesInvolved', e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Contact Number */}
              <div>
                <Label htmlFor="contactNumber">Contact Number *</Label>
                <Input
                  id="contactNumber"
                  type="tel"
                  value={formData.contactNumber}
                  onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                  required
                  placeholder="Your phone number"
                />
              </div>

              {/* Additional Information */}
              <div>
                <Label htmlFor="additionalInfo">Additional Information</Label>
                <Textarea
                  id="additionalInfo"
                  value={formData.additionalInfo}
                  onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                  placeholder="Any other relevant details (road conditions, landmarks, special circumstances, etc.)"
                  rows={3}
                />
              </div>

              {/* Emergency Contact Info */}
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Phone className="h-5 w-5 text-red-600 mr-2" />
                  <h3 className="font-medium text-red-900">Emergency Contacts (India)</h3>
                </div>
                <div className="text-sm text-red-700 space-y-1">
                  <p>• <strong>Police:</strong> 100</p>
                  <p>• <strong>Fire Brigade:</strong> 101</p>
                  <p>• <strong>Ambulance/Medical Emergency:</strong> 108</p>
                  <p>• <strong>Disaster Management:</strong> 108</p>
                  <p>• <strong>Women Helpline:</strong> 1091</p>
                  <p>• <strong>Child Helpline:</strong> 1098</p>
                  <p>• <strong>Tourist Helpline:</strong> 1363</p>
                  <p>• <strong>National Emergency Number:</strong> 112</p>
                  <p className="text-xs text-red-600 mt-2 font-medium">
                    For immediate life-threatening emergencies, call 108 (Ambulance) or 112 (National Emergency)
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3"
                size="lg"
                disabled={loading}
              >
                {loading ? 'Submitting Report...' : 'Submit Emergency Report'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
