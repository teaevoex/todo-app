import { expect, test } from '@playwright/test';
import { gotoApp, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('add subtasks and update progress', async ({ page }) => {
  await loginAs(page, 'subtask-user');
  await gotoApp(page);

  await page.getByLabel('Todo title').fill('Prepare presentation');
  const createRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'POST');
  const refreshRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await Promise.all([createRequest, refreshRequest]);

  const addFirstSubtask = page.waitForResponse((response) => response.url().match(/\/api\/todos\/\d+\/subtasks$/) !== null && response.request().method() === 'POST');
  const refreshAfterFirstSubtask = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByLabel('Add subtask for Prepare presentation').fill('Create slides');
  await page.getByRole('button', { name: 'Add' }).last().click();
  await Promise.all([addFirstSubtask, refreshAfterFirstSubtask]);

  const addSecondSubtask = page.waitForResponse((response) => response.url().match(/\/api\/todos\/\d+\/subtasks$/) !== null && response.request().method() === 'POST');
  const refreshAfterSecondSubtask = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByLabel('Add subtask for Prepare presentation').fill('Rehearse');
  await page.getByRole('button', { name: 'Add' }).last().click();
  await Promise.all([addSecondSubtask, refreshAfterSecondSubtask]);

  await expect(page.getByText('0/2 completed (0%)')).toBeVisible();
  const toggleSubtask = page.waitForResponse((response) => response.url().match(/\/api\/subtasks\/\d+$/) !== null && response.request().method() === 'PUT');
  const refreshAfterToggle = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.locator('article input[type="checkbox"]').nth(1).click();
  await Promise.all([toggleSubtask, refreshAfterToggle]);
  await expect(page.getByText('1/2 completed (50%)')).toBeVisible();
});
