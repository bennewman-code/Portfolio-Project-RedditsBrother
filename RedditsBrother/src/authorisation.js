const clientId = 'ClientId';
const clientSecret = 'clientSecret';
const redirectUrl = 'http://192.168.1.79:5173/';

const authorizationEndpoint = 'https://www.reddit.com/api/v1/authorize';
const tokenEndpoint = '/api/v1/access_token';
const scope = 'mysubreddits read'; //fill in when you know what you need access too

  // Data structure that manages the current active token, caching it in localStorage
const currentToken = {
   get access_token() { return localStorage.getItem('access_token') || null; },
   get refresh_token() { return localStorage.getItem('refresh_token') || null; },
   get expires_in() { return localStorage.getItem('refresh_in') || null },
   get expires() { return localStorage.getItem('expires') || null },
 };
  
  // Takes code from the handle redirect then puts it into localstorage
function saveToken(response) {
    const { access_token, refresh_token, expires_in } = response;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    const now = new Date();
    const expiry = new Date(now.getTime() + (expires_in * 1000));
    localStorage.setItem('expires', expiry);
}
 
async function redirectToRedditAuthorize() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = crypto.getRandomValues(new Uint8Array(64));
  const randomString = randomValues.reduce((acc, x) => acc + possible[x % possible.length], "");

  const code_verifier = randomString;
  /*
  We dont need this this encodes the random string S256 method but reddit asks for only a unique string not a encoded one
  const data = new TextEncoder().encode(code_verifier);
  const hashed = await crypto.subtle.digest('SHA-256', data);

  const code_challenge_base64 = btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    */

  window.localStorage.setItem('code_verifier', code_verifier);

  const authUrl = new URL(authorizationEndpoint)
  const params = {
    client_id: clientId,
    response_type: 'code',
    state: randomString,
    // the two directlly below might need to become one not sure if this will work as it asks for a state that is a unique string which it is but may only want state
    /*
    Not needed due to not needing the string encoded
    code_challenge_method: 'S256',
    code_challenge: code_challenge_base64,
    */
    redirect_uri: redirectUrl,
    // duration specific for reddit allows refresh token
    duration: 'permanent',
    scope: scope,
  }; 
  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString(); // Redirect the user to the authorization server for login
}
 // handles the redirect back from spotify to make sure the auth saved in local file
async function handleRedirect() {
  // So this try here helps check if the functions already runs and if it has then it just returns straight away 
  try {
    if (localStorage.getItem('redirectHandled')) {
      console.log('Redirect already handled.');
      return;
    }
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  // This if statement checks if theres code in browser then takes that code and calls getToken
  if (code) {
    const tokenResponse = await getToken(code);
    // This if statement checks if theres an access_token within the tokenResponse
    if (tokenResponse.access_token) {
      saveToken(tokenResponse);
      // This sets the localStorage redirectHandled to true meaning its been run once before
      localStorage.setItem('redirectHandled', 'true');
      // This else is just to show the error if tokenResponse doesnt bring back something we want
    } else {
      console.error('Failed to get token:', tokenResponse);
    }
    window.history.replaceState({}, document.title, "/"); //clears the url makes it so can't see the authorisation code after load
  }
  // This catches the error if this function fails
} catch (error) {
  console.log('Error handling redirect:', error);
}
}

  //automatic refreshtoken

// Function to check if token is expired
function isTokenExpired() {
  const expiry = new Date(localStorage.getItem('expires'));
  const now = new Date();
  return now >= expiry;
}
// Refreshes the Token
async function refreshToken() {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      //client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: currentToken.refresh_token
    }),
  });
  
  const newToken = await response.json();
  saveToken(newToken);
}
// Checks if token is expired every 5min
function setupTokenRefresh() {
  setInterval(async () => {
    if (isTokenExpired()) {
      await refreshToken();
      console.log('Token refreshed');
    }
  }, 5 * 60 * 1000);
}


// Reddit API Calls
async function getToken(code) {
  //const code_verifier = localStorage.getItem('code_verifier');
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      //client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUrl,
      //code_verifier: code_verifier,
    }),
  });
  return await response.json();
}

async function subReddits() {
  const url = '/api/subreddits/new';
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });
  if (response.ok) {
    return await response.json();
  } else {
    console.error('Search request failed:', response.statusText);
  }
}









// Click handlers
async function loginWithRedditClick() {
  redirectToRedditAuthorize();
}
  
async function logoutClick() {
  localStorage.clear();
}

  export { loginWithRedditClick, redirectToRedditAuthorize, handleRedirect, currentToken, setupTokenRefresh, subReddits };