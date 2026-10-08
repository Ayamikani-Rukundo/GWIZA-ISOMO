import { Router, type IRouter, type Request, type Response } from "express";
import {
  AdminLoginBody,
  AdminLoginResponse,
  AdminLogoutResponse,
  CreateSurveySubmissionBody,
  CreateSurveySubmissionResponse,
  DeleteAdminSubmissionParams,
  DeleteAdminSubmissionResponse,
  GetAdminOverviewResponse,
  GetAdminSessionResponse,
  ListAdminSubmissionsQueryParams,
  ListAdminSubmissionsResponse,
  ListQualitativeResponsesResponse,
} from "@workspace/api-zod";
import {
  clearAdminCookie,
  createAdminSessionToken,
  getAdminEmail,
  getAdminCredentials,
  isAdminRequest,
  requireAdmin,
  setAdminCookie,
  verifyAdminCredentials,
} from "../lib/admin-session";
import {
  SupabaseRequestError,
  supabaseRequest,
} from "../lib/supabase-rest";

type RespondentType = "student" | "school" | "professional" | "other";
type StoredSubmission = {
  id: string;
  respondent_type: RespondentType;
  age_group: string | null;
  region: string | null;
  school_setting: string | null;
  submitted_at: string;
  survey_version: string;
  responses: Record<string, unknown>;
};

const router: IRouter = Router();
const responseColumns =
  "id,respondent_type,age_group,region,school_setting,submitted_at,survey_version,responses";

function asShortString(value: unknown, maxLength = 120): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function validResponsePayload(responses: Record<string, unknown>): boolean {
  const forbiddenKeys = new Set([
    "name",
    "fullName",
    "phone",
    "phoneNumber",
    "email",
    "address",
    "homeAddress",
    "schoolName",
    "exactSchool",
  ]);
  const keys = Object.keys(responses);
  if (keys.length > 60 || keys.some((key) => forbiddenKeys.has(key))) return false;

  try {
    return JSON.stringify(responses).length <= 35_000;
  } catch {
    return false;
  }
}

function jsonValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(" | ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function csvCell(value: unknown): string {
  let text = jsonValue(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function sendDatabaseError(
  request: Request,
  response: Response,
  error: unknown,
  publicMessage: string,
): void {
  const status = error instanceof SupabaseRequestError ? error.status : 503;
  request.log.error(
    {
      status:
        error instanceof SupabaseRequestError ? error.status : undefined,
    },
    "Research database request failed",
  );
  response.status(status >= 400 && status < 500 ? 503 : status).json({
    error: publicMessage,
  });
}

router.post("/survey-submissions", async (request, response): Promise<void> => {
  const parsed = CreateSurveySubmissionBody.safeParse(request.body);
  if (!parsed.success || !validResponsePayload(parsed.data?.responses ?? {})) {
    response.status(400).json({
      error:
        "Please check your answers and remove any identifying information before submitting.",
    });
    return;
  }

  const { respondentType, responses } = parsed.data;
  const row = {
    respondent_type: respondentType,
    age_group: asShortString(responses.ageGroup),
    region: asShortString(responses.region),
    school_setting: asShortString(responses.schoolSetting),
    survey_version: `gwiza_${respondentType}_v1`,
    consent_acknowledged: true,
    responses,
  };

  try {
    const { data } = await supabaseRequest<
      Array<{ id: string; submitted_at: string }>
    >("survey_submissions?select=id,submitted_at", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    const result = CreateSurveySubmissionResponse.parse({
      id: data?.[0]?.id,
      submittedAt: data?.[0]?.submitted_at,
    });
    response.status(201).json(result);
  } catch (error) {
    sendDatabaseError(
      request,
      response,
      error,
      "We couldn't record your response just now. Your answers are still on this page; please try again.",
    );
  }
});

router.get("/admin/session", (request, response): void => {
  response.json(
    GetAdminSessionResponse.parse({
      authenticated: isAdminRequest(request),
      email: getAdminEmail(request),
    }),
  );
});

router.post("/admin/login", (request, response): void => {
  const parsed = AdminLoginBody.safeParse(request.body);
  const configuredCredentials = getAdminCredentials();
  if (!configuredCredentials || !process.env.SESSION_SECRET) {
    response
      .status(503)
      .json({ error: "Administrator sign-in is not configured yet." });
    return;
  }
  if (!parsed.success || !verifyAdminCredentials(parsed.data.email, parsed.data.password)) {
    response.status(401).json({ error: "Email or password was not accepted." });
    return;
  }

  const token = createAdminSessionToken();
  if (!token) {
    response
      .status(503)
      .json({ error: "Administrator sign-in is not configured yet." });
    return;
  }
  setAdminCookie(response, token);
  response.json(
    AdminLoginResponse.parse({
      authenticated: true,
      email: configuredCredentials.email,
    }),
  );
});

router.post("/admin/logout", (_request, response): void => {
  clearAdminCookie(response);
  response.json(AdminLogoutResponse.parse({ message: "You are signed out." }));
});

router.get("/admin/overview", requireAdmin, async (request, response): Promise<void> => {
  try {
    const { data } = await supabaseRequest<unknown>(
      "rpc/gwiza_admin_overview",
      { method: "POST", body: "{}" },
    );
    response.json(GetAdminOverviewResponse.parse(data));
  } catch (error) {
    sendDatabaseError(
      request,
      response,
      error,
      "Research summaries are temporarily unavailable.",
    );
  }
});

router.get(
  "/admin/submissions",
  requireAdmin,
  async (request, response): Promise<void> => {
    const parsed = ListAdminSubmissionsQueryParams.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "The response filters are invalid." });
      return;
    }

    const { respondentType, search, page, pageSize } = parsed.data;
    const offset = (page - 1) * pageSize;
    const params = new URLSearchParams({
      select: responseColumns,
      order: "submitted_at.desc",
      limit: String(pageSize),
      offset: String(offset),
    });
    if (respondentType) params.set("respondent_type", `eq.${respondentType}`);

    const cleanedSearch = search
      ?.replace(/[^a-zA-Z0-9À-ž -]/g, "")
      .trim()
      .slice(0, 80);
    if (cleanedSearch) {
      const term = `*${cleanedSearch}*`;
      const clauses = [`region.ilike.${term}`, `age_group.ilike.${term}`];
      if (
        /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(cleanedSearch)
      ) {
        clauses.push(`id.eq.${cleanedSearch}`);
      }
      params.set("or", `(${clauses.join(",")})`);
    }

    try {
      const { data, total } = await supabaseRequest<StoredSubmission[]>(
        `survey_submissions?${params.toString()}`,
        { headers: { prefer: "count=exact" } },
      );
      const result = ListAdminSubmissionsResponse.parse({
        items: (data ?? []).map((item) => ({
          id: item.id,
          respondentType: item.respondent_type,
          ageGroup: item.age_group,
          region: item.region,
          schoolSetting: item.school_setting,
          submittedAt: item.submitted_at,
          surveyVersion: item.survey_version,
          responses: item.responses ?? {},
        })),
        total: total ?? data?.length ?? 0,
        page,
        pageSize,
      });
      response.json(result);
    } catch (error) {
      sendDatabaseError(
        request,
        response,
        error,
        "Research responses are temporarily unavailable.",
      );
    }
  },
);

router.get(
  "/admin/qualitative",
  requireAdmin,
  async (request, response): Promise<void> => {
    try {
      const params = new URLSearchParams({
        select: "id,respondent_type,submitted_at,responses",
        order: "submitted_at.desc",
        limit: "5000",
      });
      const { data } = await supabaseRequest<
        Array<Pick<StoredSubmission, "id" | "respondent_type" | "submitted_at" | "responses">>
      >(`survey_submissions?${params.toString()}`);

      const questionNames: Record<RespondentType, Record<string, string>> = {
        student: {
          missingSupport: "What feels missing from current support?",
          desiredChange: "What one change would you make?",
          desiredDigitalSupport: "What would you want a digital platform to help with?",
        },
        school: {
          missingSupport: "What support is missing?",
          additionalSupport: "What additional support would help?",
          technologyProblem: "What problem could technology address?",
          technologyReplacement: "What should technology never replace?",
          platformConcerns: "What concerns would you have about a digital platform?",
        },
        professional: {
          serviceGaps: "Where are the gaps between need and available support?",
          recommendations: "What would you recommend?",
          technologyRole: "Where might technology help?",
          technologyRisks: "What limitations or risks should be considered?",
        },
        other: {
          perceivedGaps: "What gaps do you see?",
          barriers: "What barriers affect support?",
          improvements: "What could improve support?",
          recommendations: "What would you recommend?",
        },
      };

      const qualitative = (data ?? []).flatMap((item) => {
        const labels = questionNames[item.respondent_type];
        return Object.entries(labels).flatMap(([key, question]) => {
          const answer = item.responses?.[key];
          if (typeof answer !== "string" || !answer.trim()) return [];
          return [
            {
              id: item.id,
              respondentType: item.respondent_type,
              submittedAt: item.submitted_at,
              question,
              answer: answer.trim(),
            },
          ];
        });
      });

      response.json(ListQualitativeResponsesResponse.parse(qualitative));
    } catch (error) {
      sendDatabaseError(
        request,
        response,
        error,
        "Written responses are temporarily unavailable.",
      );
    }
  },
);

router.get(
  "/admin/export",
  requireAdmin,
  async (request, response): Promise<void> => {
    try {
      const allRows: StoredSubmission[] = [];
      const batchSize = 1000;
      for (let offset = 0; ; offset += batchSize) {
        const params = new URLSearchParams({
          select: responseColumns,
          order: "submitted_at.asc",
          limit: String(batchSize),
          offset: String(offset),
        });
        const { data } = await supabaseRequest<StoredSubmission[]>(
          `survey_submissions?${params.toString()}`,
        );
        allRows.push(...(data ?? []));
        if (!data || data.length < batchSize) break;
      }

      const columns = [
        "submission_id",
        "respondent_type",
        "age_group",
        "region",
        "school_setting",
        "wellbeing_frequency",
        "challenges",
        "school_impact",
        "school_effects",
        "support_options",
        "support_awareness",
        "mental_health_information",
        "help_seeking_comfort",
        "preferred_first_contact",
        "barriers",
        "school_support_rating",
        "missing_support",
        "desired_change",
        "preferred_support_types",
        "digital_comfort",
        "digital_trust_factors",
        "desired_digital_support",
        "role",
        "years_experience",
        "common_challenges",
        "current_support",
        "referral_ease",
        "student_approach_frequency",
        "support_responsibility",
        "student_support_awareness",
        "staff_training",
        "support_barriers",
        "additional_support",
        "technology_access",
        "technology_problem",
        "technology_replacement",
        "platform_concerns",
        "service_gaps",
        "technology_role",
        "technology_risks",
        "youth_relationship",
        "observations",
        "support_awareness",
        "perceived_gaps",
        "improvements",
        "recommendations",
        "survey_version",
        "submitted_at",
      ];
      const csv = [
        columns.map(csvCell).join(","),
        ...allRows.map((item) => {
          const values: Record<string, unknown> = {
            submission_id: item.id,
            respondent_type: item.respondent_type,
            age_group: item.age_group,
            region: item.region,
            school_setting: item.school_setting,
            survey_version: item.survey_version,
            submitted_at: item.submitted_at,
            ...item.responses,
          };
          return columns.map((column) => csvCell(values[column])).join(",");
        }),
      ].join("\r\n");

      response
        .status(200)
        .setHeader("content-type", "text/csv; charset=utf-8")
        .setHeader(
          "content-disposition",
          `attachment; filename="gwiza-research-${new Date().toISOString().slice(0, 10)}.csv"`,
        )
        .send(`\uFEFF${csv}`);
    } catch (error) {
      sendDatabaseError(
        request,
        response,
        error,
        "The data export could not be created. Please try again.",
      );
    }
  },
);

router.delete(
  "/admin/submissions/:id",
  requireAdmin,
  async (request, response): Promise<void> => {
    const parsed = DeleteAdminSubmissionParams.safeParse(request.params);
    if (!parsed.success) {
      response.status(400).json({ error: "That response ID is not valid." });
      return;
    }

    try {
      const params = new URLSearchParams({
        id: `eq.${parsed.data.id}`,
        select: "id",
      });
      const { data } = await supabaseRequest<Array<{ id: string }>>(
        `survey_submissions?${params.toString()}`,
        {
          method: "DELETE",
          headers: { prefer: "return=representation" },
        },
      );
      if (!data?.length) {
        response.status(404).json({ error: "That response was not found." });
        return;
      }
      response.json(
        DeleteAdminSubmissionResponse.parse({ message: "Response deleted." }),
      );
    } catch (error) {
      sendDatabaseError(
        request,
        response,
        error,
        "The response could not be deleted. Please try again.",
      );
    }
  },
);

export default router;
