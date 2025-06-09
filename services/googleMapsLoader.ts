export class GoogleMapsLoader {  private static instance: GoogleMapsLoader;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  private maxRetries = 3;
  private retryDelay = 2000;
  private scriptId = 'google-maps-script';
  private callbackName = 'initGoogleMapsCallback';

  private constructor() {}

  static getInstance(): GoogleMapsLoader {
    if (!GoogleMapsLoader.instance) {
      GoogleMapsLoader.instance = new GoogleMapsLoader();
    }
    return GoogleMapsLoader.instance;
  }

  isGoogleMapsLoaded(): boolean {
    return typeof window !== 'undefined' && 
           window.google && 
           window.google.maps && 
           window.google.maps.Map &&
           window.google.maps.places &&
           window.google.maps.Geocoder &&
           typeof window.google.maps.Geocoder === 'function' &&
           typeof window.google.maps.Map === 'function' &&
           // Check for either new or legacy Places API
           (this.hasNewPlacesAPI() || this.hasLegacyPlacesAPI());
  }

  private hasNewPlacesAPI(): boolean {
    return typeof window !== 'undefined' && 
           window.google?.maps?.places?.PlaceAutocompleteElement !== undefined &&
           typeof window.google.maps.places.PlaceAutocompleteElement === 'function';
  }

  private hasLegacyPlacesAPI(): boolean {
    return typeof window !== 'undefined' && 
           window.google?.maps?.places?.Autocomplete !== undefined &&
           typeof window.google.maps.places.Autocomplete === 'function';
  }

  async load(): Promise<void> {
    if (this.isGoogleMapsLoaded()) {
      this.isLoaded = true;
      return Promise.resolve();
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.loadWithRetry();

    try {
      await this.loadPromise;
      this.isLoaded = true;
      console.log('✅ Google Maps with Places API loaded successfully');
      
      // Log which Places API is available
      if (this.hasNewPlacesAPI()) {
        console.log('🆕 New PlaceAutocompleteElement API available');
      }
      if (this.hasLegacyPlacesAPI()) {
        console.log('🔄 Legacy Autocomplete API available');
      }
      
    } catch (error) {
      console.error('❌ Failed to load Google Maps after retries:', error);
      this.isLoaded = false;
      this.cleanup();
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  private async loadWithRetry(attempt: number = 1): Promise<void> {
    try {
      if (attempt > 1) {
        this.forceCleanup();
        await this.delay(this.retryDelay);
      }

      await this.loadGoogleMapsScript();
      await this.waitForGoogleMaps();
      
    } catch (error) {
      console.error(`❌ Google Maps load attempt ${attempt} failed:`, error);
      
      if (attempt < this.maxRetries) {
        console.log(`🔄 Retrying Google Maps load in ${this.retryDelay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
        return this.loadWithRetry(attempt + 1);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load Google Maps after ${this.maxRetries} attempts: ${errorMessage}`);
      }
    }
  }

  private loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Google Maps can only be loaded in browser environment'));
        return;
      }

      if (this.isGoogleMapsLoaded()) {
        console.log('✅ Google Maps already available');
        resolve();
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        reject(new Error('Google Maps API key not found. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable.'));
        return;
      }

      this.forceCleanup();

      console.log('🔄 Loading Google Maps script with Places API...');

      (window as any)[this.callbackName] = () => {
        console.log('📍 Google Maps callback triggered');
        
        if (this.isGoogleMapsLoaded()) {
          console.log('✅ Google Maps API with Places verified as loaded');
          
          // Check which Places API is available
          const hasNewAPI = this.hasNewPlacesAPI();
          const hasLegacyAPI = this.hasLegacyPlacesAPI();
          
          console.log('🔍 Places API Status:', {
            newAPI: hasNewAPI,
            legacyAPI: hasLegacyAPI,
            recommendation: hasNewAPI ? 'Use new PlaceAutocompleteElement' : 'Use legacy Autocomplete'
          });
          
          delete (window as any)[this.callbackName];
          resolve();
        } else {
          console.error('❌ Google Maps callback fired but API not available');
          console.log('Available APIs:', {
            maps: !!window.google?.maps,
            places: !!window.google?.maps?.places,
            newAutocomplete: this.hasNewPlacesAPI(),
            legacyAutocomplete: this.hasLegacyPlacesAPI(),
            geocoder: !!window.google?.maps?.Geocoder
          });
          delete (window as any)[this.callbackName];
          reject(new Error('Google Maps callback fired but API not properly initialized'));
        }
      };

      const script = document.createElement('script');
      script.id = this.scriptId;
      // Load with both places and geometry libraries
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async&callback=${this.callbackName}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log('📜 Google Maps script loaded, waiting for callback...');
      };

      script.onerror = (error) => {
        console.error('❌ Google Maps script failed to load:', error);
        delete (window as any)[this.callbackName];
        script.remove();
        reject(new Error('Failed to load Google Maps script. Please check your API key and internet connection.'));
      };

      document.head.appendChild(script);

      // Fallback timeout
      setTimeout(() => {
        if (this.isGoogleMapsLoaded()) {
          delete (window as any)[this.callbackName];
          resolve();
        } else {
          console.error('❌ Google Maps script timeout - API not available after 25 seconds');
          delete (window as any)[this.callbackName];
          const failedScript = document.getElementById(this.scriptId);
          if (failedScript) {
            failedScript.remove();
          }
          reject(new Error('Google Maps script loaded but API initialization timed out after 25 seconds'));
        }
      }, 25000);
    });
  }

  private async waitForGoogleMaps(maxWait: number = 15000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 500;

    return new Promise((resolve, reject) => {
      const checkAvailability = () => {
        if (this.isGoogleMapsLoaded()) {
          console.log('✅ Google Maps API with Places is now available');
          resolve();
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > maxWait) {
          console.error(`❌ Google Maps API not available after ${elapsed}ms`);
          console.log('Current state:', {
            google: !!window.google,
            maps: !!window.google?.maps,
            places: !!window.google?.maps?.places,
            newAutocomplete: this.hasNewPlacesAPI(),
            legacyAutocomplete: this.hasLegacyPlacesAPI(),
            geocoder: !!window.google?.maps?.Geocoder
          });
          reject(new Error(`Google Maps API not available after ${maxWait}ms wait`));
          return;
        }

        if (elapsed % 5000 < checkInterval) {
          console.log(`⏳ Still waiting for Google Maps API... (${Math.round(elapsed/1000)}s)`);
        }

        setTimeout(checkAvailability, checkInterval);
      };

      checkAvailability();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private forceCleanup(): void {
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
    existingScripts.forEach(script => {
      console.log('🗑️ Removing existing Google Maps script');
      script.remove();
    });

    const scriptById = document.getElementById(this.scriptId);
    if (scriptById) {
      console.log('🗑️ Removing Google Maps script by ID');
      scriptById.remove();
    }

    if ((window as any)[this.callbackName]) {
      console.log('🗑️ Cleaning up Google Maps callback');
      delete (window as any)[this.callbackName];
    }

    Object.keys(window).forEach(key => {
      if (key.includes('initGoogleMaps') || key.includes('GoogleMaps')) {
        console.log(`🗑️ Cleaning up callback: ${key}`);
        delete (window as any)[key];
      }
    });
  }

  cleanup(): void {
    console.log('🧹 Cleaning up Google Maps loader...');
    
    this.forceCleanup();
    
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
    
    console.log('✅ Google Maps loader cleaned up');
  }

  getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          let errorMessage = 'Unable to get current location: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out';
              break;
            default:
              errorMessage += 'Unknown error occurred';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000
        }
      );
    });
  }

  async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number; formattedAddress: string }> {
    if (!this.isGoogleMapsLoaded()) {
      throw new Error('Google Maps not loaded. Call load() first.');
    }

    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode({ address }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
        if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const result = results[0];
          const location = result.geometry.location;
          
          resolve({
            latitude: location.lat(),
            longitude: location.lng(),
            formattedAddress: result.formatted_address
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    if (!this.isGoogleMapsLoaded()) {
      throw new Error('Google Maps not loaded. Call load() first.');
    }

    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      const latlng = { lat: latitude, lng: longitude };
      
      geocoder.geocode({ location: latlng }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
        if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
          resolve(results[0].formatted_address);
        } else {
          reject(new Error(`Reverse geocoding failed: ${status}`));
        }
      });
    });
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.load();
      const geocoder = new window.google.maps.Geocoder();
      
      return new Promise((resolve) => {
        geocoder.geocode({ address: 'New York, NY' }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
          if (status === window.google.maps.GeocoderStatus.REQUEST_DENIED) {
            console.error('❌ Google Maps API key is invalid or restricted');
            resolve(false);
          } else {
            console.log('✅ Google Maps API key is valid');
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error validating API key:', error);
      return false;
    }
  }

  async forceReload(): Promise<void> {
    console.log('🔄 Force reloading Google Maps...');
    this.cleanup();
    await this.delay(1000);
    return this.load();
  }

  getAvailablePlacesAPI(): 'new' | 'legacy' | 'none' {
    if (typeof window === 'undefined' || !window.google?.maps?.places) {
      return 'none';
    }

    if (this.hasNewPlacesAPI()) {
      return 'new';
    }

    if (this.hasLegacyPlacesAPI()) {
      return 'legacy';
    }

    return 'none';
  }
}

export default GoogleMapsLoader;