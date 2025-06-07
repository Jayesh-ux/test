export const mapsConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  },
  
  getApiKey(): string {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Maps API key is not configured. ' +
        'Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.'
      );
    }
    return this.apiKey!;
  },
  
  validateApiKey(): boolean {
    if (!this.isConfigured()) return false;
    
    // Basic validation - Google Maps API keys start with 'AIza'
    return this.apiKey!.startsWith('AIza') && this.apiKey!.length === 39;
  },
  
  getDebugInfo() {
    return {
      hasApiKey: this.isConfigured(),
      keyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'Not set',
      isValidFormat: this.validateApiKey(),
    };
  }
};