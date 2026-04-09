import { expect, test } from '@playwright/test';
import { insertTodo, loginAs, resetDatabase, seedHoliday } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('calendar shows holiday and opens day modal', async ({ page }) => {
  const { userId } = await loginAs(page, 'calendar-user');
  insertTodo(userId, { title: 'Conference', due_date: '2030-01-05T10:00:00.000Z' });
  seedHoliday('2030-01-05', 'Special Holiday');

  await page.goto('/calendar?month=2030-01');
  await page.waitForFunction(() => document.body.dataset.calendarLoaded === 'true');
  await expect(page.getByText('Special Holiday')).toBeVisible();
  await page.getByLabel('Open 2030-01-05').click();
  await expect(page.getByText('Day Details')).toBeVisible();
  await expect(page.getByRole('article').getByText('Conference')).toBeVisible();
});
