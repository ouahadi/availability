// Multi-account management system for Google accounts
// Handles storage, authentication, and token management for multiple accounts

import { startGoogleAuth, getValidAccessToken, refreshAccessToken, signOutGoogle, fetchUserProfile, clearStoredAuth } from "./calendar.js";

export class AccountManager {
  // Storage key for accounts
  static ACCOUNTS_STORAGE_KEY = "accounts";
  static PREFS_STORAGE_KEY = "prefs";
  
  // Authentication lock to prevent concurrent auth flows
  static authLock = null;
  
  // Convert technical errors to user-friendly messages
  static getUserFriendlyError(errorMessage) {
    const friendlyErrors = {
      "Authentication already in progress": "Please wait, another account is being added...",
      "No access token received from Google": "Google authentication failed. Please try again.",
      "Invalid user profile received from Google": "Couldn't get your account info from Google. Please try again.",
      "Failed to fetch user profile": "Couldn't connect to Google. Please check your internet connection and try again.",
      "Token refresh failed": "Your account needs to be reconnected. Click the retry icon.",
      "Request is missing required authentication credential": "Your account connection has expired. Please reconnect.",
      "401": "Your account needs to be reconnected. Click the retry icon.",
      "UNAUTHENTICATED": "Your account needs to be reconnected. Click the retry icon."
    };
    
    // Check for partial matches
    for (const [technical, friendly] of Object.entries(friendlyErrors)) {
      if (errorMessage.includes(technical)) {
        return friendly;
      }
    }
    
    // Default fallback
    return "Something went wrong. Please try again.";
  }
  
  // Check account health status
  static async getAccountStatus(accountId, clientId) {
    const account = await this.getAccount(accountId);
    if (!account || !account.active) {
      return { status: 'inactive', needsReauth: false };
    }
    
    try {
      const token = await this.getValidTokenForAccount(accountId, clientId);
      if (token) {
        return { status: 'active', needsReauth: false };
      } else {
        return { status: 'needs_reauth', needsReauth: true };
      }
    } catch (error) {
      return { status: 'error', needsReauth: true };
    }
  }

  // Get all stored accounts
  static async getAccounts() {
    const { accounts = [] } = await chrome.storage.sync.get([this.ACCOUNTS_STORAGE_KEY]);
    return accounts;
  }

  // Add a new account
  static async addAccount(provider, authData, userProfile) {
    const accounts = await this.getAccounts();
    const accountId = `${provider}_${Date.now()}`;
    
    const newAccount = {
      id: accountId,
      provider,
      email: userProfile.email,
      name: userProfile.name || userProfile.email,
      picture: userProfile.picture || null,
      authData,
      addedAt: Date.now(),
      active: true
    };
    
    accounts.push(newAccount);
    await chrome.storage.sync.set({ [this.ACCOUNTS_STORAGE_KEY]: accounts });
    
    // Add to active accounts if it's the first account
    const { prefs } = await chrome.storage.sync.get([this.PREFS_STORAGE_KEY]);
    const activeAccounts = prefs?.activeAccounts || [];
    if (!activeAccounts.includes(accountId)) {
      activeAccounts.push(accountId);
      await chrome.storage.sync.set({ 
        prefs: { ...prefs, activeAccounts } 
      });
    }
    
    return newAccount;
  }

  // Remove an account
  static async removeAccount(accountId) {
    const accounts = await this.getAccounts();
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return false;

    // Sign out from provider if needed
    if (account.provider === "google") {
      try {
        await signOutGoogle();
      } catch (e) {
        console.warn("Failed to sign out from Google:", e);
      }
    }

    // Remove from accounts list
    const updatedAccounts = accounts.filter(acc => acc.id !== accountId);
    await chrome.storage.sync.set({ [this.ACCOUNTS_STORAGE_KEY]: updatedAccounts });

    // Remove from active accounts
    const { prefs } = await chrome.storage.sync.get([this.PREFS_STORAGE_KEY]);
    const activeAccounts = (prefs?.activeAccounts || []).filter(id => id !== accountId);
    await chrome.storage.sync.set({ 
      prefs: { ...prefs, activeAccounts } 
    });

    return true;
  }

  // Get a specific account
  static async getAccount(accountId) {
    const accounts = await this.getAccounts();
    return accounts.find(acc => acc.id === accountId);
  }

  // Get all active accounts
  static async getActiveAccounts() {
    const accounts = await this.getAccounts();
    const { prefs } = await chrome.storage.sync.get([this.PREFS_STORAGE_KEY]);
    const activeAccountIds = prefs?.activeAccounts || [];
    return accounts.filter(acc => activeAccountIds.includes(acc.id));
  }

  // Set active accounts
  static async setActiveAccounts(accountIds) {
    const { prefs } = await chrome.storage.sync.get([this.PREFS_STORAGE_KEY]);
    const updated = { ...prefs, activeAccounts: accountIds };
    await chrome.storage.sync.set({ prefs: updated });
  }

  // Toggle account active status
  static async toggleAccountActive(accountId, active) {
    const { prefs } = await chrome.storage.sync.get([this.PREFS_STORAGE_KEY]);
    let activeAccounts = prefs?.activeAccounts || [];
    
    if (active) {
      if (!activeAccounts.includes(accountId)) {
        activeAccounts.push(accountId);
      }
    } else {
      activeAccounts = activeAccounts.filter(id => id !== accountId);
    }
    
    await chrome.storage.sync.set({ 
      prefs: { ...prefs, activeAccounts } 
    });
  }

  // Authenticate a new Google account
  static async authenticateGoogle(clientId) {
    // Check if another auth flow is in progress
    if (this.authLock) {
      console.log("Authentication already in progress, waiting...");
      await this.authLock;
      return { success: false, error: "Authentication already in progress" };
    }
    
    // Create auth lock
    this.authLock = this._performAuthentication(clientId);
    
    try {
      const result = await this.authLock;
      return result;
    } finally {
      // Clear the lock when done
      this.authLock = null;
    }
  }
  
  // Internal method to perform the actual authentication
  static async _performAuthentication(clientId) {
    let tokens = null;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Starting Google authentication flow (attempt ${attempt}/${maxRetries})...`);
        
        // Start auth flow
        tokens = await startGoogleAuth(clientId);
        if (!tokens || !tokens.access_token) {
          throw new Error("No access token received from Google");
        }
        
        console.log("Auth flow completed, fetching user profile...");
        console.log("Access token received:", tokens.access_token ? "Yes" : "No");
        console.log("Token length:", tokens.access_token ? tokens.access_token.length : 0);
        console.log("Token preview:", tokens.access_token ? tokens.access_token.substring(0, 50) + "..." : "None");
        console.log("Token expires in:", tokens.expires_in ? tokens.expires_in + " seconds" : "Unknown");
        console.log("Token scopes:", tokens.scope || "Not specified");
        
        // Get user profile using the fresh access token
        const profile = await fetchUserProfile(tokens.access_token);
        if (!profile || !profile.email) {
          throw new Error("Invalid user profile received from Google");
        }
        
        console.log(`Fetched profile for: ${profile.email}`);
        
        // Check if account already exists
        const existingAccounts = await this.getAccounts();
        const existingAccount = existingAccounts.find(acc => 
          acc.provider === "google" && acc.email === profile.email
        );
        
        if (existingAccount) {
          console.log(`Updating existing account: ${profile.email}`);
          // Update existing account with new tokens
          existingAccount.authData = { ...existingAccount.authData, ...tokens };
          existingAccount.picture = profile.picture || existingAccount.picture;
          existingAccount.name = profile.name || existingAccount.name;
          
          const updatedAccounts = existingAccounts.map(acc => 
            acc.id === existingAccount.id ? existingAccount : acc
          );
          await chrome.storage.sync.set({ [this.ACCOUNTS_STORAGE_KEY]: updatedAccounts });
          
          // Ensure account is active
          await this.toggleAccountActive(existingAccount.id, true);
          
          return { success: true, account: existingAccount, isNew: false };
        }
        
        console.log(`Creating new account: ${profile.email}`);
        // Add new account
        const account = await this.addAccount("google", tokens, profile);
        return { success: true, account, isNew: true };
        
      } catch (error) {
        console.error(`Google authentication failed (attempt ${attempt}/${maxRetries}):`, error);
        
        // If this is the last attempt, give up
        if (attempt === maxRetries) {
          // Clean up any partial state
          if (tokens) {
            try {
              await clearStoredAuth();
            } catch (cleanupError) {
              console.warn("Failed to cleanup auth state:", cleanupError);
            }
          }
          
          return { 
            success: false, 
            error: error.message || "Authentication failed after retries" 
          };
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, etc.
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Get valid access token for a specific account
  static async getValidTokenForAccount(accountId, clientId) {
    const account = await this.getAccount(accountId);
    if (!account || account.provider !== "google") {
      console.warn(`Account ${accountId} not found or not a Google account`);
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = (account.authData.obtained_at || 0) + (account.authData.expires_in || 0) - 60;
    
    // Check if current token is still valid
    if (account.authData.access_token && now < expiresAt) {
      console.log(`Using valid token for account ${account.email}`);
      return account.authData.access_token;
    }
    
    // Try to refresh the token
    if (account.authData.refresh_token) {
      try {
        console.log(`Refreshing token for account ${account.email}`);
        const refreshed = await refreshAccessToken(clientId, account.authData.refresh_token);
        
        // Update account with new tokens
        account.authData = { ...account.authData, ...refreshed };
        const accounts = await this.getAccounts();
        const updatedAccounts = accounts.map(acc => 
          acc.id === accountId ? account : acc
        );
        await chrome.storage.sync.set({ [this.ACCOUNTS_STORAGE_KEY]: updatedAccounts });
        
        console.log(`Successfully refreshed token for account ${account.email}`);
        return refreshed.access_token;
      } catch (error) {
        console.error(`Token refresh failed for account ${account.email}:`, error);
        // Mark account as inactive if refresh fails
        await this.toggleAccountActive(accountId, false);
        return null;
      }
    }
    
    console.warn(`No valid token or refresh token for account ${account.email}`);
    return null;
  }

  // Check if account token is valid
  static async isAccountTokenValid(accountId) {
    const account = await this.getAccount(accountId);
    if (!account) return false;

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = (account.authData.obtained_at || 0) + (account.authData.expires_in || 0) - 60;
    
    return account.authData.access_token && now < expiresAt;
  }

  // Proactively refresh tokens for all active accounts
  static async refreshAllTokens(clientId) {
    const activeAccounts = await this.getActiveAccounts();
    const refreshPromises = activeAccounts.map(async (account) => {
      if (account.provider === "google") {
        try {
          const token = await this.getValidTokenForAccount(account.id, clientId);
          if (token) {
            console.log(`Successfully refreshed token for ${account.email}`);
            return { accountId: account.id, success: true, status: "refreshed" };
          } else {
            console.warn(`Failed to get valid token for ${account.email}`);
            // Mark account as inactive if token refresh fails
            await this.toggleAccountActive(account.id, false);
            return { accountId: account.id, success: false, status: "marked_inactive" };
          }
        } catch (error) {
          console.error(`Failed to refresh token for ${account.email}:`, error);
          // Mark account as inactive on persistent failure
          await this.toggleAccountActive(account.id, false);
          return { accountId: account.id, success: false, status: "marked_inactive", error: error.message };
        }
      }
      return { accountId: account.id, success: true, status: "skipped" };
    });

    const results = await Promise.all(refreshPromises);
    
    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`Token refresh completed: ${successful} successful, ${failed} failed`);
    
    return results;
  }

  // Migrate existing single account to new structure
  static async migrateExistingAccount(clientId) {
    const { googleAuth } = await chrome.storage.sync.get(["googleAuth"]);
    if (!googleAuth || !googleAuth.access_token) return null;

    try {
      // Check if token is still valid before trying to fetch profile
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = (googleAuth.obtained_at || 0) + (googleAuth.expires_in || 0) - 60;
      
      if (now >= expiresAt) {
        console.log("Old Google auth token expired, skipping migration");
        await chrome.storage.sync.remove(["googleAuth"]);
        return null;
      }
      
      // Get user profile using the stored access token
      const profile = await fetchUserProfile(googleAuth.access_token);
      
      // Check if account already exists in new structure
      const existingAccounts = await this.getAccounts();
      const existingAccount = existingAccounts.find(acc => 
        acc.provider === "google" && acc.email === profile.email
      );
      
      if (existingAccount) {
        // Update existing account with tokens from old structure
        existingAccount.authData = googleAuth;
        const updatedAccounts = existingAccounts.map(acc => 
          acc.id === existingAccount.id ? existingAccount : acc
        );
        await chrome.storage.sync.set({ [this.ACCOUNTS_STORAGE_KEY]: updatedAccounts });
        return existingAccount;
      }
      
      // Create new account from old structure
      const account = await this.addAccount("google", googleAuth, profile);
      
      // Clear old structure
      await chrome.storage.sync.remove(["googleAuth"]);
      
      return account;
    } catch (error) {
      console.log("Failed to migrate existing account:", error.message);
      // Clear old storage even if migration failed
      await chrome.storage.sync.remove(["googleAuth"]);
      return null;
    }
  }
}
