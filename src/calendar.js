// Google Calendar integration using OAuth 2.0 with PKCE
// Stores tokens in chrome.storage.sync under key 'googleAuth'
// Import config flexibly so missing named exports don't break the import
import * as CONFIG from "./config.js";
const CONFIG_CLIENT_SECRET = CONFIG.GOOGLE_CLIENT_SECRET;

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars";
const CALENDAR_LIST_ENDPOINT = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

// Helper function to get account email from account ID for logging
async function getAccountEmail(accountId) {
  try {
    const { accounts } = await chrome.storage.sync.get(["accounts"]);
    const account = (accounts || []).find(acc => acc.id === accountId);
    return account ? account.email : accountId;
  } catch (error) {
    return accountId; // Fallback to account ID if we can't get email
  }
}
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
];

async function sha256(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(digest);
}

function base64UrlEncode(bytes) {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
}

function textEncoder(str) {
  return new TextEncoder().encode(str);
}

async function generatePkce() {
  const verifierBytes = randomBytes(32);
  const codeVerifier = base64UrlEncode(verifierBytes);
  const challengeBytes = await sha256(textEncoder(codeVerifier));
  const codeChallenge = base64UrlEncode(challengeBytes);
  return { codeVerifier, codeChallenge };
}

async function getStoredAuth() {
  const { googleAuth } = await chrome.storage.sync.get(["googleAuth"]);
  return googleAuth || null;
}

async function setStoredAuth(auth) {
  await chrome.storage.sync.set({ googleAuth: auth });
}

export async function clearStoredAuth() {
  await chrome.storage.sync.remove(["googleAuth"]);
}

export async function startGoogleAuth(clientId) {
  const redirectUri = chrome.identity.getRedirectURL();
  const { codeVerifier, codeChallenge } = await generatePkce();

  const authUrl = new URL(GOOGLE_AUTH_BASE);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const redirect = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });

  const returnedUrl = new URL(redirect);
  const code = returnedUrl.searchParams.get("code");
  if (!code) throw new Error("Authorization code missing");

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });
  if (CONFIG_CLIENT_SECRET && CONFIG_CLIENT_SECRET !== "YOUR_CLIENT_SECRET_IF_REQUIRED") {
    tokenParams.set("client_secret", CONFIG_CLIENT_SECRET);
  }

  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`Token exchange failed: ${errText}`);
  }
  const tokens = await tokenResp.json();
  const now = Math.floor(Date.now() / 1000);
  
  // Don't store tokens here - AccountManager will handle storage
  // Just return the tokens with timestamp for the caller to handle
  return {
    ...tokens,
    obtained_at: now
  };
}

export async function getValidAccessToken(clientId) {
  const auth = await getStoredAuth();
  if (!auth) return null;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = (auth.obtained_at || 0) + (auth.expires_in || 0) - 60;
  if (auth.access_token && now < expiresAt) return auth.access_token;
  if (auth.refresh_token) {
    const refreshed = await refreshAccessToken(clientId, auth.refresh_token);
    return refreshed.access_token;
  }
  return null;
}

export async function refreshAccessToken(clientId, refreshToken) {
  const params = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  if (CONFIG_CLIENT_SECRET && CONFIG_CLIENT_SECRET !== "YOUR_CLIENT_SECRET_IF_REQUIRED") {
    params.set("client_secret", CONFIG_CLIENT_SECRET);
  }

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Refresh failed: ${errText}`);
  }
  const tokens = await resp.json();
  const now = Math.floor(Date.now() / 1000);
  const current = (await getStoredAuth()) || {};
  const updated = {
    ...current,
    ...tokens,
    obtained_at: now
  };
  await setStoredAuth(updated);
  return updated;
}

export async function fetchUpcomingEvents(clientId, maxResults = 10) {
  const accessToken = await getValidAccessToken(clientId);
  if (!accessToken) throw new Error("Not authenticated");
  const url = new URL(`${CALENDAR_EVENTS_ENDPOINT}/primary/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", new Date().toISOString());
  url.searchParams.set("maxResults", String(maxResults));

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Events fetch failed: ${errText}`);
  }
  const data = await resp.json();
  return (data.items || []).map(ev => ({
    id: ev.id,
    summary: ev.summary || "(no title)",
    start: ev.start?.dateTime || ev.start?.date || null,
    end: ev.end?.dateTime || ev.end?.date || null,
    location: ev.location || null,
    hangoutLink: ev.hangoutLink || null
  }));
}

export async function fetchEventsInRange(clientId, timeMinIso, timeMaxIso) {
  const accessToken = await getValidAccessToken(clientId);
  if (!accessToken) throw new Error("Not authenticated");
  const url = new URL(`${CALENDAR_EVENTS_ENDPOINT}/primary/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMinIso);
  url.searchParams.set("timeMax", timeMaxIso);
  url.searchParams.set("maxResults", "2500");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Events fetch failed: ${errText}`);
  }
  const data = await resp.json();
  return (data.items || []).map(ev => ({
    id: ev.id,
    summary: ev.summary || "(no title)",
    start: ev.start?.dateTime || ev.start?.date || null,
    end: ev.end?.dateTime || ev.end?.date || null,
    location: ev.location || null,
    hangoutLink: ev.hangoutLink || null
  }));
}

export async function fetchCalendarList(clientId) {
  const accessToken = await getValidAccessToken(clientId);
  if (!accessToken) throw new Error("Not authenticated");
  const url = new URL(CALENDAR_LIST_ENDPOINT);
  url.searchParams.set("minAccessRole", "reader");
  const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Calendar list failed: ${errText}`);
  }
  const data = await resp.json();
  const items = data.items || [];
  return items.map(it => ({ id: it.id, summary: it.summaryOverride || it.summary, primary: !!it.primary, accessRole: it.accessRole || "reader" }));
}

// Multi-account calendar list fetching
export async function fetchCalendarListForAccounts(clientId, accountIds) {
  if (!accountIds || accountIds.length === 0) {
    return await fetchCalendarList(clientId);
  }

  const allCalendars = [];
  
  for (const accountId of accountIds) {
    try {
      const accessToken = await getValidAccessTokenForAccount(accountId, clientId);
      if (!accessToken) continue;

      const url = new URL(CALENDAR_LIST_ENDPOINT);
      url.searchParams.set("minAccessRole", "reader");
      
      const resp = await fetch(url.toString(), { 
        headers: { Authorization: `Bearer ${accessToken}` } 
      });
      
      if (!resp.ok) continue;
      
      const data = await resp.json();
      const items = data.items || [];
      const calendars = items.map(it => ({ 
        id: `${accountId}:${it.id}`, // Prefix with account ID
        originalId: it.id,
        accountId,
        summary: it.summaryOverride || it.summary, 
        primary: !!it.primary, 
        accessRole: it.accessRole || "reader",
        backgroundColor: it.backgroundColor,
        foregroundColor: it.foregroundColor
      }));
      allCalendars.push(...calendars);
    } catch (error) {
      console.error(`Failed to fetch calendars for account ${accountId}:`, error);
    }
  }
  
  return allCalendars;
}

export async function fetchEventsForCalendars(clientId, calendarIds, timeMinIso, timeMaxIso) {
  const accessToken = await getValidAccessToken(clientId);
  if (!accessToken) throw new Error("Not authenticated");
  const ids = (calendarIds && calendarIds.length) ? calendarIds : ["primary"];
  const all = [];
  for (const id of ids) {
    // Handle special calendar IDs
    let calendarId = id;
    if (id.includes('@') && id.includes('gmail.com')) {
      // This is likely a primary calendar email, use 'primary' instead
      calendarId = 'primary';
    }
    
    let nextPageToken = null;
    let totalEventsFromThisCalendar = 0;
    
    do {
      const url = new URL(`${CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("timeMin", timeMinIso);
      url.searchParams.set("timeMax", timeMaxIso);
      url.searchParams.set("maxResults", "2500");
      
      if (nextPageToken) {
        url.searchParams.set("pageToken", nextPageToken);
      }
      
      const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Events fetch failed: ${errText}`);
      }
      const data = await resp.json();
      const events = (data.items || []).map(ev => ({
        id: `${id}:${ev.id}`,
        summary: ev.summary || "(no title)",
        start: ev.start?.dateTime || ev.start?.date || null,
        end: ev.end?.dateTime || ev.end?.date || null,
        location: ev.location || null,
        hangoutLink: ev.hangoutLink || null
      }));
      all.push(...events);
      totalEventsFromThisCalendar += events.length;
      nextPageToken = data.nextPageToken;
      
    } while (nextPageToken);
    
    console.log(`📅 Fetched ${totalEventsFromThisCalendar} events from calendar "${id}" (${calendarId})`);
  }
  // Sort by start time
  return all.sort((a, b) => new Date(a.start) - new Date(b.start));
}

// Multi-account event fetching
export async function fetchEventsForAccounts(clientId, accountIds, calendarIds, timeMinIso, timeMaxIso) {
  if (!accountIds || accountIds.length === 0) {
    return await fetchEventsForCalendars(clientId, calendarIds, timeMinIso, timeMaxIso);
  }

  const allEvents = [];
  
  // Group calendar IDs by account
  const calendarsByAccount = {};
  for (const calendarId of (calendarIds || [])) {
    // Check if this is already a prefixed calendar ID
    if (calendarId.includes(':') && calendarId.startsWith('google_')) {
      const [accountId, originalId] = calendarId.split(':', 2);
      if (!calendarsByAccount[accountId]) {
        calendarsByAccount[accountId] = [];
      }
      calendarsByAccount[accountId].push(originalId);
    } else {
      // This is an unprefixed calendar ID, add it to all accounts
      for (const accountId of accountIds) {
        if (!calendarsByAccount[accountId]) {
          calendarsByAccount[accountId] = [];
        }
        calendarsByAccount[accountId].push(calendarId);
      }
    }
  }
  
  for (const accountId of accountIds) {
    try {
      const accessToken = await getValidAccessTokenForAccount(accountId, clientId);
      if (!accessToken) continue;

      const accountCalendarIds = calendarsByAccount[accountId] || ["primary"];
      
      for (const originalId of accountCalendarIds) {
        // Handle special calendar IDs
        let calendarId = originalId;
        if (originalId.includes('@') && originalId.includes('gmail.com')) {
          // This is likely a primary calendar email, use 'primary' instead
          calendarId = 'primary';
        }
        
        let nextPageToken = null;
        let totalEventsFromThisCalendar = 0;
        
        do {
          const url = new URL(`${CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events`);
          url.searchParams.set("singleEvents", "true");
          url.searchParams.set("orderBy", "startTime");
          url.searchParams.set("timeMin", timeMinIso);
          url.searchParams.set("timeMax", timeMaxIso);
          url.searchParams.set("maxResults", "2500");
          
          if (nextPageToken) {
            url.searchParams.set("pageToken", nextPageToken);
          }
          
          const resp = await fetch(url.toString(), { 
            headers: { Authorization: `Bearer ${accessToken}` } 
          });
          
          if (!resp.ok) {
            console.warn(`Failed to fetch events for calendar ${calendarId}: ${resp.status} ${resp.statusText}`);
            break;
          }
          
          const data = await resp.json();
          const events = (data.items || []).map(ev => ({
            id: `${accountId}:${originalId}:${ev.id}`,
            accountId,
            calendarId: `${accountId}:${originalId}`,
            summary: ev.summary || "(no title)",
            start: ev.start?.dateTime || ev.start?.date || null,
            end: ev.end?.dateTime || ev.end?.date || null,
            location: ev.location || null,
            hangoutLink: ev.hangoutLink || null
          }));
          
          allEvents.push(...events);
          totalEventsFromThisCalendar += events.length;
          nextPageToken = data.nextPageToken;
          
        } while (nextPageToken);
        
        const accountEmail = await getAccountEmail(accountId);
        console.log(`📅 Fetched ${totalEventsFromThisCalendar} events from calendar "${originalId}" (${calendarId}) for account ${accountEmail}`);
      }
    } catch (error) {
      const accountEmail = await getAccountEmail(accountId);
      console.error(`❌ Failed to fetch events for account ${accountEmail}:`, error);
    }
  }
  
  // Sort by start time
  return allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
}

// Helper function to get access token for specific account
async function getValidAccessTokenForAccount(accountId, clientId) {
  // Direct implementation to avoid import() in service worker
  const { accounts = [] } = await chrome.storage.sync.get(["accounts"]);
  const account = accounts.find(acc => acc.id === accountId);
  if (!account || account.provider !== "google") return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = (account.authData.obtained_at || 0) + (account.authData.expires_in || 0) - 60;
  
  if (account.authData.access_token && now < expiresAt) {
    return account.authData.access_token;
  }
  
  if (account.authData.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(clientId, account.authData.refresh_token);
      
      // Update account with new tokens
      account.authData = { ...account.authData, ...refreshed };
      const updatedAccounts = accounts.map(acc => 
        acc.id === accountId ? account : acc
      );
      await chrome.storage.sync.set({ accounts: updatedAccounts });
      
      return refreshed.access_token;
    } catch (error) {
      console.error(`Token refresh failed for account ${accountId}:`, error);
      return null;
    }
  }
  
  return null;
}

export async function signOutGoogle() {
  await clearStoredAuth();
}

export async function fetchUserProfile(accessToken = null) {
  // Use provided token or get a valid one from storage
  const token = accessToken || await getValidAccessToken();
  if (!token) {
    throw new Error("No valid access token available");
  }

  console.log("Fetching user profile with token:", token.substring(0, 20) + "...");
  
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  console.log("User profile API response:", response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("User profile API error response:", errorText);
    throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText}`);
  }

  const profile = await response.json();
  console.log("User profile received:", profile.email);
  return profile;
}


