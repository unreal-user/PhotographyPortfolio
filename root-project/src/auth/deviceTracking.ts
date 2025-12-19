import Cookies from 'js-cookie';

const DEVICE_TOKEN_KEY = 'device_token';
const COOKIE_EXPIRY_DAYS = 90;

/**
 * Generate a UUID v4
 */
const generateUUID = (): string => {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Get the current device token from cookies
 */
export const getDeviceToken = (): string | undefined => {
  return Cookies.get(DEVICE_TOKEN_KEY);
};

/**
 * Check if this is a trusted device (has valid device token)
 */
export const isTrustedDevice = (): boolean => {
  return !!getDeviceToken();
};

/**
 * Mark this device as trusted by setting a device token cookie
 */
export const trustDevice = (): string => {
  const existingToken = getDeviceToken();

  if (existingToken) {
    return existingToken;
  }

  const newToken = generateUUID();

  Cookies.set(DEVICE_TOKEN_KEY, newToken, {
    expires: COOKIE_EXPIRY_DAYS,
    secure: window.location.protocol === 'https:',
    sameSite: 'strict'
  });

  return newToken;
};

/**
 * Remove device trust (clear device token cookie)
 */
export const untrustDevice = (): void => {
  Cookies.remove(DEVICE_TOKEN_KEY);
};

/**
 * Refresh device token expiry (extend trust period)
 */
export const refreshDeviceTrust = (): void => {
  const token = getDeviceToken();

  if (token) {
    Cookies.set(DEVICE_TOKEN_KEY, token, {
      expires: COOKIE_EXPIRY_DAYS,
      secure: window.location.protocol === 'https:',
      sameSite: 'strict'
    });
  }
};
