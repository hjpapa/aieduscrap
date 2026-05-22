# 교육 뉴스 인사이트 에이전트

Next.js App Router와 Tailwind CSS 기반 1차 버전입니다. 교육 관련 RSS 또는 보도자료 메타데이터를 수집하고, 기사 전문을 저장하지 않은 상태에서 OpenAI API 또는 Gemini API로 요약과 초등교사 관점 인사이트를 생성해 Supabase에 저장합니다.

## 주요 흐름

1. `/api/collect-news`가 RSS 피드에서 `title`, `source`, `url`, `published_at`, `category`만 수집합니다.
2. `education_news.url` unique 제약으로 중복 URL 저장을 방지합니다.
3. `/api/generate-briefing`이 오늘 수집된 뉴스별로 `category`, `summary`, `teacher_insight`, `school_action`, `importance`를 생성합니다.
4. 같은 API가 오늘의 통합 브리핑을 `daily_briefings`에 저장합니다.
5. `/` 메인 페이지가 오늘 브리핑, 중요도 높은 뉴스 5개, 카테고리 필터, 전체 뉴스 카드를 보여줍니다.

## 설치

```bash
npm install
```

## 환경변수

`.env.example`을 참고해 `.env.local`을 설정합니다.

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
AI_PROVIDER=openai
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
NEWS_RSS_FEEDS=
```

Gemini를 쓰려면 Google AI Studio에서 API 키를 만든 뒤 다음처럼 설정합니다.

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEY`는 채팅이나 GitHub에 올리지 말고 `.env.local` 또는 Vercel 환경변수에만 저장하세요.

`NEWS_RSS_FEEDS`는 JSON 배열을 권장합니다.

```json
[
  {
    "name": "교육부 보도자료",
    "url": "https://example.com/rss.xml",
    "category": "교육정책"
  }
]
```

기본 피드는 대한민국 정책브리핑의 교육부 RSS(`https://www.korea.kr/rss/dept_moe.xml`)입니다. RSS가 아닌 일반 HTML 목록 페이지는 `rss-parser`로 안정적으로 파싱되지 않을 수 있으므로, 실제 운영에서는 각 기관의 RSS URL 또는 RSS 변환 엔드포인트를 등록하세요.

## Supabase SQL

Supabase SQL Editor에서 실행합니다.

```sql
create extension if not exists "pgcrypto";

create table if not exists education_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text not null,
  url text not null unique,
  published_at timestamptz not null,
  category text check (category in ('AI교육', '교육정책', '디지털교육', '생활지도', '평가', '기타')),
  summary text,
  teacher_insight text,
  school_action text,
  importance text check (importance in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index if not exists education_news_published_at_idx
  on education_news (published_at desc);

create table if not exists daily_briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null unique,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);
```

이 앱은 서버 전용 `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다. 브라우저로 노출되는 `NEXT_PUBLIC_` 키를 쓰지 않습니다.

메인 화면의 카테고리 필터는 다음 6개 값을 기준으로 동작합니다.

```text
AI교육, 교육정책, 디지털교육, 생활지도, 평가, 기타
```

## 로컬 실행

```bash
npm run dev
```

수집 실행:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/collect-news
```

오늘 수집분의 유사 제목 중복 후보 확인:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/dedupe-news?dryRun=true"
```

오늘 수집분의 유사 제목 중복 삭제:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/dedupe-news?dryRun=false"
```

브리핑 생성:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/generate-briefing
```

매일 실행되는 전체 작업을 로컬에서 확인하려면 다음처럼 호출합니다.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/daily-cron
```

## Vercel 배포

Vercel Git 연동을 쓰는 경우 GitHub에 푸시하면 자동 배포할 수 있습니다. CLI로 배포하려면 다음 순서로 진행합니다.

```bash
npm i -g vercel
vercel login
vercel link
```

그다음 Vercel Dashboard에서 Project Settings → Environment Variables에 `.env.local`과 같은 값을 등록합니다. 비밀키는 채팅, GitHub, 브라우저 화면에 노출하지 마세요.

Vercel Project Settings → Environment Variables에 다음 값을 Production 환경으로 등록합니다.

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
AI_PROVIDER
GEMINI_API_KEY
GEMINI_MODEL
OPENAI_API_KEY
OPENAI_MODEL
CRON_SECRET
NEWS_RSS_FEEDS
```

Gemini만 쓸 경우 `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`만 있으면 됩니다. OpenAI를 쓰지 않으면 `OPENAI_API_KEY`는 비워도 됩니다.

`CRON_SECRET`은 16자 이상의 임의 문자열을 사용하세요. Vercel Cron은 이 값을 `Authorization: Bearer <CRON_SECRET>` 헤더로 자동 전송하며, 앱의 Cron API는 이 헤더를 검증합니다.

현재 Cron은 UTC 기준으로 실행됩니다. 한국 시간 오전 7시는 전날 22:00 UTC입니다.

- `0 22 * * *`: 매일 22:00 UTC에 `/api/daily-cron` 실행

`/api/daily-cron`은 내부에서 `/api/collect-news`를 먼저 실행한 뒤 `/api/generate-briefing`을 실행합니다.

환경변수 등록 후 Production 배포를 실행합니다.

```bash
vercel deploy --prod
```

배포 후 Vercel Dashboard → Settings → Cron Jobs에서 `/api/daily-cron`이 `0 22 * * *`로 등록되었는지 확인하세요. Cron Jobs는 Production Deployment에서 실행됩니다.

## 운영 주의사항

- 기사 전문을 저장하지 않습니다.
- 원문 URL은 모든 뉴스 항목에 유지합니다.
- AI 생성 결과는 사실 요약(`summary`)과 교사 관점 해석(`teacher_insight`)을 분리합니다.
- 피드별 오류, 항목별 생성 오류는 try/catch로 수집하고 전체 작업을 계속 진행합니다.
- 운영 전 `NEWS_RSS_FEEDS`에 실제 RSS URL을 등록하세요.

## 문제 해결

- `/api/collect-news`에서 `read ECONNRESET`이 나오면 원격 RSS 서버가 연결을 끊은 상태입니다. 앱은 RSS 요청을 3회 재시도하고, 기본 대체 피드로 Google 뉴스 교육 RSS도 함께 조회합니다.
- `/api/generate-briefing`에서 quota 또는 rate limit 오류가 나오면 선택한 AI provider의 크레딧, 결제, 사용량 한도를 확인한 뒤 다시 실행하세요.
