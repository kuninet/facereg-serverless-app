import { useState } from 'react'
import { Search, Download, Trash2, LogOut, CheckSquare, Image as ImageIcon } from 'lucide-react'

// --- モックデータ定義 ---
type AdminEntry = {
  id: string
  created_at: string
  company_name: string
  visitor_name: string
  purpose: string
  photo_url: string | null
}

const mockEntries: AdminEntry[] = Array.from({ length: 15 }).map((_, i) => ({
  id: `ENTRY-${1000 + i}`,
  created_at: new Date(Date.now() - i * 3600000).toLocaleString('ja-JP'),
  company_name: i % 3 === 0 ? '株式会社テスト' : 'サンプル有限会社',
  visitor_name: `ゲスト 太郎 ${i}`,
  purpose: i % 2 === 0 ? '商談' : '面接',
  photo_url: null, // UI確認用
}))

// --- コンポーネント本体 ---
export default function AdminApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  
  // ログインフォーム状態
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')

  // ダッシュボード状態
  const [entries] = useState<AdminEntry[]>(mockEntries)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // 簡易ログイン処理
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (userId && password) {
      setIsLoggedIn(true)
    }
  }

  // ログアウト処理
  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserId('')
    setPassword('')
  }

  // チェックボックス操作
  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(entries.map(e => e.id)))
    }
  }

  const toggleSelectLine = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  // ログイン画面表示
  if (!isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
          <div className="text-center md:mb-8 mb-6">
            <h1 className="text-2xl font-bold text-gray-800">顔写真登録システム 管理者用</h1>
            <p className="text-sm text-gray-500 mt-2">IDとパスワードを入力してください</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">ユーザーID</label>
              <input
                type="text"
                required
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm border p-3 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                value={userId}
                onChange={e => setUserId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">パスワード</label>
              <input
                type="password"
                required
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm border p-3 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[var(--primary)] text-white rounded-md font-semibold hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ダッシュボード画面表示
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--primary)] rounded-md flex items-center justify-center">
            <CheckSquare className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">顔写真登録 管理ダッシュボード</h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ログアウト
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Search & Filter Section */}
        <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">キーワード検索</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="会社名、名前、用件で絞り込み..."
                  className="pl-10 w-full rounded-md border border-gray-300 py-2.5 shadow-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button className="px-4 py-2.5 bg-gray-100 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 font-medium text-sm transition-colors whitespace-nowrap">
                クリア
              </button>
              <button className="px-6 py-2.5 bg-gray-800 text-white rounded-md hover:bg-gray-900 font-medium text-sm transition-colors whitespace-nowrap">
                検索
              </button>
            </div>
          </div>
        </section>

        {/* Table & Actions Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          
          {/* Action Toolbar */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-3 items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{selectedIds.size}</span> 件選択中
            </div>
            <div className="flex gap-2">
              <button 
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                ZIP一括ダウンロード
              </button>
              <button 
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-md text-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-white border-b-2 border-gray-200 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="p-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      checked={selectedIds.size > 0 && selectedIds.size === entries.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-4 whitespace-nowrap">登録日時</th>
                  <th className="p-4 text-center">顔写真</th>
                  <th className="p-4">会社名</th>
                  <th className="p-4">お名前</th>
                  <th className="p-4">ご用件</th>
                  <th className="p-4 text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox"
                        className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelectLine(entry.id)}
                      />
                    </td>
                    <td className="p-4 text-gray-500 whitespace-nowrap">{entry.created_at}</td>
                    <td className="p-4 text-center">
                      <div className="w-10 h-10 mx-auto rounded bg-gray-100 flex items-center justify-center border border-gray-200 overflow-hidden cursor-pointer hover:border-[var(--primary)] transition-colors">
                        {entry.photo_url ? (
                          <img src={entry.photo_url} alt="Face" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-medium text-gray-900">{entry.company_name}</td>
                    <td className="p-4 text-gray-700">{entry.visitor_name}</td>
                    <td className="p-4 text-gray-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {entry.purpose}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button className="text-gray-400 hover:text-[var(--primary)] transition-colors" title="ダウンロード">
                          <Download className="w-4 h-4" />
                        </button>
                        <button className="text-gray-400 hover:text-red-500 transition-colors" title="削除">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      登録されたデータはありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
            <span className="text-sm text-gray-500">
              全 <span className="font-semibold text-gray-900">{entries.length}</span> 件中 1-15 件を表示
            </span>
            <div className="flex gap-1">
              <button disabled className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-500 bg-gray-50 disabled:opacity-50">前へ</button>
              <button className="px-3 py-1 border border-[var(--primary)] bg-[var(--primary)] rounded text-sm text-white font-medium">1</button>
              <button className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">2</button>
              <button className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">次へ</button>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
