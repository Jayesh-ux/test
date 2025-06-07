'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Truck, 
  Heart, 
  Building2, 
  Shield, 
  Clock, 
  MapPin,
  Phone,
  Users
} from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Redirect based on user role
      switch (user.role) {
        case 'vehicle_driver':
          router.push('/driver-dashboard');
          break;
        case 'ambulance_driver':
          router.push('/ambulance-dashboard');
          break;
        case 'hospital_admin':
          router.push('/hospital-dashboard');
          break;
        default:
          console.error('Unknown user role:', user.role);
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-200 border-t-red-600 mx-auto"></div>
            <Heart className="absolute inset-0 m-auto h-6 w-6 text-red-600 animate-pulse" />
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading Emergency System...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-200 border-t-red-600 mx-auto"></div>
            <Heart className="absolute inset-0 m-auto h-6 w-6 text-red-600 animate-pulse" />
          </div>
          <p className="mt-6 text-slate-600 font-medium">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-red-600 p-2 rounded-xl">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">EmergencyDispatch</span>
            </div>
            <Link href="/login">
              <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center bg-red-100 text-red-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Shield className="h-4 w-4 mr-2" />
            Emergency Response System
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
            Rapid Response for
            <span className="text-red-600 block">Life-Saving Care</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            Connect drivers, ambulances, and hospitals in real-time for faster emergency response 
            and better patient outcomes during critical situations.
          </p>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-md mx-auto mb-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">24/7</div>
              <div className="text-sm text-slate-600">Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">&lt;5min</div>
              <div className="text-sm text-slate-600">Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">100%</div>
              <div className="text-sm text-slate-600">Reliable</div>
            </div>
          </div>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Vehicle Driver Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10 group-hover:from-blue-500/10 group-hover:to-blue-600/20 transition-all duration-300"></div>
            <CardContent className="relative p-8">
              <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Truck className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Vehicle Driver</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Report accidents instantly and get immediate emergency assistance with real-time location tracking.
              </p>
              <div className="space-y-3">
                <Link href="/register?role=vehicle_driver" className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all duration-200">
                    Get Started
                  </Button>
                </Link>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 font-medium py-3 rounded-xl transition-all duration-200">
                    Sign In
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex items-center text-sm text-slate-500">
                <Clock className="h-4 w-4 mr-2" />
                Instant emergency reporting
              </div>
            </CardContent>
          </Card>

          {/* Ambulance Driver Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/10 group-hover:from-red-500/10 group-hover:to-red-600/20 transition-all duration-300"></div>
            <CardContent className="relative p-8">
              <div className="bg-red-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Heart className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Ambulance Driver</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Receive emergency calls with precise locations and respond quickly to save lives in critical situations.
              </p>
              <div className="space-y-3">
                <Link href="/register?role=ambulance_driver" className="block">
                  <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition-all duration-200">
                    Join as Responder
                  </Button>
                </Link>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50 font-medium py-3 rounded-xl transition-all duration-200">
                    Sign In
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex items-center text-sm text-slate-500">
                <MapPin className="h-4 w-4 mr-2" />
                GPS-enabled dispatch system
              </div>
            </CardContent>
          </Card>

          {/* Hospital Admin Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 group-hover:from-emerald-500/10 group-hover:to-emerald-600/20 transition-all duration-300"></div>
            <CardContent className="relative p-8">
              <div className="bg-emerald-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Building2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Hospital Admin</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Coordinate hospital resources, manage incoming patients, and optimize emergency care workflows.
              </p>
              <div className="space-y-3">
                <Link href="/register?role=hospital_admin" className="block">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-all duration-200">
                    Manage Hospital
                  </Button>
                </Link>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium py-3 rounded-xl transition-all duration-200">
                    Sign In
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex items-center text-sm text-slate-500">
                <Users className="h-4 w-4 mr-2" />
                Resource management dashboard
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Emergency Contact */}
        <div className="mt-20 text-center">
          <div className="bg-red-600 text-white p-8 rounded-2xl max-w-md mx-auto">
            <Phone className="h-8 w-8 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Emergency Hotline</h3>
            <p className="text-red-100 mb-4">For immediate assistance call</p>
            <div className="text-2xl font-bold">911</div>
          </div>
        </div>
      </section>
    </div>
  );
}
