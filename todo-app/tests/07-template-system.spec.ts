import { expect, test } from '@playwright/test';
import { gotoApp, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('save and use a template', async ({ page }) => {
  await loginAs(page, 'template-user');
  await gotoApp(page);

  await page.getByLabel('Todo title').fill('Weekly review');
  await page.getByLabel('Template name').fill('Weekly Review Template');
  const saveTemplateRequest = page.waitForResponse((response) => response.url().endsWith('/api/templates') && response.request().method() === 'POST');
  const refreshTemplatesRequest = page.waitForResponse((response) => response.url().endsWith('/api/templates') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Save as Template' }).click();
  await Promise.all([saveTemplateRequest, refreshTemplatesRequest]);
  await expect(page.getByText('Weekly Review Template')).toBeVisible();

  const useTemplateRequest = page.waitForResponse((response) => response.url().match(/\/api\/templates\/\d+\/use$/) !== null && response.request().method() === 'POST');
  const refreshTodosRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Use Template' }).click();
  await Promise.all([useTemplateRequest, refreshTodosRequest]);
  await expect(page.getByLabel('Toggle Weekly review')).toBeVisible();
});
