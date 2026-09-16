import { generateUUID } from '../utils/textUtils';

const USER_ID = 'anonymous';

// No fallback endpoint on purpose. A hardcoded default gets baked into every
// published bundle, which is how the previous API URL ended up public. A build
// without REACT_APP_API_ENDPOINT set is a misconfigured build.
//
// Resolved lazily rather than in the constructor: this module is a singleton
// instantiated at import time, so throwing there would take down every route,
// including the ones that never call the API.
const API_ENDPOINT = (process.env.REACT_APP_API_ENDPOINT || '').replace(/\/+$/, '');

class AWSService {
  constructor() {
    this.userId = USER_ID;
  }

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

  async _request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API responded with status ${response.status}`);
    }

    return response.json();
  }

  async sendMessage(message, conversationId = null, loadHistory = false) {
    try {
      const convId = conversationId || generateUUID();
      const data = await this._request(this.chatEndpoint, {
        method: 'POST',
        body: JSON.stringify({
          user_id: this.userId,
          conversation_id: convId,
          message,
          load_history: loadHistory,
        }),
      });
      return {
        response: data.response || 'No response from API',
        conversationId: data.conversation_id || convId,
        timestamp: data.timestamp,
      };
    } catch (error) {
      console.error('Chat API error:', error);
      throw new Error(error.message || 'Failed to get AI response');
    }
  }

  async saveJournal(content, title = '', mood = '', tags = [], timestamp = null) {
    try {
      const payload = { user_id: this.userId, content, title, mood, tags };
      if (timestamp) payload.timestamp = timestamp;

      const data = await this._request(this.journalEndpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return { entryId: data.entry_id, timestamp: data.timestamp };
    } catch (error) {
      console.error('Journal save error:', error);
      throw new Error(error.message || 'Failed to save journal entry');
    }
  }

  async getJournalEntries(limit = 20) {
    try {
      const url = `${this.journalEndpoint}?user_id=${this.userId}&limit=${limit}`;
      const data = await this._request(url);
      return data.entries || [];
    } catch (error) {
      console.error('Journal fetch error:', error);
      throw new Error(error.message || 'Failed to fetch journal entries');
    }
  }
}

const awsService = new AWSService();
export default awsService;
