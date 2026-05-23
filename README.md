# 교육 뉴스 인사이트 에이전트

Next.js App Router, TypeScript, Tailwind CSS, Supabase, Gemini/OpenAI API, rss-parser, Vercel Cron 기반의 교육 뉴스 브리핑 도구입니다.

현재 버전은 3차 버전인 **대화형 교육 뉴스 인사이트 에이전트**입니다. 매일 교육 뉴스를 수집하고, 초등교사 관점의 요약과 통찰을 저장한 뒤, 저장된 뉴스 데이터를 근거로 사용자가 질문할 수 있습니다.

## 주요 기능

1. RSS 또는 뉴스 피드에서 교육 뉴스 메타데이터를 수집합니다.
2. 기사 전문은 저장하지 않고 제목, 출처, URL, 발행일만 저장합니다.
3. 중복 URL은 저장하지 않습니다.
4. AI가 뉴스별 사실 요약, 초등교사 관점 통찰, 학교 적용 아이디어, 중요도를 생성합니다.
5. Supabase에 뉴스 분석 결과와 일일 브리핑을 저장합니다.
6. 메인 페이지에서 오늘의 교육 뉴스 브리핑과 중요 뉴스 5개를 보여줍니다.
7. 사용자는 저장된 뉴스 데이터를 바탕으로 질문할 수 있습니다.
8. 답변은 참고한 뉴스의 제목, 출처, URL을 함께 제공합니다.
9. 답변에 사용된 뉴스를 보고용 요약, 교직원 연수 도입부, 수업 아이디어, 학부모 안내문, 체크리스트로 변환할 수 있습니다.
10. Vercel Cron으로 매일 한국 시간 오전 7시에 자동 실행할 수 있습니다.

## 설치

```bash
npm install
```

## 환경변수

`.env.example`을 참고해 `.env.local`을 만듭니다.

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
NEWS_RSS_FEEDS=
NEWS_MAX_ITEMS_PER_FEED=30
```

Gemini만 사용할 경우 `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`이 필요합니다. OpenAI를 사용하지 않으면 `OPENAI_API_KEY`는 비워도 됩니다.

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 키입니다. 브라우저에 노출되는 `NEXT_PUBLIC_` 변수로 만들지 마세요.

기본 RSS 피드는 국내 교육 뉴스와 국제 교육 뉴스를 함께 수집합니다. 국제 피드는 영어권 Google News RSS를 활용해 K-12, elementary school, primary school, classroom, student wellbeing, assessment 중심의 교육 뉴스를 보강합니다. 국제 뉴스 제목은 AI 분석 단계에서 `translated_title`에 한국어 번역 제목으로 저장되고, 화면에서는 한국어 제목을 우선 표시합니다.

신뢰 출처 우선순위도 적용되어 있습니다. 교육부, KERIS, OECD, UNESCO 같은 공식 기관/국제기구와 EdSurge, Education Week, eSchool News, EdTech Magazine 같은 주요 해외 교육기술 매체를 별도 피드로 먼저 수집하고, 화면 정렬과 에이전트 검색에서도 우선 참고하도록 구성했습니다. Google News RSS의 실제 매체명도 함께 읽어 `source`에 반영합니다.

`NEWS_MAX_ITEMS_PER_FEED`는 각 RSS 피드에서 가져올 최대 기사 수입니다. 기본값은 `30`이며, Vercel 함수 실행 시간이 길어지면 `15` 또는 `20`으로 줄일 수 있습니다.

## Supabase SQL

Supabase 프로젝트의 SQL Editor에서 아래 SQL을 실행하세요.

```sql
create extension if not exists "pgcrypto";

create table if not exists education_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  translated_title text,
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

-- 기존 education_news 테이블을 이미 만들었다면 아래 한 줄만 추가로 실행해도 됩니다.
alter table education_news
  add column if not exists translated_title text;

create table if not exists daily_briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null unique,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists agent_conversations (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  role_type text not null check (
    role_type in ('homeroom_teacher', 'it_lead', 'research_lead', 'administrator', 'trainer')
  ),
  period text not null check (period in ('today', '3d', '1w', '1m')),
  answer text not null,
  referenced_news_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists agent_conversations_created_at_idx
  on agent_conversations (created_at desc);

create table if not exists generated_outputs (
  id uuid primary key default gen_random_uuid(),
  output_type text not null check (
    output_type in ('report_summary', 'training_intro', 'lesson_idea', 'parent_notice', 'checklist')
  ),
  role_type text not null check (
    role_type in ('homeroom_teacher', 'it_lead', 'research_lead', 'administrator', 'trainer')
  ),
  news_ids uuid[] not null default '{}',
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists generated_outputs_created_at_idx
  on generated_outputs (created_at desc);
```

## 로컬 실행

```bash
npm run dev
```

뉴스 수집:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/collect-news
```

브리핑 생성:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/generate-briefing
```

수집과 브리핑을 한 번에 실행:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/daily-cron
```

## 대화형 에이전트 API

`POST /api/agent`

```json
{
  "message": "최근 AI교육 뉴스 중 우리 학교가 준비해야 할 점은?",
  "roleType": "homeroom_teacher",
  "period": "1w"
}
```

지원하는 `roleType`:

```text
homeroom_teacher, it_lead, research_lead, administrator, trainer
```

지원하는 `period`:

```text
today, 3d, 1w, 1m
```

응답에는 `answer`, `references`, `provider`가 포함됩니다. `references`는 참고한 뉴스의 제목, 출처, URL을 포함합니다.

## 산출물 변환 API

`POST /api/transform`

```json
{
  "outputType": "checklist",
  "newsIds": ["education_news id"],
  "roleType": "administrator"
}
```

지원하는 `outputType`:

```text
report_summary, training_intro, lesson_idea, parent_notice, checklist
```

`newsIds`를 보내면 해당 뉴스를 기반으로 생성합니다. `newsIds`를 비우면 최근 1주일 뉴스 중 중요도 높은 뉴스를 기반으로 생성합니다.

## Vercel 배포

Vercel 프로젝트 Settings -> Environment Variables에 아래 값을 등록하세요.

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
NEWS_MAX_ITEMS_PER_FEED
```

환경변수를 바꾼 뒤에는 Production Deployment를 다시 배포해야 합니다.

`vercel.json`에는 한국 시간 오전 7시에 실행되도록 Vercel Cron이 UTC 기준 전날 22:00으로 설정되어 있습니다.

```json
{
  "crons": [
    {
      "path": "/api/daily-cron",
      "schedule": "0 22 * * *"
    }
  ]
}
```

`/api/daily-cron`은 내부에서 `/api/collect-news`를 먼저 실행한 뒤 `/api/generate-briefing`을 실행합니다. API routes는 `Authorization: Bearer <CRON_SECRET>` 헤더를 검증합니다.

## 운영 원칙

- 기사 전문을 저장하거나 출력하지 않습니다.
- 원문 링크를 반드시 유지합니다.
- AI 답변은 저장된 뉴스 데이터에 근거합니다.
- 확인되지 않은 사실은 단정하지 않도록 프롬프트를 구성했습니다.
- 사실 요약과 교사 관점 해석을 구분합니다.
- 오류가 발생하면 전체 작업이 중단되지 않도록 API 단위로 예외를 처리합니다.

## 문제 해결

- 메인 화면에 오늘 브리핑이 없다면 `/api/daily-cron`이 아직 성공적으로 실행되지 않은 상태일 수 있습니다.
- Vercel에서 `/api/collect-news`가 504로 실패하면 RSS 수집이 함수 제한 시간보다 오래 걸린 것입니다. 피드 수를 줄이거나 수집 작업을 나누는 방식으로 개선할 수 있습니다.
- Gemini 또는 OpenAI에서 quota, rate limit, high demand 오류가 나오면 잠시 후 재시도하거나 더 가벼운 모델을 사용하세요.
