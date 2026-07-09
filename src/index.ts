import express from "express";
import multer from "multer";
import { OCCASIONS, type Occasion } from "./rubric.js";
import { runFitCheck } from "./vision.js";
import { fitCheckPaymentMiddleware } from "./payment.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

const PORT = process.env.PORT ?? 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// A2MCP entrypoint: POST /fit-check, multipart form with "photo" file + "occasion" field.
// fitCheckPaymentMiddleware runs first — unpaid/unsigned requests get a 402 and never
// reach multer or the vision call below.
app.post("/fit-check", fitCheckPaymentMiddleware, upload.single("photo"), async (req, res) => {
  try {
    const occasion = req.body.occasion as Occasion | undefined;

    if (!occasion || !OCCASIONS.includes(occasion)) {
      res.status(400).json({
        error: `occasion must be one of: ${OCCASIONS.join(", ")}`,
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "photo file is required (field name: photo)" });
      return;
    }

    const mediaType = req.file.mimetype;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
      res.status(400).json({ error: "photo must be jpeg, png, or webp" });
      return;
    }

    const imageBase64 = req.file.buffer.toString("base64");

    const result = await runFitCheck(
      imageBase64,
      mediaType as "image/jpeg" | "image/png" | "image/webp",
      occasion
    );

    res.json({ occasion, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "fit check failed", detail: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Fit Check listening on port ${PORT}`);
});
