import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export class NotificationService {
  // Notify vehicle driver
  static async notifyVehicleDriver(
    driverId: string, 
    message: string, 
    type: string
  ) {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: driverId,
        message,
        type,
        status: 'unread',
        priority: 'normal',
        createdAt: serverTimestamp(),
      });
      console.log('✅ Vehicle driver notified:', driverId);
    } catch (error) {
      console.error('❌ Error notifying vehicle driver:', error);
      throw error;
    }
  }

  // Notify hospital
  static async notifyHospital(
    hospitalId: string, 
    message: string, 
    type: string
  ) {
    try {
      await addDoc(collection(db, 'hospital_notifications'), {
        hospitalId,
        message,
        type,
        status: 'unread',
        priority: 'normal',
        createdAt: serverTimestamp(),
      });
      console.log('✅ Hospital notified:', hospitalId);
    } catch (error) {
      console.error('❌ Error notifying hospital:', error);
      throw error;
    }
  }

  // Get user notifications
  static async getUserNotifications(userId: string) {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ Error getting user notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string) {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, {
        status: 'read',
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  // Get hospital notifications
  static async getHospitalNotifications(hospitalId: string) {
    try {
      const q = query(
        collection(db, 'hospital_notifications'),
        where('hospitalId', '==', hospitalId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ Error getting hospital notifications:', error);
      return [];
    }
  }

  // Notify ambulance driver
  static async notifyAmbulanceDriver(
    driverId: string, 
    message: string, 
    type: string
  ) {
    try {
      await addDoc(collection(db, 'ambulance_notifications'), {
        ambulanceDriverId: driverId,
        message,
        type,
        status: 'unread',
        priority: 'normal',
        createdAt: serverTimestamp(),
      });
      console.log('✅ Ambulance driver notified:', driverId);
    } catch (error) {
      console.error('❌ Error notifying ambulance driver:', error);
      throw error;
    }
  }
}