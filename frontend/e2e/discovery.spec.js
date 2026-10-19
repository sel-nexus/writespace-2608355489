/** Exercise discovery using real browser storage; parent runs these after all slices. */
import { expect, test } from '@playwright/test';

/** Capture runtime errors before the first navigation.
 * @param {import('@playwright/test').Page} page Browser page.
 * @returns {string[]} Collected console and uncaught errors.
 */
function captureErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('guest entry points and empty discovery remain navigable', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  const publicNav = page.getByRole('navigation', { name: 'Public navigation' });
  await expect(publicNav.getByRole('link', { name: 'Login', exact: true })).toHaveAttribute('href', '/login');
  await expect(publicNav.getByRole('link', { name: 'Get Started', exact: true })).toHaveAttribute('href', '/register');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await publicNav.getByRole('link', { name: 'WriteSpace.' }).click();
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await publicNav.getByRole('link', { name: 'WriteSpace.' }).click();
  await publicNav.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await publicNav.getByRole('link', { name: 'WriteSpace.' }).click();
  await publicNav.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await publicNav.getByRole('link', { name: 'WriteSpace.' }).click();
  const footer = page.getByRole('navigation', { name: 'Footer navigation' });
  for (const [name, route] of [['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']]) {
    await footer.getByRole('link', { name, exact: true }).click();
    // Parent updates All Blogs to the exact login redirect when guards are wired.
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await publicNav.getByRole('link', { name: 'WriteSpace.' }).click();
  }
  await footer.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Latest from the Blog' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBeNull();
  expect(errors).toEqual([]);
});

test('real stored posts show newest three and persist after link navigation', async ({ page }) => {
  const errors = captureErrors(page);
  const fixture = [1, 4, 2, 3].map((day) => ({
    id: `local-${day}`, title: `Browser story ${day}`, content: `Stored words for edition ${day}.`,
    authorId: 'fixture-writer', authorName: 'Browser Writer', createdAt: `2025-02-0${day}T10:00:00.000Z`,
  }));
  await page.addInitScript((posts) => {
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
  }, fixture);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText([
    'Browser story 4', 'Browser story 3', 'Browser story 2',
  ]);
  await expect(latest.getByRole('article')).toHaveCount(3);
  await expect(latest.getByText('Stored words for edition 4.')).toBeVisible();
  await expect(latest.getByText('Feb 04, 2025')).toBeVisible();
  await expect(page.getByRole('complementary').getByRole('link', { name: 'Browser story 4' })).toBeVisible();
  await latest.getByRole('link', { name: 'Browser story 4' }).click();
  // Parent changes this exact destination to /login when the reader guard is wired.
  await expect(page).toHaveURL(/\/blog\/local-4$/);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'WriteSpace.' }).click();
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText([
    'Browser story 4', 'Browser story 3', 'Browser story 2',
  ]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(fixture);
  expect(errors).toEqual([]);
});

test('corrupt persisted data renders a safe empty discovery state', async ({ page }) => {
  const errors = captureErrors(page);
  await page.addInitScript(() => localStorage.setItem('writespace_posts', '[{"id":null}]'));
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('complementary').getByText('Your first story belongs here.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Latest from the Blog' }).getByRole('article')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('[{"id":null}]');
  expect(errors).toEqual([]);
});
