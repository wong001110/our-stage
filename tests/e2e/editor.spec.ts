import { expect, test } from '@playwright/test';

test('shows the Our Stage editor shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Our Stage' })).toBeVisible();
  await expect(page.getByText('Assets')).toBeVisible();
  await expect(page.getByText('Timeline')).toBeVisible();
});
