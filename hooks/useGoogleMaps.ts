'use client';

import { useState, useEffect } from 'react';
import GoogleMapsLoader from '@/services/googleMapsLoader';

interface UseGoogleMapsReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  loadMaps: () => Promise<void>;
}

export function useGoogleMaps(): UseGoogleMapsReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mapsLoader = GoogleMapsLoader.getInstance();

  const loadMaps = async () => {
    if (mapsLoader.isGoogleMapsLoaded()) {
      setIsLoaded(true);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      await mapsLoader.load();
      
      setIsLoaded(true);
      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load Google Maps';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Google Maps loading error:', err);
    }
  };

  useEffect(() => {
    loadMaps();
  }, []);

  return {
    isLoaded,
    isLoading,
    error,
    loadMaps
  };
}