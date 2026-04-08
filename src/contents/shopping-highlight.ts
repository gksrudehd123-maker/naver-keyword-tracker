import type { PlasmoCSConfig } from "plasmo"
import type { StorageData } from "~/lib/types"

export const config: PlasmoCSConfig = {
  matches: ["https://search.shopping.naver.com/*"],
  run_at: "document_idle"
}

const HIGHLIGHT_ATTR = "data-nkt-highlighted"
const BADGE_CLASS = "nkt-rank-badge"

// 스타일 주입
function injectStyles() {
  if (document.getElementById("nkt-highlight-styles")) return
  const style = document.createElement("style")
  style.id = "nkt-highlight-styles"
  style.textContent = `
    .nkt-highlighted {
      outline: 3px solid #22c55e !important;
      outline-offset: -1px;
      border-radius: 8px;
      position: relative;
    }
    .${BADGE_CLASS} {
      position: absolute;
      top: 8px;
      left: 8px;
      background: #22c55e;
      color: white;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
  `
  document.head.appendChild(style)
}

// 상품 카드에서 스토어명 매칭 + 하이라이트
function highlightProducts(storeName: string) {
  if (!storeName) return

  injectStyles()

  // 네이버 쇼핑 검색 결과 상품 카드 셀렉터들
  const productItems = document.querySelectorAll(
    ".basicList_item__0T9JD, .product_item__MDtDF, [class*='basicList_item'], [class*='product_item']"
  )

  let rank = 0

  productItems.forEach((item) => {
    rank++
    const el = item as HTMLElement

    // 이미 처리된 항목 스킵
    if (el.hasAttribute(HIGHLIGHT_ATTR)) return

    // 쇼핑몰명 찾기: mall_area 안의 a 태그에서 스토어명 추출
    const mallAreaEl = el.querySelector("[class*='mall_area']") || el.querySelector("[class*='mall_name']")
    if (!mallAreaEl) return

    const mallLink = mallAreaEl.querySelector("a")
    const mallName = (mallLink?.textContent || mallAreaEl.textContent || "").trim()

    if (mallName === storeName) {
      el.classList.add("nkt-highlighted")
      el.setAttribute(HIGHLIGHT_ATTR, "true")

      // 상위 요소에 position: relative 확보
      if (getComputedStyle(el).position === "static") {
        el.style.position = "relative"
      }

      // 뱃지 추가
      const badge = document.createElement("div")
      badge.className = BADGE_CLASS
      badge.textContent = `내 상품 ${rank}위`
      el.appendChild(badge)
    }
  })
}

// 메인 실행
async function run() {
  try {
    const data: StorageData = await chrome.runtime.sendMessage({
      type: "GET_STORAGE_DATA"
    })

    if (!data?.config?.storeName) return

    const storeName = data.config.storeName

    // 초기 하이라이트
    highlightProducts(storeName)

    // DOM 변경 감지 (무한스크롤, SPA 대응)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let isHighlighting = false

    const observer = new MutationObserver(() => {
      if (isHighlighting) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        isHighlighting = true
        highlightProducts(storeName)
        isHighlighting = false
      }, 300)
    })

    const targetNode =
      document.querySelector("#content") ||
      document.querySelector("#__next") ||
      document.body

    observer.observe(targetNode, {
      childList: true,
      subtree: true
    })
  } catch {
    // 확장 프로그램 컨텍스트 오류 무시
  }
}

run()
