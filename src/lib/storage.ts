import type { NaverApiConfig, Product, StorageData } from "./types"

const STORAGE_KEY = "nkt_data"

const DEFAULT_DATA: StorageData = {
  config: null,
  products: []
}

/** 전체 데이터 로드 */
export async function loadData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] || DEFAULT_DATA
}

/** 전체 데이터 저장 */
async function saveData(data: StorageData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data })
}

/** API 설정 조회 */
export async function getConfig(): Promise<NaverApiConfig | null> {
  const data = await loadData()
  return data.config
}

/** API 설정 저장 */
export async function saveConfig(config: NaverApiConfig): Promise<void> {
  const data = await loadData()
  data.config = config
  await saveData(data)
}

/** API 설정 삭제 */
export async function clearConfig(): Promise<void> {
  const data = await loadData()
  data.config = null
  await saveData(data)
}

/** 상품 목록 조회 */
export async function getProducts(): Promise<Product[]> {
  const data = await loadData()
  return data.products
}

/** 상품 저장 (전체 덮어쓰기) */
export async function saveProducts(products: Product[]): Promise<void> {
  const data = await loadData()
  data.products = products
  await saveData(data)
}
