'use client';

import { useState } from 'react';
import { LocationPicker } from '@/components/maps/LocationPicker';

export default function TestLocationPage() {
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  const handleLocationSelect = (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    console.log('🎯 Location selected in test page:', location);
    setSelectedLocation(location);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Location Picker Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <LocationPicker
            onLocationSelect={handleLocationSelect}
            initialLocation={{ latitude: 19.0760, longitude: 72.8777 }}
          />
        </div>

        {selectedLocation && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Selected Location:</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm">
              {JSON.stringify(selectedLocation, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}