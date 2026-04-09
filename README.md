# 네이버 키워드 순위 추적기 — Chrome Extension

> 스마트스토어 셀러를 위한 네이버 쇼핑 키워드 순위 추적 크롬 확장프로그램

---

## 개요

스마트스토어 상품의 네이버 쇼핑 키워드 순위를 추적하는 크롬 확장프로그램입니다.

### 핵심 기능

- **팝업 순위 조회** — 상품별 네이버 쇼핑 키워드 순위 조회 + 등락 표시 (▲▼)
- **순위 추이 차트** — 일별 순위 변동 추이 (Recharts, Y축 반전)
- **자동 조회** — chrome.alarms로 매일 자동 순위 조회 + 뱃지 알림
- **네이버 쇼핑 패널** — 검색 시 오른쪽 순위 패널 자동 표시 + 키워드 추가 버튼
- **상품 하이라이트** — 검색 결과에서 내 상품 초록 테두리 + "N위" 뱃지
- **데이터 백업** — JSON 내보내기/가져오기
- 모든 데이터 브라우저 로컬 저장 (서버 없음)

### 사용자 흐름

```
1. 설정에서 네이버 검색 API 키 입력 (developers.naver.com 에서 무료 발급)
2. 추적할 상품과 키워드 등록
3. "순위 조회" 클릭 → 현재 순위 표시
4. 일별 순위 추이 차트 확인
5. 네이버 쇼핑 검색 시 자동으로 순위 패널 + 상품 하이라이트 표시
```

---

## 기술 스택

| 구분 | 기술 | 설명 |
|------|------|------|
| **프레임워크** | Plasmo | 크롬 확장 전용 프레임워크 (manifest 자동 생성, HMR) |
| **UI** | React + TypeScript | 타입 안정성 + 컴포넌트 기반 UI |
| **스타일** | Tailwind CSS | 유틸리티 CSS |
| **차트** | Recharts | 순위 추이 차트 |
| **API** | 네이버 검색 API | 쇼핑 키워드 순위 조회 (무료, 하루 25,000건) |
| **저장소** | chrome.storage.local | 로컬 브라우저 저장 (최대 5MB) |

---

## 프로젝트 구조

```
naver-keyword-tracker/
├── src/
│   ├── popup.tsx                          # 메인 팝업 UI (상품별 순위 목록, 추이 차트)
│   ├── options.tsx                        # 설정 페이지 (API 키, 스토어 이름)
│   ├── background.ts                      # 서비스 워커 (API 호출, 자동 조회 알람)
│   ├── style.css                          # Tailwind 글로벌 스타일
│   ├── contents/
│   │   ├── shopping-search.tsx            # 네이버 쇼핑 검색 순위 패널 (Content Script)
│   │   └── shopping-highlight.ts          # 검색 결과 내 상품 하이라이트 (Content Script)
│   └── lib/
│       ├── storage.ts                     # chrome.storage 래퍼
│       └── types.ts                       # 타입 정의
├── assets/
│   └── icon.png                           # 확장프로그램 아이콘 (128x128)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## 빌드 및 테스트

```bash
# 의존성 설치
pnpm install

# 개발 서버 (HMR)
pnpm dev
# → chrome://extensions → 개발자 모드 → build/chrome-mv3-dev 폴더 로드

# 프로덕션 빌드
pnpm build

# 스토어 배포용 zip
pnpm package
# → build/chrome-mv3-prod.zip
```

---

## TODO

### 미완료

#### Chrome Web Store 배포

- [ ] PRIVACY.md 작성 (개인정보 처리방침)
- [ ] 스크린샷 준비 (1280x800)
- [ ] 개발자 등록 ($5)
- [ ] 스토어 제출 및 심사

### 완료된 작업 이력

| 날짜 | 내용 |
|------|------|
| 04-06 | 프로젝트 세팅 (Plasmo + React + TypeScript + Tailwind CSS) |
| 04-07 | 설정 페이지 (API 키 입력, 유효성 테스트, 스토어 이름) |
| 04-07 | 상품/키워드 관리 (등록/삭제, 메인 키워드 토글) |
| 04-07 | 키워드 순위 조회 (네이버 쇼핑 API, 순차 조회, 등락 표시) |
| 04-07 | 팝업 UI (상품 카드, 순위 배지, 썸네일) |
| 04-07 | 순위 추이 차트 (Recharts, Y축 반전, 14일) |
| 04-08 | Content Script — 네이버 쇼핑 검색 순위 패널 (자동 표시, 키워드 추가) |
| 04-08 | Content Script — 검색 결과 내 상품 하이라이트 (초록 테두리 + N위 뱃지) |
| 04-08 | 자동 조회 (chrome.alarms), 뱃지 알림, JSON 백업/복원 |

---

## Chrome Web Store 배포 절차

### 1. 개발자 등록

| 순서 | 작업 |
|------|------|
| 1 | [Chrome Web Store 개발자 콘솔](https://chrome.google.com/webstore/devconsole) 접속 |
| 2 | 개발자 등록비 $5 결제 (1회) |
| 3 | 개발자 정보 입력 (이름, 이메일) |
| 4 | 이메일 인증 |

### 2. 등록 자료 준비

| 항목 | 규격 | 설명 |
|------|------|------|
| 아이콘 | 128x128 PNG | 스토어 목록 표시용 |
| 스크린샷 | 1280x800 또는 640x400 | 최소 1장, 3~5장 추천 |
| 짧은 설명 | 132자 이내 | 검색 결과 표시 |
| 상세 설명 | 자유 | 기능, 사용법, API 키 발급 안내 |
| 카테고리 | "생산성" 또는 "쇼핑" | |
| 개인정보 처리방침 | URL | PRIVACY.md를 GitHub Pages로 공개 |

### 3. 제출 및 심사

| 항목 | 내용 |
|------|------|
| 심사 기간 | 1~3일 (첫 등록은 더 걸릴 수 있음) |
| 거절 시 | 사유 이메일 수신 → 수정 후 재제출 |
| 승인 시 | 자동 스토어 공개 |
| 업데이트 | zip 재업로드 → 재심사 |

---

## 스토어 상세 설명 (초안)

```
스마트스토어 셀러를 위한 네이버 쇼핑 키워드 순위 추적 도구입니다.

[주요 기능]
- 상품별 네이버 쇼핑 키워드 순위 조회
- 일별 순위 변동 추이 차트
- 여러 상품, 여러 키워드 동시 추적
- 매일 자동 순위 조회 + 변동 알림
- 네이버 쇼핑 검색 시 내 상품 순위 패널 자동 표시
- 검색 결과에서 내 상품 하이라이트

[사용 방법]
1. 설정에서 네이버 검색 API 키를 입력합니다
   (https://developers.naver.com 에서 무료 발급)
2. 추적할 상품과 키워드를 등록합니다
3. "순위 조회" 버튼을 클릭하면 현재 순위가 표시됩니다

[참고]
- 네이버 검색 API 키가 필요합니다 (무료, 하루 25,000건)
- 모든 데이터는 브라우저 로컬에만 저장됩니다 (서버 전송 없음)
```

---

## 참고

- 네이버 검색 API 문서: https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md
- Plasmo 공식 문서: https://docs.plasmo.com
- Chrome Extensions 개발 문서: https://developer.chrome.com/docs/extensions
