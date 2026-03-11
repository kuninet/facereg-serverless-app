import { test, expect } from '@playwright/test';

test.describe('受付画面 (キオスク用)', () => {
  test.beforeEach(async ({ page }) => {
    // 受付画面（admin.以外のホスト）としてアクセス
    await page.goto('http://localhost:5173/');
  });

  test('初期表示でカメラ起動またはファイル選択のUIが表示されること', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '顔写真 受付システム' })).toBeVisible();
    await expect(page.getByText('カメラを起動する')).toBeVisible();
    await expect(page.getByText('ファイルを選択')).toBeVisible();
  });

  test('必須項目を入力せずに登録ボタンを押せないこと', async ({ page }) => {
    // ボタンが disabled になっていることを確認
    const submitBtn = page.getByRole('button', { name: '登録する' });
    await expect(submitBtn).toBeDisabled();
    
    // 値を入力
    await page.fill('input#company_name', '株式会社Playwright');
    await page.fill('input#visitor_name', 'E2E 太郎');
    
    // まだ写真がないのでdisabledのはず
    await expect(submitBtn).toBeDisabled();
  });
});
