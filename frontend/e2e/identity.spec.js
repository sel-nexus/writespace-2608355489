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

test('register, profile logout, bad login and valid login preserve local identity', async ({ page }) => {
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
  await page.getByRole('navigation', { name: 'Authenticated navigation' })
    .getByRole('link', { name: 'WriteSpace.', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
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

for (const [label, message] of [
  ['Display Name *', 'Display Name is required.'],
  ['Username *', 'Username is required.'],
  ['Password *', 'Password is required.'],
  ['Confirm Password *', 'Confirm Password is required.'],
]) {
  test(`registration requires ${label} and persists only after UI correction`, async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Public navigation' })
      .getByRole('link', { name: 'Get Started', exact: true }).click();
    const form = page.getByRole('form', { name: 'Register' });
    const values = {
      'Display Name *': 'Required Writer', 'Username *': 'required-writer',
      'Password *': 'dummy-required', 'Confirm Password *': 'dummy-required',
    };
    for (const [field, value] of Object.entries(values)) {
      if (field !== label) await form.getByLabel(field, { exact: true }).fill(value);
    }
    await form.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(form.getByRole('alert')).toHaveText(message);
    await expect(form.getByLabel(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
    expect(await page.evaluate(() => ({
      users: localStorage.getItem('writespace_users'), session: localStorage.getItem('writespace_session'),
    }))).toEqual({ users: null, session: null });
    await form.getByLabel(label, { exact: true }).fill(values[label]);
    await expect(form.getByRole('alert')).toHaveCount(0);
    await form.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('button', { name: 'Profile for Required Writer' })).toBeVisible();
    const saved = await page.evaluate(() => ({
      users: JSON.parse(localStorage.getItem('writespace_users')),
      session: JSON.parse(localStorage.getItem('writespace_session')),
    }));
    expect(saved.users).toHaveLength(1);
    expect(saved.users[0]).toEqual({
      id: expect.any(String), createdAt: expect.any(String), displayName: 'Required Writer',
      username: 'required-writer', password: 'dummy-required', role: 'user',
    });
    expect(saved.session).toEqual({
      userId: saved.users[0].id, username: 'required-writer', displayName: 'Required Writer', role: 'user',
    });
    expect(errors).toEqual([]);
  });
}

test('mismatched passwords and reserved username recover through UI corrections without premature writes', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Public navigation' })
    .getByRole('link', { name: 'Get Started', exact: true }).click();
  const form = page.getByRole('form', { name: 'Register' });
  await form.getByLabel('Display Name *', { exact: true }).fill('Corrected Writer');
  await form.getByLabel('Username *', { exact: true }).fill(' ADMIN ');
  await form.getByLabel('Password *', { exact: true }).fill('dummy-corrected');
  await form.getByLabel('Confirm Password *', { exact: true }).fill('not-matching');
  await form.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText('Passwords must match.');
  await expect(form.getByLabel('Confirm Password *', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => ({
    users: localStorage.getItem('writespace_users'), session: localStorage.getItem('writespace_session'),
  }))).toEqual({ users: null, session: null });
  await form.getByLabel('Confirm Password *', { exact: true }).fill('dummy-corrected');
  await expect(form.getByRole('alert')).toHaveCount(0);
  await form.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(form.getByRole('alert')).toHaveText('Username is already taken.');
  await expect(form.getByLabel('Username *', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => ({
    users: localStorage.getItem('writespace_users'), session: localStorage.getItem('writespace_session'),
  }))).toEqual({ users: null, session: null });
  await form.getByLabel('Username *', { exact: true }).fill('corrected-writer');
  await expect(form.getByRole('alert')).toHaveCount(0);
  await form.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('button', { name: 'Profile for Corrected Writer' })).toBeVisible();
  const saved = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(saved.users).toHaveLength(1);
  expect(saved.users[0]).toEqual({
    id: expect.any(String), createdAt: expect.any(String), displayName: 'Corrected Writer',
    username: 'corrected-writer', password: 'dummy-corrected', role: 'user',
  });
  expect(saved.session).toEqual({
    userId: saved.users[0].id, username: 'corrected-writer', displayName: 'Corrected Writer', role: 'user',
  });
  expect(errors).toEqual([]);
});

test('duplicate username preserves the UI-created account until corrected registration succeeds', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  const publicNav = page.getByRole('navigation', { name: 'Public navigation' });
  await publicNav.getByRole('link', { name: 'Get Started', exact: true }).click();
  const form = page.getByRole('form', { name: 'Register' });
  await form.getByLabel('Display Name *', { exact: true }).fill('First Writer');
  await form.getByLabel('Username *', { exact: true }).fill('first-writer');
  await form.getByLabel('Password *', { exact: true }).fill('dummy-duplicate');
  await form.getByLabel('Confirm Password *', { exact: true }).fill('dummy-duplicate');
  await form.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const originalUsers = await page.evaluate(() => localStorage.getItem('writespace_users'));
  await page.getByRole('button', { name: 'Profile for First Writer' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await publicNav.getByRole('link', { name: 'Get Started', exact: true }).click();
  await form.getByLabel('Display Name *', { exact: true }).fill('Second Writer');
  await form.getByLabel('Username *', { exact: true }).fill(' FIRST-WRITER ');
  await form.getByLabel('Password *', { exact: true }).fill('dummy-duplicate');
  await form.getByLabel('Confirm Password *', { exact: true }).fill('dummy-duplicate');
  await form.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(form.getByRole('alert')).toHaveText('Username is already taken.');
  await expect(form.getByLabel('Username *', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe(originalUsers);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await form.getByLabel('Username *', { exact: true }).fill('second-writer');
  await expect(form.getByRole('alert')).toHaveCount(0);
  await form.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('button', { name: 'Profile for Second Writer' })).toBeVisible();
  const saved = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(saved.users).toHaveLength(2);
  expect(saved.users[0]).toEqual(JSON.parse(originalUsers)[0]);
  expect(saved.users[1]).toEqual({
    id: expect.any(String), createdAt: expect.any(String), displayName: 'Second Writer',
    username: 'second-writer', password: 'dummy-duplicate', role: 'user',
  });
  expect(saved.users[1].id).not.toBe(saved.users[0].id);
  expect(saved.session).toEqual({
    userId: saved.users[1].id, username: 'second-writer', displayName: 'Second Writer', role: 'user',
  });
  expect(errors).toEqual([]);
});

// Guest protected initial entries, authenticated login/register redirects, and
// responsive role navigation are already covered in roles.spec.js, not duplicated here.
