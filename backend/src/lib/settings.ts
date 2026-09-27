import { prisma } from './prisma';

/** Keys editable by admin. Empty stats.* value means "use the real number from the database". */
export const SETTING_DEFAULTS = {
  'site.name': 'Somon',
  'site.fullName': 'Веб-приложение для управления образовательным центром Somon',
  'site.tagline': 'Учись. Развивайся. Достигай большего вместе с Somon.',
  'site.description':
    'Somon — современный образовательный центр. Мы обучаем программированию, дизайну, аналитике данных и цифровым профессиям через практику, живые занятия и поддержку преподавателей.',
  'about.text':
    'Somon объединяет очные и онлайн-занятия, практические проекты и прозрачную систему оценки. Каждый студент видит свой прогресс, получает обратную связь от преподавателя и собирает портфолио реальных работ.',
  'contact.phone': '+992 37 123 45 67',
  'contact.email': 'info@somon.tj',
  'contact.address': 'г. Душанбе, пр. Рудаки 123',
  'contact.workHours': 'Пн–Пт 9:00–19:00, Сб 10:00–16:00',
  'social.instagram': '',
  'social.telegram': '',
  'social.facebook': '',
  'social.youtube': '',
  'stats.students': '',
  'stats.courses': '',
  'stats.teachers': '',
  'stats.directions': '',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await prisma.siteSetting.findMany();
  const result = { ...SETTING_DEFAULTS } as Record<SettingKey, string>;
  for (const row of rows) {
    if (row.key in result) result[row.key as SettingKey] = row.value;
  }
  return result;
}

export async function saveSettings(values: Partial<Record<SettingKey, string>>) {
  for (const key of SETTING_KEYS) {
    const value = values[key];
    if (value === undefined) continue;
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
  return getSettings();
}
