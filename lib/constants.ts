/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

export const CHAT_CONSTANTS = {
  // Message truncation settings
  DEFAULT_TRUNCATE_LENGTH: 150,
  MIN_TRUNCATE_LENGTH: 150,
  MAX_TRUNCATE_LENGTH: 1000,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50,
  
  // Debounce timings (in milliseconds)
  SEARCH_DEBOUNCE_MS: 300,
  INPUT_DEBOUNCE_MS: 500,
  
  // Auto-scroll threshold (pixels from bottom)
  AUTO_SCROLL_THRESHOLD: 100,
  
  // Code block settings
  MIN_LINES_FOR_LINE_NUMBERS: 5,
  
  // Copy feedback duration (milliseconds)
  COPY_FEEDBACK_DURATION: 2000,
} as const

export const MODEL_CONSTANTS = {
  DEFAULT_MODEL: 'mistral-large',
  SUPPORTED_MODELS: [
    'mistral-large',
    'mistral-small',
    'mistral-medium',
  ] as const,
} as const

export const THEME_CONSTANTS = {
  // Theme names
  THEMES: ['light', 'dark'] as const,
  DEFAULT_THEME: 'dark',
  
  // Keybindings
  KEYBINDINGS: ['enter', 'ctrl-enter'] as const,
  DEFAULT_KEYBINDING: 'enter',
} as const

export const RATE_LIMIT_CONSTANTS = {
  // Chat rate limits
  MAX_MESSAGES_PER_MINUTE: 10,
  MAX_MESSAGES_PER_HOUR: 100,
  
  // OTP rate limits
  MAX_OTP_REQUESTS_PER_HOUR: 5,
} as const

export const UI_CONSTANTS = {
  // Sidebar
  SIDEBAR_COLLAPSE_BREAKPOINT: 768, // md breakpoint
  
  // Empty state suggestions
  MAX_SUGGESTIONS: 3,
  
  // Keyboard shortcuts
  SHORTCUTS: {
    FOCUS_INPUT: 'Ctrl+I',
    TOGGLE_SIDEBAR: 'Cmd+B',
    OPEN_SETTINGS: 'Cmd+/',
    OPEN_SEARCH: 'Cmd+K',
    CLOSE_MODAL: 'Escape',
  },
} as const
