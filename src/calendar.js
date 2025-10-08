// Google Calendar integration using OAuth 2.0 with PKCE
// Stores tokens in chrome.storage.sync under key 'googleAuth'
// Import config flexibly so missing named exports don't break the import
import * as CONFIG from "./config.js";
const CONFIG_CLIENT_SECRET = CONFIG.GOOGLE_CLIENT_SECRET;

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly"
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

async function clearStoredAuth() {
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
  await setStoredAuth({
    ...tokens,
    obtained_at: now
  });
  return tokens;
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
  const url = new URL(CALENDAR_EVENTS_ENDPOINT);
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
  const url = new URL(CALENDAR_EVENTS_ENDPOINT);
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

export async function signOutGoogle() {
  await clearStoredAuth();
}


