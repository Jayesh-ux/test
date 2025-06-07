import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  GeoPoint
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  Accident,
  AccidentCreateData,
  Assignment,
  Hospital,
  HospitalAdmin
} from '@/types';

export class DatabaseService {
  // Accident operations
  static async createAccident(accidentData: AccidentCreateData) {
    try {
      const docRef = await addDoc(collection(db, 'accidents'), {
        ...accidentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating accident:', error);
      throw error;
    }
  }

  static async getAccident(accidentId: string): Promise<Accident | null> {
    try {
      const docRef = doc(db, 'accidents', accidentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Accident;
      }
      return null;
    } catch (error) {
      console.error('Error getting accident:', error);
      throw error;
    }
  }

  static async updateAccidentStatus(accidentId: string, status: Accident['status']) {
    try {
      const docRef = doc(db, 'accidents', accidentId);
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating accident status:', error);
      throw error;
    }
  }

  static async deleteAccident(accidentId: string) {
    try {
      console.log(`🔍 Starting delete process for accident: ${accidentId}`);
      
      // First check if accident can be deleted
      const accident = await this.getAccident(accidentId);
      if (!accident) {
        throw new Error('Accident not found');
      }
      
      console.log(`📋 Accident details:`, {
        id: accident.id,
        status: accident.status,
        reporterId: accident.reporterId,
        description: accident.description?.substring(0, 50) + '...'
      });
      
      // Allow deletion for pending and hospital_notified status
      const deletableStatuses = ['pending', 'hospital_notified'];
      if (!deletableStatuses.includes(accident.status)) {
        throw new Error(`Cannot delete accident with status: ${accident.status}. Only pending or hospital_notified accidents can be deleted.`);
      }
      
      console.log(`✅ Accident status ${accident.status} is deletable`);
      console.log(`🗑️ Proceeding to delete accident ${accidentId}`);
      
      // Delete the accident document
      const docRef = doc(db, 'accidents', accidentId);
      await deleteDoc(docRef);
      
      console.log(`✅ Successfully deleted accident document ${accidentId}`);
      
      // Also delete any related notifications if they exist
      try {
        console.log(`🔍 Looking for related notifications for accident ${accidentId}`);
        
        const notificationsQuery = query(
          collection(db, 'hospital_notifications'),
          where('accidentId', '==', accidentId)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        
        console.log(`📋 Found ${notificationsSnapshot.docs.length} related notifications`);
        
        // Delete all related notifications
        const deletePromises = notificationsSnapshot.docs.map(doc => {
          console.log(`🗑️ Deleting notification: ${doc.id}`);
          return deleteDoc(doc.ref);
        });
        await Promise.all(deletePromises);
        
        console.log(`✅ Successfully deleted accident ${accidentId} and ${notificationsSnapshot.docs.length} related notifications`);
      } catch (notificationError) {
        // If notifications don't exist or there's an error, just log it but don't fail the deletion
        console.log(`⚠️ Could not delete notifications for accident ${accidentId}:`, notificationError);
      }
      
    } catch (error) {
      console.error('❌ Error deleting accident:', error);
      throw error;
    }
  }

  static async getPendingAccidents(): Promise<Accident[]> {
    try {
      const q = query(
        collection(db, 'accidents'),
        where('status', '==', 'pending'),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Accident[];
    } catch (error) {
      console.error('Error getting pending accidents:', error);
      throw error;
    }
  }

  // New method for hospital dashboard
  static async getNearbyPendingAccidents(hospitalLocation: { latitude: number; longitude: number }, radiusKm: number = 50): Promise<Accident[]> {
    try {
      console.log('🔍 Searching for accidents near:', hospitalLocation, 'within', radiusKm, 'km');
      
      // Get all pending and hospital_notified accidents
      const q = query(
        collection(db, 'accidents'),
        where('status', 'in', ['pending', 'hospital_notified']),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);

      console.log('📋 Found total accidents with pending/hospital_notified status:', querySnapshot.docs.length);

      const allAccidents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Accident[];

      console.log('📋 All accidents:', allAccidents.map(acc => ({
        id: acc.id,
        status: acc.status,
        location: acc.location,
        description: acc.description?.substring(0, 50) + '...'
      })));

      // Filter by distance
      const nearbyAccidents = allAccidents.filter(accident => {
        if (!accident.location) {
          console.log('❌ Accident missing location:', accident.id);
          return false;
        }

        const distance = this.calculateDistance(
          hospitalLocation.latitude,
          hospitalLocation.longitude,
          accident.location.latitude,
          accident.location.longitude
        );

        console.log(`📏 Distance to accident ${accident.id}: ${distance.toFixed(2)} km`);

        return distance <= radiusKm;
      });

      console.log('🎯 Nearby accidents found:', nearbyAccidents.length);
      console.log('🎯 Nearby accidents details:', nearbyAccidents.map(acc => ({
        id: acc.id,
        status: acc.status,
        severity: acc.severity,
        description: acc.description?.substring(0, 50) + '...'
      })));

      return nearbyAccidents;
    } catch (error) {
      console.error('Error getting nearby pending accidents:', error);
      throw error;
    }
  }

  // Enhanced distance calculation with better precision for global coordinates (SINGLE IMPLEMENTATION)
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  // Helper method to convert degrees to radians
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Enhanced method to validate hospital location globally
  static async validateHospitalLocation(location: { latitude: number; longitude: number }): Promise<boolean> {
    // Basic validation for global coordinates
    const { latitude, longitude } = location;
    
    // Check if coordinates are within valid ranges
    if (latitude < -90 || latitude > 90) {
      console.error('❌ Invalid latitude:', latitude);
      return false;
    }
    
    if (longitude < -180 || longitude > 180) {
      console.error('❌ Invalid longitude:', longitude);
      return false;
    }
    
    // Check if coordinates are not null island (0,0)
    if (latitude === 0 && longitude === 0) {
      console.error('❌ Coordinates appear to be null island (0,0)');
      return false;
    }
    
    console.log('✅ Hospital location validation passed:', location);
    return true;
  }

  // Method to get hospitals by country/region for better organization
  static async getHospitalsByRegion(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): Promise<HospitalAdmin[]> {
    try {
      const hospitalsQuery = query(collection(db, 'hospital_admins'));
      const snapshot = await getDocs(hospitalsQuery);
      
      const hospitals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HospitalAdmin[];
      
      // Filter hospitals within bounds
      const hospitalsInRegion = hospitals.filter(hospital => {
        if (!hospital.hospitalLocation) return false;
        
        const { latitude, longitude } = hospital.hospitalLocation;
        return (
          latitude >= bounds.south &&
          latitude <= bounds.north &&
          longitude >= bounds.west &&
          longitude <= bounds.east
        );
      });
      
      console.log(`🏥 Found ${hospitalsInRegion.length} hospitals in region`);
      return hospitalsInRegion;
      
    } catch (error) {
      console.error('❌ Error getting hospitals by region:', error);
      throw error;
    }
  }

  // Hospital Admin operations
  static async getHospitalAdmin(userId: string): Promise<HospitalAdmin | null> {
    try {
      const docRef = doc(db, 'hospital_admins', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const adminData = { id: docSnap.id, ...docSnap.data() } as HospitalAdmin;
        
        // Also fetch the hospital data to get the location
        if (adminData.hospitalId) {
          const hospitalData = await this.getHospital(adminData.hospitalId);
          if (hospitalData && hospitalData.location) {
            // Add hospital location to admin data
            adminData.hospitalLocation = {
              latitude: hospitalData.location.latitude,
              longitude: hospitalData.location.longitude
            };
            
            console.log('🏥 Hospital admin with location:', {
              adminId: adminData.id,
              hospitalId: adminData.hospitalId,
              hospitalName: adminData.hospitalName,
              location: adminData.hospitalLocation
            });
          }
        }
        
        return adminData;
      }
      return null;
    } catch (error) {
      console.error('Error getting hospital admin:', error);
      return null;
    }
  }

  // Assignment operations
  static async getAssignmentsByAmbulanceDriver(driverId: string): Promise<Assignment[]> {
    try {
      const q = query(
        collection(db, 'assignments'),
        where('ambulanceDriverId', '==', driverId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];
    } catch (error) {
      console.error('Error getting assignments:', error);
      throw error;
    }
  }

  // Hospital operations
  static async getHospital(hospitalId: string): Promise<Hospital | null> {
    try {
      const docRef = doc(db, 'hospitals', hospitalId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Hospital;
      }
      return null;
    } catch (error) {
      console.error('Error getting hospital:', error);
      throw error;
    }
  }

  static async getAllHospitals(): Promise<Hospital[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'hospitals'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hospital[];
    } catch (error) {
      console.error('Error getting hospitals:', error);
      throw error;
    }
  }

  static async getNearbyHospitals(latitude: number, longitude: number, radiusKm: number = 50): Promise<Hospital[]> {
    try {
      // For now, get all hospitals and filter client-side
      // In production, you'd want to use GeoFirestore for proper geospatial queries
      const hospitals = await this.getAllHospitals();

      return hospitals.filter(hospital => {
        if (!hospital.location) return false;

        const distance = this.calculateDistance(
          latitude,
          longitude,
          hospital.location.latitude,
          hospital.location.longitude
        );

        return distance <= radiusKm;
      });
    } catch (error) {
      console.error('Error getting nearby hospitals:', error);
      throw error;
    }
  }

  // Add this method to get accidents by reporter
  static async getAccidentsByReporter(reporterId: string): Promise<Accident[]> {
    try {
      const q = query(
        collection(db, 'accidents'),
        where('reporterId', '==', reporterId),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Accident[];
    } catch (error) {
      console.error('Error getting accidents by reporter:', error);
      throw error;
    }
  }

  // Hospital notification methods
  static async createHospitalNotification(notificationData: {
    accidentId: string;
    hospitalId: string;
    type: string;
    status: string;
    distance: number;
  }) {
    try {
      const docRef = await addDoc(collection(db, 'hospital_notifications'), {
        ...notificationData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating hospital notification:', error);
      throw error;
    }
  }

  // Hospital response methods
  static async createHospitalResponse(responseData: {
    accidentId: string;
    hospitalId: string;
    hospitalName: string;
    status: 'accepted' | 'rejected';
    availableBeds: number;
    estimatedArrivalTime: number;
    specialtyServices?: string[];
    rejectionReason?: string;
  }) {
    try {
      const docRef = await addDoc(collection(db, 'hospital_responses'), {
        ...responseData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If accepted, update accident status
      if (responseData.status === 'accepted') {
        await this.updateAccidentStatus(responseData.accidentId, 'hospital_accepted');
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating hospital response:', error);
      throw error;
    }
  }

  // Ambulance notification methods
  static async notifyAmbulanceDrivers(accidentId: string, hospitalId: string) {
    try {
      // Get all ambulance drivers (in a real app, you'd filter by location/availability)
      const driversQuery = query(collection(db, 'ambulance_drivers'));
      const driversSnapshot = await getDocs(driversQuery);

      const notificationPromises = driversSnapshot.docs.map(driverDoc => 
        addDoc(collection(db, 'ambulance_notifications'), {
          accidentId,
          hospitalId,
          ambulanceDriverId: driverDoc.id,
          type: 'emergency_assignment',
          status: 'pending',
          createdAt: serverTimestamp(),
        })
      );

      await Promise.all(notificationPromises);
      console.log(`✅ Notified ${driversSnapshot.docs.length} ambulance drivers`);
    } catch (error) {
      console.error('Error notifying ambulance drivers:', error);
      throw error;
    }
  }

  // Debug method for hospital location
  static async debugHospitalLocation(hospitalAdminId: string) {
    try {
      const hospitalAdmin = await this.getHospitalAdmin(hospitalAdminId);
      if (hospitalAdmin) {
        console.log('🏥 Hospital Admin Location:', {
          hospitalName: hospitalAdmin.hospitalName,
          location: hospitalAdmin.hospitalLocation,
          latitude: hospitalAdmin.hospitalLocation?.latitude,
          longitude: hospitalAdmin.hospitalLocation?.longitude
        });
        return hospitalAdmin.hospitalLocation;
      }
      return null;
    } catch (error) {
      console.error('Error debugging hospital location:', error);
      return null;
    }
  }

  // Additional methods that might be referenced in other parts of the app
  static async getHospitalAcceptedEmergencies(): Promise<Array<{
    accident: Accident;
    hospitalResponse: any;
  }>> {
    try {
      // Get accidents that hospitals have accepted
      const q = query(
        collection(db, 'accidents'),
        where('status', '==', 'hospital_accepted'),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);

      const emergencies = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const accident = { id: doc.id, ...doc.data() } as Accident;
          
          // Get hospital response for this accident
          const responseQuery = query(
            collection(db, 'hospital_responses'),
            where('accidentId', '==', accident.id),
            where('status', '==', 'accepted')
          );
          const responseSnapshot = await getDocs(responseQuery);
          
          const hospitalResponse = responseSnapshot.docs[0]?.data() || {
            hospitalId: 'temp-id',
            hospitalName: 'Emergency Hospital',
            availableBeds: 5,
            estimatedArrivalTime: 15,
            specialtyServices: ['Emergency Care']
          };

          return {
            accident,
            hospitalResponse
          };
        })
      );

      return emergencies;
    } catch (error) {
      console.error('Error getting hospital accepted emergencies:', error);
      throw error;
    }
  }

  static async createAssignment(assignmentData: {
    accidentId: string;
    ambulanceDriverId: string;
    hospitalId: string;
    status: string;
    estimatedArrivalTime: number;
    driverLocation: { latitude: number; longitude: number };
  }) {
    try {
      console.log('🚑 Creating assignment with data:', assignmentData);
      
      const docRef = await addDoc(collection(db, 'assignments'), {
        ...assignmentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Assignment created successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating assignment:', error);
      throw error;
    }
  }

  static async updateAssignmentStatus(assignmentId: string, status: string) {
    try {
      const docRef = doc(db, 'assignments', assignmentId);
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating assignment status:', error);
      throw error;
    }
  }

  static async notifyAssignmentAccepted(assignmentId: string, accidentId: string, hospitalId: string) {
    try {
      // Create notifications for hospital and accident reporter
      await addDoc(collection(db, 'notifications'), {
        type: 'assignment_accepted',
        assignmentId,
        accidentId,
        hospitalId,
        message: 'Ambulance driver has accepted the emergency assignment',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error notifying assignment accepted:', error);
      throw error;
    }
  }

  static async recordAmbulanceRejection(rejectionData: {
    accidentId: string;
    ambulanceDriverId: string;
    rejectionReason: string;
    timestamp: Date;
  }) {
    try {
      const docRef = await addDoc(collection(db, 'ambulance_rejections'), {
        ...rejectionData,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error recording ambulance rejection:', error);
      throw error;
    }
  }

  // Additional utility methods
  static async getHospitalByAdminId(adminId: string): Promise<Hospital | null> {
    try {
      const hospitalAdmin = await this.getHospitalAdmin(adminId);
      if (hospitalAdmin && hospitalAdmin.hospitalId) {
        return await this.getHospital(hospitalAdmin.hospitalId);
      }
      return null;
    } catch (error) {
      console.error('Error getting hospital by admin ID:', error);
      throw error;
    }
  }

  static async updateHospitalBeds(hospitalId: string, availableBeds: number) {
    try {
      const docRef = doc(db, 'hospitals', hospitalId);
      await updateDoc(docRef, {
        availableBeds,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating hospital beds:', error);
      throw error;
    }
  }

  // Get hospital responses for a specific accident
  static async getHospitalResponsesForAccident(accidentId: string) {
    try {
      const q = query(
        collection(db, 'hospital_responses'),
        where('accidentId', '==', accidentId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting hospital responses:', error);
      throw error;
    }
  }

  // Get ambulance notifications for a specific driver
  static async getAmbulanceNotifications(driverId: string) {
    try {
      const q = query(
        collection(db, 'ambulance_notifications'),
        where('ambulanceDriverId', '==', driverId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting ambulance notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markNotificationAsRead(notificationId: string, collection_name: string = 'ambulance_notifications') {
    try {
      const docRef = doc(db, collection_name, notificationId);
      await updateDoc(docRef, {
        status: 'read',
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get statistics for dashboard
  static async getEmergencyStats() {
    try {
      const [pendingSnapshot, inProgressSnapshot, completedSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'accidents'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'accidents'), where('status', 'in', ['assigned', 'in_progress']))),
        getDocs(query(collection(db, 'accidents'), where('status', '==', 'completed')))
      ]);

      return {
        pending: pendingSnapshot.size,
        inProgress: inProgressSnapshot.size,
        completed: completedSnapshot.size,
        total: pendingSnapshot.size + inProgressSnapshot.size + completedSnapshot.size
      };
    } catch (error) {
      console.error('Error getting emergency stats:', error);
      return { pending: 0, inProgress: 0, completed: 0, total: 0 };
    }
  }

  // Cleanup old notifications (utility method)
  static async cleanupOldNotifications(daysOld: number = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const collections_to_clean = ['hospital_notifications', 'ambulance_notifications', 'notifications'];
      
      for (const collection_name of collections_to_clean) {
        const q = query(
          collection(db, collection_name),
          where('createdAt', '<', cutoffDate)
        );
        const snapshot = await getDocs(q);
        
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        console.log(`🧹 Cleaned up ${snapshot.size} old notifications from ${collection_name}`);
      }
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  static async createNotification(notificationData: {
    type: string;
    message: string;
    accidentId?: string;
    recipientId?: string;
    assignmentId?: string;
  }) {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...notificationData,
        status: 'unread',
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  static async updateAssignmentLocation(
    assignmentId: string, 
    location: { latitude: number; longitude: number }
  ) {
    try {
      const docRef = doc(db, 'assignments', assignmentId);
      await updateDoc(docRef, {
        driverLocation: location,
        lastLocationUpdate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating assignment location:', error);
      throw error;
    }
  }

  static async getAssignmentWithDetails(assignmentId: string) {
    try {
      const assignmentDoc = await getDoc(doc(db, 'assignments', assignmentId));
      if (!assignmentDoc.exists()) return null;

      const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() } as Assignment;
      
      // Get related accident and hospital data
      const [accident, hospital] = await Promise.all([
        this.getAccident(assignment.accidentId),
        this.getHospital(assignment.hospitalId)
      ]);

      return {
        assignment,
        accident,
        hospital
      };
    } catch (error) {
      console.error('Error getting assignment details:', error);
      throw error;
    }
  }

  static async notifyArrival(
    assignmentId: string, 
    accidentId: string, 
    phase: 'accident' | 'hospital'
  ) {
    try {
      const accident = await this.getAccident(accidentId);
      if (!accident) return;

      const message = phase === 'accident' 
        ? 'Ambulance has arrived at the scene'
        : 'Patient has been delivered to the hospital';

      // Notify the reporter
      await this.createNotification({
        type: `ambulance_${phase}_arrival`,
        message,
        accidentId,
        assignmentId,
        recipientId: accident.reporterId,
      });

      // If hospital arrival, also notify hospital
      if (phase === 'hospital') {
        const assignment = await this.getAssignmentWithDetails(assignmentId);
        if (assignment?.hospital) {
          await this.createNotification({
            type: 'patient_delivered',
            message: `Patient from accident ${accidentId} has been delivered`,
            accidentId,
            assignmentId,
            recipientId: assignment.hospital.id,
          });
        }
      }
    } catch (error) {
      console.error('Error sending arrival notification:', error);
      throw error;
    }
  }

  static async addAssignmentCancellationReason(assignmentId: string, reason: string) {
    try {
      const docRef = doc(db, 'assignments', assignmentId);
      await updateDoc(docRef, {
        cancellationReason: reason,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding cancellation reason:', error);
      throw error;
    }
  }

  static async notifyAssignmentCancellation(assignmentId: string, accidentId: string, reason: string) {
    try {
      // Get assignment details with proper typing
      const assignment = await this.getAssignment(assignmentId);
      if (!assignment) return;

      // Notify hospital
      await addDoc(collection(db, 'hospital_notifications'), {
        hospitalId: assignment.hospitalId,
        accidentId: accidentId,
        assignmentId: assignmentId,
        type: 'assignment_cancelled',
        title: 'Ambulance Assignment Cancelled',
        message: `Ambulance driver cancelled assignment due to: ${reason}. Emergency is now available for other ambulances.`,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      // Notify other ambulance drivers that this emergency is available again
      await addDoc(collection(db, 'ambulance_notifications'), {
        accidentId: accidentId,
        type: 'emergency_available_again',
        title: 'Emergency Available Again',
        message: `An emergency is now available again due to ambulance cancellation. Check available emergencies.`,
        isRead: false,
        createdAt: serverTimestamp(),
      });

    } catch (error) {
      console.error('Error notifying assignment cancellation:', error);
      throw error;
    }
  }

  static async getAssignment(assignmentId: string): Promise<Assignment | null> {
    try {
      const docRef = doc(db, 'assignments', assignmentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Assignment;
      }
      return null;
    } catch (error) {
      console.error('Error getting assignment:', error);
      throw error;
    }
  }
}
