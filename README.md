# GWIZA Research

GWIZA Research is an anonymous, mobile-first action-research platform for learning about secondary-school students' well-being, the support currently available in Rwanda, barriers to seeking help, and support young people would actually use. It is for research data collection—not diagnosis, treatment, or a mental-health service.

## Technology

- React, TypeScript, Vite, Tailwind CSS
- Shared Express API in `artifacts/api-server`
- Supabase Postgres for research submissions
- Orval-generated OpenAPI hooks and Zod validation
- Recharts for research summaries

## Supabase setup

1. Create a Supabase project for the research team.
2. Apply `artifacts/gwiza-research/supabase/migrations/20261008000000_gwiza_research.sql` using the Supabase SQL editor or the Supabase CLI.
3. In the project's API settings, copy its project URL and server-only secret key. Do not use the secret key in a browser, `VITE_` variable, public repository, or UI.
4. Set the server environment variables below. Respondents use the GWIZA API; the website never connects directly to Supabase.

The migration enables row-level security and denies direct table access to anonymous and authenticated browser roles. The API server performs submissions and administrator operations using the server-only key. Keep that key restricted to the API server.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Fill it with values from the Supabase setup and choose a unique administrator email and password. Generate `SESSION_SECRET` with a secure random generator such as `openssl rand -base64 32`. Do not commit `.env.local`.

| Variable | Use |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL; server only |
| `SUPABASE_SECRET_KEY` | Supabase server-only key; never expose to the browser |
| `ADMIN_EMAIL` | Research dashboard sign-in email |
| `ADMIN_PASSWORD` | Research dashboard password |
| `SESSION_SECRET` | Signs secure, HTTP-only administrator session cookies |

The deployed API server must receive these settings through its private environment/secrets configuration. They are not compiled into the frontend.

## Database schema

The SQL migration creates `public.survey_submissions` as the source of truth, plus four role-specific views (`student_responses`, `school_staff_responses`, `professional_responses`, and `other_responses`) with explicit analysis-friendly fields. It stores a UUID, respondent category, broad optional age/region/school-setting context, survey version, consent acknowledgement, timestamp, and JSONB research answers. It intentionally does not store names, phone numbers, exact school names, addresses, or IP addresses. Checkbox responses stay as JSON arrays. A restricted database function provides grouped dashboard counts without returning individual responses to the public.

## Run locally

1. Install Node.js 20+ and pnpm 9+.
2. From the repository root, run `pnpm install`.
3. Copy `.env.example` to `.env.local` and configure the values above.
4. Apply the SQL migration to the Supabase project.
5. In one terminal, load the environment and start the API:

   ```sh
   set -a
   . ./.env.local
   set +a
   pnpm --filter @workspace/api-server run dev
   ```

6. In a second terminal, start the web app:

   ```sh
   pnpm --filter @workspace/gwiza-research run dev
   ```

The browser app uses the shared `/api` service on the same site; it does not need any Supabase variables.

## Build and checks

```sh
pnpm --filter @workspace/gwiza-research run typecheck
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/gwiza-research run build
```

OpenAPI is maintained in `lib/api-spec/openapi.yaml`. After editing the API contract, regenerate the React Query hooks and Zod schemas with:

```sh
pnpm --filter @workspace/api-spec run codegen
```

## Deploy

Deploy the web app and shared API server so the web origin can reach `/api`. Configure the five private server environment variables in the deployment environment, apply the SQL migration to the production Supabase project, and confirm the production admin login before sharing the research link. Never use the local `.env.local` file as a deployment mechanism.

## Change survey questions

The respondent-specific survey screens define the question text, choices, stages, and answer keys. Keep those keys stable once research collection starts; changing their meaning should also update the survey version, qualitative-response mapping, and CSV columns so later analysis can distinguish questionnaire versions. Do not add questions that request identifying information or imply that a digital product is the intended solution.

## Change administrator configuration

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in private server environment settings, and ensure `SESSION_SECRET` is a high-entropy value. Signing out clears the HTTP-only cookie; sessions expire after eight hours. Do not add administrator credentials to frontend configuration or source control.

## Research and security notes

- Participation is voluntary; respondents may skip questions.
- Open-text prompts remind participants not to include identifying information.
- This website does not diagnose, treat, or provide medical advice.
- The team must confirm and configure its approved participation, eligibility, and minor-consent process with its school/program/adult supervisors before collecting responses from minors. This software does not determine legal or ethical approval.
- Administrator routes require a signed, HTTP-only, `SameSite=Strict` cookie and server-side environment configuration.
- CSV export is administrator-only and escapes spreadsheet formula prefixes.
- Deleting a response is an irreversible, individually confirmed administrator action; there is no bulk-delete action.
- No demo submissions or fabricated statistics are included.
