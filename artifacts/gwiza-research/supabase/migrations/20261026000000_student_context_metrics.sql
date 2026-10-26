begin;

alter table public.student_responses
  add column if not exists school_year text,
  add column if not exists school_status text,
  add column if not exists gender_status text,
  add column if not exists family_size text,
  add column if not exists family_status text,
  add column if not exists school_psychologist text,
  add column if not exists mental_health_history text,
  add column if not exists financial_support text;

update public.student_responses as sr
set
  school_year = submission.responses ->> 'schoolYear',
  school_status = submission.responses ->> 'schoolStatus',
  gender_status = submission.responses ->> 'genderStatus',
  family_size = submission.responses ->> 'familySize',
  family_status = submission.responses ->> 'familyStatus',
  school_psychologist = submission.responses ->> 'schoolPsychologist',
  mental_health_history = submission.responses ->> 'mentalHealthHistory',
  financial_support = submission.responses ->> 'financialSupport'
from public.survey_submissions as submission
where submission.id = sr.submission_id;

create or replace function public.gwiza_create_survey_submission(
  p_respondent_type text,
  p_responses jsonb,
  p_survey_version text,
  p_consent_acknowledged boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  new_id uuid;
  new_submitted_at timestamptz;
begin
  if p_respondent_type is null
    or p_respondent_type not in ('student', 'school', 'professional', 'other')
    or jsonb_typeof(p_responses) is distinct from 'object'
    or p_survey_version is null
    or p_consent_acknowledged is not true then
    raise exception 'Invalid survey submission';
  end if;

  insert into public.survey_submissions (
    respondent_type, age_group, region, school_setting, survey_version,
    consent_acknowledged, responses
  ) values (
    p_respondent_type,
    p_responses ->> 'ageGroup',
    p_responses ->> 'region',
    p_responses ->> 'schoolSetting',
    p_survey_version,
    p_consent_acknowledged,
    p_responses
  ) returning id, submitted_at into new_id, new_submitted_at;

  if p_respondent_type = 'student' then
    insert into public.student_responses (
      submission_id, school_year, school_status, gender_status, family_size,
      family_status, school_psychologist, mental_health_history,
      financial_support, wellbeing_frequency, challenges, school_impact,
      school_effects, support_options, support_awareness,
      mental_health_information, help_seeking_comfort, preferred_first_contact,
      barriers, school_support_rating, missing_support, desired_change,
      preferred_support_types, digital_comfort, digital_trust_factors,
      desired_digital_support
    ) values (
      new_id,
      p_responses ->> 'schoolYear',
      p_responses ->> 'schoolStatus',
      p_responses ->> 'genderStatus',
      p_responses ->> 'familySize',
      p_responses ->> 'familyStatus',
      p_responses ->> 'schoolPsychologist',
      p_responses ->> 'mentalHealthHistory',
      p_responses ->> 'financialSupport',
      p_responses ->> 'wellbeingFrequency',
      p_responses -> 'challenges',
      p_responses ->> 'schoolImpact',
      p_responses -> 'schoolEffects',
      p_responses -> 'supportOptions',
      p_responses ->> 'supportAwareness',
      p_responses ->> 'mentalHealthInformation',
      p_responses ->> 'helpSeekingComfort',
      p_responses ->> 'preferredFirstContact',
      p_responses -> 'barriers',
      p_responses ->> 'schoolSupportRating',
      p_responses ->> 'missingSupport',
      p_responses ->> 'desiredChange',
      p_responses -> 'preferredSupportTypes',
      p_responses ->> 'digitalComfort',
      p_responses -> 'digitalTrustFactors',
      p_responses ->> 'desiredDigitalSupport'
    );
  elsif p_respondent_type = 'school' then
    insert into public.school_staff_responses (
      submission_id, role, years_experience, student_approach_frequency, staff_awareness,
      common_challenges, current_support, counsellor_availability, support_responsibility,
      referral_ease, student_support_awareness, staff_training, support_barriers,
      missing_support, additional_support, additional_support_needs, technology_access, technology_problem,
      technology_replacement, platform_concerns
    ) values (
      new_id, p_responses ->> 'role', p_responses ->> 'yearsExperience',
      p_responses ->> 'studentApproachFrequency', p_responses ->> 'staffAwareness',
      p_responses -> 'commonChallenges', p_responses -> 'currentSupport',
      p_responses ->> 'counsellorAvailability', p_responses -> 'supportResponsibility',
      p_responses ->> 'referralEase', p_responses ->> 'studentSupportAwareness',
      p_responses ->> 'staffTraining', p_responses -> 'supportBarriers',
      p_responses ->> 'missingSupport', p_responses ->> 'additionalSupport',
      p_responses -> 'additionalSupportNeeds',
      p_responses ->> 'technologyAccess', p_responses ->> 'technologyProblem',
      p_responses ->> 'technologyReplacement', p_responses -> 'platformConcerns'
    );
  elsif p_respondent_type = 'professional' then
    insert into public.professional_responses (
      submission_id, professional_role, experience_areas, referral_effectiveness,
      service_barriers, service_gaps, recommendations, technology_role, technology_risks
    ) values (
      new_id, p_responses ->> 'professionalRole', p_responses -> 'experienceAreas',
      p_responses ->> 'referralEffectiveness', p_responses -> 'serviceBarriers',
      p_responses ->> 'serviceGaps', p_responses ->> 'recommendations',
      p_responses ->> 'technologyRole', p_responses -> 'technologyRisks'
    );
  else
    insert into public.other_responses (
      submission_id, youth_relationship, observations, support_awareness,
      perceived_gaps, barriers, improvements, recommendations
    ) values (
      new_id, p_responses ->> 'youthRelationship', p_responses -> 'observations',
      p_responses ->> 'supportAwareness', p_responses ->> 'perceivedGaps',
      p_responses -> 'barriers', p_responses ->> 'improvements',
      p_responses ->> 'recommendations'
    );
  end if;

  return jsonb_build_object('id', new_id, 'submitted_at', new_submitted_at);
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
         select min(btrim(school_name)) as school_name, count(*)::integer as item_count
         from public.survey_submissions
         where school_name is not null and btrim(school_name) <> ''
         group by lower(btrim(school_name))
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

revoke all on function public.gwiza_create_survey_submission(text, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.gwiza_create_survey_submission(text, jsonb, text, boolean) to service_role;
revoke all on function public.gwiza_admin_overview() from public, anon, authenticated;
grant execute on function public.gwiza_admin_overview() to service_role;

commit;
