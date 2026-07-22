// Resolves the outfit photo from either a multipart file upload or a JSON
// body field (data URI, raw base64, or an https URL) — added after a buyer
// report showed the marketplace's x402 replay flow posts JSON only, with no
// multipart option, so a multipart-only endpoint charges for calls that are
// guaranteed to fail.

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof ALLOWED_TYPES)[number];
const MAX_BYTES = 8 * 1024 * 1024;

export class PhotoError extends Error {}

function sniffMediaType(buf: Buffer): MediaType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  return null;
}

// Blocks the obvious SSRF targets (cloud metadata, loopback, private ranges)
// for a server that fetches a buyer-supplied URL. Not exhaustive (no DNS
// rebinding protection), but stops the easy cases.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "169.254.169.254" || h === "::1") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

async function fetchPhotoUrl(url: string): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new PhotoError("photo URL must be http or https");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new PhotoError("photo URL host is not allowed");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new PhotoError(`could not fetch photo URL: HTTP ${resp.status}`);
    const arrayBuf = await resp.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BYTES) throw new PhotoError("photo URL exceeds 8MB limit");
    return Buffer.from(arrayBuf);
  } finally {
    clearTimeout(timeout);
  }
}

export interface ResolvedPhoto {
  buffer: Buffer;
  mediaType: MediaType;
}

/** Multipart file, already parsed by multer. */
export function resolveFromMulterFile(file: Express.Multer.File): ResolvedPhoto {
  if (!ALLOWED_TYPES.includes(file.mimetype as MediaType)) {
    throw new PhotoError("photo must be jpeg, png, or webp");
  }
  return { buffer: file.buffer, mediaType: file.mimetype as MediaType };
}

/** JSON body's `photo` field: data URI, raw base64, or an https/http URL. */
export async function resolveFromJsonField(photo: string): Promise<ResolvedPhoto> {
  let buffer: Buffer;

  if (/^https?:\/\//i.test(photo)) {
    buffer = await fetchPhotoUrl(photo);
  } else {
    const dataUriMatch = photo.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
    const base64Payload = dataUriMatch ? dataUriMatch[2] : photo;
    try {
      buffer = Buffer.from(base64Payload, "base64");
    } catch {
      throw new PhotoError("photo must be a valid base64 string, data URI, or URL");
    }
    if (buffer.length === 0) throw new PhotoError("photo must be a valid base64 string, data URI, or URL");
    if (buffer.length > MAX_BYTES) throw new PhotoError("photo exceeds 8MB limit");
  }

  const mediaType = sniffMediaType(buffer);
  if (!mediaType) throw new PhotoError("photo must be jpeg, png, or webp");
  return { buffer, mediaType };
}
