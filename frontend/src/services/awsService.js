import { getIdToken } from './cognitoService';

// No fallback endpoint on purpose. A hardcoded default gets baked into every
// published bundle, which is how the previous API URL ended up public. A build
// without REACT_APP_API_ENDPOINT set is a misconfigured build.
//
// Resolved lazily rather than in the constructor: this module is a singleton
// instantiated at import time, so throwing there would take down every route,
// including the ones that never call the API.
const API_ENDPOINT = (process.env.REACT_APP_API_ENDPOINT || '').replace(/\/+$/, '');

class AWSService {
  get baseEndpoint() {
    if (!API_ENDPOINT) {
      throw new Error(
        'REACT_APP_API_ENDPOINT is not set. Copy frontend/.env.example to ' +
          'frontend/.env.local and set it before running or building the app.'
      );
    }
    return API_ENDPOINT;
  }

  get chatEndpoint() {
    return `${this.baseEndpoint}/chat`;
  }

  get journalEndpoint() {
    return `${this.baseEndpoint}/journal`;
  }

  get profileEndpoint() {
    return `${this.baseEndpoint}/profile`;
  }

  get accountEndpoint() {
    return `${this.baseEndpoint}/account`;
  }

  /**
   * Authenticated request.
   *
   * getIdToken refreshes an expired id token using the refresh token, so a
   * long session does not start failing mid-conversation. A null token means
   * genuinely signed out, which the UI handles by showing the sign-in screen
   * rather than by surfacing an error.
   */
  async _request(url, options = {}) {
    const token = await getIdToken();
    if (!token) {
      const error = new Error('Your session has ended. Please sign in again.');
      error.status = 401;
      throw error;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error(detail.error || `API responded with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  /**
   * Send a chat message.
   *
   * Note what is no longer sent: `user_id`, which the server takes from the
   * verified Cognito token, and `history`, which the server reads from
   * storage. Both used to be caller-supplied, which let anyone claim another
   * identity or forge the model's own prior turns.
   */
  async sendMessage(message, conversationId = null) {
    try {
      const payload = { message };
      if (conversationId) payload.conversation_id = conversationId;

      const data = await this._request(this.chatEndpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        response: data.response || 'No response from API',
        conversationId: data.conversation_id || conversationId,
        timestamp: data.timestamp,
        quota: data.quota,
      };
    } catch (error) {
      console.error('Chat API error:', error.message);
      throw error;
    }
  }

  async saveJournal(content, title = '', mood = '', tags = []) {
    try {
      const data = await this._request(this.journalEndpoint, {
        method: 'POST',
        body: JSON.stringify({ content, title, mood, tags }),
      });
      return { entryId: data.entry_id, timestamp: data.timestamp };
    } catch (error) {
      console.error('Journal save error:', error.message);
      throw error;
    }
  }

  async getJournalEntries(limit = 20) {
    try {
      // No user_id parameter: the server scopes entries to the authenticated
      // identity. Passing one used to return anybody's entries.
      const data = await this._request(`${this.journalEndpoint}?limit=${limit}`);
      return data.entries || [];
    } catch (error) {
      console.error('Journal fetch error:', error.message);
      throw error;
    }
  }

  // --- Account -------------------------------------------------------------

  /** Nickname and picture, or an empty object. */
  async getProfile() {
    const data = await this._request(this.profileEndpoint);
    return data.profile || {};
  }

  /** Replace the profile. Empty strings clear a field. */
  /**
   * Replaces the whole profile, sharing choices included.
   *
   * The two flags are always sent explicitly. The server keeps its default
   * for anything missing, so leaving one out would quietly reset it.
   */
  async saveProfile({ nickname = '', avatar = '', shareNickname = true, shareJournal = false }) {
    const data = await this._request(this.profileEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        nickname,
        avatar,
        share_nickname: !!shareNickname,
        share_journal: !!shareJournal,
      }),
    });
    return data.profile || {};
  }

  /** Everything held for the signed-in person, as the export document. */
  exportData() {
    return this._request(`${this.accountEndpoint}/export`);
  }

  /** Chats, journal and profile gone; the account stays. */
  deleteData() {
    return this._request(`${this.accountEndpoint}/delete-data`, {
      method: 'POST',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  }

  /**
   * Remove everything in the tables ahead of deleting the account itself.
   * The confirmation is the person's own email, typed by them.
   */
  deleteAccountData(confirmEmail) {
    return this._request(`${this.accountEndpoint}/delete`, {
      method: 'POST',
      body: JSON.stringify({ confirm: confirmEmail }),
    });
  }
}

const awsService = new AWSService();
export default awsService;
