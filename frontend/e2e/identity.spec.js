/** Exercise real browser identity journeys; E2E execution belongs to the parent run. */
import { expect, test } from '@playwright/test';

/** Capture console and uncaught errors before the initial navigation.
 * @param {import('@playwright/test').Page} page Browser page.
 * @returns {string[]} Collected runtime errors.
 */
function captureErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('register, reload, profile logout, bad login and valid login preserve local identity', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  const registration = page.getByRole('form', { name: 'Register' });
  await registration.getByLabel('Display Name', { exact: false }).fill('Browser Writer');
  await registration.getByLabel('Username', { exact: false }).fill('browser-writer');
  await registration.getByLabel('Password *', { exact: true }).fill('dummy-browser-password');
  await registration.getByLabel('Confirm Password *', { exact: true }).fill('dummy-browser-password');
  await registration.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const profile = page.getByRole('button', { name: 'Profile for Browser Writer' });
  await expect(profile).toBeVisible();
  const persisted = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(persisted.users).toHaveLength(1);
  expect(persisted.users[0]).toMatchObject({ displayName: 'Browser Writer', username: 'browser-writer', password: 'dummy-browser-password', role: 'user' });
  expect(persisted.session).toEqual({ userId: persisted.users[0].id, username: 'browser-writer', displayName: 'Browser Writer', role: 'user' });
  expect(persisted.session).not.toHaveProperty('password');
  await page.reload();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(profile).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(persisted.session);
  await profile.click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(persisted.users);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  const login = page.getByRole('form', { name: 'Login' });
  await login.getByLabel('Username', { exact: false }).fill('browser-writer');
  await login.getByLabel('Password', { exact: false }).fill('wrong');
  await login.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(login.getByRole('alert')).toHaveText('Invalid username or password.');
  await expect(login.getByLabel('Password', { exact: false })).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await login.getByLabel('Password', { exact: false }).fill('dummy-browser-password');
  await login.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(profile).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(persisted.session);
  expect(errors).toEqual([]);
});

test('built-in admin logs in to admin home and logs out through the profile', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/login');
  await expect(page.getByText(/admin \/ admin/)).toBeVisible();
  const login = page.getByRole('form', { name: 'Login' });
  await login.getByLabel('Username', { exact: false }).fill('admin');
  await login.getByLabel('Password', { exact: false }).fill('admin');
  await login.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const profile = page.getByRole('button', { name: 'Profile for Admin' });
  await expect(profile).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await profile.click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(errors).toEqual([]);
});

// Guest protected initial entries, authenticated login/register redirects, and
// responsive role navigation are already covered in roles.spec.js, not duplicated here.
