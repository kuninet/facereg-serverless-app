import { test, expect } from '@playwright/test';

test.describe('受付画面 (キオスク用)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('初期表示でファイル選択のUIが表示されること', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '顔写真 受付システム' })).toBeVisible();
    await expect(page.getByText('ファイルを選択')).toBeVisible();
    await expect(page.getByText('カメラを起動する')).not.toBeVisible();
  });

  test('必須項目を入力せずに登録ボタンを押せないこと', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: '登録する' });
    await expect(submitBtn).toBeDisabled();

    // 項目入力後も写真なしでは disabled のまま
    await page.fill('#company_name', '株式会社Playwright');
    await page.fill('#visitor_name', 'E2E 太郎');
    await expect(submitBtn).toBeDisabled();
  });
});
