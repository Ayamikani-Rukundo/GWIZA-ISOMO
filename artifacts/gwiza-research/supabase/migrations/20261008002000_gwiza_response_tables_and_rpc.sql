begin;

-- Replace the analysis views with real, linked response tables.
drop view if exists public.student_responses;
drop view if exists public.school_staff_responses;
drop view if exists public.professional_responses;
drop view if exists public.other_responses;

create table if not exists public.student_responses (
  submission_id uuid primary key references public.survey_submissions(id) on delete cascade,
  wellbeing_frequency text,
  challenges jsonb,
  school_impact text,
  school_effects jsonb,
  support_options jsonb,
  support_awareness text,
  mental_health_information text,
  help_seeking_comfort text,
  preferred_first_contact text,
  barriers jsonb,
  school_support_rating text,
  missing_support text,
  desired_change text,
  preferred_support_types jsonb,
  digital_comfort text,
  digital_trust_factors jsonb,
  desired_digital_support text
);

create table if not exists public.school_staff_responses (
  submission_id uuid primary key references public.survey_submissions(id) on delete cascade,
  role text,
  years_experience text,
  student_approach_frequency text,
  staff_awareness text,
  common_challenges jsonb,
  current_support jsonb,
  counsellor_availability text,
  support_responsibility jsonb,
  referral_ease text,
  student_support_awareness text,
  staff_training text,
  support_barriers jsonb,
  missing_support text,
  additional_support text,
  additional_support_needs jsonb,
  technology_access text,
  technology_problem text,
  technology_replacement text,
  platform_concerns jsonb
);

create table if not exists public.professional_responses (
  submission_id uuid primary key references public.survey_submissions(id) on delete cascade,
  professional_role text,
  experience_areas jsonb,
  referral_effectiveness text,
  service_barriers jsonb,
  service_gaps text,
  recommendations text,
  technology_role text,
  technology_risks jsonb
);

create table if not exists public.other_responses (
  submission_id uuid primary key references public.survey_submissions(id) on delete cascade,
  youth_relationship text,
  observations jsonb,
  support_awareness text,
  perceived_gaps text,
  barriers jsonb,
  improvements text,
  recommendations text
);

alter table public.student_responses enable row level security;
alter table public.school_staff_responses enable row level security;
alter table public.professional_responses enable row level security;
alter table public.other_responses enable row level security;

revoke all on public.student_responses, public.school_staff_responses,
  public.professional_responses, public.other_responses from anon, authenticated;
grant select, insert, update, delete on public.student_responses,
  public.school_staff_responses, public.professional_responses,
  public.other_responses to service_role;

-- Backfill existing JSONB submissions without changing their original IDs.
insert into public.student_responses (
  submission_id, wellbeing_frequency, challenges, school_impact, school_effects,
  support_options, support_awareness, mental_health_information,
  help_seeking_comfort, preferred_first_contact, barriers, school_support_rating,
  missing_support, desired_change, preferred_support_types, digital_comfort,
  digital_trust_factors, desired_digital_support
)
select id, responses ->> 'wellbeingFrequency', responses -> 'challenges',
  responses ->> 'schoolImpact', responses -> 'schoolEffects', responses -> 'supportOptions',
  responses ->> 'supportAwareness', responses ->> 'mentalHealthInformation',
  responses ->> 'helpSeekingComfort', responses ->> 'preferredFirstContact',
  responses -> 'barriers', responses ->> 'schoolSupportRating',
  responses ->> 'missingSupport', responses ->> 'desiredChange',
  responses -> 'preferredSupportTypes', responses ->> 'digitalComfort',
  responses -> 'digitalTrustFactors', responses ->> 'desiredDigitalSupport'
from public.survey_submissions where respondent_type = 'student'
on conflict (submission_id) do nothing;

insert into public.school_staff_responses (
  submission_id, role, years_experience, student_approach_frequency, staff_awareness,
  common_challenges, current_support, counsellor_availability, support_responsibility,
  referral_ease, student_support_awareness, staff_training, support_barriers,
  missing_support, additional_support, additional_support_needs, technology_access, technology_problem,
  technology_replacement, platform_concerns
)
select id, responses ->> 'role', responses ->> 'yearsExperience',
  responses ->> 'studentApproachFrequency', responses ->> 'staffAwareness',
  responses -> 'commonChallenges', responses -> 'currentSupport',
  responses ->> 'counsellorAvailability', responses -> 'supportResponsibility',
  responses ->> 'referralEase', responses ->> 'studentSupportAwareness',
  responses ->> 'staffTraining', responses -> 'supportBarriers',
  responses ->> 'missingSupport', responses ->> 'additionalSupport',
  responses -> 'additionalSupportNeeds',
  responses ->> 'technologyAccess', responses ->> 'technologyProblem',
  responses ->> 'technologyReplacement', responses -> 'platformConcerns'
from public.survey_submissions where respondent_type = 'school'
on conflict (submission_id) do nothing;

insert into public.professional_responses (
  submission_id, professional_role, experience_areas, referral_effectiveness,
  service_barriers, service_gaps, recommendations, technology_role, technology_risks
)
select id, responses ->> 'professionalRole', responses -> 'experienceAreas',
  responses ->> 'referralEffectiveness', responses -> 'serviceBarriers',
  responses ->> 'serviceGaps', responses ->> 'recommendations',
  responses ->> 'technologyRole', responses -> 'technologyRisks'
from public.survey_submissions where respondent_type = 'professional'
on conflict (submission_id) do nothing;

insert into public.other_responses (
  submission_id, youth_relationship, observations, support_awareness,
  perceived_gaps, barriers, improvements, recommendations
)
select id, responses ->> 'youthRelationship', responses -> 'observations',
  responses ->> 'supportAwareness', responses ->> 'perceivedGaps',
  responses -> 'barriers', responses ->> 'improvements', responses ->> 'recommendations'
from public.survey_submissions where respondent_type = 'other'
on conflict (submission_id) do nothing;

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
      submission_id, wellbeing_frequency, challenges, school_impact, school_effects,
      support_options, support_awareness, mental_health_information,
      help_seeking_comfort, preferred_first_contact, barriers, school_support_rating,
      missing_support, desired_change, preferred_support_types, digital_comfort,
      digital_trust_factors, desired_digital_support
    ) values (
      new_id, p_responses ->> 'wellbeingFrequency', p_responses -> 'challenges',
      p_responses ->> 'schoolImpact', p_responses -> 'schoolEffects',
      p_responses -> 'supportOptions', p_responses ->> 'supportAwareness',
      p_responses ->> 'mentalHealthInformation', p_responses ->> 'helpSeekingComfort',
      p_responses ->> 'preferredFirstContact', p_responses -> 'barriers',
      p_responses ->> 'schoolSupportRating', p_responses ->> 'missingSupport',
      p_responses ->> 'desiredChange', p_responses -> 'preferredSupportTypes',
      p_responses ->> 'digitalComfort', p_responses -> 'digitalTrustFactors',
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

revoke all on function public.gwiza_create_survey_submission(text, jsonb, text, boolean)
  from public, anon, authenticated;
grant execute on function public.gwiza_create_survey_submission(text, jsonb, text, boolean)
  to service_role;

commit;
