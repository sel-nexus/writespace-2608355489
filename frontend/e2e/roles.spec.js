/** Exercise real browser role sessions and route navigation; execution belongs to the parent. */
import { expect, test } from '@playwright/test';

const protectedEntries = ['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users'];
const writer = { userId: 'browser-writer', username: 'writer', displayName: 'Browser Writer', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };

/** Capture runtime errors before any initial navigation.
 * @param {import('@playwright/test').Page} page Browser page.
 * @returns {string[]} Console and uncaught errors.
 */
function captureErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Seed real localStorage once, so reload cannot resurrect a logged-out session.
 * @param {import('@playwright/test').Page} page Browser page.
 * @param {object} session Role fixture.
 * @returns {Promise<void>} Completion of browser initialization setup.
 */
async function seedSession(page, session) {
  await page.addInitScript((identity) => {
    if (!sessionStorage.getItem('roles-fixture-seeded')) {
      localStorage.setItem('writespace_session', JSON.stringify(identity));
      sessionStorage.setItem('roles-fixture-seeded', 'true');
    }
  }, session);
}

/** Reveal role links only when the responsive hamburger is visible.
 * @param {import('@playwright/test').Page} page Browser page.
 * @returns {Promise<void>} Completion of optional mobile disclosure.
 */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible()) {
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
}

for (const route of protectedEntries) {
  test(`guest initial entry ${route} redirects to login`, async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Authenticated navigation' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(errors).toEqual([]);
  });
}

for (const session of [writer, admin]) {
  for (const route of protectedEntries) {
    test(`${session.role} initial entry ${route} enforces role and supports nav clicks`, async ({ page }) => {
      const errors = captureErrors(page);
      await seedSession(page, session);
      await page.goto(route);
      const denied = session.role === 'user' && ['/admin', '/users'].includes(route);
      await expect(page).toHaveURL(new RegExp(`${denied ? '/blogs' : route}$`));
      const nav = page.getByRole('navigation', { name: 'Authenticated navigation' });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('button', { name: `Profile for ${session.displayName}` })).toBeVisible();
      const avatar = nav.getByRole('img', { name: session.role === 'admin' ? 'Admin avatar' : 'User avatar' });
      await expect(avatar).toHaveClass(new RegExp(session.role === 'admin' ? 'bg-violet-600' : 'bg-indigo-500'));
      if (session.role === 'user') await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
      for (const [label, destination] of session.role === 'admin'
        ? [['All Blogs', '/blogs'], ['Write', '/write'], ['Users', '/users']]
        : [['All Blogs', '/blogs'], ['Write', '/write']]) {
        await openNavigation(page);
        await nav.getByRole('link', { name: label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${destination}$`));
        await openNavigation(page);
        await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(nav.getByRole('link', { name: label, exact: true })).toHaveClass(/bg-indigo-600/);
        const toggle = nav.getByRole('button', { name: 'Toggle navigation' });
        if (await toggle.isVisible()) await toggle.click();
      }
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
      expect(errors).toEqual([]);
    });
  }

  for (const route of ['/login', '/register']) {
    test(`${session.role} initial ${route} redirects to role home`, async ({ page }) => {
      const errors = captureErrors(page);
      await seedSession(page, session);
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${session.role === 'admin' ? '/admin' : '/blogs'}$`));
      await expect(page.getByRole('button', { name: `Profile for ${session.displayName}` })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test(`${session.role} mobile menu and profile logout clear session across reread`, async ({ page }) => {
    const errors = captureErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await seedSession(page, session);
    await page.goto('/blogs');
    const toggle = page.getByRole('button', { name: 'Toggle navigation' });
    const nav = page.getByRole('navigation', { name: 'Authenticated navigation' });
    await expect(nav.getByRole('link', { name: 'Write', exact: true })).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await nav.getByRole('link', { name: 'Write', exact: true }).click();
    await expect(page).toHaveURL(/\/write$/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const profile = page.getByRole('button', { name: `Profile for ${session.displayName}` });
    await profile.click();
    await expect(profile).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    const publicNav = page.getByRole('navigation', { name: 'Public navigation' });
    await expect(publicNav.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    await page.reload();
    await expect(publicNav.getByRole('link', { name: 'Get Started', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'All Blogs' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  });

  test(`${session.role} can visit public landing and return to its dashboard`, async ({ page }) => {
    const errors = captureErrors(page);
    await seedSession(page, session);
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Public navigation' });
    await expect(nav.getByText(session.displayName, { exact: true })).toBeVisible();
    await nav.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(new RegExp(`${session.role === 'admin' ? '/admin' : '/blogs'}$`));
    await page.getByRole('navigation', { name: 'Authenticated navigation' }).getByRole('link', { name: 'WriteSpace.' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(nav).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('malformed session initial protected entry fails closed', async ({ page }) => {
  const errors = captureErrors(page);
  await page.addInitScript(() => localStorage.setItem('writespace_session', '{"role":"admin"}'));
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('navigation', { name: 'Authenticated navigation' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
