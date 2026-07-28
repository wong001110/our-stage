import { expect, test } from '@playwright/test';

test('shows the Our Stage editor shell and Phase 9 controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Our Stage/ })).toBeVisible();
  await expect(page.getByText('Assets', { exact: true })).toBeVisible();
  await expect(page.getByText('Timeline', { exact: true })).toBeVisible();
  await expect(page.getByText('Pose Override', { exact: true })).toBeVisible();
});
