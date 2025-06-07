'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Assignment, Accident } from '@/types';
import { DatabaseService } from '@/services/databaseService';
import { NotificationService } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TrackingState {
  assignment: Assignment | null;
  accident: Accident | null;
  currentLocation: { latitude: number; longitude: number } | null;
  destination: { latitude: number; longitude: number } | null;
  phase: 'to_accident' | 'to_hospital' | 'completed';
  distance: number;
  eta: number;
  isNearDestination: boolean;
}

export function useAssignmentTracking(assignmentId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<TrackingState>({
    assignment: null,
    accident: null,
    currentLocation: null,
    destination: null,
    phase: 'to_accident',
    distance: 0,
    eta: 0,
    isNearDestination: false,
  });
  
  const [loading, setLoading] = useState(true);
  const watchId = useRef<number | null>(null);
  const locationUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Load assignment and accident data
  const loadAssignmentData = useCallback(async () => {
    if (!user || !assignmentId) {
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Loading assignment data for ID:', assignmentId);
      console.log('👤 Current user:', user.id);

      // Get all assignments for this ambulance driver
      const assignments = await DatabaseService.getAssignmentsByAmbulanceDriver(user.id);
      console.log('📋 Found assignments:', assignments.length);

      // Find the specific assignment
      const assignment = assignments.find(a => a.id === assignmentId);
      
      if (!assignment) {
        console.error('❌ Assignment not found. Available assignments:', assignments.map(a => a.id));
        throw new Error(`Assignment ${assignmentId} not found for user ${user.id}`);
      }

      console.log('✅ Assignment found:', assignment);

      // Get the accident details
      const accident = await DatabaseService.getAccident(assignment.accidentId);
      if (!accident) {
        throw new Error('Accident not found');
      }

      console.log('✅ Accident found:', accident);

      // Determine phase and destination based on assignment status
      let phase: 'to_accident' | 'to_hospital' | 'completed' = 'to_accident';
      let destination = accident.location;

      if (assignment.status === 'arrived') {
        // Driver has arrived at accident, now going to hospital
        const hospital = await DatabaseService.getHospital(assignment.hospitalId);
        if (hospital) {
          phase = 'to_hospital';
          destination = hospital.location;
          console.log('🏥 Phase: to_hospital, destination:', hospital.name);
        }
      } else if (assignment.status === 'completed') {
        phase = 'completed';
        console.log('✅ Assignment completed');
      } else {
        console.log('🚨 Phase: to_accident');
      }

      setState(prev => ({
        ...prev,
        assignment,
        accident,
        destination,
        phase,
      }));

      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading assignment data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load assignment details",
        variant: "destructive",
      });
      setLoading(false);
    }
  }, [assignmentId, user, toast]);

  // Calculate distance and ETA
  const calculateDistanceAndETA = useCallback((
    current: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    const distance = DatabaseService.calculateDistance(
      current.latitude,
      current.longitude,
      destination.latitude,
      destination.longitude
    );

    // Estimate ETA (assuming average speed of 40 km/h in city)
    const eta = Math.round((distance / 40) * 60); // in minutes

    return { distance, eta };
  }, []);

  // Check if near destination (within 100 meters)
  const checkProximity = useCallback((
    current: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    const distance = DatabaseService.calculateDistance(
      current.latitude,
      current.longitude,
      destination.latitude,
      destination.longitude
    );
    
    return distance <= 0.1; // 100 meters in km
  }, []);

  // Handle auto-arrival detection
  const handleAutoArrival = useCallback(async (assignment: Assignment, currentPhase: string) => {
    try {
      if (currentPhase === 'to_accident') {
        // Auto-arrived at accident scene
        await DatabaseService.updateAssignmentStatus(assignment.id, 'arrived');
        await DatabaseService.updateAccidentStatus(assignment.accidentId, 'in_progress');
        
        // Send notification to vehicle driver
        if (state.accident?.reporterId) {
          await NotificationService.notifyVehicleDriver(
            state.accident.reporterId,
            'Ambulance has arrived at the scene. Help is here!',
            'ambulance_arrived'
          );
        }

        toast({
          title: "🚑 Arrived at Scene",
          description: "Auto-detected arrival. Vehicle driver has been notified.",
        });

      } else if (currentPhase === 'to_hospital') {
        // Auto-arrived at hospital
        await DatabaseService.updateAssignmentStatus(assignment.id, 'completed');
        await DatabaseService.updateAccidentStatus(assignment.accidentId, 'completed');
        
        // Notify hospital and vehicle driver
        const notifications = [];
        
        notifications.push(
          NotificationService.notifyHospital(
            assignment.hospitalId,
            'Patient has been delivered to the hospital',
            'patient_delivered'
          )
        );

        if (state.accident?.reporterId) {
          notifications.push(
            NotificationService.notifyVehicleDriver(
              state.accident.reporterId,
              'Patient has been safely delivered to the hospital',
              'patient_delivered'
            )
          );
        }

        await Promise.all(notifications);

        toast({
          title: "🏥 Delivered to Hospital",
          description: "Assignment completed successfully!",
        });
      }
    } catch (error) {
      console.error('Error in auto-arrival detection:', error);
    }
  }, [state.accident?.reporterId, toast]);

  // Handle location updates
  const handleLocationUpdate = useCallback(async (position: GeolocationPosition) => {
    const currentLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    console.log('📍 Location updated:', currentLocation);

    setState(prev => {
      if (!prev.destination) return prev;

      const { distance, eta } = calculateDistanceAndETA(currentLocation, prev.destination);
      const isNearDestination = checkProximity(currentLocation, prev.destination);

      // Auto-detect arrival and trigger notifications
      if (isNearDestination && !prev.isNearDestination && prev.assignment) {
        console.log('🎯 Near destination detected, triggering auto-arrival');
        handleAutoArrival(prev.assignment, prev.phase);
      }

      return {
        ...prev,
        currentLocation,
        distance,
        eta,
        isNearDestination,
      };
    });
  }, [calculateDistanceAndETA, checkProximity, handleAutoArrival]);

  // Start location tracking
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: "Location Not Available",
        description: "Geolocation is not supported by this browser",
        variant: "destructive",
      });
      return;
    }

    console.log('📍 Starting location tracking...');

    // Watch position with high accuracy
    watchId.current = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: "Location Error",
          description: "Unable to track your location. Please check GPS settings.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    // Also update location every 30 seconds
    locationUpdateInterval.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handleLocationUpdate,
        (error) => console.error('Location update error:', error),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }, 30000);
  }, [handleLocationUpdate, toast]);

  // Progress to next phase
  const progressToNextPhase = useCallback(async () => {
    if (!state.assignment) return;

    try {
      console.log('⏭️ Progressing to next phase from:', state.phase);

      if (state.phase === 'to_accident') {
        // Move to hospital phase
        await DatabaseService.updateAssignmentStatus(state.assignment.id, 'arrived');
        
        // Get hospital location
        const hospital = await DatabaseService.getHospital(state.assignment.hospitalId);
        if (hospital) {
          setState(prev => ({
            ...prev,
            phase: 'to_hospital',
            destination: hospital.location,
            isNearDestination: false,
          }));

          // Notify that patient is being transported
          const notifications = [];
          
          if (state.accident?.reporterId) {
            notifications.push(
              NotificationService.notifyVehicleDriver(
                state.accident.reporterId,
                'Patient is being transported to the hospital',
                'ambulance_enroute'
              )
            );
          }

          notifications.push(
            NotificationService.notifyHospital(
              state.assignment.hospitalId,
              'Ambulance is en route with patient',
              'ambulance_enroute'
            )
          );

          await Promise.all(notifications);
        }

        toast({
          title: "Phase Updated",
          description: "Now heading to hospital with patient",
        });

      } else if (state.phase === 'to_hospital') {
        // Complete assignment
        await DatabaseService.updateAssignmentStatus(state.assignment.id, 'completed');
        await DatabaseService.updateAccidentStatus(state.assignment.accidentId, 'completed');

        setState(prev => ({
          ...prev,
          phase: 'completed',
        }));

        // Send completion notifications
        const notifications = [];
        
        notifications.push(
          NotificationService.notifyHospital(
            state.assignment.hospitalId,
            'Patient has been delivered successfully',
            'patient_delivered'
          )
        );

        if (state.accident?.reporterId) {
          notifications.push(
            NotificationService.notifyVehicleDriver(
              state.accident.reporterId,
              'Patient has been safely delivered to the hospital',
              'patient_delivered'
            )
          );
        }

        await Promise.all(notifications);

        toast({
          title: "Assignment Completed! 🎉",
          description: "Patient successfully delivered to hospital",
        });
      }
    } catch (error) {
      console.error('Error progressing phase:', error);
      toast({
        title: "Error",
        description: "Failed to update assignment status",
        variant: "destructive",
      });
    }
  }, [state.assignment, state.phase, state.accident?.reporterId, toast]);

  // Initialize tracking
  useEffect(() => {
    if (assignmentId) {
      loadAssignmentData();
    }
  }, [loadAssignmentData, assignmentId]);

  // Start location tracking when assignment is loaded
  useEffect(() => {
    if (state.assignment && !loading) {
      startLocationTracking();
    }

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (locationUpdateInterval.current) {
        clearInterval(locationUpdateInterval.current);
        locationUpdateInterval.current = null;
      }
    };
  }, [state.assignment, loading, startLocationTracking]);

  return {
    assignment: state.assignment,
    accident: state.accident,
    currentLocation: state.currentLocation,
    destination: state.destination,
    phase: state.phase,
    distance: state.distance,
    eta: state.eta,
    isNearDestination: state.isNearDestination,
    loading,
    progressToNextPhase,
  };
}
