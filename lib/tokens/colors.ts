export const colorTokens = {
  light: {
    // Surface
    'surface-primary':    '#FFFFFF',
    'surface-secondary':  '#F9FAFB',
    'surface-tertiary':   '#F3F4F6',
    'surface-inverse':    '#111827',

    // Text
    'text-primary':       '#111827',
    'text-secondary':     '#4B5563',
    'text-tertiary':      '#9CA3AF',
    'text-inverse':       '#FFFFFF',
    'text-on-color':      '#FFFFFF',

    // Border
    'border-primary':     '#E5E7EB',
    'border-secondary':   '#D1D5DB',
    'border-focus':       '#3B82F6',

    // Interactive
    'interactive-primary':       '#3B82F6',
    'interactive-primary-hover': '#2563EB',
    'interactive-secondary':     '#6B7280',
    'interactive-danger':        '#EF4444',
    'interactive-danger-hover':  '#DC2626',
  },
  dark: {
    'surface-primary':    '#111827',
    'surface-secondary':  '#1F2937',
    'surface-tertiary':   '#374151',
    'surface-inverse':    '#F9FAFB',

    'text-primary':       '#F9FAFB',
    'text-secondary':     '#D1D5DB',
    'text-tertiary':      '#6B7280',
    'text-inverse':       '#111827',
    'text-on-color':      '#FFFFFF',

    'border-primary':     '#374151',
    'border-secondary':   '#4B5563',
    'border-focus':       '#60A5FA',

    'interactive-primary':       '#60A5FA',
    'interactive-primary-hover': '#3B82F6',
    'interactive-secondary':     '#9CA3AF',
    'interactive-danger':        '#F87171',
    'interactive-danger-hover':  '#EF4444',
  },
} as const
