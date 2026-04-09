export const TEMPLATE_CATEGORIES = [
  'Work',
  'Personal',
  'Project',
  'Health',
  'Finance',
  'Learning',
  'Other',
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]
