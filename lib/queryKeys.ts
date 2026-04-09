export const queryKeys = {
  todos: ['todos'] as const,
  todo: (id: number) => ['todos', id] as const,
  tags: ['tags'] as const,
  templates: ['templates'] as const,
  holidays: (year: number, month: number) => ['holidays', year, month] as const,
  user: ['auth', 'me'] as const,
  notifications: ['notifications'] as const,
} as const
