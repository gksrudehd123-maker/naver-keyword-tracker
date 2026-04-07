import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts"

import { getConfig, getProducts, saveProducts } from "~/lib/storage"
import type { Product, Keyword } from "~/lib/types"

import "./style.css"

type Tab = "rank" | "product" | "settings"

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function Popup() {
  const [tab, setTab] = useState<Tab>("product")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // 상품 추가 폼
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newProductName, setNewProductName] = useState("")

  // 키워드 추가
  const [addingKeywordId, setAddingKeywordId] = useState<string | null>(null)
  const [newKeyword, setNewKeyword] = useState("")

  // 펼침 상태
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 순위 조회
  const [checking, setChecking] = useState(false)
  const [checkProgress, setCheckProgress] = useState("")

  // 차트 표시
  const [chartKeyword, setChartKeyword] = useState<Keyword | null>(null)

  useEffect(() => {
    getProducts().then((p) => {
      setProducts(p)
      setLoading(false)
    })
  }, [])

  const persist = async (updated: Product[]) => {
    setProducts(updated)
    await saveProducts(updated)
  }

  // 상품 추가
  const handleAddProduct = async () => {
    const name = newProductName.trim()
    if (!name) return
    const product: Product = {
      id: genId(),
      name,
      keywords: [],
      createdAt: Date.now()
    }
    await persist([...products, product])
    setNewProductName("")
    setShowAddProduct(false)
    setExpandedId(product.id)
  }

  // 상품 삭제
  const handleDeleteProduct = async (id: string) => {
    if (!confirm("이 상품을 삭제하시겠습니까?")) return
    await persist(products.filter((p) => p.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // 키워드 추가
  const handleAddKeyword = async (productId: string) => {
    const text = newKeyword.trim()
    if (!text) return
    const keyword: Keyword = {
      id: genId(),
      text,
      isMain: false,
      ranks: []
    }
    const updated = products.map((p) =>
      p.id === productId ? { ...p, keywords: [...p.keywords, keyword] } : p
    )
    await persist(updated)
    setNewKeyword("")
    setAddingKeywordId(null)
  }

  // 키워드 삭제
  const handleDeleteKeyword = async (productId: string, keywordId: string) => {
    const updated = products.map((p) =>
      p.id === productId
        ? { ...p, keywords: p.keywords.filter((k) => k.id !== keywordId) }
        : p
    )
    await persist(updated)
  }

  // 메인 키워드 토글
  const handleToggleMain = async (productId: string, keywordId: string) => {
    const updated = products.map((p) =>
      p.id === productId
        ? {
            ...p,
            keywords: p.keywords.map((k) =>
              k.id === keywordId ? { ...k, isMain: !k.isMain } : k
            )
          }
        : p
    )
    await persist(updated)
  }

  // 전체 키워드 순위 조회
  const handleCheckAll = async () => {
    const config = await getConfig()
    if (!config || !config.clientId || !config.clientSecret) {
      alert("설정에서 네이버 API 키를 먼저 등록해주세요.")
      return
    }

    const allKeywords: { productId: string; keyword: Keyword }[] = []
    for (const p of products) {
      for (const k of p.keywords) {
        allKeywords.push({ productId: p.id, keyword: k })
      }
    }

    if (allKeywords.length === 0) {
      alert("조회할 키워드가 없습니다.")
      return
    }

    setChecking(true)
    const today = new Date().toISOString().split("T")[0]
    let updated = [...products]

    for (let i = 0; i < allKeywords.length; i++) {
      const { productId, keyword } = allKeywords[i]
      setCheckProgress(`${i + 1}/${allKeywords.length} 조회 중...`)

      try {
        const result = await chrome.runtime.sendMessage({
          type: "CHECK_RANK",
          payload: {
            keyword: keyword.text,
            storeName: config.storeName,
            clientId: config.clientId,
            clientSecret: config.clientSecret
          }
        })

        if (result.ok) {
          const newRank = { rank: result.rank, page: result.page, date: today }
          updated = updated.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  image: result.item?.image || p.image,
                  keywords: p.keywords.map((k) =>
                    k.id === keyword.id
                      ? {
                          ...k,
                          ranks: [
                            ...k.ranks.filter((r) => r.date !== today),
                            newRank
                          ]
                        }
                      : k
                  )
                }
              : p
          )
        }
      } catch {
        // 개별 키워드 실패는 무시하고 계속 진행
      }

      // API 호출 간 딜레이 (rate limit 방지)
      if (i < allKeywords.length - 1) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    await persist(updated)
    setChecking(false)
    setCheckProgress("")
  }

  const renderRankTab = () => {
    const hasKeywords = products.some((p) => p.keywords.length > 0)

    return (
      <div className="flex-1 overflow-y-auto">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-gray-500 mb-2">
              등록된 상품이 없습니다.
            </p>
            <p className="text-xs text-gray-400">
              상품 탭에서 상품과 키워드를 먼저 등록해주세요.
            </p>
          </div>
        ) : (
          <>
            {/* 조회 버튼 */}
            {hasKeywords && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={handleCheckAll}
                  disabled={checking}
                  className="flex-1 rounded-lg bg-green-500 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50">
                  {checking ? checkProgress : "전체 순위 조회"}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2.5">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-400">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900">
                      {p.name}
                    </h3>
                  </div>
                  {p.keywords.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-400">키워드 없음</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {p.keywords.map((k) => {
                        const latest =
                          k.ranks.length > 0
                            ? k.ranks[k.ranks.length - 1]
                            : null
                        const prev =
                          k.ranks.length > 1
                            ? k.ranks[k.ranks.length - 2]
                            : null

                        let changeEl = null
                        if (latest?.rank && prev?.rank) {
                          const diff = prev.rank - latest.rank
                          if (diff > 0)
                            changeEl = (
                              <span className="text-xs text-green-500">
                                ▲{diff}
                              </span>
                            )
                          else if (diff < 0)
                            changeEl = (
                              <span className="text-xs text-red-500">
                                ▼{Math.abs(diff)}
                              </span>
                            )
                        }

                        const isChartOpen = chartKeyword?.id === k.id
                        const chartData = k.ranks
                          .slice(-14)
                          .map((r) => ({
                            date: r.date.slice(5),
                            rank: r.rank ?? 101
                          }))

                        return (
                          <div key={k.id}>
                            <div
                              onClick={() =>
                                setChartKeyword(isChartOpen ? null : k)
                              }
                              className="flex cursor-pointer items-center justify-between rounded px-1 py-0.5 text-sm hover:bg-gray-50">
                              <span className="text-gray-700">
                                {k.isMain && (
                                  <span className="mr-1 text-xs text-green-600">
                                    ★
                                  </span>
                                )}
                                {k.text}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {changeEl}
                                <span
                                  className={`text-xs font-medium ${
                                    latest?.rank
                                      ? latest.rank <= 10
                                        ? "text-green-600"
                                        : latest.rank <= 50
                                          ? "text-yellow-600"
                                          : "text-gray-500"
                                      : "text-gray-400"
                                  }`}>
                                  {latest
                                    ? latest.rank
                                      ? `${latest.rank}위`
                                      : "100위 밖"
                                    : "미조회"}
                                </span>
                              </div>
                            </div>
                            {isChartOpen && chartData.length >= 2 && (
                              <div className="mt-1 mb-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                                <p className="mb-1 text-xs font-medium text-gray-500">
                                  최근 14일 순위 추이
                                </p>
                                <ResponsiveContainer width="100%" height={100}>
                                  <LineChart data={chartData}>
                                    <XAxis
                                      dataKey="date"
                                      tick={{ fontSize: 10 }}
                                      interval="preserveStartEnd"
                                    />
                                    <YAxis
                                      reversed
                                      domain={[1, "auto"]}
                                      tick={{ fontSize: 10 }}
                                      width={30}
                                    />
                                    <Tooltip
                                      formatter={(v: number) =>
                                        v === 101 ? "100위 밖" : `${v}위`
                                      }
                                      labelFormatter={(l) => `날짜: ${l}`}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="rank"
                                      stroke="#22c55e"
                                      strokeWidth={2}
                                      dot={{ r: 3 }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                            {isChartOpen && chartData.length < 2 && (
                              <p className="mb-2 text-center text-xs text-gray-400">
                                2일 이상 데이터가 쌓이면 차트가 표시됩니다.
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  const renderProductTab = () => (
    <div className="flex-1 overflow-y-auto">
      {/* 상품 목록 */}
      {products.length === 0 && !showAddProduct ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-500 mb-4">등록된 상품이 없습니다.</p>
          <button
            onClick={() => setShowAddProduct(true)}
            className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600">
            상품 등록하기
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-gray-200 bg-white">
              {/* 상품 헤더 */}
              <div
                className="flex cursor-pointer items-center justify-between px-3 py-2.5"
                onClick={() =>
                  setExpandedId(expandedId === p.id ? null : p.id)
                }>
                <div className="flex items-center gap-2">
                  <svg
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expandedId === p.id ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {p.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({p.keywords.length}개 키워드)
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteProduct(p.id)
                  }}
                  className="text-gray-300 transition-colors hover:text-red-500">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* 키워드 목록 (펼침) */}
              {expandedId === p.id && (
                <div className="border-t border-gray-100 px-3 py-2">
                  {p.keywords.length === 0 ? (
                    <p className="py-2 text-center text-xs text-gray-400">
                      등록된 키워드가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {p.keywords.map((k) => (
                        <div
                          key={k.id}
                          className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleMain(p.id, k.id)}
                              title={
                                k.isMain
                                  ? "메인 키워드 해제"
                                  : "메인 키워드 설정"
                              }
                              className={`text-xs ${k.isMain ? "text-green-500" : "text-gray-300 hover:text-green-400"}`}>
                              ★
                            </button>
                            <span className="text-sm text-gray-700">
                              {k.text}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteKeyword(p.id, k.id)}
                            className="text-gray-300 transition-colors hover:text-red-500">
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 키워드 추가 */}
                  {addingKeywordId === p.id ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddKeyword(p.id)
                        }
                        placeholder="키워드 입력"
                        autoFocus
                        className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddKeyword(p.id)}
                        className="rounded bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">
                        추가
                      </button>
                      <button
                        onClick={() => {
                          setAddingKeywordId(null)
                          setNewKeyword("")
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600">
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingKeywordId(p.id)}
                      className="mt-2 w-full rounded border border-dashed border-gray-300 py-1.5 text-xs text-gray-400 transition-colors hover:border-green-400 hover:text-green-500">
                      + 키워드 추가
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 상품 추가 버튼/폼 */}
          {showAddProduct ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddProduct()}
                placeholder="상품 이름 입력"
                autoFocus
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
              />
              <button
                onClick={handleAddProduct}
                className="rounded bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">
                등록
              </button>
              <button
                onClick={() => {
                  setShowAddProduct(false)
                  setNewProductName("")
                }}
                className="text-xs text-gray-400 hover:text-gray-600">
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddProduct(true)}
              className="w-full rounded-lg border border-dashed border-gray-300 py-2.5 text-sm text-gray-400 transition-colors hover:border-green-400 hover:text-green-500">
              + 상품 추가
            </button>
          )}
        </div>
      )}
    </div>
  )

  const tabClass = (t: Tab) =>
    `flex flex-col items-center gap-1 ${tab === t ? "text-green-600" : "text-gray-400 hover:text-gray-600"}`

  if (loading) {
    return (
      <div className="flex h-[400px] w-[360px] items-center justify-center bg-white">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="flex h-[480px] w-[360px] flex-col bg-white p-4">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b pb-3 mb-4">
        <h1 className="text-lg font-bold text-gray-900">키워드 순위 추적기</h1>
        <span className="text-xs text-gray-400">v0.0.1</span>
      </header>

      {/* 탭 콘텐츠 */}
      {tab === "rank" && renderRankTab()}
      {tab === "product" && renderProductTab()}

      {/* 하단 네비게이션 */}
      <nav className="flex justify-around border-t pt-3 mt-3">
        <button className={tabClass("rank")} onClick={() => setTab("rank")}>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span className="text-xs">순위</span>
        </button>
        <button
          className={tabClass("product")}
          onClick={() => setTab("product")}>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span className="text-xs">상품</span>
        </button>
        <button
          className={tabClass("settings")}
          onClick={() => chrome.runtime.openOptionsPage()}>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-xs">설정</span>
        </button>
      </nav>
    </div>
  )
}

export default Popup
