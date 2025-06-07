// Extend the existing Google Maps types to include the new Places API
declare global {
  interface Window {
    google: typeof google;
  }
}

declare namespace google.maps.places {
  // New PlaceAutocompleteElement interface
  interface PlaceAutocompleteElement extends HTMLElement {
    // Override the standard addEventListener to include both standard and custom events
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: 'gmp-placeselect', listener: (event: PlaceSelectEvent) => void): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: 'gmp-placeselect', listener: (event: PlaceSelectEvent) => void): void;
    setAttribute(name: string, value: string): void;
    style: CSSStyleDeclaration;
  }

  interface PlaceSelectEvent extends CustomEvent {
    detail: {
      place: {
        id: string;
        displayName: string;
        formattedAddress: string;
        location: {
          lat(): number;
          lng(): number;
        };
        types: string[];
      };
    };
  }

  // Constructor for the new element
  interface PlaceAutocompleteElementConstructor {
    new(): PlaceAutocompleteElement;
  }

  var PlaceAutocompleteElement: PlaceAutocompleteElementConstructor;
}

// Extend the document to support creating the new element
declare global {
  interface Document {
    createElement(tagName: 'gmp-place-autocomplete'): google.maps.places.PlaceAutocompleteElement;
  }
}

export {};