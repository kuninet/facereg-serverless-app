import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, RefreshCw, CheckCircle2 } from 'lucide-react'

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

  // カメラ起動
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCapturing(true)
      }
    } catch (err) {
      console.error('Camera access denied:', err)
      alert('カメラのアクセスが拒否されました。設定を確認するか、ファイルアップロードをご利用ください。')
    }
  }

  // カメラ停止
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setIsCapturing(false)
  }, [])

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

  // フォーム送信（モック）とキオスクリセット
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoPreview || !formData.company_name || !formData.visitor_name) return

    setIsSubmitting(true)

    // TODO: ここで S3 Presigned URL 取得 -> S3 画像アップロード -> DynamoDB 登録 API を呼び出す
    // 今回はモックとして2秒待機
    await new Promise(resolve => setTimeout(resolve, 2000))

    setIsSubmitting(false)
    setIsSuccess(true)

    // キオスクモード: 3秒後に自動リセット
    setTimeout(() => {
      setFormData(INITIAL_FORM_DATA)
      setPhotoPreview(null)
      setIsSuccess(false)
    }, 3000)
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
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
                  >
                    <Camera className="w-5 h-5" />
                    カメラを起動する
                  </button>
                  <label className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
                    <Upload className="w-5 h-5" />
                    ファイルを選択
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              )}

              {/* Camera Live View */}
              {isCapturing && !photoPreview && (
                <div className="relative w-full max-w-sm rounded-lg overflow-hidden bg-black">
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
                      className="bg-white text-gray-900 rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-gray-100 transition-transform hover:scale-105"
                    >
                      <Camera className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-gray-800/70 text-white px-4 py-2 rounded-full text-sm hover:bg-gray-700/70 backdrop-blur-sm"
                    >
                      キャンセル
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
                    onClick={() => setPhotoPreview(null)}
                    className="absolute top-2 right-2 bg-gray-900/70 text-white p-2 rounded-full hover:bg-gray-800/70 backdrop-blur-sm transition-colors"
                  >
                    <RefreshCw className="w-5 h-5" />
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
