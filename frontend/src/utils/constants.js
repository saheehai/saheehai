export const COLORS = {
  primary: '#6B4423',
  cream: '#FFF8E7',
  darkBrown: '#5D4E37',
  lightCream: '#F5E6D3',
  mediumBrown: '#7A5C3C',
  brownBorder: 'rgba(93, 78, 55, 0.3)',
  brownBorderLight: 'rgba(93, 78, 55, 0.2)',
  brownHover: 'rgba(107, 68, 35, 0.1)',
  brownTagBg: 'rgba(107, 68, 35, 0.15)',
  brownLight: '#D3C4B0',
  brownDark: '#5A3619',
  errorBorder: '#D2691E',
  successBg: '#F0FFF4',
  successBorder: '#48BB78',
  successText: '#2F855A',
  overlay: 'rgba(0, 0, 0, 0.3)',
};

export const COMMON_STYLES = {
  header: {
    backgroundColor: COLORS.primary,
    color: COLORS.cream,
  },

  button: {
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: '500',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: COLORS.primary,
    color: COLORS.cream,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: `2px solid ${COLORS.brownBorder}`,
    backgroundColor: COLORS.cream,
    color: COLORS.darkBrown,
    outline: 'none',
    boxSizing: 'border-box',
  },

  card: {
    padding: '16px',
    backgroundColor: COLORS.cream,
    border: `2px solid ${COLORS.brownBorder}`,
    borderRadius: '8px',
  },

  alert: {
    error: {
      padding: '12px 16px',
      backgroundColor: COLORS.cream,
      border: `2px solid ${COLORS.errorBorder}`,
      borderRadius: '8px',
      color: COLORS.errorBorder,
      marginBottom: '20px',
      fontSize: '14px',
    },
    success: {
      padding: '12px 16px',
      backgroundColor: COLORS.successBg,
      border: `2px solid ${COLORS.successBorder}`,
      borderRadius: '8px',
      color: COLORS.successText,
      marginBottom: '20px',
      fontSize: '14px',
    },
  },

  moodChip: (active) => ({
    padding: '8px 16px',
    fontSize: '14px',
    borderRadius: '20px',
    border: '2px solid',
    borderColor: active ? COLORS.primary : COLORS.brownBorder,
    backgroundColor: active ? COLORS.primary : COLORS.cream,
    color: active ? COLORS.cream : COLORS.darkBrown,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textTransform: 'capitalize',
  }),
};

export const MOODS = ['calm', 'happy', 'stressed', 'anxious', 'grateful', 'reflective'];

export const MOOD_EMOJI_MAP = {
  calm: '😌',
  happy: '😊',
  stressed: '😰',
  anxious: '😟',
  grateful: '🙏',
  reflective: '🤔',
};

export const GREETING_MESSAGE = {
  id: 1,
  text: "Hello! I'm Saheeh AI. Ask me anything!",
  sender: 'assistant',
};

export const CHUNK_SIZE = 80;
export const TYPING_DELAY_MS = 3000;
export const DAILY_RATE_LIMIT = 50;

export const STORAGE_KEYS = {
  conversationId: 'conversationId',
  chatMessages: 'chatMessages',
  chatScrollPosition: 'chatScrollPosition',
  journalDraft: 'journalDraft',
  rateLimit: 'saheehAI_rateLimit',
  disclaimerAccepted: 'saheehAI_disclaimerAccepted',
  lastActive: 'saheehAI_lastActive',
  idleSignedOut: 'saheehAI_idleSignedOut',
  profile: 'saheehAI_profile',
  // Practice keeps what someone has met and what they marked, in this
  // browser and nowhere else. Cleared on sign out with the rest.
  practice: 'saheehAI_practice',
  practiceVotes: 'saheehAI_practiceVotes',
};
