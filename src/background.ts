export {}

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
