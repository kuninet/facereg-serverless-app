import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Upload, RefreshCw, CheckCircle2 } from 'lucide-react'
import { apiClient } from '../../api/apiClient'

type EntryFormData = {
  company_name: string
  visitor_name: string
  purpose: string
  purpose_detail: string
}

const INITIAL_FORM_DATA: EntryFormData = {
  company_name: '',
  visitor_name: '',
  purpose: '商談',
  purpose_detail: '',
}

export default function ReceptionApp() {
  const [formData, setFormData] = useState<EntryFormData>(INITIAL_FORM_DATA)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // デバイス判定 (簡易)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const [deviceChecked, setDeviceChecked] = useState(false)
  
  // マウント後にストリームを保持するRef
  const streamRef = useRef<MediaStream | null>(null)

  // カメラ起動
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      })
      streamRef.current = stream
      setIsCapturing(true) // ここでtrueにすることで次のレンダリングで <video> がマウントされる
    } catch (err) {
      console.error('Camera access denied:', err)
      setIsCapturing(false)
    }
  }, [])

  // <video> 要素がマウントされたら srcObject にストリームを割り当てる
  useEffect(() => {
    if (isCapturing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [isCapturing])

  // 初期ロード時のモバイル判定と自動カメラ起動
  useEffect(() => {
    if (!deviceChecked) {
      if (isMobile) {
        startCamera().catch(err => {
          console.warn('Auto start camera failed:', err)
        })
      }
      setDeviceChecked(true)
    }
  }, [isMobile, startCamera, deviceChecked])

  // カメラ停止
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCapturing(false)
  }, [])

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // 写真撮影
  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8)
      setPhotoPreview(photoDataUrl)
      stopCamera()
    }
  }

  // ファイルアップロード処理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoPreview || !formData.company_name || !formData.visitor_name) return

    setIsSubmitting(true)

    try {
      // 1. DataURLからBlobを生成
      const res = await fetch(photoPreview)
      const blob = await res.blob()
      
      // MIMEタイプから拡張子を決定
      const mimeType = blob.type || 'image/jpeg'
      const ext = mimeType.split('/')[1] || 'jpeg'
      const filename = `photo.${ext}`

      // 2. S3 Presigned URL 取得
      const initData = await apiClient.initializeUpload(filename, mimeType)

      // 3. S3 画像アップロード
      await apiClient.uploadPhotoToS3(initData, blob)

      // 4. DynamoDB 登録
      await apiClient.registerEntry({
        company_name: formData.company_name,
        visitor_name: formData.visitor_name,
        purpose: formData.purpose,
        purpose_detail: formData.purpose_detail,
        photo_key: initData.photo_key
      })

      setIsSuccess(true)

      // キオスクモード: 3秒後に自動リセット
      setTimeout(() => {
        setFormData(INITIAL_FORM_DATA)
        setPhotoPreview(null)
        setIsSuccess(false)
      }, 3000)
    } catch (err) {
      console.error('Registration failed:', err)
      alert(`登録に失敗しました。もう一度お試しください。\n詳細: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 完了画面
  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-green-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl animate-in fade-in zoom-in duration-500">
          <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-800 mb-4">登録が完了しました</h2>
          <p className="text-gray-600 text-lg">ご来場ありがとうございます。<br />担当者が参りますので少々お待ちください。</p>
          <p className="text-sm text-gray-400 mt-8">※ 数秒後に初期画面へ戻ります</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-color)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-[var(--primary)] px-8 py-6 text-white text-center">
          <h1 className="text-2xl font-bold">顔写真 受付システム</h1>
          <p className="mt-2 text-indigo-100 text-sm">ご来場ありがとうございます。情報を入力し、顔写真を登録してください。</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8" autoComplete="off">
          
          {/* Photo Section */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">お顔の撮影 <span className="text-red-500">*</span></label>
            
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50 min-h-[320px]">
              
              {!photoPreview && !isCapturing && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="text-gray-500 mb-2">
                    {isMobile ? 'カメラへのアクセスができませんでした。' : 'PCからのアクセスです。'}
                  </div>
                  <label className="flex items-center gap-2 px-8 py-4 bg-[var(--primary)] text-white font-bold rounded-lg hover:bg-[var(--primary-hover)] transition-colors shadow-sm cursor-pointer">
                    <Upload className="w-5 h-5" />
                    ファイルを選択
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      onClick={(e) => {
                        // 同じファイルを選び直せるようにリセット
                        (e.target as HTMLInputElement).value = ''
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Camera Live View (モバイルのみ) */}
              {isCapturing && !photoPreview && (
                <div className="relative w-full max-w-sm rounded-lg overflow-hidden bg-black flex flex-col">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-auto transform scale-x-[-1]" 
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <button
                      type="button"
                      onClick={takePhoto}
                      className="flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-100 transition-transform active:scale-95"
                    >
                      <Camera className="w-5 h-5" />
                      撮影
                    </button>
                  </div>
                </div>
              )}

              {/* Photo Preview */}
              {photoPreview && (
                <div className="relative w-full max-w-sm rounded-lg overflow-hidden shadow-md">
                  <img src={photoPreview} alt="Preview" className="w-full h-auto" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null)
                      // モバイルなら再撮影できるようカメラを再起動する
                      if (isMobile) {
                        startCamera().catch(err => console.warn(err))
                      }
                    }}
                    className="absolute top-2 right-2 bg-gray-900/70 text-white p-2 text-sm flex items-center gap-1 rounded hover:bg-gray-800/70 backdrop-blur-sm transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    撮り直す
                  </button>
                </div>
              )}

              {/* Hidden Canvas for capturing */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* Form Fields Section */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">会社名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="company_name"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--primary)] focus:ring-[var(--primary)] sm:text-sm p-3 border"
                placeholder="株式会社 例"
                value={formData.company_name}
                onChange={e => setFormData({...formData, company_name: e.target.value})}
                autoComplete="off"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="visitor_name" className="block text-sm font-medium text-gray-700">お名前 <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="visitor_name"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--primary)] focus:ring-[var(--primary)] sm:text-sm p-3 border"
                placeholder="山田 太郎"
                value={formData.visitor_name}
                onChange={e => setFormData({...formData, visitor_name: e.target.value})}
                autoComplete="off"
              />
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">ご用件 <span className="text-red-500">*</span></label>
              <select
                id="purpose"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--primary)] focus:ring-[var(--primary)] sm:text-sm p-3 border bg-white"
                value={formData.purpose}
                onChange={e => setFormData({...formData, purpose: e.target.value})}
              >
                <option>商談</option>
                <option>面接</option>
                <option>配達・納品</option>
                <option>その他</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="purpose_detail" className="block text-sm font-medium text-gray-700">詳細（任意）</label>
              <input
                type="text"
                id="purpose_detail"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--primary)] focus:ring-[var(--primary)] sm:text-sm p-3 border"
                placeholder="担当者名など"
                value={formData.purpose_detail}
                onChange={e => setFormData({...formData, purpose_detail: e.target.value})}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !photoPreview || !formData.company_name || !formData.visitor_name}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '登録処理中...' : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
