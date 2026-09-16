import React from 'react';
import { MOODS, COMMON_STYLES, COLORS } from '../utils/constants';

function MoodPicker({ value, onChange, label = 'How are you feeling? (optional)' }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label
        style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 500,
          color: COLORS.darkBrown,
          marginBottom: '8px',
        }}
      >
        {label}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={COMMON_STYLES.moodChip(value === m)}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

export default React.memo(MoodPicker);
