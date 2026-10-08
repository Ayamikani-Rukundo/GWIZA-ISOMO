-- Add analysis-friendly columns for the expanded school and professional surveys.
-- Apply after 20261008000000_gwiza_research.sql. Existing JSONB submissions remain unchanged.

begin;

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
  responses ->> 'platformConcerns' as platform_concerns,
  responses ->> 'staffAwareness' as staff_awareness,
  responses ->> 'counsellorAvailability' as counsellor_availability,
  responses -> 'additionalSupportNeeds' as additional_support_needs
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
  responses ->> 'technologyRisks' as technology_risks,
  responses ->> 'professionalRole' as professional_role,
  responses -> 'experienceAreas' as experience_areas,
  responses ->> 'referralEffectiveness' as referral_effectiveness,
  responses -> 'serviceBarriers' as service_barriers
from public.survey_submissions
where respondent_type = 'professional';

commit;
