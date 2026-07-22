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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", occasions: OCCASIONS });
});

// Runs before the payment gate, after upload.single("photo") below, so both
// multipart (req.file) and JSON (req.body.photo) requests have their occasion
// + photo *presence* checked before charging. A buyer with a doomed request
// gets a free 400 instead of a paid one. This only checks presence/format —
// actually resolving the photo (decoding base64, fetching a URL) still
// happens post-payment, since that requires real work.
function preValidateBody(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const errors: string[] = [];

  const occasion = req.body?.occasion as Occasion | undefined;
  if (!occasion || !OCCASIONS.includes(occasion)) {
    errors.push(`occasion must be one of: ${OCCASIONS.join(", ")}`);
  }

  const hasPhoto = !!req.file || (typeof req.body?.photo === "string" && req.body.photo.length > 0);
  if (!hasPhoto) {
    errors.push(
      "photo is required — either multipart form field \"photo\" (jpeg/png/webp file), or JSON field \"photo\" (base64 string, data URI, or https URL)"
    );
  }

  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  next();
}

// A2MCP entrypoint: POST /fit-check, "occasion" field plus a photo — either
// multipart form field "photo" (file), or JSON field "photo" (base64 string,
// data URI, or https URL). Added JSON support after a buyer's x402 replay
// flow turned out to be JSON-only with no multipart option.
// upload.single("photo") runs first (multer no-ops on non-multipart requests,
// so this is safe for JSON bodies too) so preValidateBody can check both paths
// before fitCheckPaymentMiddleware charges anything.
app.post("/fit-check", upload.single("photo"), preValidateBody, fitCheckPaymentMiddleware, async (req, res) => {
  const startedAt = Date.now();
  console.log("[fit-check] paid request received");
  try {
    const occasion = req.body.occasion as Occasion;

    // Presence already confirmed by preValidateBody; this resolves the actual
    // bytes (decode/fetch/sniff) and can still fail on malformed content.
    let photo: Awaited<ReturnType<typeof resolveFromJsonField>>;
    try {
      photo = req.file ? resolveFromMulterFile(req.file) : await resolveFromJsonField(req.body.photo as string);
    } catch (err) {
      if (err instanceof PhotoError) {
        res.status(400).json({ errors: [err.message] });
        return;
      }
      throw err;
    }

    const imageBase64 = photo.buffer.toString("base64");

    const result = await runFitCheck(imageBase64, photo.mediaType, occasion);

    res.json({ occasion, ...result });
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
