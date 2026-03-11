import React, { useState, useEffect } from 'react'
import { Search, Download, Trash2, LogOut, CheckSquare, Image as ImageIcon, Loader2 } from 'lucide-react'
import { apiClient } from '../../api/apiClient'
import type { Entry } from '../../api/apiClient'

const ITEMS_PER_PAGE = 15

export default function AdminApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  
  // ログインフォーム状態
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')

  // ダッシュボード状態
  const [entries, setEntries] = useState<Entry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // 簡易ログイン処理 (複数ID対応)
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // 簡易認証: ユーザーIDとパスワードが入力されていれば許可
    // 本格的な認証 (Cognito等) は別Issueで対応
    if (userId && password) {
      setIsLoggedIn(true)
    }
  }

  // ログアウト処理
  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserId('')
    setPassword('')
    setEntries([])
    setSelectedIds(new Set())
  }

  // エントリー一覧の取得
  const fetchEntries = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.listEntries()
      setEntries(data)
    } catch (err) {
      console.error(err)
      setError('データの取得に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }

  // ログイン成功時に一覧を取得
  useEffect(() => {
    if (isLoggedIn) {
      fetchEntries()
    }
  }, [isLoggedIn])

  // 検索・フィルタリング
  const filteredEntries = entries.filter(e => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      e.company_name.toLowerCase().includes(q) ||
      e.visitor_name.toLowerCase().includes(q) ||
      e.purpose.toLowerCase().includes(q) ||
      (e.purpose_detail || '').toLowerCase().includes(q)
    )
  })

  // ページネーション計算
  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE) || 1
  // 検索等でページ数が減った場合の補正
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages)
  }
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // チェックボックス操作
  const toggleSelectAll = () => {
    const pageIds = paginatedEntries.map(e => e.id)
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
    
    const newSet = new Set(selectedIds)
    if (allSelected) {
      pageIds.forEach(id => newSet.delete(id))
    } else {
      pageIds.forEach(id => newSet.add(id))
    }
    setSelectedIds(newSet)
  }

  const toggleSelectLine = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }
  
  const isAllCurrentPageSelected = paginatedEntries.length > 0 && paginatedEntries.every(e => selectedIds.has(e.id))

  // 削除処理 (単一・複数)
  const handleDelete = async (itemsToDelete: {id: string, photo_url: string | null}[]) => {
    if (!window.confirm(`${itemsToDelete.length}件のデータを削除します。よろしいですか？`)) return
    
    try {
      setIsLoading(true)
      await apiClient.bulkDeleteEntries(itemsToDelete)
      // 再取得
      await fetchEntries()
      // 削除されたIDを選択状態から解除
      const newSelected = new Set(selectedIds)
      itemsToDelete.forEach(i => newSelected.delete(i.id))
      setSelectedIds(newSelected)
    } catch (err) {
      console.error(err)
      alert('削除に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }

  // 個別画像のダウンロード処理
  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error(err)
      // CORS等でfetchできない場合のフォールバック
      window.open(url, '_blank')
    }
  }

  // フォーマット用: 日時整形
  const formatDateTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      })
    } catch {
      return isoString
    }
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
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
            👤 {userId}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

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
                  onChange={e => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1) // 検索時は1ページ目に戻す
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={() => {
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 font-medium text-sm transition-colors whitespace-nowrap"
              >
                クリア
              </button>
              <button 
                onClick={fetchEntries}
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 text-white rounded-md hover:bg-gray-900 font-medium text-sm transition-colors whitespace-nowrap"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                再読み込み
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
                disabled={true} // ZIPダウンロードは別Issueで対応
                title="現在ZIP一括ダウンロードは開発中です"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-400 cursor-not-allowed shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                ZIP一括DL (準備中)
              </button>
              <button 
                disabled={selectedIds.size === 0 || isLoading}
                onClick={() => {
                  const targets = entries.filter(e => selectedIds.has(e.id)).map(e => ({ id: e.id, photo_url: e.photo_url }))
                  handleDelete(targets)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-md text-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                一括削除
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto relative min-h-[300px]">
            {isLoading && entries.length === 0 && (
               <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                 <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
               </div>
            )}
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-white border-b-2 border-gray-200 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="p-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      checked={isAllCurrentPageSelected}
                      onChange={toggleSelectAll}
                      disabled={paginatedEntries.length === 0}
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
              <tbody className="divide-y divide-gray-100 relative">
                {paginatedEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox"
                        className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelectLine(entry.id)}
                      />
                    </td>
                    <td className="p-4 text-gray-500 whitespace-nowrap">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="w-10 h-10 mx-auto rounded bg-gray-100 flex items-center justify-center border border-gray-200 overflow-hidden">
                        {(entry.photo_download_url || entry.photo_url) ? (
                          <a href={entry.photo_download_url || entry.photo_url || '#'} target="_blank" rel="noopener noreferrer" className="w-full h-full block">
                            <img src={entry.photo_download_url || entry.photo_url!} alt="Face" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                          </a>
                        ) : (
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-medium text-gray-900 truncate max-w-[150px]" title={entry.company_name}>
                      {entry.company_name}
                    </td>
                    <td className="p-4 text-gray-700 truncate max-w-[150px]" title={entry.visitor_name}>
                      {entry.visitor_name}
                    </td>
                    <td className="p-4 text-gray-600">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 whitespace-nowrap">
                          {entry.purpose}
                        </span>
                        {entry.purpose_detail && (
                          <span className="text-xs text-gray-500 truncate max-w-[120px]" title={entry.purpose_detail}>
                            {entry.purpose_detail}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button 
                          onClick={() => {
                            const urlStr = entry.photo_download_url || entry.photo_url
                            if (urlStr) {
                              let ext = 'jpg';
                              try {
                                const parsed = new URL(urlStr)
                                ext = parsed.pathname.split('.').pop() || 'jpg'
                              } catch(e) {
                                ext = urlStr.split('.').pop() || 'jpg'
                              }
                              const filename = `${entry.company_name}_${entry.visitor_name}_${entry.id.substring(0,6)}.${ext}`
                              handleDownloadImage(urlStr, filename)
                            }
                          }}
                          disabled={!(entry.photo_download_url || entry.photo_url)}
                          className="text-gray-400 hover:text-[var(--primary)] transition-colors disabled:opacity-30 disabled:hover:text-gray-400" 
                          title="ダウンロード"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete([{id: entry.id, photo_url: entry.photo_url}])}
                          disabled={isLoading}
                          className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30" 
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && paginatedEntries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      一致するデータがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
            <span className="text-sm text-gray-500">
              全 <span className="font-semibold text-gray-900">{filteredEntries.length}</span> 件中 
              {filteredEntries.length > 0 ? ` ${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, filteredEntries.length)} ` : ' 0 '} 
              件を表示
            </span>
            <div className="flex gap-1">
              <button 
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:bg-gray-50"
              >
                前へ
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                // ページ数が多い場合は省略が必要だが、今回は簡易的に全ページ表示か、最大5ページ程度に絞る
                .filter(page => Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages)
                .map((page, index, array) => (
                  <React.Fragment key={page}>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-2 py-1 text-gray-400">...</span>
                    )}
                    <button 
                      onClick={() => setCurrentPage(page)}
                      disabled={isLoading}
                      className={`px-3 py-1 border rounded text-sm font-medium transition-colors ${
                        currentPage === page 
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white' 
                          : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
              
              <button 
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:bg-gray-50"
              >
                次へ
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
