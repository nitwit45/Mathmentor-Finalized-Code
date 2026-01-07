const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Fetch CSRF token from backend
 */
export async function fetchCsrfToken() {
  // #region agent log
  fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csrf.js:6',message:'fetchCsrfToken called',data:{apiBase:API_BASE_URL},sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/csrf-token/`, {
      method: 'GET',
      credentials: 'include',
    });

    // #region agent log
    fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csrf.js:14',message:'CSRF fetch response',data:{status:response.status,ok:response.ok},sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    const data = await response.json();

    // #region agent log
    fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csrf.js:18',message:'CSRF token response data',data:{hasToken:!!data.csrfToken,tokenLength:data.csrfToken?.length},sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    return data.csrfToken;
  } catch (error) {
    // #region agent log
    fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csrf.js:22',message:'CSRF fetch error',data:{error:error.message},sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('Error fetching CSRF token:', error);
    return null;
  }
}

/**
 * Get CSRF token from cookie
 */
export function getCsrfTokenFromCookie() {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');

  // #region agent log
  fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csrf.js:25',message:'getCsrfTokenFromCookie called',data:{cookieCount:cookies.length},sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      // #region agent log
      fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csrf.js:31',message:'CSRF token found in cookie',data:{tokenLength:value.length},sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return decodeURIComponent(value);
    }
  }

  // #region agent log
  fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csrf.js:35',message:'CSRF token not found in cookies',data:{},sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  return null;
}

