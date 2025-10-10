// Multi-account management system for Google accounts
// Handles storage, authentication, and token management for multiple accounts

import { startGoogleAuth, getValidAccessToken, refreshAccessToken, signOutGoogle, fetchUserProfile } from "./calendar.js";

export class AccountManager {
  // Storage key for accounts
  static ACCOUNTS_STORAGE_KEY = "accounts";
  static PREFS_STORAGE_KEY = "prefs";

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
    try {
      // Start auth flow
      const tokens = await startGoogleAuth(clientId);
      
      // Get user profile
      const profile = await fetchUserProfile();
      
      // Check if account already exists
      const existingAccounts = await this.getAccounts();
      const existingAccount = existingAccounts.find(acc => 
        acc.provider === "google" && acc.email === profile.email
      );
      
      if (existingAccount) {
        // Update existing account with new tokens
        existingAccount.authData = tokens;
        existingAccount.picture = profile.picture || existingAccount.picture;
        existingAccount.name = profile.name || existingAccount.name;
        
        const updatedAccounts = existingAccounts.map(acc => 
          acc.id === existingAccount.id ? existingAccount : acc
        );
        await chrome.storage.sync.set({ [this.ACCOUNTS_STORAGE_KEY]: updatedAccounts });
        
        return { success: true, account: existingAccount, isNew: false };
      }
      
      // Add new account
      const account = await this.addAccount("google", tokens, profile);
      return { success: true, account, isNew: true };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get valid access token for a specific account
  static async getValidTokenForAccount(accountId, clientId) {
    const account = await this.getAccount(accountId);
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
        const accounts = await this.getAccounts();
        const updatedAccounts = accounts.map(acc => 
          acc.id === accountId ? account : acc
        );
        await chrome.storage.sync.set({ [this.ACCOUNTS_STORAGE_KEY]: updatedAccounts });
        
        return refreshed.access_token;
      } catch (error) {
        console.error(`Token refresh failed for account ${accountId}:`, error);
        return null;
      }
    }
    
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
          return { accountId: account.id, success: !!token };
        } catch (error) {
          console.error(`Failed to refresh token for ${account.email}:`, error);
          return { accountId: account.id, success: false, error: error.message };
        }
      }
      return { accountId: account.id, success: true };
    });

    const results = await Promise.all(refreshPromises);
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
      
      // Get user profile
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
