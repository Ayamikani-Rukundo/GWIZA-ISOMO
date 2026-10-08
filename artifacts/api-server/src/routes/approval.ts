import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
const approvalViewCode = "A1B2C3_Isomo";
const approvalFiles = [
  path.join(path.dirname(fileURLToPath(import.meta.url)), "private-approval.pdf"),
  path.resolve(process.cwd(), "Aproval.pdf"),
  path.resolve(process.cwd(), "../../Aproval.pdf"),
];

async function loadApprovalDocument(): Promise<Buffer> {
  let lastError: unknown;
  for (const file of approvalFiles) {
    try {
      return await readFile(file);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function matchesApprovalCode(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const submitted = Buffer.from(value);
  const expected = Buffer.from(approvalViewCode);
  return submitted.length === expected.length && timingSafeEqual(submitted, expected);
}

router.post("/approval-document", async (request, response): Promise<void> => {
  if (!matchesApprovalCode(request.body?.code)) {
    response.status(401).json({ error: "The viewing code was not accepted." });
    return;
  }

  try {
    const document = await loadApprovalDocument();
    response
      .setHeader("content-type", "application/pdf")
      .setHeader("content-disposition", 'inline; filename="Isomo-approval.pdf"')
      .setHeader("cache-control", "no-store")
      .setHeader("x-content-type-options", "nosniff")
      .send(document);
  } catch (error) {
    request.log.error({ err: error }, "Approval document could not be read");
    response.status(503).json({ error: "The approval document is temporarily unavailable." });
  }
});

export default router;
