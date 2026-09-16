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
}

const awsService = new AWSService();
export default awsService;
