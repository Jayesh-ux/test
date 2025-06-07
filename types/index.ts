import { Timestamp } from 'firebase/firestore';

// User types
export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: 'vehicle_driver' | 'ambulance_driver' | 'hospital_admin';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Location type
export interface Location {
  latitude: number;
  longitude: number;
}

// Vehicle Driver types
export interface VehicleDriver {
  id: string;
  userId: string;
  name: string;
  vehicleNumber: string;
  vehicleType: string;
  emergencyContactNumber: string;
  clinicalHistory?: string;
  createdAt: Timestamp;
}

export interface VehicleDriverData {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: 'vehicle_driver';
  vehicleNumber: string;
  vehicleType: string;
  emergencyContactNumber: string;
  clinicalHistory?: string;
}

// Ambulance Driver types
export interface AmbulanceDriver {
  id: string;
  userId: string;
  name: string;
  vehicleNumber: string;
  createdAt: Timestamp;
}

export interface AmbulanceDriverData {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: 'ambulance_driver';
  vehicleNumber: string;
}

// Hospital types
export interface Hospital {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  location: Location;
  availableBeds: number;
  totalBeds: number;
  specialtyServices: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HospitalAdmin {
  id: string;
  userId: string;
  name: string;
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhoneNumber: string;
  hospitalLocation: Location;
  specialtyServices?: string[];
  createdAt: Timestamp;
}

export interface HospitalAdminData {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: 'hospital_admin';
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhoneNumber: string;
  hospitalLocation: Location;
  specialtyServices?: string[];
  hospitalLatitude: number;
  hospitalLongitude: number;
}

// Accident types
export interface Accident {
  id: string;
  reporterId: string;
  location: Location;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'hospital_notified' | 'hospital_accepted' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  injuredCount: number;
  vehiclesInvolved: number;
  additionalInfo?: string;
  contactNumber: string;
  timestamp: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AccidentCreateData {
  reporterId: string;
  location: Location;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  injuredCount: number;
  vehiclesInvolved: number;
  additionalInfo?: string;
  contactNumber: string;
  status: 'pending';
  timestamp: Timestamp;
}

// Assignment types
export interface Assignment {
  id: string;
  accidentId: string;
  ambulanceDriverId: string;
  hospitalId: string;
  status: 'accepted' | 'en_route' | 'arrived' | 'completed' | 'cancelled';
  estimatedArrivalTime?: number;
  driverLocation?: {
    latitude: number;
    longitude: number;
  };
  cancellationReason?: string;
  cancelledAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AssignmentCreateData {
  accidentId: string;
  ambulanceDriverId: string;
  hospitalId: string;
  status: 'accepted';
  estimatedArrivalTime?: number;
  driverLocation?: Location;
}

// NEW TYPES for Hospital Response System
export interface HospitalResponse {
  id: string;
  accidentId: string;
  hospitalId: string;
  hospitalAdminId: string;
  hospitalName: string;
  status: 'accepted' | 'rejected';
  availableBeds?: number;
  estimatedArrivalTime?: number;
  specialtyServices?: string[];
  rejectionReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HospitalResponseCreateData {
  accidentId: string;
  hospitalId: string;
  hospitalAdminId: string;
  hospitalName?: string;
  status: 'accepted' | 'rejected';
  availableBeds?: number;
  estimatedArrivalTime?: number;
  specialtyServices?: string[];
  rejectionReason?: string;
}

export interface AmbulanceRejection {
  accidentId: string;
  ambulanceDriverId: string;
  rejectionReason: string;
  timestamp: Date;
}

// Emergency Alert State (from existing codebase)
export interface EmergencyAlertState {
  isReporting: boolean;
  isEmergencyActive: boolean;
  accidentId: string | null;
}

// Emergency Modal Props (from existing codebase)
export interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    location: { latitude: number; longitude: number };
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    injuredCount: number;
    vehiclesInvolved: number;
    additionalInfo?: string;
    contactNumber: string;
  }) => Promise<void>;
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface EmergencyReportData {
  location: Location;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Geolocation types
export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: VehicleDriverData | AmbulanceDriverData | HospitalAdminData) => Promise<void>;
  logout: () => Promise<void>;
}

// Notification interfaces
export interface HospitalNotification {
  id: string;
  accidentId: string;
  hospitalId: string;
  type: string;
  status: string;
  distance: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AmbulanceNotification {
  id: string;
  accidentId: string;
  hospitalId: string;
  ambulanceDriverId: string;
  type: string;
  status: string;
  createdAt: Timestamp;
}
