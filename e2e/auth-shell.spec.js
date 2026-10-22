import { expect, test } from '@playwright/test';

test('unauthenticated users are sent to the sign-in screen', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByText('Welcome back')).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('sign-in screen can switch to account creation without submitting', async ({ page }) => {
  await page.goto('/auth');

  await page.getByRole('button', { name: 'Create a new account' }).click();

  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  await expect(page.getByLabel('User Name')).toBeVisible();
  await expect(page.getByLabel('Confirm Password')).toBeVisible();
});
