interface DecodedJWT {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
  iat?: number;
  exp?: number;
}

function decodeJWT(token: string): DecodedJWT | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('[auth-utils] Failed to decode JWT:', error);
    return null;
  }
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return false;
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp > now;
}

export function getTokenExpiry(token: string | null): number | null {
  if (!token) return null;
  
  const decoded = decodeJWT(token);
  return decoded?.exp ?? null;
}

export function clearAuthAndRedirect(): void {
  console.log('[auth-utils] Clearing authentication and redirecting to login');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function handleAuthError(error: any): void {
  const status = error?.status || error?.response?.status;
  const message = error?.message || error?.error || '';
  
  // Handle 401 (unauthorized) or 403 with token-related errors
  if (status === 401) {
    console.error('[auth-utils] 401 Unauthorized - clearing token');
    clearAuthAndRedirect();
    return;
  }
  
  if (status === 403 && message.toLowerCase().includes('token')) {
    console.error('[auth-utils] 403 with token error - clearing token');
    clearAuthAndRedirect();
    return;
  }
}
