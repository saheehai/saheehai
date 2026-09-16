import React from 'react';
import { COLORS, MOOD_EMOJI_MAP } from '../utils/constants';
import { formatDate } from '../utils/dateUtils';

function EntryCard({ entry }) {
  return (
    <div className="entry-card">
      <div className="entry-card__header">
        <div style={{ flex: 1 }}>
          {entry.title && (
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: COLORS.darkBrown, marginBottom: '4px' }}>
              {entry.title}
            </h3>
          )}
          <p style={{ fontSize: '13px', color: COLORS.mediumBrown }}>
            {formatDate(entry.timestamp)}
          </p>
        </div>
        {entry.mood && (
          <div className="entry-card__mood">
            <span>{MOOD_EMOJI_MAP[entry.mood] || ''}</span>
            <span style={{ color: COLORS.darkBrown, textTransform: 'capitalize' }}>{entry.mood}</span>
          </div>
        )}
      </div>

      <p className="entry-card__body">{entry.content}</p>

      {entry.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {entry.tags.map((tag, idx) => (
            <span key={`${tag}-${idx}`} className="entry-card__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(EntryCard);
