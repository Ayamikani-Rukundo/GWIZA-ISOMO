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
2. Apply the SQL files in `artifacts/gwiza-research/supabase/migrations/` in filename order using the Supabase SQL editor or the Supabase CLI. If the first two migrations were already applied, apply only the new `20261008002000_gwiza_response_tables_and_rpc.sql` migration.
3. In the project's API settings, configure its project URL (or REST URL) and a fresh server-only secret key. The API accepts either URL format. Do not use the secret key in a browser, `VITE_` variable, public repository, or UI.
4. Set the server environment variables below. Respondents use the GWIZA API; the website never connects directly to Supabase. `SUPABASE_PUBLISHABLE_KEY` is included as a placeholder for future approved public-client use and is not used by this server-mediated app.

The migrations enable row-level security and deny direct table access to anonymous and authenticated browser roles. The API's service role can write through a transaction-backed RPC. Keep that key restricted to the API server; do not add public policies to make research data accessible from browsers.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Fill it with values from the Supabase setup and choose a unique administrator email and password. Generate `SESSION_SECRET` with a secure random generator such as `openssl rand -base64 32`. Do not commit `.env.local`.

| Variable | Use |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL; server only |
| `SUPABASE_PUBLISHABLE_KEY` | Not currently used; the browser calls the GWIZA API |
| `SUPABASE_SECRET_KEY` | Supabase server-only key; never expose to the browser |
| `API_PORT` | Local API port; defaults to `3001` |
| `ADMIN_EMAIL` | Research dashboard sign-in email |
| `ADMIN_PASSWORD` | Research dashboard password |
| `SESSION_SECRET` | Signs secure, HTTP-only administrator session cookies |

The deployed API server must receive these settings through its private environment/secrets configuration. They are not compiled into the frontend.

## Database schema

`public.survey_submissions` remains the master record, with a UUID, respondent category, broad optional age/region/school-setting context, survey version, consent acknowledgement, timestamp, and JSONB answers. The migration adds four real, one-to-one response tables (`student_responses`, `school_staff_responses`, `professional_responses`, and `other_responses`) with explicit analysis-friendly fields and links each row to its master record by `submission_id`. Existing submissions are backfilled. New submissions are written to both the master and the matching response table in one database transaction. Checkbox responses stay as JSON arrays. Row deletion cascades to the matching response row. The schema intentionally does not request names, phone numbers, exact school names, home addresses, or IP addresses. A restricted database function provides grouped dashboard counts without returning individual responses to the public.

The admin's **Download Excel** action produces an `.xlsx` workbook containing a summary sheet and separate filterable sheets for Students, School staff, Professionals, and Other respondents.

## Run locally

1. Install Node.js 22.12+ and pnpm 9+.
2. From the repository root, run `pnpm install`.
3. Copy `.env.example` to `.env.local` in PowerShell with `Copy-Item .env.example .env.local`, then add the Supabase URL, newly rotated server-only key, and private administrator credentials. `.env.local` is ignored by Git and loaded by Node only for the API process.
4. Apply all four SQL migrations to Supabase in filename order. If the first three were already applied, apply the fourth migration to backfill any responses saved while an older API server was running.
5. From the repository root, run `pnpm dev`.
6. Open `http://localhost:5173`. The API runs on `http://localhost:3001`, and Vite proxies browser `/api` requests to it.

The local `.env.local` may contain development-only administrator values. Survey submission, dashboard data, Excel export, and deletion require a configured Supabase project and all applicable migrations. Never deploy development administrator values or the local session secret.

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

### GitHub

Keep the GitHub repository **private**. The source tree includes the Isomo approval PDF and the hardcoded viewing code; making the repository public would let people bypass the site prompt and access those source materials. The PDF is not emitted as a public frontend asset, but it must be available to the private server function.

Before pushing, from the repository root check that the local environment file is ignored:

```powershell
git check-ignore .env.local
git status --short
```

`git check-ignore` should print `.env.local`. Do not force-add `.env.local`, `.env`, or any credential file. Rotate any Supabase key or password that has been shared, and enter only fresh credentials in Vercel's project settings.

When the checks look right, push the project to a **private** GitHub repository. From Command Prompt or PowerShell at the repository root:

```powershell
git add -A
git commit -m "Prepare GWIZA Research for deployment"
git push origin main
```

If your default GitHub branch is not `main`, substitute its actual name. The push contains source and migrations, not your ignored local environment file.

### Vercel

The root `vercel.json` defines two Vercel Services: `api-server` (Express) and `gwiza-research` (Vite). Public `/api/*` requests route to Express; all other public paths route to the Vite service, whose SPA rewrite serves `index.html` on direct page loads such as `/survey/student`, `/admin/login`, and `/admin`. The API is public only under `/api/*`; the website is public on all remaining paths. There are no internal server-to-server calls, so no service bindings are required. The mockup sandbox is not deployed or publicly routed. Import the GitHub repository into Vercel with the **repository root** as the Root Directory. Leave Vercel build settings to the per-service settings in `vercel.json`. The project requires Node 22.12+ and pnpm 9.15.9; the root package and lockfile pin these expectations.

In Vercel, open **Project Settings → Environment Variables** and add these values for Production (add Preview too only if you want preview deployments to connect to the real research database):

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | The Supabase project root URL, without `/rest/v1/` |
| `SUPABASE_SECRET_KEY` | A newly rotated server-only Supabase secret key |
| `ADMIN_EMAIL` | The administrator login email |
| `ADMIN_PASSWORD` | A strong, unique administrator password |
| `SESSION_SECRET` | A fresh, high-entropy random string |

Do not set these with a `VITE_` prefix. `SUPABASE_PUBLISHABLE_KEY` is not used by this server-mediated app. The database password is not an app environment variable. Never paste secret values into GitHub or commit `.env.local`.

Before inviting respondents, apply every missing SQL migration in filename order to the **production** Supabase project. For a project that already has the first three installed, also run `20261008003000_backfill_uncategorized_responses.sql` to populate any submissions written by the older API process. Run `pnpm dev` locally after pushing only if desired; Vercel automatically builds on pushes to the configured production branch and creates preview deployments for other branches/PRs.

After Vercel reports Ready, verify `/api/healthz` returns `{"status":"ok"}`, refresh each client-side route directly (for example `/survey/student` and `/admin/login`), test administrator login, and use the Excel download. Do not submit fake research answers in production. The approval document prompt should reject a wrong code and show the document in its overlay with the correct code.

Use the Vercel deployment URL to share the live site. Do not use the local `.env.local` file as a deployment mechanism.

## Change survey questions

The respondent-specific survey screens define the question text, choices, stages, and answer keys. Keep those keys stable once research collection starts; changing their meaning should also update the survey version, typed response-table fields, qualitative-response mapping, and Excel columns so later analysis can distinguish questionnaire versions. Do not add questions that request identifying information or imply that a digital product is the intended solution.

## Change administrator configuration

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in private server environment settings, and ensure `SESSION_SECRET` is a high-entropy value. Signing out clears the HTTP-only cookie; sessions expire after eight hours. Do not add administrator credentials to frontend configuration or source control.

## Research and security notes

- Participation is voluntary; respondents may skip questions.
- Open-text prompts remind participants not to include identifying information.
- This website does not diagnose, treat, or provide medical advice.
- The team must confirm and configure its approved participation, eligibility, and minor-consent process with its school/program/adult supervisors before collecting responses from minors. This software does not determine legal or ethical approval.
- Administrator routes require a signed, HTTP-only, `SameSite=Strict` cookie and server-side environment configuration.
- Excel workbook export is administrator-only, separates respondent types into distinct worksheets, and escapes spreadsheet formula prefixes.
- Deleting a response is an irreversible, individually confirmed administrator action; there is no bulk-delete action.
- No demo submissions or fabricated statistics are included.
