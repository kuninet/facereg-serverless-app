import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ReceptionApp from './pages/reception/ReceptionApp'
import AdminApp from './pages/admin/AdminApp'

/**
 * カスタムドメイン（サブドメイン）によって
 * 見せる画面（受付 / 管理）を振り分けるためのルートコンポーネントです。
 * （ローカル開発時はパスによってルーティングします）
 */
function App() {
  const hostname = window.location.hostname
  const isAdminDomain = hostname.startsWith('admin.')

  // サブドメインが 'admin.' の場合は管理画面へ、それ以外は受付画面へ
  if (isAdminDomain) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<AdminApp />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // 受付アプリ（reception.* または localhost）
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReceptionApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
