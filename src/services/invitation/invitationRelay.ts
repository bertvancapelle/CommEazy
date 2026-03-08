/**
 * Invitation Relay Client — API client for the Invitation Relay server
 *
 * Handles HTTP communication with the Invitation Relay via the API Gateway.
 * All requests include JWT authentication.
 *
 * @see server/invitation-relay/server.js for server implementation
 * @see TRUST_AND_ATTESTATION_PLAN.md section 2.3
 */

import { getAccessToken, getApiGatewayUrl } from '../attestation';

const LOG_PREFIX = '[invitationRelay]';

interface CreateInvitationResponse {
  code: string;
  expiresAt: string;
  ttlDays: number;
}

interface InvitationBlobResponse {
  encrypted: string;
  nonce: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * Get authenticated fetch headers.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No access token available — attestation required');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Upload an encrypted invitation blob to the relay.
 *
 * @param code - Invitation code (CE-XXXX-XXXX)
 * @param encrypted - Base64-encoded encrypted payload
 * @param nonce - Base64-encoded nonce
 */
export async function uploadInvitation(
  code: string,
  encrypted: string,
  nonce: string,
): Promise<CreateInvitationResponse> {
  const url = `${getApiGatewayUrl()}/api/v1/invitations`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code, encrypted, nonce }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'UNKNOWN' }));
    console.error(LOG_PREFIX, 'Upload failed', { status: response.status, error: error.error });
    throw new Error(`Upload failed: ${error.error || response.status}`);
  }

  return await response.json();
}

/**
 * Download an encrypted invitation blob from the relay.
 *
 * @param code - Invitation code (CE-XXXX-XXXX)
 */
export async function downloadInvitation(
  code: string,
): Promise<InvitationBlobResponse | null> {
  const url = `${getApiGatewayUrl()}/api/v1/invitations/${encodeURIComponent(code)}`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, { headers });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'UNKNOWN' }));
    throw new Error(`Download failed: ${error.error || response.status}`);
  }

  return await response.json();
}

/**
 * Upload a response blob to the relay (from the invitation acceptor).
 *
 * @param code - Invitation code (CE-XXXX-XXXX)
 * @param encrypted - Base64-encoded encrypted payload
 * @param nonce - Base64-encoded nonce
 */
export async function uploadResponse(
  code: string,
  encrypted: string,
  nonce: string,
): Promise<void> {
  const url = `${getApiGatewayUrl()}/api/v1/invitations/${encodeURIComponent(code)}/response`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ encrypted, nonce }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'UNKNOWN' }));
    throw new Error(`Response upload failed: ${error.error || response.status}`);
  }
}

/**
 * Download the response blob from the relay.
 * The response is deleted after retrieval (one-time read).
 *
 * @param code - Invitation code (CE-XXXX-XXXX)
 */
export async function downloadResponse(
  code: string,
): Promise<InvitationBlobResponse | null> {
  const url = `${getApiGatewayUrl()}/api/v1/invitations/${encodeURIComponent(code)}/response`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, { headers });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'UNKNOWN' }));
    throw new Error(`Response download failed: ${error.error || response.status}`);
  }

  return await response.json();
}

/**
 * Delete an invitation from the relay (cancel by sender).
 *
 * @param code - Invitation code (CE-XXXX-XXXX)
 */
export async function deleteInvitation(code: string): Promise<void> {
  const url = `${getApiGatewayUrl()}/api/v1/invitations/${encodeURIComponent(code)}`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, { method: 'DELETE', headers });

  if (!response.ok && response.status !== 404) {
    const error = await response.json().catch(() => ({ error: 'UNKNOWN' }));
    throw new Error(`Delete failed: ${error.error || response.status}`);
  }
}

/**
 * Poll for a response to an invitation.
 * Returns the response if available, null if not yet.
 *
 * @param code - Invitation code to poll
 * @param intervalMs - Poll interval in milliseconds (default: 5000)
 * @param maxAttempts - Maximum poll attempts (default: 120 = 10 minutes at 5s)
 * @param onPoll - Optional callback invoked on each poll attempt
 */
export async function pollForResponse(
  code: string,
  intervalMs: number = 5000,
  maxAttempts: number = 120,
  onPoll?: (attempt: number) => void,
): Promise<InvitationBlobResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onPoll?.(attempt);

    try {
      const response = await downloadResponse(code);
      if (response) {
        return response;
      }
    } catch {
      // Network error — continue polling
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return null;
}
