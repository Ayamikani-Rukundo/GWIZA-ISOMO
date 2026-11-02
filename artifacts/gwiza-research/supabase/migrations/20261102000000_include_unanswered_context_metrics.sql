begin;

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
  with counted_values as (
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
  ),
  unanswered_values as (
    select 'Never answered'::text as label, count(*)::integer as item_count
    from public.survey_submissions as submission
    where p_respondent_type = 'student'
      and p_key = any(array[
        'schoolStatus', 'genderStatus', 'schoolPsychologist',
        'mentalHealthHistory', 'financialSupport', 'familySize',
        'familyStatus', 'schoolYear'
      ])
      and submission.respondent_type = 'student'
      and (
        not (submission.responses ? p_key)
        or submission.responses -> p_key = 'null'::jsonb
        or (
          jsonb_typeof(submission.responses -> p_key) = 'string'
          and btrim(submission.responses ->> p_key) = ''
        )
      )
    having count(*) > 0
  ),
  all_values as (
    select label, item_count from counted_values
    union all
    select label, item_count from unanswered_values
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('label', all_values.label, 'count', all_values.item_count)
      order by all_values.item_count desc, all_values.label
    ),
    '[]'::jsonb
  )
  from all_values;
$function$;

revoke all on function public.gwiza_count_values(text, text) from public, anon, authenticated;
grant execute on function public.gwiza_count_values(text, text) to service_role;

commit;