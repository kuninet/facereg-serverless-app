import { test, expect } from '@playwright/test';

test.describe('管理画面ダッシュボード', () => {
  test.beforeEach(async ({ page }) => {
    // admin.localhost でアクセスし管理画面を表示
    // DNS解決できない場合は受付画面が表示されるためスキップ
    try {
      await page.goto('http://admin.localhost:5173/');
    } catch {
      await page.goto('/');
    }
  });

  test('ログイン画面が表示され、ログイン後にダッシュボードが見えること', async ({ page }) => {
    const heading = page.locator('h1');
    const text = await heading.textContent();

    if (text?.includes('受付システム')) {
      test.skip(true, 'admin サブドメイン未解決のためスキップ');
    }

    // --- ログイン画面の検証 ---
    await expect(page.getByRole('heading', { name: '顔写真登録システム 管理者用' })).toBeVisible();
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'password');
    await page.getByRole('button', { name: 'ログイン' }).click();

    // --- ダッシュボード検証 ---
    await expect(page.getByRole('heading', { name: '顔写真登録 管理ダッシュボード' })).toBeVisible();
    await expect(page.getByText('株式会社テスト').first()).toBeVisible();

    // 削除ボタンが初期は無効
    const deleteBtn = page.getByRole('button', { name: '削除', exact: true }).first();
    await expect(deleteBtn).toBeDisabled();

    // チェックボックスで有効化
    const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(deleteBtn).toBeEnabled();
  });
});
