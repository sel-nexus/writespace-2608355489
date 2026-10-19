/** Specify real browser post journeys; intentionally not executed in this slice. */
import { expect, test } from '@playwright/test';

/** Collect runtime errors before initial navigation.
 * @param {import('@playwright/test').Page} page Browser page.
 * @returns {string[]} Runtime errors to assert at journey end.
 */
function captureErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Register via native UI without seeding identity or mocking storage.
 * @param {import('@playwright/test').Page} page Browser page on landing.
 * @param {string} name Unique demo writer name.
 * @returns {Promise<void>} Registered feed entry.
 */
async function registerWriter(page, name) {
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Get Started', exact: true }).click();
  const form = page.getByRole('form', { name: 'Register' });
  await form.getByLabel('Display Name', { exact: false }).fill(name);
  await form.getByLabel('Username', { exact: false }).fill(name.toLowerCase().replaceAll(' ', '-'));
  await form.getByLabel('Password *', { exact: true }).fill('dummy-post-password');
  await form.getByLabel('Confirm Password *', { exact: true }).fill('dummy-post-password');
  await form.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
}

/** Read real persisted posts for state assertions.
 * @param {import('@playwright/test').Page} page Browser page.
 * @returns {Promise<object[]>} Stored posts.
 */
async function storedPosts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts') ?? '[]'));
}

/** Attach representative HTML, accessibility tree, styles and screenshot for later review.
 * @param {import('@playwright/test').Page} page Browser page.
 * @param {string} name Representative view name.
 * @returns {Promise<void>} Attached review evidence.
 */
async function capturePreflight(page, name) {
  await test.info().attach(`${name}-html`, { body: await page.content(), contentType: 'text/html' });
  await test.info().attach(`${name}-a11y`, {
    body: JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2),
    contentType: 'application/json',
  });
  const styles = await page.evaluate(() => {
    const selectors = ['main', 'h1', 'section[aria-label="All posts"]', 'article', '.whitespace-pre-wrap'];
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, present: false };
      const style = getComputedStyle(element);
      return {
        selector, display: style.display, gridTemplateColumns: style.gridTemplateColumns,
        color: style.color, background: style.backgroundColor, fontFamily: style.fontFamily,
        whiteSpace: style.whiteSpace, width: style.width,
      };
    });
  });
  await test.info().attach(`${name}-styles`, { body: JSON.stringify(styles, null, 2), contentType: 'application/json' });
  await test.info().attach(`${name}-screenshot`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

test('register, write, read, reload, feed edit cancel/save and delete reject/accept persist real posts', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  await registerWriter(page, 'Post Writer');
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Write New Post' }).click();
  await page.getByRole('button', { name: 'Save Post' }).click();
  await expect(page.getByLabel('Title', { exact: false })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Content', { exact: false })).toHaveAttribute('aria-invalid', 'true');
  expect(await storedPosts(page)).toEqual([]);
  const content = '  First line\n\n<script>plain text, not executable</script>\n' + 'Words '.repeat(25);
  await page.getByLabel('Title', { exact: false }).fill('Browser story');
  await page.getByLabel('Content', { exact: false }).fill(content);
  await expect(page.getByRole('status', { name: 'Character count' })).toHaveText(`${content.length} characters`);
  expect(await page.getByLabel('Content', { exact: false }).evaluate((element) => parseFloat(getComputedStyle(element).minHeight))).toBeGreaterThanOrEqual(256);
  await page.getByRole('button', { name: 'Save Post' }).click();
  const [created] = await storedPosts(page);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(created).toEqual({
    id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    title: 'Browser story', content, createdAt: expect.any(String), authorId: session.userId, authorName: 'Post Writer',
  });
  expect(Number.isFinite(Date.parse(created.createdAt))).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/blog/${created.id}$`));
  await expect(page.getByRole('heading', { name: 'Browser story' })).toBeVisible();
  expect(await page.locator('.whitespace-pre-wrap').textContent()).toBe(content);
  await expect(page.locator('article script')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('img', { name: 'User avatar' })).toBeVisible();
  await capturePreflight(page, 'reader');
  await page.reload();
  expect(await storedPosts(page)).toEqual([created]);
  expect(await page.locator('.whitespace-pre-wrap').textContent()).toBe(content);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: false })).toHaveValue(created.title);
  await expect(page.getByLabel('Content', { exact: false })).toHaveValue(content);
  await page.getByLabel('Title', { exact: false }).fill('Discarded draft');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(await storedPosts(page)).toEqual([created]);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  const feed = page.getByRole('region', { name: 'All posts' });
  await expect(feed.getByRole('link', { name: 'Browser story', exact: true })).toBeVisible();
  expect(await feed.locator('article p').first().textContent()).toBe(content.slice(0, 120) + '…');
  const columns = await feed.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  const width = page.viewportSize().width;
  expect(columns).toBe(width >= 1024 ? 3 : width >= 768 ? 2 : 1);
  await capturePreflight(page, 'feed');
  await feed.getByRole('link', { name: 'Browser story', exact: true }).click();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('link', { name: 'Edit Browser story', exact: true }).click();
  await page.getByLabel('Title', { exact: false }).fill('Revised story');
  await page.getByLabel('Content', { exact: false }).fill('Revised\n\nplain text');
  await page.getByRole('button', { name: 'Save Post' }).click();
  const revised = { ...created, title: 'Revised story', content: 'Revised\n\nplain text' };
  expect(await storedPosts(page)).toEqual([revised]);
  await expect(page.getByRole('heading', { name: 'Revised story' })).toBeVisible();
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(await storedPosts(page)).toEqual([revised]);
  await expect(page).toHaveURL(new RegExp(`/blog/${created.id}$`));
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await storedPosts(page)).toEqual([]);
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  expect(errors).toEqual([]);
});

test('second real registered writer can read but has no edit or delete actions on another writer post', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  await registerWriter(page, 'First Writer');
  await page.getByRole('main').getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title', { exact: false }).fill('Owned by first');
  await page.getByLabel('Content', { exact: false }).fill('The first writer owns this post.');
  await page.getByRole('button', { name: 'Save Post' }).click();
  const original = await storedPosts(page);
  await page.getByRole('button', { name: 'Profile for First Writer' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await registerWriter(page, 'Second Writer');
  await expect(page.getByRole('main').getByRole('link', { name: /Edit Owned/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Owned by first', exact: true }).click();
  await expect(page.getByRole('main').getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await expect(page.getByText('The first writer owns this post.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  expect(await storedPosts(page)).toEqual(original);
  expect(errors).toEqual([]);
});

test('initial direct unauthorized edit route redirects to feed without modifying stored post', async ({ page }) => {
  const errors = captureErrors(page);
  const original = {
    id: 'owned-post', title: 'Another writer', content: 'Unchanged content',
    createdAt: '2025-01-02T00:00:00.000Z', authorId: 'first', authorName: 'First Writer',
  };
  // Explicit direct-route permission fixture; the journeys above create data through UI.
  await page.addInitScript((post) => {
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
    localStorage.setItem('writespace_session', JSON.stringify({
      userId: 'second', username: 'second', displayName: 'Second Writer', role: 'user',
    }));
  }, original);
  await page.goto('/edit/owned-post');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Edit Post' })).toHaveCount(0);
  expect(await storedPosts(page)).toEqual([original]);
  await page.getByRole('link', { name: 'Another writer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Administrator cross-author browser editing belongs to the later administration slice.
