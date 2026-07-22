import express from "express";
import multer from "multer";
import { OCCASIONS, type Occasion } from "./rubric.js";
import { runFitCheck } from "./vision.js";
import { fitCheckPaymentMiddleware } from "./payment.js";
import { PhotoError, resolveFromJsonField, resolveFromMulterFile } from "./photo.js";

// Process-level guards: a malformed request must never take the service down.
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

const app = express();
// Base64-encoded photos inflate ~33% over raw bytes; match the 8MB multer limit with headroom.
app.use(express.json({ limit: "12mb" }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

const PORT = process.env.PORT ?? 3000;

// Machine-parseable schema for POST /fit-check's request body, so a buyer's
// calling agent can form a valid request without guessing from prose.
const FIT_CHECK_REQUEST_SCHEMA = {
  type: "object",
  properties: {
    occasion: { type: "string", enum: OCCASIONS },
    photo: {
      type: "string",
      description: "base64 string, data URI, or https URL of a jpeg/png/webp image (or send as multipart form field \"photo\" instead)",
    },
  },
  required: ["occasion", "photo"],
} as const;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", occasions: OCCASIONS, fitCheckRequestSchema: FIT_CHECK_REQUEST_SCHEMA });
});

// A2MCP entrypoint: POST /fit-check, "occasion" field plus a photo — either
// multipart form field "photo" (file), or JSON field "photo" (base64 string,
// data URI, or https URL). Added JSON support after a buyer's x402 replay
// flow turned out to be JSON-only with no multipart option.
//
// fitCheckPaymentMiddleware runs FIRST, unconditionally — every unpaid POST
// (any body, including empty/malformed) must get a 402 with the real accepts
// array, or x402 discovery tooling correctly reports this as "not a valid
// x402 service." Business-param validation happens after: a signed-but-invalid
// request still costs the buyer nothing, since the facilitator only settles
// on a 200 response (confirmed empirically — balance is untouched by a 400
// after payment verification, regardless of validation order).
app.post("/fit-check", fitCheckPaymentMiddleware, upload.single("photo"), async (req, res) => {
  const startedAt = Date.now();
  console.log("[fit-check] paid request received");
  try {
    const errors: string[] = [];

    const occasion = req.body.occasion as Occasion | undefined;
    if (!occasion || !OCCASIONS.includes(occasion)) {
      errors.push(`occasion must be one of: ${OCCASIONS.join(", ")}`);
    }

    let photo: Awaited<ReturnType<typeof resolveFromJsonField>> | undefined;
    try {
      if (req.file) {
        photo = resolveFromMulterFile(req.file);
      } else if (typeof req.body.photo === "string" && req.body.photo.length > 0) {
        photo = await resolveFromJsonField(req.body.photo);
      } else {
        errors.push(
          "photo is required — either multipart form field \"photo\" (jpeg/png/webp file), or JSON field \"photo\" (base64 string, data URI, or https URL)"
        );
      }
    } catch (err) {
      if (err instanceof PhotoError) {
        errors.push(err.message);
      } else {
        throw err;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const imageBase64 = photo!.buffer.toString("base64");

    const result = await runFitCheck(imageBase64, photo!.mediaType, occasion!);

    res.json({ occasion: occasion!, ...result });
    console.log(`[fit-check] completed in ${Date.now() - startedAt}ms`);
  } catch (err) {
    console.error(`[fit-check] failed after ${Date.now() - startedAt}ms:`, err);
    res.status(500).json({ error: "fit check failed", detail: (err as Error).message });
  }
});

// x402 convention: non-POST requests to a paid endpoint should return 405, not fall
// through to a generic 404.
app.all("/fit-check", (req, res) => {
  res.set("Allow", "POST").status(405).json({ error: "method not allowed, use POST" });
});

// Catch-all error handler — no thrown error bubbles into an unhandled state.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("route error:", err);
  if (!res.headersSent) res.status(500).json({ error: "internal error" });
});

app.listen(PORT, () => {
  console.log(`Fit Check listening on port ${PORT}`);
});
