/** Specify real admin browser journeys and review attachments; do not execute in this slice. */
import { expect, test } from '@playwright/test';

/** Collect console and uncaught errors before initial navigation.
 * @param {import('@playwright/test').Page} page Browser page.
 * @returns {string[]} Runtime errors.
 */
function captureErrors(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Log in through the public UI using real persisted credentials.
 * @param {import('@playwright/test').Page} page Landing page.
 * @param {string} username Demo username.
 * @param {string} password Demo password.
 * @returns {Promise<void>} Completed login.
 */
async function login(page, username = 'admin', password = 'admin') {
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: false }).fill(username);
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Reveal authenticated links when the responsive hamburger is visible.
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

test('E17 populated admin dashboard shows four counts and newest five, then refreshes after confirmed deletion', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  await login(page);
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await createAccount(page, 'Overview Writer', 'user');
  await expect(page.getByRole('status')).toHaveText('Account Overview Writer created.');
  await createAccount(page, 'Overview Admin', 'admin');
  await expect(page.getByRole('status')).toHaveText('Account Overview Admin created.');
  await page.getByRole('link', { name: 'Back to Dashboard', exact: true }).click();

  const creationOrder = [];
  for (let index = 0; index < 7; index += 1) {
    await openNavigation(page);
    await page.getByRole('navigation', { name: 'Authenticated navigation' })
      .getByRole('link', { name: 'Write', exact: true }).click();
    const title = `Overview story ${index + 1}`;
    await page.getByLabel('Title', { exact: false }).fill(title);
    await page.getByLabel('Content', { exact: false }).fill(`Real UI-created overview content ${index + 1}.`);
    await page.getByRole('button', { name: 'Save Post', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const saved = (await stored(page)).posts.find((post) => post.title === title);
    expect(saved).toMatchObject({ title, authorId: 'admin', authorName: 'Admin' });
    expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
    if (creationOrder.length) {
      expect(Date.parse(saved.createdAt)).toBeGreaterThan(Date.parse(creationOrder.at(-1).createdAt));
    }
    creationOrder.push(saved);
  }
  expect((await stored(page)).posts).toHaveLength(7);
  await page.getByRole('link', { name: 'WriteSpace.', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  for (const [label, count] of [
    ['Total Posts', 7],
    ['Total Users', 3],
    ['Total Admins', 2],
    ['Total users (repeated)', 2],
  ]) {
    await expect(page.getByLabel(label, { exact: true }).getByText(String(count), { exact: true })).toBeVisible();
  }
  const recent = page.getByRole('region', { name: 'Recent posts' });
  const titleLinks = recent.getByRole('link').filter({ hasNotText: /^Edit$/ });
  await expect(recent.getByRole('listitem')).toHaveCount(5);
  await expect(titleLinks).toHaveText(creationOrder.slice(-5).reverse().map((post) => post.title));
  await expect(recent.getByRole('link', { name: creationOrder[0].title, exact: true })).toHaveCount(0);
  await expect(recent.getByRole('link', { name: creationOrder[1].title, exact: true })).toHaveCount(0);
  await capturePreflight(page, 'dashboard-seven-ui-created-posts');

  const newest = creationOrder.at(-1);
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe(`Delete "${newest.title}"? This cannot be undone.`);
    await dialog.accept();
  });
  await recent.getByRole('button', { name: `Delete ${newest.title}`, exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Post deleted.');
  expect((await stored(page)).posts).toEqual(creationOrder.slice(0, -1));
  await expect(page.getByLabel('Total Posts', { exact: true }).getByText('6', { exact: true })).toBeVisible();
  await expect(recent.getByRole('listitem')).toHaveCount(5);
  await expect(titleLinks).toHaveText(creationOrder.slice(0, -1).slice(-5).reverse().map((post) => post.title));
  await expect(recent.getByRole('link', { name: newest.title, exact: true })).toHaveCount(0);
  for (const [label, count] of [['Total Users', 3], ['Total Admins', 2], ['Total users (repeated)', 2]]) {
    await expect(page.getByLabel(label, { exact: true }).getByText(String(count), { exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

/** Create an account from native required fields in either role.
 * @param {import('@playwright/test').Page} page Management page.
 * @param {string} name Unique account username/display name.
 * @param {string} role Supported role.
 * @returns {Promise<void>} Submitted account.
 */
async function createAccount(page, name, role) {
  const form = page.getByRole('form', { name: 'Create User' });
  await form.getByLabel('Display Name', { exact: false }).fill(name);
  await form.getByLabel('Username', { exact: false }).fill(name);
  await form.getByLabel('Password', { exact: false }).fill('dummy-admin-journey');
  await form.getByLabel('Role', { exact: false }).selectOption(role);
  await form.getByRole('button', { name: 'Create User', exact: true }).click();
}

/** Read actual persisted collections without fixtures or memory substitution.
 * @param {import('@playwright/test').Page} page Browser page.
 * @returns {Promise<object>} Real users and posts.
 */
async function stored(page) {
  return page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users') ?? '[]'),
    posts: JSON.parse(localStorage.getItem('writespace_posts') ?? '[]'),
  }));
}

/** Select the account action from the viewport's responsive semantic wrapper.
 * @param {import('@playwright/test').Page} page Management page.
 * @param {string} username Account username.
 * @returns {import('@playwright/test').Locator} Visible deletion control.
 */
function accountAction(page, username) {
  const mobile = page.viewportSize().width < 640;
  const row = page.getByRole(mobile ? 'article' : 'row', { name: `Account ${username}`, exact: true });
  return row.getByRole('button', { name: `Delete ${username}`, exact: true });
}

/** Attach representative rendered structure, accessibility, styles, and screenshot.
 * @param {import('@playwright/test').Page} page Browser page.
 * @param {string} name Representative state.
 * @returns {Promise<void>} Attached evidence for parent verification.
 */
async function capturePreflight(page, name) {
  await test.info().attach(`${name}-html`, { body: await page.content(), contentType: 'text/html' });
  await test.info().attach(`${name}-a11y`, {
    body: JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2), contentType: 'application/json',
  });
  const styles = await page.evaluate(() => ['main', 'h1', '[aria-label="Publication statistics"]', '[aria-label="Desktop accounts"]', '[aria-label="Mobile accounts"]', 'table', 'article'].map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, present: false };
    const style = getComputedStyle(element);
    return { selector, display: style.display, width: style.width, color: style.color, background: style.backgroundColor,
      gridTemplateColumns: style.gridTemplateColumns, fontFamily: style.fontFamily };
  }));
  await test.info().attach(`${name}-styles`, { body: JSON.stringify(styles, null, 2), contentType: 'application/json' });
  await test.info().attach(`${name}-screenshot`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

test('admin creates both roles, handles uniqueness and confirmed deletion, manages newest post, and protects current admin', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  await login(page);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  await expect(page.getByLabel('Total Users', { exact: true })).toContainText('1');
  await capturePreflight(page, 'dashboard-empty');
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  await createAccount(page, 'Journey Writer', 'user');
  await expect(page.getByRole('status')).toHaveText('Account Journey Writer created.');
  await createAccount(page, 'Journey Admin', 'admin');
  await expect(page.getByRole('status')).toHaveText('Account Journey Admin created.');
  const created = (await stored(page)).users;
  expect(created.map((account) => account.role)).toEqual(['user', 'admin']);
  created.forEach((account) => {
    expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(Number.isFinite(Date.parse(account.createdAt))).toBe(true);
    expect(account.password).toBe('dummy-admin-journey');
  });
  await createAccount(page, 'journey writer', 'user');
  await expect(page.getByRole('alert')).toHaveText('Username is already taken.');
  expect((await stored(page)).users).toEqual(created);
  await capturePreflight(page, 'users-populated-unique-error');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(accountAction(page, 'admin')).toBeDisabled();
  await expect(accountAction(page, 'admin')).toHaveAttribute('title', 'Default admin cannot be deleted.');
  const builtinRow = page.getByRole(page.viewportSize().width < 640 ? 'article' : 'row', { name: 'Account admin', exact: true });
  await expect(builtinRow.getByText('Built-in', { exact: true })).toBeVisible();
  page.once('dialog', async (dialog) => { expect(dialog.type()).toBe('confirm'); await dialog.dismiss(); });
  await accountAction(page, 'Journey Writer').click();
  expect((await stored(page)).users).toEqual(created);
  page.once('dialog', async (dialog) => { expect(dialog.type()).toBe('confirm'); await dialog.accept(); });
  await accountAction(page, 'Journey Writer').click();
  await expect(page.getByRole('status')).toHaveText('Account Journey Writer deleted.');
  expect((await stored(page)).users).toEqual([created[1]]);
  await page.getByRole('link', { name: 'Back to Dashboard', exact: true }).click();
  await page.getByRole('link', { name: 'Write New Post', exact: true }).click();
  await page.getByLabel('Title', { exact: false }).fill('Admin browser story');
  await page.getByLabel('Content', { exact: false }).fill('Real plain-text administration post.');
  await page.getByRole('button', { name: 'Save Post', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin browser story', exact: true })).toBeVisible();
  const [post] = (await stored(page)).posts;
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(post.content);
  await page.getByRole('link', { name: 'WriteSpace.', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Admin browser story', exact: true })).toBeVisible();
  await capturePreflight(page, 'dashboard-populated');
  await page.getByRole('link', { name: 'Edit Admin browser story', exact: true }).click();
  await page.getByLabel('Title', { exact: false }).fill('Admin revised story');
  await page.getByRole('button', { name: 'Save Post', exact: true }).click();
  expect((await stored(page)).posts).toEqual([{ ...post, title: 'Admin revised story' }]);
  await page.getByRole('link', { name: 'WriteSpace.', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
  page.once('dialog', async (dialog) => { expect(dialog.type()).toBe('confirm'); await dialog.dismiss(); });
  await page.getByRole('button', { name: 'Delete Admin revised story', exact: true }).click();
  expect((await stored(page)).posts).toHaveLength(1);
  page.once('dialog', async (dialog) => { expect(dialog.type()).toBe('confirm'); await dialog.accept(); });
  await page.getByRole('button', { name: 'Delete Admin revised story', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Post deleted.');
  expect((await stored(page)).posts).toEqual([]);
  await page.getByRole('button', { name: 'Profile for Admin', exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await login(page, 'Journey Admin', 'dummy-admin-journey');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await expect(accountAction(page, 'Journey Admin')).toBeDisabled();
  await expect(accountAction(page, 'Journey Admin')).toHaveAttribute('title', 'You cannot delete your current account.');
  await expect(accountAction(page, 'admin')).toBeDisabled();
  await capturePreflight(page, 'users-current-admin-protected');
  expect((await stored(page)).users).toEqual([created[1]]);
  expect(errors).toEqual([]);
});

test('created administrator can edit and delete another writer post through dashboard controls', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  await login(page);
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await createAccount(page, 'Cross Writer', 'user');
  await createAccount(page, 'Cross Admin', 'admin');
  await page.getByRole('button', { name: 'Profile for Admin', exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await login(page, 'Cross Writer', 'dummy-admin-journey');
  await page.getByRole('main').getByRole('link', { name: 'Write New Post', exact: true }).click();
  await page.getByLabel('Title', { exact: false }).fill('Writer-owned story');
  await page.getByLabel('Content', { exact: false }).fill('Original writer text');
  await page.getByRole('button', { name: 'Save Post', exact: true }).click();
  const [original] = (await stored(page)).posts;
  await page.getByRole('button', { name: 'Profile for Cross Writer', exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await login(page, 'Cross Admin', 'dummy-admin-journey');
  await page.getByRole('link', { name: 'Edit Writer-owned story', exact: true }).click();
  await page.getByLabel('Content', { exact: false }).fill('Administrator revision');
  await page.getByRole('button', { name: 'Save Post', exact: true }).click();
  expect((await stored(page)).posts).toEqual([{ ...original, content: 'Administrator revision' }]);
  await page.getByRole('link', { name: 'WriteSpace.', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
  page.once('dialog', async (dialog) => { expect(dialog.type()).toBe('confirm'); await dialog.accept(); });
  await page.getByRole('button', { name: 'Delete Writer-owned story', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Post deleted.');
  expect((await stored(page)).posts).toEqual([]);
  expect(errors).toEqual([]);
});
