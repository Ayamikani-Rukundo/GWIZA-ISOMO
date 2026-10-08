import { Router, type IRouter, type Request, type Response } from "express";
import ExcelJS from "exceljs";
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

type ResponseFieldKind = "single" | "multiple" | "text";

const responseFields: Record<RespondentType, Record<string, ResponseFieldKind>> = {
  student: {
    ageGroup: "single", schoolSetting: "single", region: "single",
    wellbeingFrequency: "single", challenges: "multiple", schoolImpact: "single",
    schoolEffects: "multiple", supportOptions: "multiple", supportAwareness: "single",
    mentalHealthInformation: "single", helpSeekingComfort: "single",
    preferredFirstContact: "single", barriers: "multiple", schoolSupportRating: "single",
    missingSupport: "text", desiredChange: "text", preferredSupportTypes: "multiple",
    digitalComfort: "single", digitalTrustFactors: "multiple", desiredDigitalSupport: "text",
  },
  school: {
    role: "single", yearsExperience: "single", studentApproachFrequency: "single",
    staffAwareness: "single", counsellorAvailability: "single",
    commonChallenges: "multiple", currentSupport: "multiple", supportResponsibility: "multiple",
    referralEase: "single", studentSupportAwareness: "single", staffTraining: "single",
    supportBarriers: "multiple", missingSupport: "text", additionalSupport: "text",
    additionalSupportNeeds: "multiple", technologyAccess: "single", technologyProblem: "text",
    technologyReplacement: "text", platformConcerns: "multiple",
  },
  professional: {
    professionalRole: "single", experienceAreas: "multiple", referralEffectiveness: "single",
    serviceBarriers: "multiple", serviceGaps: "text", recommendations: "text",
    technologyRole: "text", technologyRisks: "multiple",
  },
  other: {
    youthRelationship: "single", observations: "multiple", supportAwareness: "single",
    perceivedGaps: "text", barriers: "multiple", improvements: "text", recommendations: "text",
  },
};

function validResponsePayload(
  respondentType: RespondentType,
  responses: Record<string, unknown>,
): boolean {
  const allowedFields = responseFields[respondentType];
  const forbiddenKeys = new Set([
    "name", "fullname", "phone", "phonenumber", "email", "address",
    "homeaddress", "schoolname", "exactschool",
  ]);
  const entries = Object.entries(responses);
  if (entries.length > 60) return false;

  for (const [key, value] of entries) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const kind = allowedFields[key];
    if (!kind || forbiddenKeys.has(normalizedKey)) return false;

    if (kind === "text") {
      if (typeof value !== "string" || value.length > 4_000) return false;
    } else if (kind === "multiple") {
      if (
        !Array.isArray(value) || value.length > 30 ||
        value.some((item) => typeof item !== "string" || item.length > 160)
      ) return false;
    } else if (typeof value !== "string" || value.length > 160) {
      return false;
    }
  }

  try {
    return JSON.stringify(responses).length <= 35_000;
  } catch {
    return false;
  }
}

function responseKeyForColumn(column: string): string {
  return column.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function jsonValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(" | ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function workbookValue(value: unknown): string {
  const text = jsonValue(value);
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

const workbookSheets: Record<RespondentType, { name: string; columns: string[] }> = {
  student: {
    name: "Students",
    columns: [
      "wellbeing_frequency", "challenges", "school_impact", "school_effects",
      "support_options", "support_awareness", "mental_health_information",
      "help_seeking_comfort", "preferred_first_contact", "barriers",
      "school_support_rating", "missing_support", "desired_change",
      "preferred_support_types", "digital_comfort", "digital_trust_factors",
      "desired_digital_support",
    ],
  },
  school: {
    name: "School staff",
    columns: [
      "role", "years_experience", "student_approach_frequency", "staff_awareness",
      "common_challenges", "current_support", "counsellor_availability",
      "support_responsibility", "referral_ease", "student_support_awareness",
      "staff_training", "support_barriers", "missing_support",
      "additional_support_needs", "technology_access", "technology_problem",
      "technology_replacement", "platform_concerns",
    ],
  },
  professional: {
    name: "Professionals",
    columns: [
      "professional_role", "experience_areas", "referral_effectiveness",
      "service_barriers", "service_gaps", "recommendations", "technology_role",
      "technology_risks",
    ],
  },
  other: {
    name: "Other respondents",
    columns: [
      "youth_relationship", "observations", "support_awareness", "perceived_gaps",
      "barriers", "improvements", "recommendations",
    ],
  },
};

const workbookMetadataColumns = [
  "submission_id", "respondent_type", "age_group", "region", "school_setting",
  "survey_version", "submitted_at",
];

function styleWorkbookHeader(worksheet: ExcelJS.Worksheet): void {
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF315F4B" },
  };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 32;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };
  worksheet.columns.forEach((column) => {
    column.width = Math.min(36, Math.max(18, String(column.header ?? "").length + 3));
  });
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
  if (
    !parsed.success ||
    !validResponsePayload(parsed.data.respondentType, parsed.data.responses)
  ) {
    response.status(400).json({
      error:
        "Please check your answers and remove any identifying information before submitting.",
    });
    return;
  }

  const { respondentType, responses } = parsed.data;
  const surveyVersion = `gwiza_${respondentType}_${respondentType === "school" || respondentType === "professional" ? "v2" : "v1"}`;

  try {
    const { data } = await supabaseRequest<{
      id: string;
      submitted_at: string;
    }>("rpc/gwiza_create_survey_submission", {
      method: "POST",
      body: JSON.stringify({
        p_respondent_type: respondentType,
        p_responses: responses,
        p_survey_version: surveyVersion,
        p_consent_acknowledged: true,
      }),
    });
    const result = CreateSurveySubmissionResponse.parse({
      id: data?.id,
      submittedAt: data?.submitted_at,
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

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "GWIZA Research";
      workbook.created = new Date();
      const summary = workbook.addWorksheet("Summary");
      summary.addRow(["GWIZA Research submissions"]);
      summary.addRow(["Generated at", new Date().toISOString()]);
      summary.addRow([]);
      summary.addRow(["Respondent type", "Responses", "Worksheet"]);
      for (const type of Object.keys(workbookSheets) as RespondentType[]) {
        summary.addRow([
          type,
          allRows.filter((item) => item.respondent_type === type).length,
          workbookSheets[type].name,
        ]);
      }
      summary.mergeCells("A1:C1");
      summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF315F4B" } };
      summary.getRow(4).font = { bold: true };
      summary.getColumn(1).width = 30;
      summary.getColumn(2).width = 18;
      summary.getColumn(3).width = 24;

      for (const type of Object.keys(workbookSheets) as RespondentType[]) {
        const definition = workbookSheets[type];
        const worksheet = workbook.addWorksheet(definition.name);
        const columns = [...workbookMetadataColumns, ...definition.columns];
        worksheet.addRow(columns);
        for (const item of allRows) {
          if (item.respondent_type !== type) continue;
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
          worksheet.addRow(columns.map((column) =>
            workbookValue(values[column] ?? values[responseKeyForColumn(column)]),
          ));
        }
        styleWorkbookHeader(worksheet);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      response
        .status(200)
        .setHeader(
          "content-type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .setHeader(
          "content-disposition",
          `attachment; filename="gwiza-research-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        )
        .send(Buffer.from(buffer));
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
