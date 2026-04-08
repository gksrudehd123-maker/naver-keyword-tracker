export {}

const STORAGE_KEY = "nkt_data"
const ALARM_NAME = "nkt-daily-check"

type SearchItem = {
  title: string
  link: string
  image: string
  mallName: string
  productId: string
}

type SearchResponse = {
  items: SearchItem[]
}

type RankEntry = {
  rank: number | null
  page: number | null
  date: string
}

type Keyword = {
  id: string
  text: string
  isMain: boolean
  ranks: RankEntry[]
}

type Product = {
  id: string
  name: string
  image?: string
  keywords: Keyword[]
  createdAt: number
}

type NaverApiConfig = {
  clientId: string
  clientSecret: string
  storeName: string
}

type StorageData = {
  config: NaverApiConfig | null
  products: Product[]
  autoCheck?: boolean
}

async function loadData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] || { config: null, products: [] }
}

async function saveData(data: StorageData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data })
}

async function naverSearch(
  query: string,
  clientId: string,
  clientSecret: string
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    query,
    display: "100",
    start: "1",
    sort: "sim"
  })

  const res = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?${params}`,
    {
      credentials: "omit",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret
      }
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }

  return res.json()
}

// === 자동 순위 조회 ===

async function autoCheckRanks() {
  const data = await loadData()
  if (!data.config || !data.autoCheck) return

  const { clientId, clientSecret, storeName } = data.config
  if (!clientId || !clientSecret || !storeName) return

  const today = new Date().toISOString().split("T")[0]
  let updated = [...data.products]
  let changes = 0

  for (const product of updated) {
    for (const keyword of product.keywords) {
      try {
        const searchData = await naverSearch(
          keyword.text,
          clientId.trim(),
          clientSecret.trim()
        )

        let newRank: number | null = null
        let newPage: number | null = null
        let image: string | undefined

        for (let i = 0; i < searchData.items.length; i++) {
          if (searchData.items[i].mallName === storeName) {
            newRank = i + 1
            newPage = Math.ceil((i + 1) / 40)
            image = searchData.items[i].image
            break
          }
        }

        // 이전 순위와 비교
        const prevRank =
          keyword.ranks.length > 0
            ? keyword.ranks[keyword.ranks.length - 1]
            : null

        if (
          prevRank?.date !== today &&
          (prevRank?.rank !== newRank || !prevRank)
        ) {
          changes++
        }

        // 순위 기록 저장
        keyword.ranks = [
          ...keyword.ranks.filter((r) => r.date !== today),
          { rank: newRank, page: newPage, date: today }
        ]

        if (image) product.image = image
      } catch {
        // 개별 키워드 실패는 무시
      }

      // API rate limit 방지
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  await saveData({ ...data, products: updated })

  // 순위 변동이 있으면 뱃지 표시
  if (changes > 0) {
    chrome.action.setBadgeBackgroundColor({ color: "#22c55e" })
    chrome.action.setBadgeText({ text: String(changes) })
  }
}

// 알람 설정/해제
async function setupAlarm() {
  const data = await loadData()
  if (data.autoCheck) {
    // 매일 1회 (24시간 주기, 첫 실행은 1분 후)
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: 24 * 60
    })
  } else {
    chrome.alarms.clear(ALARM_NAME)
  }
}

// 알람 리스너
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    autoCheckRanks()
  }
})

// 확장 설치/업데이트 시 알람 설정
chrome.runtime.onInstalled.addListener(() => {
  setupAlarm()
})

// 브라우저 시작 시 알람 확인
chrome.runtime.onStartup.addListener(() => {
  setupAlarm()
})

// === 메시지 리스너 ===

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Storage 데이터 조회 (Content Script용)
  if (message.type === "GET_STORAGE_DATA") {
    loadData().then((data) => sendResponse(data))
    return true
  }

  // Storage 데이터 저장 (Content Script용)
  if (message.type === "SAVE_STORAGE_DATA") {
    chrome.storage.local.set({ [STORAGE_KEY]: message.payload }).then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  // 자동 조회 설정 토글
  if (message.type === "SET_AUTO_CHECK") {
    loadData().then(async (data) => {
      data.autoCheck = message.payload.enabled
      await saveData(data)
      await setupAlarm()
      sendResponse({ ok: true })
    })
    return true
  }

  // 뱃지 초기화
  if (message.type === "CLEAR_BADGE") {
    chrome.action.setBadgeText({ text: "" })
    sendResponse({ ok: true })
    return true
  }

  // 데이터 내보내기
  if (message.type === "EXPORT_DATA") {
    loadData().then((data) => sendResponse({ ok: true, data }))
    return true
  }

  // 데이터 가져오기
  if (message.type === "IMPORT_DATA") {
    saveData(message.payload).then(() => {
      setupAlarm()
      sendResponse({ ok: true })
    })
    return true
  }

  // API 연결 테스트
  if (message.type === "NAVER_API_TEST") {
    const clientId = message.payload.clientId.trim()
    const clientSecret = message.payload.clientSecret.trim()

    naverSearch("테스트", clientId, clientSecret)
      .then(() => sendResponse({ ok: true, message: "API 연결 성공!" }))
      .catch((err) => {
        const msg = String(err.message || "")
        if (msg.includes("401")) {
          sendResponse({
            ok: false,
            message: "인증 실패 — Client ID 또는 Secret이 올바르지 않습니다."
          })
        } else {
          sendResponse({ ok: false, message: `오류: ${msg}` })
        }
      })

    return true
  }

  // 키워드 순위 조회
  if (message.type === "CHECK_RANK") {
    const { keyword, storeName, clientId, clientSecret } = message.payload

    naverSearch(keyword, clientId.trim(), clientSecret.trim())
      .then((data) => {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i]
          if (item.mallName === storeName) {
            sendResponse({
              ok: true,
              rank: i + 1,
              page: Math.ceil((i + 1) / 40),
              item: {
                title: item.title.replace(/<[^>]*>/g, ""),
                link: item.link,
                image: item.image,
                mallName: item.mallName
              }
            })
            return
          }
        }
        // 100위 안에 없음
        sendResponse({ ok: true, rank: null, page: null, item: null })
      })
      .catch((err) => {
        sendResponse({ ok: false, error: String(err.message || "조회 실패") })
      })

    return true
  }
})
