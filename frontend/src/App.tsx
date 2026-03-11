import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ReceptionApp from './pages/reception/ReceptionApp'
import AdminApp from './pages/admin/AdminApp'

/**
 * パスベースルーティングにより、受付画面と管理画面を振り分けるルートコンポーネント。
 *
 * - `/`      → 受付画面（ReceptionApp）
 * - `/admin` → 管理画面（AdminApp）
 *
 * ※カスタムドメイン導入後はサブドメイン方式に切り替え可能
 *   （例: reception.example.com / admin.example.com）
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 受付画面 */}
        <Route path="/" element={<ReceptionApp />} />
        {/* 管理画面 */}
        <Route path="/admin/*" element={<AdminApp />} />
        {/* その他のパスは受付画面へリダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

