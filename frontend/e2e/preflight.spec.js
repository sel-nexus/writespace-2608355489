/** Save source-review evidence from real desktop/mobile screens, without synthetic UI. */
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

/** Persist browser text evidence and a screenshot for human review.
 * @param {object} page Current Playwright page.
 * @param {string} name Portable evidence name.
 * @returns {Promise<void>} Completed capture.
 */
async function capture(page, name) {
  await mkdir('evidence', { recursive: true });
  await page.screenshot({ path: `evidence/${name}.png`, fullPage: true });
  await writeFile(`evidence/${name}.html`, await page.content());
  const accessibility = await page.accessibility.snapshot();
  const styles = await page.evaluate(() => ({
    bodyFont: getComputedStyle(document.body).fontFamily,
    headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
    headingSize: getComputedStyle(document.querySelector('h1')).fontSize,
    viewport: { width: innerWidth, height: innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((node) => node.textContent),
  }));
  await writeFile(`evidence/${name}.json`, JSON.stringify({ accessibility, styles }, null, 2));
}

test('capture public, login error, feed empty, admin and mobile navigation evidence', async ({ page }, info) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Latest from the Blog' })).toBeVisible();
  await capture(page, `${info.project.name}-landing`);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Username is required.')).toBeVisible();
  await capture(page, `${info.project.name}-login-error`);
  await page.getByLabel('Username', { exact: false }).fill('admin');
  await page.getByLabel('Password', { exact: false }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await capture(page, `${info.project.name}-dashboard`);
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await capture(page, `${info.project.name}-accounts`);
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await capture(page, 'mobile-navigation');
  }
  await page.getByRole('navigation', { name: 'Authenticated navigation' }).getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await capture(page, `${info.project.name}-feed-empty`);
  expect(errors).toEqual([]);
});
