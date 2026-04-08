import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"
import type { Product, Keyword, NaverApiConfig, StorageData } from "~/lib/types"

export const config: PlasmoCSConfig = {
  matches: ["https://search.shopping.naver.com/*"]
}

// Plasmo Shadow DOM에 Tailwind 주입
import cssText from "data-text:~/style.css"
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

// 패널 위치: 페이지 오른쪽 상단 고정
export const getOverlayAnchor = () => document.body

function getSearchKeyword(): string {
  const url = new URL(window.location.href)
  return url.searchParams.get("query") || ""
}

type RankResult = {
  keyword: Keyword
  product: Product
  rank: number | null
  page: number | null
  loading: boolean
}

function ShoppingSearchPanel() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [config, setConfig] = useState<NaverApiConfig | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [results, setResults] = useState<RankResult[]>([])
  const [checking, setChecking] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  // 초기 로드: storage 데이터 + 검색어 추출
  useEffect(() => {
    const keyword = getSearchKeyword()
    setSearchKeyword(keyword)

    chrome.runtime.sendMessage({ type: "GET_STORAGE_DATA" }).then(
      (data: StorageData) => {
        setConfig(data.config)
        setProducts(data.products || [])
        setReady(true)
      }
    )
  }, [])

  // URL 변경 감지 (SPA 대응)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const keyword = getSearchKeyword()
      if (keyword !== searchKeyword) {
        setSearchKeyword(keyword)
        setResults([])
      }
    })
    observer.observe(document.querySelector("title") || document.head, {
      childList: true,
      subtree: true
    })
    return () => observer.disconnect()
  }, [searchKeyword])

  // 검색어 변경 시 자동 순위 조회
  useEffect(() => {
    if (!ready || !searchKeyword || !config) return

    // 등록된 키워드 중 현재 검색어와 일치하는 것 찾기
    const matching: { product: Product; keyword: Keyword }[] = []
    for (const p of products) {
      for (const k of p.keywords) {
        if (k.text === searchKeyword) {
          matching.push({ product: p, keyword: k })
        }
      }
    }

    if (matching.length === 0) {
      setResults([])
      return
    }

    // 순위 조회 실행
    setChecking(true)
    const initialResults: RankResult[] = matching.map(({ product, keyword }) => ({
      product,
      keyword,
      rank: null,
      page: null,
      loading: true
    }))
    setResults(initialResults)

    const today = new Date().toISOString().split("T")[0]

    ;(async () => {
      const updatedResults = [...initialResults]

      for (let i = 0; i < matching.length; i++) {
        const { product, keyword } = matching[i]
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
            updatedResults[i] = {
              ...updatedResults[i],
              rank: result.rank,
              page: result.page,
              loading: false
            }
            setResults([...updatedResults])

            // 순위 기록 저장
            const newRank = { rank: result.rank, page: result.page, date: today }
            const updatedProducts = products.map((p) =>
              p.id === product.id
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

            await chrome.runtime.sendMessage({
              type: "SAVE_STORAGE_DATA",
              payload: { config, products: updatedProducts }
            })
          } else {
            updatedResults[i] = { ...updatedResults[i], loading: false }
            setResults([...updatedResults])
          }
        } catch {
          updatedResults[i] = { ...updatedResults[i], loading: false }
          setResults([...updatedResults])
        }

        if (i < matching.length - 1) {
          await new Promise((r) => setTimeout(r, 300))
        }
      }

      setChecking(false)
    })()
  }, [searchKeyword, ready])

  // 키워드 추가 핸들러
  const handleAddKeyword = async (productId: string) => {
    if (!searchKeyword || !config) return

    const newKeyword: Keyword = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: searchKeyword,
      isMain: false,
      ranks: []
    }

    const updatedProducts = products.map((p) =>
      p.id === productId
        ? { ...p, keywords: [...p.keywords, newKeyword] }
        : p
    )

    await chrome.runtime.sendMessage({
      type: "SAVE_STORAGE_DATA",
      payload: { config, products: updatedProducts }
    })

    setProducts(updatedProducts)

    // 즉시 순위 조회
    const product = updatedProducts.find((p) => p.id === productId)!
    setResults((prev) => [
      ...prev,
      { product, keyword: newKeyword, rank: null, page: null, loading: true }
    ])

    try {
      const result = await chrome.runtime.sendMessage({
        type: "CHECK_RANK",
        payload: {
          keyword: searchKeyword,
          storeName: config.storeName,
          clientId: config.clientId,
          clientSecret: config.clientSecret
        }
      })

      if (result.ok) {
        const today = new Date().toISOString().split("T")[0]
        const newRank = { rank: result.rank, page: result.page, date: today }
        const savedProducts = updatedProducts.map((p) =>
          p.id === productId
            ? {
                ...p,
                image: result.item?.image || p.image,
                keywords: p.keywords.map((k) =>
                  k.id === newKeyword.id
                    ? { ...k, ranks: [newRank] }
                    : k
                )
              }
            : p
        )

        await chrome.runtime.sendMessage({
          type: "SAVE_STORAGE_DATA",
          payload: { config, products: savedProducts }
        })

        setResults((prev) =>
          prev.map((r) =>
            r.keyword.id === newKeyword.id
              ? { ...r, rank: result.rank, page: result.page, loading: false }
              : r
          )
        )
      }
    } catch {
      setResults((prev) =>
        prev.map((r) =>
          r.keyword.id === newKeyword.id ? { ...r, loading: false } : r
        )
      )
    }
  }

  // 설정 안 됨
  if (!ready) return null
  if (!config) return null
  if (!searchKeyword) return null

  // 이 키워드가 등록된 상품 목록
  const registeredProductIds = new Set(
    results.map((r) => r.product.id)
  )
  const unregisteredProducts = products.filter(
    (p) => !registeredProductIds.has(p.id)
  )

  const isRegistered = results.length > 0

  return (
    <div
      style={{
        position: "fixed",
        top: "80px",
        right: "16px",
        zIndex: 2147483647,
        width: collapsed ? "auto" : "320px"
      }}>
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
        {/* 헤더 */}
        <div
          className="flex items-center justify-between bg-green-500 px-4 py-2.5 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">키워드 순위 추적기</span>
            {checking && (
              <span className="text-xs text-green-100">조회 중...</span>
            )}
          </div>
          <span className="text-white text-xs">
            {collapsed ? "▼" : "▲"}
          </span>
        </div>

        {!collapsed && (
          <div className="p-3">
            {/* 현재 검색어 */}
            <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">검색 키워드</p>
              <p className="text-sm font-semibold text-gray-900">
                {searchKeyword}
              </p>
            </div>

            {/* 순위 결과 */}
            {isRegistered ? (
              <div className="space-y-2">
                {results.map((r) => {
                  const prev =
                    r.keyword.ranks.length > 1
                      ? r.keyword.ranks[r.keyword.ranks.length - 2]
                      : null

                  let changeEl = null
                  if (r.rank && prev?.rank) {
                    const diff = prev.rank - r.rank
                    if (diff > 0)
                      changeEl = (
                        <span className="text-xs text-green-500 ml-1">
                          ▲{diff}
                        </span>
                      )
                    else if (diff < 0)
                      changeEl = (
                        <span className="text-xs text-red-500 ml-1">
                          ▼{Math.abs(diff)}
                        </span>
                      )
                  }

                  return (
                    <div
                      key={r.keyword.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.product.image ? (
                          <img
                            src={r.product.image}
                            alt=""
                            className="h-8 w-8 rounded object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-400 shrink-0">
                            <svg
                              className="h-4 w-4"
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
                          </div>
                        )}
                        <span className="text-xs text-gray-700 truncate">
                          {r.product.name}
                        </span>
                      </div>
                      <div className="flex items-center shrink-0">
                        {r.loading ? (
                          <span className="text-xs text-gray-400">조회 중...</span>
                        ) : (
                          <>
                            <span
                              className={`text-sm font-bold ${
                                r.rank
                                  ? r.rank <= 10
                                    ? "text-green-600"
                                    : r.rank <= 50
                                      ? "text-yellow-600"
                                      : "text-gray-500"
                                  : "text-gray-400"
                              }`}>
                              {r.rank ? `${r.rank}위` : "100위 밖"}
                            </span>
                            {changeEl}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400 py-2">
                이 키워드로 등록된 상품이 없습니다.
              </p>
            )}

            {/* 미등록 상품에 키워드 추가 */}
            {unregisteredProducts.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500 mb-2">
                  이 키워드를 추가할 상품 선택
                </p>
                <div className="space-y-1">
                  {unregisteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddKeyword(p.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left transition-colors hover:border-green-400 hover:bg-green-50">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-400">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </div>
                      )}
                      <span className="text-xs text-gray-600">{p.name}</span>
                      <span className="ml-auto text-xs text-green-500">+ 추가</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ShoppingSearchPanel
