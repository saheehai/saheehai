import { STORAGE_KEYS, DAILY_RATE_LIMIT } from '../utils/constants';

const getCurrentDate = () => new Date().toISOString().split('T')[0];

class RateLimitService {
  _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.rateLimit);
      if (!raw) return { date: getCurrentDate(), count: 0 };
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error reading rate limit data:', err);
      return { date: getCurrentDate(), count: 0 };
    }
  }

  _write(data) {
    try {
      localStorage.setItem(STORAGE_KEYS.rateLimit, JSON.stringify(data));
    } catch (err) {
      console.error('Error saving rate limit data:', err);
    }
  }

  _todayData() {
    const today = getCurrentDate();
    const data = this._read();
    if (data.date !== today) return { date: today, count: 0 };
    return data;
  }

  checkAndIncrement() {
    const data = this._todayData();

    if (data.count >= DAILY_RATE_LIMIT) {
      return { allowed: false, remaining: 0, count: data.count, limit: DAILY_RATE_LIMIT };
    }

    data.count++;
    this._write(data);
    return { allowed: true, remaining: DAILY_RATE_LIMIT - data.count, count: data.count, limit: DAILY_RATE_LIMIT };
  }

  rollback() {
    const data = this._read();
    if (data.count > 0) {
      data.count--;
      this._write(data);
    }
  }

  getStatus() {
    const data = this._todayData();
    return { count: data.count, remaining: DAILY_RATE_LIMIT - data.count, limit: DAILY_RATE_LIMIT };
  }

  reset() {
    localStorage.removeItem(STORAGE_KEYS.rateLimit);
  }
}

const rateLimitService = new RateLimitService();
export default rateLimitService;
