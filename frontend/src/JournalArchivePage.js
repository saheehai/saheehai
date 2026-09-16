import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import awsService from "./services/awsService";
import { formatDate, formatMonthYear, getDateString } from "./utils/dateUtils";
import Header from "./components/Header";
import Alert from "./components/Alert";
import EntryCard from "./components/EntryCard";
import { COLORS, COMMON_STYLES } from "./utils/constants";

function JournalArchivePage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchDate, setSearchDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const allEntries = await awsService.getJournalEntries(100);
        if (cancelled) return;
        setEntries(allEntries);

        if (allEntries.length > 0) {
          const currentMonth = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long',
          });
          setExpandedMonths(new Set([currentMonth]));
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load journal entries:', err);
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredAndGrouped = useMemo(() => {
    const lowerSearch = searchText.toLowerCase();
    const groups = {};

    for (const entry of entries) {
      if (searchDate && entry.timestamp) {
        if (getDateString(entry.timestamp) !== searchDate) continue;
      }
      if (lowerSearch) {
        const hit =
          entry.content?.toLowerCase().includes(lowerSearch) ||
          entry.title?.toLowerCase().includes(lowerSearch) ||
          entry.tags?.some((tag) => tag.toLowerCase().includes(lowerSearch));
        if (!hit) continue;
      }

      const groupKey = !entry.timestamp
        ? 'Unknown Date'
        : searchDate
          ? formatDate(entry.timestamp)
          : formatMonthYear(entry.timestamp);

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(entry);
    }

    return Object.entries(groups);
  }, [entries, searchDate, searchText]);

  const toggleMonth = useCallback((monthYear) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthYear)) next.delete(monthYear);
      else next.add(monthYear);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <Header
        left={
          <button onClick={() => navigate('/journal')} className="logout-button back-button">
            <ChevronLeft size={16} />
            Daily Journal
          </button>
        }
        title="Past Journals"
      />

      <div className="page-content page-content--wide">
        {loading ? (
          <div style={{ textAlign: 'center', color: COLORS.darkBrown, fontSize: '18px' }}>
            Loading your journals...
          </div>
        ) : error ? (
          <Alert kind="error" style={{ textAlign: 'center', padding: '16px' }}>{error}</Alert>
        ) : (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search by title, content, or tags..."
                  style={{
                    ...COMMON_STYLES.input,
                    flex: 1,
                    minWidth: '200px',
                    fontSize: '14px',
                    width: 'auto',
                  }}
                />
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  style={{
                    ...COMMON_STYLES.input,
                    fontSize: '14px',
                    width: 'auto',
                  }}
                />
              </div>
            </div>

            {entries.length === 0 ? (
              <div style={{ textAlign: 'center', color: COLORS.mediumBrown, fontSize: '16px', marginTop: '40px' }}>
                No journal entries yet. Start writing to see them here!
              </div>
            ) : (
              filteredAndGrouped.map(([monthYear, monthEntries]) => {
                const isExpanded = expandedMonths.has(monthYear);
                return (
                  <div key={monthYear} style={{ marginBottom: '24px' }}>
                    <button
                      onClick={() => toggleMonth(monthYear)}
                      className="month-toggle"
                    >
                      <span>{monthYear} ({monthEntries.length})</span>
                      <span style={{ fontSize: '20px' }}>{isExpanded ? '−' : '+'}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {monthEntries.map((entry) => (
                          <EntryCard key={entry.entry_id} entry={entry} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default JournalArchivePage;
