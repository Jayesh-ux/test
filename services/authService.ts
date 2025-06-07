import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  collection, 
  serverTimestamp,
  GeoPoint 
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { 
  User, 
  VehicleDriverData, 
  AmbulanceDriverData, 
  HospitalAdminData 
} from '@/types';

export class AuthService {
  static async registerUser(userData: VehicleDriverData | AmbulanceDriverData | HospitalAdminData) {
    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        userData.email, 
        userData.password
      );
      
      const user = userCredential.user;
      
      // Create user document
      const userDoc: Omit<User, 'id'> = {
        name: userData.name,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        role: userData.role,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any, // Add updatedAt
      };
      
      await setDoc(doc(db, 'users', user.uid), userDoc);
      
      // Create role-specific document
      switch (userData.role) {
        case 'vehicle_driver':
          const vehicleData = userData as VehicleDriverData;
          await setDoc(doc(db, 'vehicle_drivers', user.uid), {
            userId: user.uid,
            name: vehicleData.name,
            vehicleNumber: vehicleData.vehicleNumber,
            vehicleType: vehicleData.vehicleType,
            emergencyContactNumber: vehicleData.emergencyContactNumber,
            clinicalHistory: vehicleData.clinicalHistory || '',
            createdAt: serverTimestamp(),
          });
          break;
          
        case 'ambulance_driver':
          const ambulanceData = userData as AmbulanceDriverData;
          await setDoc(doc(db, 'ambulance_drivers', user.uid), {
            userId: user.uid,
            name: ambulanceData.name,
            vehicleNumber: ambulanceData.vehicleNumber,
            createdAt: serverTimestamp(),
          });
          break;
          
        case 'hospital_admin':
          const hospitalAdminData = userData as HospitalAdminData;
          
          // Create hospital document
          const hospitalDoc = await addDoc(collection(db, 'hospitals'), {
            name: hospitalAdminData.hospitalName,
            address: hospitalAdminData.hospitalAddress,
            phoneNumber: hospitalAdminData.hospitalPhoneNumber,
            location: new GeoPoint(
              hospitalAdminData.hospitalLatitude,
              hospitalAdminData.hospitalLongitude
            ),
            capacity: 100, // Default capacity
            availableBeds: 50, // Default available beds
            specialties: [], // Default empty specialties
            createdAt: serverTimestamp(),
          });
          
          // Create hospital admin document
          await setDoc(doc(db, 'hospital_admins', user.uid), {
            userId: user.uid,
            name: hospitalAdminData.name,
            hospitalId: hospitalDoc.id,
            hospitalName: hospitalAdminData.hospitalName, // Add these fields
            hospitalAddress: hospitalAdminData.hospitalAddress,
            hospitalPhoneNumber: hospitalAdminData.hospitalPhoneNumber,
            createdAt: serverTimestamp(),
          });
          break;
      }
      
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  static async loginUser(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  static async logoutUser() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  static async getCurrentUserData(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }
}
