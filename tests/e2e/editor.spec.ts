import { expect, test } from '@playwright/test';

test('shows the Our Stage foundation screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Our Stage' })).toBeVisible();
  await expect(page.getByText('Bring a character. Direct a performance.')).toBeVisible();
});
