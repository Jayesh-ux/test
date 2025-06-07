'use client';

import { useState, useCallback } from 'react';
import { EmergencyAlertState } from '@/types';
import { DatabaseService } from '@/services/databaseService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { serverTimestamp } from 'firebase/firestore';

export function useEmergencyAlert() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [state, setState] = useState<EmergencyAlertState>({
    isReporting: false,
    isEmergencyActive: false,
    accidentId: null,
  });

  const reportEmergency = useCallback(async (emergencyData: {
    location: { latitude: number; longitude: number };
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    injuredCount: number;
    vehiclesInvolved: number;
    additionalInfo?: string;
    contactNumber: string;
  }) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to report an emergency.",
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, isReporting: true }));

    try {
      console.log('🚨 Reporting emergency:', emergencyData);
      
      // Create accident record
      const accidentId = await DatabaseService.createAccident({
        reporterId: user.id,
        location: emergencyData.location,
        description: emergencyData.description,
        severity: emergencyData.severity,
        injuredCount: emergencyData.injuredCount,
        vehiclesInvolved: emergencyData.vehiclesInvolved,
        additionalInfo: emergencyData.additionalInfo,
        contactNumber: emergencyData.contactNumber,
        status: 'pending',
        timestamp: serverTimestamp() as any,
      });

      console.log('✅ Emergency created with ID:', accidentId);

      // Notify nearby hospitals automatically
      await notifyNearbyHospitals(accidentId, emergencyData.location);

      setState({
        isReporting: false,
        isEmergencyActive: true,
        accidentId,
      });

      toast({
        title: "Emergency Reported Successfully! 🚨",
        description: "Your emergency has been reported and nearby hospitals have been notified. Help is on the way!",
      });

      return accidentId;
    } catch (error) {
      console.error('❌ Error reporting emergency:', error);
      setState(prev => ({ ...prev, isReporting: false }));
      
      toast({
        title: "Error Reporting Emergency",
        description: "Failed to report emergency. Please try again or call 911 directly.",
        variant: "destructive",
      });
      
      throw error;
    }
  }, [user, toast]);

  const notifyNearbyHospitals = async (accidentId: string, location: { latitude: number; longitude: number }) => {
    try {
      console.log('🏥 Notifying nearby hospitals for accident:', accidentId);
      
      // Get nearby hospitals (within 50km)
      const nearbyHospitals = await DatabaseService.getNearbyHospitals(
        location.latitude, 
        location.longitude, 
        50
      );

      console.log(`📍 Found ${nearbyHospitals.length} nearby hospitals`);

      if (nearbyHospitals.length > 0) {
        // Update accident status to indicate hospitals have been notified
        await DatabaseService.updateAccidentStatus(accidentId, 'hospital_notified');

        // Create hospital notifications
        const notificationPromises = nearbyHospitals.map(hospital => 
          DatabaseService.createHospitalNotification({
            accidentId,
            hospitalId: hospital.id,
            type: 'emergency_nearby',
            status: 'pending',
            distance: DatabaseService.calculateDistance(
              location.latitude,
              location.longitude,
              hospital.location.latitude,
              hospital.location.longitude
            )
          })
        );

        await Promise.all(notificationPromises);
        console.log(`✅ Successfully notified ${nearbyHospitals.length} hospitals`);
      } else {
        console.log('⚠️ No nearby hospitals found');
        // Keep status as 'pending' if no hospitals found
      }
    } catch (error) {
      console.error('❌ Error notifying hospitals:', error);
      // Don't throw here - emergency is still reported even if hospital notification fails
    }
  };

  const clearEmergencyState = useCallback(() => {
    setState({
      isReporting: false,
      isEmergencyActive: false,
      accidentId: null,
    });
  }, []);

  return {
    state,
    reportEmergency,
    clearEmergencyState,
  };
}
