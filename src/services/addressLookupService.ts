/**
 * Address Lookup Service — GISCO Address API
 *
 * Uses the EU Commission's free GISCO geocoding API to auto-fill address fields
 * from country + postcode + housenumber.
 *
 * Behavior:
 * - 1 result  → return address (auto-fill)
 * - 0 results → return null (user fills manually)
 * - >1 results → return null (user fills manually)
 * - API error  → return null (silent fallback)
 * - Non-EU country → return null (no API call)
 *
 * @see https://gisco-services.ec.europa.eu/addressapi/docs
 */

const GISCO_BASE_URL = 'https://gisco-services.ec.europa.eu/addressapi/search';
const TIMEOUT_MS = 5000;

/** Countries supported by the GISCO Address API (EU + EEA + CH) */
const GISCO_SUPPORTED_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES',
  'FI', 'FO', 'FR', 'HR', 'HU', 'IS', 'IT', 'LI', 'LT', 'LU',
  'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

export interface AddressLookupResult {
  street: string;
  city: string;
  province: string;
}

interface GISCOResult {
  /** House/door number */
  LD?: string;
  /** Street/thoroughfare */
  TF?: string;
  /** City */
  L2?: string;
  /** Province/region */
  L1?: string;
  /** Country */
  L0?: string;
  /** Postcode */
  PC?: string;
  /** NUTS codes */
  N0?: string;
  N1?: string;
  N2?: string;
  N3?: string;
  /** Coordinates [lon, lat] */
  XY?: number[];
  /** Original label */
  OL?: string;
}

interface GISCOResponse {
  count: number;
  results: GISCOResult[];
}

/**
 * Checks if a country code is supported by the GISCO API.
 */
export function isGISCOSupported(countryCode: string): boolean {
  return GISCO_SUPPORTED_COUNTRIES.has(countryCode.toUpperCase());
}

/**
 * Look up address from country + postcode + optional housenumber.
 *
 * Returns address fields if exactly 1 result found, null otherwise.
 * Never throws — all errors result in null (silent fallback).
 */
export async function lookupAddress(
  countryCode: string,
  postcode: string,
  housenumber?: string,
): Promise<AddressLookupResult | null> {
  // Non-EU countries: skip API call
  if (!isGISCOSupported(countryCode)) {
    return null;
  }

  // Build query params
  const params = new URLSearchParams({
    country: countryCode.toUpperCase(),
    postcode: postcode.trim(),
  });

  if (housenumber?.trim()) {
    params.set('housenumber', housenumber.trim());
  }

  const url = `${GISCO_BASE_URL}?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data: GISCOResponse = await response.json();

    // Only auto-fill when exactly 1 result
    if (data.count !== 1 || data.results.length !== 1) {
      return null;
    }

    const result = data.results[0];

    // Validate that we have meaningful data
    if (!result.L2) {
      return null;
    }

    return {
      street: result.TF || '',
      city: result.L2 || '',
      province: result.L1 || '',
    };
  } catch {
    // Network error, timeout, parse error — silent fallback
    return null;
  }
}
