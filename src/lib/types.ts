/** 네이버 API 설정 */
export type NaverApiConfig = {
  clientId: string
  clientSecret: string
  storeName: string
}

/** 상품 정보 */
export type Product = {
  id: string
  name: string
  image?: string // 네이버 쇼핑 썸네일 URL
  keywords: Keyword[]
  createdAt: number
}

/** 키워드 정보 */
export type Keyword = {
  id: string
  text: string
  isMain: boolean
  ranks: RankEntry[]
}

/** 순위 기록 */
export type RankEntry = {
  rank: number | null // null이면 100위 밖
  page: number | null
  date: string // YYYY-MM-DD
}

/** 전체 저장 데이터 */
export type StorageData = {
  config: NaverApiConfig | null
  products: Product[]
}
