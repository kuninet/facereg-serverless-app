import { test, expect } from '@playwright/test';

test.describe('管理画面ダッシュボード', () => {
  test.beforeEach(async ({ page }) => {
    // APIレスポンスをモック化して、バックエンドなしでもUIテストが通るようにする
    await page.route('**/v1/admin/entries', async route => {
      const json = [
        {
          id: 'ENTRY-MOCK-1',
          created_at: new Date().toISOString(),
          company_name: '株式会社Playwrightモック',
          visitor_name: 'テスト ユーザー',
          purpose: '商談',
          photo_url: null
        }
      ];
      await route.fulfill({ json });
    });

    await page.goto('/admin');
  });

  test('ログイン画面が表示され、ログイン後にダッシュボードが見えること', async ({ page }) => {
    // --- ログイン画面の検証 ---
    await expect(page.getByRole('heading', { name: '顔写真登録システム 管理者用' })).toBeVisible();
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'password');
    await page.getByRole('button', { name: 'ログイン' }).click();

    // --- ダッシュボード検証 ---
    await expect(page.getByRole('heading', { name: '顔写真登録 管理ダッシュボード' })).toBeVisible();
    await expect(page.getByText('株式会社Playwrightモック')).toBeVisible();

    // 削除ボタンが初期は無効
    const deleteBtn = page.getByRole('button', { name: '一括削除', exact: true }).first();
    await expect(deleteBtn).toBeDisabled();

    // チェックボックスで有効化
    const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(deleteBtn).toBeEnabled();
  });
});
