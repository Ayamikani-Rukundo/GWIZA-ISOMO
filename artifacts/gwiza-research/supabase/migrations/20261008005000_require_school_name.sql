begin;

alter table public.survey_submissions
  add constraint survey_submissions_school_name_required
  check (school_name is not null and char_length(school_name) <= 160)
  not valid;

commit;
