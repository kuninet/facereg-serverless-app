/**
 * 顔写真登録システム APIクライアント
 */

const API_BASE = '/v1' // CloudFrontでの同ドメインプロキシ、ローカルDevサーバプロキシを利用

export type InitializeUploadResponse = {
  upload_url: string
  fields: Record<string, string>
  photo_key: string
  entry_id: string
}

export type RegisterEntryRequest = {
  company_name: string
  visitor_name: string
  purpose: string
  purpose_detail?: string
  photo_key: string
}

export type Entry = {
  id: string
  pk: string
  sk: string
  created_at: string
  company_name: string
  visitor_name: string
  purpose: string
  purpose_detail: string
  photo_url: string | null
  photo_download_url?: string
  expires_at: number
}

export const apiClient = {
  /**
   * S3 Presigned URLの発行
   */
  async initializeUpload(filename: string, contentType: string): Promise<InitializeUploadResponse> {
    const res = await fetch(`${API_BASE}/entries/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_filename: filename,
        photo_content_type: contentType
      })
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to initialize upload: ${text}`)
    }
    return res.json()
  },

  /**
   * S3への画像アップロード
   */
  async uploadPhotoToS3(presignedData: InitializeUploadResponse, file: Blob): Promise<void> {
    const formData = new FormData()
    // Presigned PostのfieldsをすべてFormDataに追加する必要がある
    Object.entries(presignedData.fields).forEach(([key, value]) => {
      formData.append(key, value)
    })
    // 最後にfileを追加する（S3 POST Policyの仕様上、fileは最後尾推奨）
    formData.append('file', file)

    const res = await fetch(presignedData.upload_url, {
      method: 'POST',
      body: formData
    })
    
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to upload photo to S3: ${text}`)
    }
  },

  /**
   * エントリーの登録 (DynamoDB)
   */
  async registerEntry(data: RegisterEntryRequest): Promise<Entry> {
    const res = await fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to register entry: ${text}`)
    }
    return res.json()
  },

  /**
   * エントリーの一覧取得（管理画面用）
   */
  async listEntries(): Promise<Entry[]> {
    const res = await fetch(`${API_BASE}/admin/entries`, {
      method: 'GET'
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to fetch entries: ${text}`)
    }
    return res.json()
  },

  /**
   * エントリーの一括削除（管理画面用）
   */
  async bulkDeleteEntries(items: { id: string; photo_url: string | null }[]): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/entries/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to bulk delete entries: ${text}`)
    }
  }
}
