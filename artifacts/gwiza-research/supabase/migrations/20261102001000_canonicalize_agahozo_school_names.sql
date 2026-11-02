begin;

create or replace function public.gwiza_text_edit_distance(
  p_left text,
  p_right text
)
returns integer
language plpgsql
immutable
strict
set search_path = public
as $function$
declare
  left_length integer := char_length(p_left);
  right_length integer := char_length(p_right);
  previous_row integer[];
  current_row integer[];
  edit_cost integer;
  left_index integer;
  right_index integer;
begin
  previous_row := array_fill(0, array[right_length + 1]);

  for right_index in 1..right_length loop
    previous_row[right_index + 1] := right_index;
  end loop;

  for left_index in 1..left_length loop
    current_row := array_fill(0, array[right_length + 1]);
    current_row[1] := left_index;

    for right_index in 1..right_length loop
      edit_cost := case
        when substr(p_left, left_index, 1) = substr(p_right, right_index, 1) then 0
        else 1
      end;
      current_row[right_index + 1] := least(
        previous_row[right_index + 1] + 1,
        current_row[right_index] + 1,
        previous_row[right_index] + edit_cost
      );
    end loop;

    previous_row := current_row;
  end loop;

  return previous_row[right_length + 1];
end;
$function$;

create or replace function public.gwiza_canonical_school_name(p_school_name text)
returns text
language plpgsql
immutable
set search_path = public
as $function$
declare
  normalized_name text := regexp_replace(
    lower(coalesce(p_school_name, '')),
    '[^a-z0-9]+',
    '',
    'g'
  );
begin
  if normalized_name = '' then
    return null;
  end if;

  if position('asyv' in normalized_name) > 0
    or public.gwiza_text_edit_distance(normalized_name, 'agahozoshalomyouthvillage') <= 3
    or public.gwiza_text_edit_distance(normalized_name, 'liquidnetfamilyhighschool') <= 3
    or public.gwiza_text_edit_distance(normalized_name, 'liquidnetfamilyhighschoolasyv') <= 3
    or public.gwiza_text_edit_distance(
      normalized_name,
      'liquidnetfamilyhighschoolagahozoshalomyouthvillage'
    ) <= 3 then
    return 'Agahozo Shalom Youth Village';
  end if;

  return btrim(p_school_name);
end;
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
    'schools',
      (select coalesce(
         jsonb_agg(
           jsonb_build_object('label', grouped.school_name, 'count', grouped.item_count)
           order by grouped.item_count desc, grouped.school_name
         ),
         '[]'::jsonb
       )
       from (
         select case
             when lower(public.gwiza_canonical_school_name(school_name)) = 'agahozo shalom youth village'
               then 'Agahozo Shalom Youth Village'
             else min(btrim(school_name))
           end as school_name,
           count(*)::integer as item_count
         from public.survey_submissions
         where school_name is not null and btrim(school_name) <> ''
         group by lower(public.gwiza_canonical_school_name(school_name))
       ) as grouped),
    'regions',
      public.gwiza_count_values('region', 'student'),
    'schoolSettings',
      public.gwiza_count_values('schoolSetting', 'student'),
    'schoolStatus',
      public.gwiza_count_values('schoolStatus', 'student'),
    'genderStatus',
      public.gwiza_count_values('genderStatus', 'student'),
    'schoolPsychologist',
      public.gwiza_count_values('schoolPsychologist', 'student'),
    'mentalHealthHistory',
      public.gwiza_count_values('mentalHealthHistory', 'student'),
    'financialSupport',
      public.gwiza_count_values('financialSupport', 'student'),
    'familySize',
      public.gwiza_count_values('familySize', 'student'),
    'familyStatus',
      public.gwiza_count_values('familyStatus', 'student'),
    'schoolYear',
      public.gwiza_count_values('schoolYear', 'student'),
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

revoke all on function public.gwiza_text_edit_distance(text, text) from public, anon, authenticated;
revoke all on function public.gwiza_canonical_school_name(text) from public, anon, authenticated;
grant execute on function public.gwiza_text_edit_distance(text, text) to service_role;
grant execute on function public.gwiza_canonical_school_name(text) to service_role;
revoke all on function public.gwiza_admin_overview() from public, anon, authenticated;
grant execute on function public.gwiza_admin_overview() to service_role;

commit;