# Portfolio Manager

크립토 및 주식 포트폴리오 관리 서비스. 매크로 지표, 온체인 지표를 종합 분석하여 리밸런싱을 제안합니다.

## 주요 기능

- **실시간 가격 추적**: 업비트, 빗썸 거래소 실시간 가격
- **김치 프리미엄 모니터링**: 국내/해외 가격 차이 실시간 계산
- **온체인 지표 분석**:
  - MVRV Ratio
  - NVT Ratio
  - 해시레이트, 난이도
  - 활성 주소 수
  - 거래소 유출입
- **매크로 지표 분석**:
  - Fear & Greed Index
  - USD/KRW 환율
  - VIX 변동성
- **AI 현금 전략**: 지표 기반 최적 현금 비중 추천
- **자동 리밸런싱**: 거래소 API 연동으로 자동 매매

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **Backend**: Node.js + Express
- **Charts**: Recharts
- **API**: Upbit, Bithumb, CoinGecko, Blockchain.info, CoinMetrics

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 `.env`로 복사하고 API 키를 설정합니다:

```bash
cp .env.example .env
```

```env
# 업비트 API (https://upbit.com/mypage/open_api_management)
UPBIT_ACCESS_KEY=your_key
UPBIT_SECRET_KEY=your_secret

# 빗썸 API (https://www.bithumb.com/api_support/management_api)
BITHUMB_API_KEY=your_key
BITHUMB_SECRET_KEY=your_secret

# 선택사항: 추가 데이터 소스
GLASSNODE_API_KEY=
CRYPTOQUANT_API_KEY=
ALPHA_VANTAGE_API_KEY=
```

### 3. 실행

**개발 모드** (프론트엔드 + 백엔드):
```bash
npm run dev
```

**프론트엔드만**:
```bash
npm start
```

**백엔드만**:
```bash
npm run server
```

## 프로젝트 구조

```
portfolio-manager/
├── src/
│   ├── App.tsx              # 메인 앱 컴포넌트
│   ├── index.tsx            # 엔트리 포인트
│   ├── types/
│   │   └── index.ts         # TypeScript 타입 정의
│   ├── services/
│   │   ├── api.ts           # 시장 데이터 API
│   │   └── exchangeApi.ts   # 거래소 Private API
│   ├── hooks/
│   │   └── useMarketData.ts # React 커스텀 훅
│   └── utils/
│       ├── cashAnalysis.ts  # 현금 비중 분석
│       └── styles.ts        # 스타일 상수
├── server/
│   └── index.js             # Express 백엔드 서버
├── .env.example             # 환경변수 템플릿
├── tsconfig.json            # TypeScript 설정
└── package.json
```

## API 데이터 소스

### 무료 API (API 키 불필요)
- **Upbit Public API**: 한국 원화 가격
- **Bithumb Public API**: 한국 원화 가격
- **CoinGecko**: 글로벌 USD 가격
- **Alternative.me**: Fear & Greed Index
- **Blockchain.info**: BTC 온체인 기본 데이터
- **Mempool.space**: 멤풀 및 수수료 데이터
- **CoinMetrics Community API**: NVT, 활성 주소

### 유료/선택 API
- **Glassnode**: MVRV, 거래소 유출입 (무료 티어 제한적)
- **CryptoQuant**: 거래소 리저브, 펀드 플로우
- **Alpha Vantage**: 주식 시장 데이터

## 지표 기반 분석

### 현금 비중 추천 로직

| 지표 | 가중치 | 설명 |
|------|--------|------|
| Fear & Greed | 20% | 극단적 공포 = 매수 기회 |
| MVRV | 15% | 1 미만 = 바닥, 4 이상 = 천장 |
| 김치 프리미엄 | 10% | 10% 이상 = 과열 |
| 거래소 유출입 | 15% | 유출 = 축적, 유입 = 매도 압력 |
| 200MA 대비 | 15% | 과도한 이탈 = 조정 필요 |
| 변동성 (VIX) | 15% | 높은 변동성 = 리스크 관리 |

### 리스크 레벨

- **AGGRESSIVE**: 현금 10% - 적극 매수
- **GROWTH**: 현금 20% - 점진적 매수
- **BALANCED**: 현금 25% - 현상 유지
- **CAUTIOUS**: 현금 35% - 익절 고려
- **DEFENSIVE**: 현금 45% - 리스크 축소
- **PRESERVATION**: 현금 55% - 시장 관망

## 주의사항

- API 키는 절대 공개 저장소에 커밋하지 마세요
- 자동 매매 기능은 신중하게 사용하세요
- 투자 결정은 본인 책임입니다

## 라이선스

MIT License
