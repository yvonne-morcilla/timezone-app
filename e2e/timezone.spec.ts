import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Time Keeper — page load', () => {
  test('loads with the correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Time Keeper/);
  });

  test('automatically creates a local "You" row on first load', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('You');
  });
});

test.describe('Time Keeper — adding timezones', () => {
  test('adds a new row with the given label and timezone', async ({ page }) => {
    await page.getByRole('button', { name: 'Add timezone' }).click();
    await page.getByLabel('Label').fill('Europe HQ');
    await page.getByLabel('Location').selectOption({ label: 'Eastern Standard Time' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.getByText('Europe HQ', { exact: true })).toBeVisible();
  });

  test('does not add a row when the label is missing', async ({ page }) => {
    await page.getByRole('button', { name: 'Add timezone' }).click();
    await page.getByLabel('Location').selectOption({ label: 'Eastern Standard Time' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('does not add a row when the timezone is missing', async ({ page }) => {
    await page.getByRole('button', { name: 'Add timezone' }).click();
    await page.getByLabel('Label').fill('No Timezone');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('tbody tr')).toHaveCount(1);
  });
});

test.describe('Time Keeper — sort order (per spec)', () => {
  test('sorts rows by current time, earliest first', async ({ page }) => {
    // Labels are deliberately chosen so alphabetical order and chronological
    // order disagree — this isolates the sort-by-time requirement.
    await page.getByRole('button', { name: 'Add timezone' }).click();
    await page.getByLabel('Label').fill('Zulu - Hawaii');
    await page.getByLabel('Location').selectOption({ label: 'Hawaii-Aleutian Standard Time' });
    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: 'Add timezone' }).click();
    await page.getByLabel('Label').fill('Alpha - Eastern');
    await page.getByLabel('Location').selectOption({ label: 'Eastern Standard Time' });
    await page.getByRole('button', { name: 'Save' }).click();

    const rowLabels = await page.locator('tbody tr td:first-child').allTextContents();
    const hawaiiIndex = rowLabels.findIndex((l) => l.includes('Zulu - Hawaii'));
    const easternIndex = rowLabels.findIndex((l) => l.includes('Alpha - Eastern'));

    // Hawaii is always earlier in the day than US Eastern time, so — per the
    // spec — it must render first. (This fails against the current
    // alphabetical-sort implementation, which is the point.)
    expect(hawaiiIndex).toBeGreaterThanOrEqual(0);
    expect(easternIndex).toBeGreaterThanOrEqual(0);
    expect(hawaiiIndex).toBeLessThan(easternIndex);
  });
});

test.describe('Time Keeper — deleting timezones', () => {
  test('allows deleting a non-"You" row', async ({ page }) => {
    await page.getByRole('button', { name: 'Add timezone' }).click();
    await page.getByLabel('Label').fill('Temp Row');
    await page.getByLabel('Location').selectOption({ label: 'Mountain Standard Time' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('tbody tr')).toHaveCount(2);

    const row = page.locator('tbody tr', { hasText: 'Temp Row' });
    await row.getByRole('button', { name: /Delete/ }).click();

    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('Temp Row')).not.toBeVisible();
  });

  test('does not allow deleting the "You" row', async ({ page }) => {
    const youRow = page.locator('tbody tr', { hasText: 'You' });
    const deleteButton = youRow.getByRole('button', { name: /Delete/ });

    // Per spec this should be disabled. Currently fails, documenting BUG-1.
    await expect(deleteButton).toBeDisabled();
  });

  test('deleting one row does not remove other rows with the same label', async ({ page }) => {
    await page.getByRole('button', { name: 'Add timezone' }).click();
    await page.getByLabel('Label').fill('Duplicate');
    await page.getByLabel('Location').selectOption({ label: 'Central Standard Time' });
    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: 'Add timezone' }).click();
    await page.getByLabel('Label').fill('Duplicate');
    await page.getByLabel('Location').selectOption({ label: 'Mountain Standard Time' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('tbody tr')).toHaveCount(3);

    const duplicateRows = page.locator('tbody tr', { hasText: 'Duplicate' });
    await duplicateRows.first().getByRole('button', { name: /Delete/ }).click();

    // Only one "Duplicate" row should be gone, not both. Currently fails,
    // documenting BUG-4.
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });
});

test.describe('Time Keeper — persistence', () => {
  test('retains the "You" row after a page reload', async ({ page }) => {
    await expect(page.locator('tbody tr', { hasText: 'You' })).toHaveCount(1);
    await page.reload();
    await expect(page.locator('tbody tr', { hasText: 'You' })).toHaveCount(1);
  });
});
