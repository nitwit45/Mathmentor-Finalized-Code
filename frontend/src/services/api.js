import { getCsrfTokenFromCookie, fetchCsrfToken } from './csrf';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

// Fetch CSRF token on app initialization
export async function initializeCsrf() {
  await fetchCsrfToken();
}

/**
 * Make API request with credentials and CSRF token
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // #region agent log
  fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:14',message:'apiRequest called',data:{endpoint,method:options.method||'GET',apiBase:API_BASE_URL},sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // Get CSRF token from cookie for POST/PUT/DELETE requests
  const token = getCsrfTokenFromCookie();

  // #region agent log
  fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:21',message:'CSRF token check',data:{hasToken:!!token,method:options.method||'GET'},sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'X-CSRFToken': token }),
      ...options.headers,
    },
  };

  try {
    // #region agent log
    fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:28',message:'making fetch request',data:{url},sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    const response = await fetch(url, config);

    // #region agent log
    fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:31',message:'fetch response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    const data = await response.json();

    // #region agent log
    fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:35',message:'response data parsed',data:{hasData:!!data,success:data.success},sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      // #region agent log
      fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:39',message:'response not ok, throwing error',data:{status:response.status,message:data.message},sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw new Error(data.message || 'An error occurred');
    }

    return data;
  } catch (error) {
    // #region agent log
    fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:43',message:'apiRequest error',data:{error:error.message},sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    throw error;
  }
}

/**
 * Make API request with multipart form data
 */
async function apiRequestFormData(endpoint, formData, method = 'POST') {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getCsrfTokenFromCookie();
  
  const config = {
    method,
    credentials: 'include',
    headers: {
      ...(token && { 'X-CSRFToken': token }),
    },
    body: formData,
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

// ==================== Auth Endpoints ====================

export async function login(email, password) {
  return apiRequest('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

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

export async function logout() {
  return apiRequest('/api/auth/logout/', {
    method: 'POST',
  });
}

export async function getProfile() {
  return apiRequest('/api/auth/profile/');
}

export async function verifyEmail(email, code) {
  return apiRequest('/api/auth/verify-email/', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export async function resendVerificationCode(email) {
  return apiRequest('/api/auth/resend-verification/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// ==================== Profile Endpoints ====================

export async function getMyProfile() {
  return apiRequest('/api/profile/me/');
}

export async function updateMyProfile(data) {
  return apiRequest('/api/profile/update_me/', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateMyProfileWithImage(formData) {
  return apiRequestFormData('/api/profile/update_me/', formData, 'PATCH');
}

export async function getChoices() {
  return apiRequest('/api/profile/choices/');
}

// ==================== Tutor Endpoints ====================

export async function searchTutors(params = {}) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      queryParams.append(key, value);
    }
  });
  return apiRequest(`/api/tutors/?${queryParams.toString()}`);
}

export async function getTutorProfile(tutorId) {
  return apiRequest(`/api/tutors/${tutorId}/`);
}

export async function getTutorAvailability(tutorId) {
  return apiRequest(`/api/tutors/${tutorId}/availability/`);
}

// ==================== Session Endpoints ====================

export async function getSessions(params = {}) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      queryParams.append(key, value);
    }
  });
  return apiRequest(`/api/sessions/?${queryParams.toString()}`);
}

export async function getSession(sessionId) {
  return apiRequest(`/api/sessions/${sessionId}/`);
}

export async function createBooking(data) {
  return apiRequest('/api/sessions/create-booking/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cancelSession(sessionId) {
  return apiRequest(`/api/sessions/${sessionId}/cancel/`, {
    method: 'POST',
  });
}

export async function completeSession(sessionId) {
  return apiRequest(`/api/sessions/${sessionId}/complete/`, {
    method: 'POST',
  });
}

export async function endSession(sessionId) {
  return apiRequest(`/api/sessions/${sessionId}/end/`, {
    method: 'POST',
  });
}

export async function reviewSession(sessionId, data) {
  return apiRequest(`/api/sessions/${sessionId}/review/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSessionStatus(sessionId, status) {
  return apiRequest(`/api/sessions/${sessionId}/update-status/`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function getJaasToken(sessionId) {
  return apiRequest(`/api/sessions/${sessionId}/jaas-token/`);
}

export async function createCheckoutSession(sessionId) {
  return apiRequest(`/api/sessions/${sessionId}/checkout/`, {
    method: 'POST',
  });
}

// ==================== Payment Methods ====================

export async function getStripeConfig() {
  return apiRequest('/api/stripe/config/');
}

export async function getPaymentMethods() {
  return apiRequest('/api/payment-methods/');
}

export async function createSetupIntent() {
  return apiRequest('/api/payment-methods/setup-intent/', {
    method: 'POST',
  });
}

export async function savePaymentMethod(paymentMethodId, setAsDefault = true) {
  return apiRequest('/api/payment-methods/save/', {
    method: 'POST',
    body: JSON.stringify({ 
      payment_method_id: paymentMethodId,
      set_as_default: setAsDefault 
    }),
  });
}

export async function deletePaymentMethod(paymentMethodId) {
  return apiRequest(`/api/payment-methods/${paymentMethodId}/`, {
    method: 'DELETE',
  });
}

export async function setDefaultPaymentMethod(paymentMethodId) {
  return apiRequest(`/api/payment-methods/${paymentMethodId}/default/`, {
    method: 'POST',
  });
}

export async function payWithSavedCard(sessionId, paymentMethodId) {
  return apiRequest(`/api/sessions/${sessionId}/pay/`, {
    method: 'POST',
    body: JSON.stringify({ payment_method_id: paymentMethodId }),
  });
}

// ==================== Messaging Endpoints ====================

export async function getConversations() {
  return apiRequest('/api/conversations/');
}

export async function getConversation(conversationId) {
  return apiRequest(`/api/conversations/${conversationId}/`);
}

export async function startConversation(userId) {
  return apiRequest('/api/conversations/start/', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function sendMessage(conversationId, content) {
  return apiRequest(`/api/conversations/${conversationId}/send-message/`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// ==================== Availability Endpoints ====================

export async function getMyAvailability() {
  return apiRequest('/api/availability/');
}

export async function addAvailability(data) {
  return apiRequest('/api/availability/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAvailability(id) {
  return apiRequest(`/api/availability/${id}/`, {
    method: 'DELETE',
  });
}

export async function getInstantRequests() {
  return apiRequest('/api/instant_requests/');
}

export async function createInstantRequest(data) {
  return apiRequest('/api/instant_requests/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function acceptInstantRequest(requestId) {
  return apiRequest(`/api/instant_requests/${requestId}/accept/`, {
    method: 'POST',
  });
}

export async function declineInstantRequest(requestId) {
  return apiRequest(`/api/instant_requests/${requestId}/decline/`, {
    method: 'POST',
  });
}

// ==================== WebSocket Helpers ====================

export function createChatWebSocket(conversationId) {
  return new WebSocket(`${WS_BASE_URL}/ws/chat/${conversationId}/`);
}

export function createInstantWebSocket() {
  return new WebSocket(`${WS_BASE_URL}/ws/instant/`);
}

export function createNotificationWebSocket() {
  return new WebSocket(`${WS_BASE_URL}/ws/notifications/`);
}
