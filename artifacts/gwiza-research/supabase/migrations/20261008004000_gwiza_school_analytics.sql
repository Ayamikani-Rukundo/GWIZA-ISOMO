begin;

alter table public.survey_submissions
  add column if not exists school_name text generated always as (
    nullif(btrim(responses ->> 'schoolName'), '')
  ) stored;

create index if not exists survey_submissions_school_name_idx
  on public.survey_submissions (lower(school_name))
  where school_name is not null;

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
    'schools',
      (select coalesce(
         jsonb_agg(
           jsonb_build_object('label', grouped.school_name, 'count', grouped.item_count)
           order by grouped.item_count desc, grouped.school_name
         ),
         '[]'::jsonb
       )
       from (
         select min(btrim(school_name)) as school_name, count(*)::integer as item_count
         from public.survey_submissions
         where school_name is not null and btrim(school_name) <> ''
         group by lower(btrim(school_name))
       ) as grouped),
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

commit;
