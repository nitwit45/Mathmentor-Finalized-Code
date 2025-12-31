import { getCsrfTokenFromCookie, fetchCsrfToken } from './csrf';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Fetch CSRF token on app initialization
let csrfToken = null;
export async function initializeCsrf() {
  csrfToken = await fetchCsrfToken();
}

/**
 * Make API request with credentials and CSRF token
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get CSRF token from cookie for POST/PUT/DELETE requests
  const token = getCsrfTokenFromCookie();
  
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'X-CSRFToken': token }),  // Add CSRF token header
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'An error occurred');
    }
    
    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * Login user
 */
export async function login(email, password) {
  return apiRequest('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Sign up user
 */
export async function signup(email, password, passwordConfirm, firstName, lastName, role) {
  const endpoint = `/api/auth/${role.toLowerCase()}/signup/`;
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      password_confirm: passwordConfirm,
      first_name: firstName || '',
      last_name: lastName || '',
    }),
  });
}

/**
 * Logout user
 */
export async function logout() {
  return apiRequest('/api/auth/logout/', {
    method: 'POST',
  });
}

/**
 * Get current user profile
 */
export async function getProfile() {
  return apiRequest('/api/auth/profile/');
}

/**
 * Verify email with verification code
 */
export async function verifyEmail(email, code) {
  return apiRequest('/api/auth/verify-email/', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

/**
 * Resend verification code
 */
export async function resendVerificationCode(email) {
  return apiRequest('/api/auth/resend-verification/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

