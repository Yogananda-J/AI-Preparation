/**
 * Application constants
 * Centralized constants used throughout the application
 */

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  CHALLENGES: {
    LIST: '/challenges',
    DAILY: '/challenges/daily',
    SUBMIT: '/challenges/submit',
    RUN: '/challenges/run',
    STATS: '/challenges/stats',
    CATEGORIES: '/challenges/categories',
  },
  LEADERBOARD: {
    GLOBAL: '/leaderboard/global',
    COUNTRY: '/leaderboard/country',
    FRIENDS: '/leaderboard/friends',
    STATS: '/leaderboard/stats',
  },
  INTERVIEWS: {
    START: '/interviews/start',
    SUBMIT: '/interviews/submit-answer',
    COMPLETE: '/interviews/complete',
    HISTORY: '/interviews/history',
  },
};

// Difficulty Levels
export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export const DIFFICULTY_COLORS = {
  [DIFFICULTY_LEVELS.EASY]: {
    text: 'text-green-600',
    bg: 'bg-green-100',
    border: 'border-green-200',
  },
  [DIFFICULTY_LEVELS.MEDIUM]: {
    text: 'text-yellow-600',
    bg: 'bg-yellow-100',
    border: 'border-yellow-200',
  },
  [DIFFICULTY_LEVELS.HARD]: {
    text: 'text-red-600',
    bg: 'bg-red-100',
    border: 'border-red-200',
  },
};

// Programming Languages
export const PROGRAMMING_LANGUAGES = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  JAVA: 'java',
  CPP: 'cpp',
  C: 'c',
  CSHARP: 'csharp',
  GO: 'go',
  RUST: 'rust',
  TYPESCRIPT: 'typescript',
};

export const LANGUAGE_DISPLAY_NAMES = {
  [PROGRAMMING_LANGUAGES.JAVASCRIPT]: 'JavaScript',
  [PROGRAMMING_LANGUAGES.PYTHON]: 'Python',
  [PROGRAMMING_LANGUAGES.JAVA]: 'Java',
  [PROGRAMMING_LANGUAGES.CPP]: 'C++',
  [PROGRAMMING_LANGUAGES.C]: 'C',
  [PROGRAMMING_LANGUAGES.CSHARP]: 'C#',
  [PROGRAMMING_LANGUAGES.GO]: 'Go',
  [PROGRAMMING_LANGUAGES.RUST]: 'Rust',
  [PROGRAMMING_LANGUAGES.TYPESCRIPT]: 'TypeScript',
};

// Challenge Categories
export const CHALLENGE_CATEGORIES = {
  ARRAYS: 'arrays',
  STRINGS: 'strings',
  LINKED_LISTS: 'linked-lists',
  TREES: 'trees',
  GRAPHS: 'graphs',
  DYNAMIC_PROGRAMMING: 'dynamic-programming',
  SORTING: 'sorting',
  SEARCHING: 'searching',
  RECURSION: 'recursion',
  GREEDY: 'greedy',
  BACKTRACKING: 'backtracking',
  MATH: 'math',
  BIT_MANIPULATION: 'bit-manipulation',
};

export const CATEGORY_DISPLAY_NAMES = {
  [CHALLENGE_CATEGORIES.ARRAYS]: 'Arrays',
  [CHALLENGE_CATEGORIES.STRINGS]: 'Strings',
  [CHALLENGE_CATEGORIES.LINKED_LISTS]: 'Linked Lists',
  [CHALLENGE_CATEGORIES.TREES]: 'Trees',
  [CHALLENGE_CATEGORIES.GRAPHS]: 'Graphs',
  [CHALLENGE_CATEGORIES.DYNAMIC_PROGRAMMING]: 'Dynamic Programming',
  [CHALLENGE_CATEGORIES.SORTING]: 'Sorting',
  [CHALLENGE_CATEGORIES.SEARCHING]: 'Searching',
  [CHALLENGE_CATEGORIES.RECURSION]: 'Recursion',
  [CHALLENGE_CATEGORIES.GREEDY]: 'Greedy',
  [CHALLENGE_CATEGORIES.BACKTRACKING]: 'Backtracking',
  [CHALLENGE_CATEGORIES.MATH]: 'Math',
  [CHALLENGE_CATEGORIES.BIT_MANIPULATION]: 'Bit Manipulation',
};

// Interview Types
export const INTERVIEW_TYPES = {
  TECHNICAL: 'technical',
  BEHAVIORAL: 'behavioral',
  SYSTEM_DESIGN: 'system-design',
  MIXED: 'mixed',
};

export const INTERVIEW_TYPE_DISPLAY_NAMES = {
  [INTERVIEW_TYPES.TECHNICAL]: 'Technical Coding',
  [INTERVIEW_TYPES.BEHAVIORAL]: 'Behavioral',
  [INTERVIEW_TYPES.SYSTEM_DESIGN]: 'System Design',
  [INTERVIEW_TYPES.MIXED]: 'Mixed Interview',
};

// Submission Status
export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  ACCEPTED: 'accepted',
  WRONG_ANSWER: 'wrong_answer',
  TIME_LIMIT_EXCEEDED: 'time_limit_exceeded',
  MEMORY_LIMIT_EXCEEDED: 'memory_limit_exceeded',
  RUNTIME_ERROR: 'runtime_error',
  COMPILATION_ERROR: 'compilation_error',
};

export const STATUS_DISPLAY_NAMES = {
  [SUBMISSION_STATUS.PENDING]: 'Pending',
  [SUBMISSION_STATUS.RUNNING]: 'Running',
  [SUBMISSION_STATUS.ACCEPTED]: 'Accepted',
  [SUBMISSION_STATUS.WRONG_ANSWER]: 'Wrong Answer',
  [SUBMISSION_STATUS.TIME_LIMIT_EXCEEDED]: 'Time Limit Exceeded',
  [SUBMISSION_STATUS.MEMORY_LIMIT_EXCEEDED]: 'Memory Limit Exceeded',
  [SUBMISSION_STATUS.RUNTIME_ERROR]: 'Runtime Error',
  [SUBMISSION_STATUS.COMPILATION_ERROR]: 'Compilation Error',
};

export const STATUS_COLORS = {
  [SUBMISSION_STATUS.PENDING]: 'text-yellow-600 bg-yellow-100',
  [SUBMISSION_STATUS.RUNNING]: 'text-blue-600 bg-blue-100',
  [SUBMISSION_STATUS.ACCEPTED]: 'text-green-600 bg-green-100',
  [SUBMISSION_STATUS.WRONG_ANSWER]: 'text-red-600 bg-red-100',
  [SUBMISSION_STATUS.TIME_LIMIT_EXCEEDED]: 'text-orange-600 bg-orange-100',
  [SUBMISSION_STATUS.MEMORY_LIMIT_EXCEEDED]: 'text-purple-600 bg-purple-100',
  [SUBMISSION_STATUS.RUNTIME_ERROR]: 'text-red-600 bg-red-100',
  [SUBMISSION_STATUS.COMPILATION_ERROR]: 'text-gray-600 bg-gray-100',
};

// Leaderboard Categories
export const LEADERBOARD_CATEGORIES = {
  OVERALL: 'overall',
  PROBLEMS_SOLVED: 'problems',
  CURRENT_STREAK: 'streak',
  FASTEST_SOLUTIONS: 'speed',
  ACCURACY: 'accuracy',
};

export const LEADERBOARD_TIMEFRAMES = {
  ALL_TIME: 'all-time',
  MONTHLY: 'monthly',
  WEEKLY: 'weekly',
  DAILY: 'daily',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'user',
  THEME: 'theme',
  LANGUAGE_PREFERENCE: 'languagePreference',
  EDITOR_SETTINGS: 'editorSettings',
};

// Theme Options
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
};

// Time Limits (in seconds)
export const TIME_LIMITS = {
  EASY_CHALLENGE: 1800, // 30 minutes
  MEDIUM_CHALLENGE: 2700, // 45 minutes
  HARD_CHALLENGE: 3600, // 60 minutes
  INTERVIEW_SESSION: 2700, // 45 minutes
};

// Code Editor Settings
export const EDITOR_THEMES = {
  VS_DARK: 'vs-dark',
  VS_LIGHT: 'vs',
  HIGH_CONTRAST: 'hc-black',
};

export const EDITOR_FONT_SIZES = [12, 14, 16, 18, 20, 22, 24];

// Validation Rules
export const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    PATTERN: /^[a-zA-Z0-9_]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: false,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Internal server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in!',
  REGISTER_SUCCESS: 'Account created successfully!',
  LOGOUT_SUCCESS: 'Successfully logged out!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
  SOLUTION_SUBMITTED: 'Solution submitted successfully!',
  DRAFT_SAVED: 'Draft saved successfully!',
};

// Application Metadata
export const APP_METADATA = {
  NAME: 'AI CodeSkill',
  DESCRIPTION: 'AI-Based Coding Skill Enhancer & Interview Prep',
  VERSION: '1.0.0',
  AUTHOR: 'AI CodeSkill Team',
  CONTACT_EMAIL: 'contact@aicodeskill.com',
  GITHUB_URL: 'https://github.com/aicodeskill',
  DOCUMENTATION_URL: 'https://docs.aicodeskill.com',
};
