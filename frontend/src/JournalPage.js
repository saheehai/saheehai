import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import awsService from "./services/awsService";
import { History } from "lucide-react";
import SiteNav from "./components/SiteNav";
import SiteFooter from "./components/SiteFooter";
import Alert from "./components/Alert";
import FormInput from "./components/FormInput";
import MoodPicker from "./components/MoodPicker";
import { COLORS, COMMON_STYLES, STORAGE_KEYS } from "./utils/constants";
import Sprout from './components/Sprout';

const isToday = (timestamp) => {
  const entryDate = new Date(timestamp);
  return entryDate.toDateString() === new Date().toDateString();
};

function JournalPage({ onSignOut }) {
  const navigate = useNavigate();
  const [todayEntry, setTodayEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const entries = await awsService.getJournalEntries(1);

        if (cancelled) return;

        if (entries.length > 0 && isToday(entries[0].timestamp)) {
          const entry = entries[0];
          setTodayEntry(entry);
          setTitle(entry.title || '');
          setContent(entry.content || '');
          setMood(entry.mood || '');
          setTags(entry.tags ? entry.tags.join(', ') : '');
          localStorage.removeItem(STORAGE_KEYS.journalDraft);
        } else {
          const draftRaw = localStorage.getItem(STORAGE_KEYS.journalDraft);
          if (!draftRaw) return;
          try {
            const draft = JSON.parse(draftRaw);
            if (new Date(draft.date).toDateString() === new Date().toDateString()) {
              setTitle(draft.title || '');
              setContent(draft.content || '');
              setMood(draft.mood || '');
              setTags(draft.tags || '');
            } else {
              localStorage.removeItem(STORAGE_KEYS.journalDraft);
            }
          } catch (e) {
            console.error('Failed to parse draft:', e);
            localStorage.removeItem(STORAGE_KEYS.journalDraft);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load journal entry:', err);
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!todayEntry && (title || content || mood || tags)) {
      localStorage.setItem(
        STORAGE_KEYS.journalDraft,
        JSON.stringify({ title, content, mood, tags, date: new Date().toISOString() })
      );
    }
  }, [title, content, mood, tags, todayEntry]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('Please write something in your journal entry');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');

      const tagArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // Only used for the optimistic local render below. The server stamps
      // the authoritative timestamp; it no longer accepts one from the client.
      const timestamp = new Date().toISOString();

      const result = await awsService.saveJournal(content, title, mood, tagArray);

      setSuccessMessage('Journal entry saved successfully!');
      setTodayEntry({
        entry_id: result.entryId,
        timestamp: result.timestamp || timestamp,
        content,
        title,
        mood,
        tags: tagArray,
      });

      localStorage.removeItem(STORAGE_KEYS.journalDraft);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save journal entry:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [content, title, mood, tags]);

  const dateLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }),
    []
  );

  const submitDisabled = saving || !content.trim();

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn onSignOut={onSignOut} />

      <div className="page-content">
        {loading ? (
          <Sprout label="Loading your journal" />
        ) : (
          <div>
            <div className="page-heading">
              <div>
                <p className="page-heading__eyebrow">Daily journal</p>
                <h1 className="page-heading__title">{dateLabel}</h1>
              </div>
              <button
                type="button"
                onClick={() => navigate('/journal/archive')}
                className="page-heading__action"
              >
                <History size={16} aria-hidden="true" />
                Past journals
              </button>
            </div>

            {todayEntry && (
              <p style={{ fontSize: '14px', color: COLORS.mediumBrown, marginBottom: '24px', fontStyle: 'italic' }}>
                You've already written your journal entry for today. You can view or edit it below.
              </p>
            )}

            {error && <Alert kind="error">{error}</Alert>}
            {successMessage && <Alert kind="success">{successMessage}</Alert>}

            <form onSubmit={handleSubmit}>
              <FormInput
                label="Title (optional)"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your entry a title..."
              />

              <MoodPicker value={mood} onChange={setMood} />

              <FormInput
                as="textarea"
                label="Journal Entry"
                required
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your thoughts for today..."
              />

              <FormInput
                label="Tags (optional, comma-separated)"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., gratitude, work, family"
                containerStyle={{ marginBottom: '24px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="submit"
                  disabled={submitDisabled}
                  style={{
                    ...COMMON_STYLES.button,
                    backgroundColor: submitDisabled ? COLORS.brownLight : COLORS.primary,
                    cursor: submitDisabled ? 'not-allowed' : 'pointer',
                    opacity: submitDisabled ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving...' : todayEntry ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

export default JournalPage;
