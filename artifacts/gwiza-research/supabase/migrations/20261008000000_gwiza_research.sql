-- GWIZA Research: anonymous survey collection with server-only administrative access.
-- Apply this migration to the Supabase project before accepting research submissions.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.survey_submissions (
  id uuid primary key default gen_random_uuid(),
  respondent_type text not null
    check (respondent_type in ('student', 'school', 'professional', 'other')),
  age_group text,
  region text,
  school_setting text,
  survey_version text not null,
  consent_acknowledged boolean not null default false
    check (consent_acknowledged is true),
  responses jsonb not null default '{}'::jsonb
    check (jsonb_typeof(responses) = 'object'),
  submitted_at timestamptz not null default now()
);

create index if not exists survey_submissions_submitted_at_idx
  on public.survey_submissions (submitted_at desc);
create index if not exists survey_submissions_respondent_type_idx
  on public.survey_submissions (respondent_type);
create index if not exists survey_submissions_region_idx
  on public.survey_submissions (region);

alter table public.survey_submissions enable row level security;

-- Respondents never connect to Supabase directly. Public submission and all
-- admin operations go through the API server, which uses its private key.
revoke all on table public.survey_submissions from anon, authenticated;
grant select, insert, update, delete on table public.survey_submissions to service_role;

-- Role-specific views keep the storage model compact while exposing explicit,
-- analysis-friendly columns for each questionnaire.
create or replace view public.student_responses
with (security_invoker = true)
as
select
  id as submission_id,
  responses ->> 'wellbeingFrequency' as wellbeing_frequency,
  responses -> 'challenges' as challenges,
  responses ->> 'schoolImpact' as school_impact,
  responses -> 'schoolEffects' as school_effects,
  responses -> 'supportOptions' as support_options,
  responses ->> 'supportAwareness' as support_awareness,
  responses ->> 'mentalHealthInformation' as mental_health_information,
  responses ->> 'helpSeekingComfort' as help_seeking_comfort,
  responses ->> 'preferredFirstContact' as preferred_first_contact,
  responses -> 'barriers' as barriers,
  responses ->> 'schoolSupportRating' as school_support_rating,
  responses ->> 'missingSupport' as missing_support,
  responses ->> 'desiredChange' as desired_change,
  responses -> 'preferredSupportTypes' as preferred_support_types,
  responses ->> 'digitalComfort' as digital_comfort,
  responses -> 'digitalTrustFactors' as digital_trust_factors,
  responses ->> 'desiredDigitalSupport' as desired_digital_support
from public.survey_submissions
where respondent_type = 'student';

create or replace view public.school_staff_responses
with (security_invoker = true)
as
select
  id as submission_id,
  responses ->> 'role' as role,
  responses ->> 'yearsExperience' as years_experience,
  responses ->> 'studentApproachFrequency' as student_approach_frequency,
  responses -> 'commonChallenges' as common_challenges,
  responses -> 'currentSupport' as current_support,
  responses -> 'supportResponsibility' as support_responsibility,
  responses ->> 'referralEase' as referral_ease,
  responses ->> 'studentSupportAwareness' as student_support_awareness,
  responses ->> 'staffTraining' as staff_training,
  responses -> 'supportBarriers' as support_barriers,
  responses ->> 'missingSupport' as missing_support,
  responses ->> 'additionalSupport' as additional_support,
  responses ->> 'technologyAccess' as technology_access,
  responses ->> 'technologyProblem' as technology_problem,
  responses ->> 'technologyReplacement' as technology_replacement,
  responses ->> 'platformConcerns' as platform_concerns
from public.survey_submissions
where respondent_type = 'school';

create or replace view public.professional_responses
with (security_invoker = true)
as
select
  id as submission_id,
  responses ->> 'serviceGaps' as service_gaps,
  responses ->> 'recommendations' as recommendations,
  responses ->> 'technologyRole' as technology_role,
  responses ->> 'technologyRisks' as technology_risks
from public.survey_submissions
where respondent_type = 'professional';

create or replace view public.other_responses
with (security_invoker = true)
as
select
  id as submission_id,
  responses ->> 'youthRelationship' as youth_relationship,
  responses -> 'observations' as observations,
  responses ->> 'supportAwareness' as support_awareness,
  responses ->> 'perceivedGaps' as perceived_gaps,
  responses -> 'barriers' as barriers,
  responses ->> 'improvements' as improvements,
  responses ->> 'recommendations' as recommendations
from public.survey_submissions
where respondent_type = 'other';

revoke all on public.student_responses, public.school_staff_responses,
  public.professional_responses, public.other_responses from anon, authenticated;
grant select on public.student_responses, public.school_staff_responses,
  public.professional_responses, public.other_responses to service_role;

create or replace function public.gwiza_count_values(
  p_key text,
  p_respondent_type text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('label', grouped.label, 'count', grouped.item_count)
      order by grouped.item_count desc, grouped.label
    ),
    '[]'::jsonb
  )
  from (
    select option_value.label, count(*)::integer as item_count
    from public.survey_submissions as submission
    cross join lateral jsonb_array_elements_text(
      case
        when p_key = 'respondentType'
          then jsonb_build_array(to_jsonb(submission.respondent_type))
        when p_key = 'region' and submission.region is not null
          then jsonb_build_array(to_jsonb(submission.region))
        when p_key = 'schoolSetting' and submission.school_setting is not null
          then jsonb_build_array(to_jsonb(submission.school_setting))
        when jsonb_typeof(submission.responses -> p_key) = 'array'
          then submission.responses -> p_key
        when submission.responses ? p_key
          then jsonb_build_array(submission.responses -> p_key)
        else '[]'::jsonb
      end
    ) as option_value(label)
    where (p_respondent_type is null or submission.respondent_type = p_respondent_type)
      and option_value.label is not null
      and btrim(option_value.label) <> ''
    group by option_value.label
  ) as grouped;
$function$;

create or replace function public.gwiza_admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select jsonb_build_object(
    'totalResponses',
      (select count(*)::integer from public.survey_submissions),
    'responsesToday',
      (select count(*)::integer
       from public.survey_submissions
       where submitted_at >= (
         date_trunc('day', timezone('Africa/Kigali', now()))
         at time zone 'Africa/Kigali'
       )),
    'latestSubmission',
      (select max(submitted_at) from public.survey_submissions),
    'respondentTypes',
      public.gwiza_count_values('respondentType'),
    'regions',
      public.gwiza_count_values('region', 'student'),
    'schoolSettings',
      public.gwiza_count_values('schoolSetting', 'student'),
    'challenges',
      public.gwiza_count_values('challenges', 'student'),
    'supportRatings',
      public.gwiza_count_values('schoolSupportRating', 'student'),
    'helpSeekingComfort',
      public.gwiza_count_values('helpSeekingComfort', 'student'),
    'barriers',
      public.gwiza_count_values('barriers', 'student'),
    'preferredSupportTypes',
      public.gwiza_count_values('preferredSupportTypes', 'student'),
    'digitalComfort',
      public.gwiza_count_values('digitalComfort', 'student'),
    'digitalTrustFactors',
      public.gwiza_count_values('digitalTrustFactors', 'student')
  );
$function$;

revoke all on function public.gwiza_count_values(text, text) from public, anon, authenticated;
revoke all on function public.gwiza_admin_overview() from public, anon, authenticated;
grant execute on function public.gwiza_count_values(text, text) to service_role;
grant execute on function public.gwiza_admin_overview() to service_role;
