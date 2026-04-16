export interface BrowserSupport {
  supported: boolean;
  hasObserver: boolean;
  reason?: string;
  brand: 'brave' | 'chromium' | 'unknown';
}

function detectBrand(): BrowserSupport['brand'] {
  if (typeof navigator === 'undefined') return 'unknown';
  // navigator.brave is a Brave-only object exposing isBrave().
  if ('brave' in navigator && navigator.brave) return 'brave';
  // userAgentData.brands lists "Chromium" entries on Chrome/Edge/Arc/Opera/Brave.
  const brands =
    (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData
      ?.brands ?? [];
  if (brands.some((b) => /Chromium|Chrome|Edge|Opera|Arc/i.test(b.brand))) return 'chromium';
  return 'unknown';
}

export function detectSupport(): BrowserSupport {
  if (typeof window === 'undefined') {
    return { supported: false, hasObserver: false, brand: 'unknown', reason: 'No window' };
  }
  const brand = detectBrand();

  if (!('showDirectoryPicker' in window)) {
    const reason =
      brand === 'brave'
        ? "Brave disables the File System Access API by default. Enable it once via brave://flags and you're set."
        : 'This browser does not support the File System Access API. Use Chrome, Edge, Arc, or Opera.';
    return { supported: false, hasObserver: false, brand, reason };
  }
  if (!window.isSecureContext) {
    return {
      supported: false,
      hasObserver: false,
      brand,
      reason: 'A secure context (HTTPS or localhost) is required.',
    };
  }
  const hasObserver = 'FileSystemObserver' in window;
  return { supported: true, hasObserver, brand };
}
