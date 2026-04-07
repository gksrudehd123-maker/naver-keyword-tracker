import { useEffect, useState } from "react"

import { clearConfig, getConfig, saveConfig } from "~/lib/storage"
import type { NaverApiConfig } from "~/lib/types"

import "./style.css"

function Options() {
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [storeName, setStoreName] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  useEffect(() => {
    getConfig().then((config) => {
      if (config) {
        setClientId(config.clientId)
        setClientSecret(config.clientSecret)
        setStoreName(config.storeName)
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!clientId || !clientSecret) {
      alert("Client ID와 Client Secret을 입력해주세요.")
      return
    }

    await saveConfig({ clientId, clientSecret, storeName })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = async () => {
    if (!confirm("API 설정을 초기화하시겠습니까?")) return
    await clearConfig()
    setClientId("")
    setClientSecret("")
    setStoreName("")
    setTestResult(null)
  }

  const handleTest = async () => {
    if (!clientId || !clientSecret) {
      alert("Client ID와 Client Secret을 먼저 입력해주세요.")
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const result = await chrome.runtime.sendMessage({
        type: "NAVER_API_TEST",
        payload: { clientId, clientSecret }
      })
      setTestResult(result)
    } catch {
      setTestResult({
        ok: false,
        message: "테스트 실패 — 확장프로그램을 다시 로드해주세요."
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-lg px-4">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            키워드 순위 추적기 설정
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            네이버 검색 API 키를 등록하면 키워드 순위를 조회할 수 있습니다.
          </p>
        </div>

        {/* API 설정 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            네이버 API 설정
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Client ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="네이버 개발자센터에서 발급받은 Client ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Client Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="네이버 개발자센터에서 발급받은 Client Secret"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                스토어 이름
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="예: 방짜온열"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              />
              <p className="mt-1 text-xs text-gray-400">
                스토어 이름을 입력하면 내 상품 순위만 정확하게 찾습니다.
              </p>
            </div>
          </div>

          {/* 테스트 결과 */}
          {testResult && (
            <div
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                testResult.ok
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
              {testResult.message}
            </div>
          )}

          {/* 저장 성공 */}
          {saved && (
            <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              설정이 저장되었습니다!
            </div>
          )}

          {/* 버튼 */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600">
              저장
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50">
              {testing ? "테스트 중..." : "API 테스트"}
            </button>
            <button
              onClick={handleClear}
              className="ml-auto text-sm text-gray-400 transition-colors hover:text-red-500">
              초기화
            </button>
          </div>
        </div>

        {/* 안내 카드 */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            API 키 발급 방법
          </h2>
          <ol className="list-inside list-decimal space-y-2 text-sm text-gray-600">
            <li>
              <a
                href="https://developers.naver.com/apps/#/register"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 underline hover:text-green-700">
                네이버 개발자센터
              </a>
              에 접속합니다.
            </li>
            <li>애플리케이션 등록 → 이름 입력 후 등록합니다.</li>
            <li>
              사용 API에서 <strong>검색</strong>을 선택합니다.
            </li>
            <li>
              환경 추가에서 <strong>WEB 설정</strong>을 선택하고 URL을 입력합니다.
            </li>
            <li>발급된 Client ID와 Client Secret을 위에 입력합니다.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Options
