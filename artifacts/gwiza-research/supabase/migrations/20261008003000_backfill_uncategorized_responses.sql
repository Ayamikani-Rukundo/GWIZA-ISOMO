begin;

-- Preserve an answer key used by the earlier school-staff questionnaire.
alter table public.school_staff_responses
  add column if not exists additional_support text;

-- Catch up any submissions written by an API instance that predates the RPC.
-- Existing categorized response rows are left unchanged.
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
  missing_support, additional_support, additional_support_needs, technology_access,
  technology_problem, technology_replacement, platform_concerns
)
select id, responses ->> 'role', responses ->> 'yearsExperience',
  responses ->> 'studentApproachFrequency', responses ->> 'staffAwareness',
  responses -> 'commonChallenges', responses -> 'currentSupport',
  responses ->> 'counsellorAvailability', responses -> 'supportResponsibility',
  responses ->> 'referralEase', responses ->> 'studentSupportAwareness',
  responses ->> 'staffTraining', responses -> 'supportBarriers',
  responses ->> 'missingSupport', responses ->> 'additionalSupport',
  responses -> 'additionalSupportNeeds', responses ->> 'technologyAccess',
  responses ->> 'technologyProblem', responses ->> 'technologyReplacement',
  responses -> 'platformConcerns'
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

commit;
