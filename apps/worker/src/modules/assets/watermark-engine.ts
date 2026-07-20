/**
 * Server-side watermark engine.
 *
 * - `selectVariant`: HMAC-based deterministic variant selection for asset serving.
 * - `extractWatermark`: forensic extraction of watermark blocks from files.
 * - `generateWatermarkPayload`: HMAC-SHA256 payload for verification.
 */

const WATERMARK_MAGIC = new TextEncoder().encode("PGWM");
const BLOCK_SIZE = 38; // magic(4) + variantIndex(2) + hmac(32)

/** Deterministically select which variant to serve. */
export async function selectVariant(
  userId: string,
  assetId: string,
  variantCount: number,
  secret: string,
): Promise<number> {
  if (variantCount <= 1) return 0;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}:${assetId}:${secret}`),
  );
  const view = new DataView(sig);
  return view.getUint32(0, false) % variantCount;
}

/** Extract watermark from file bytes. */
export function extractWatermark(
  data: Uint8Array,
): { variantIndex: number; payload: Uint8Array } | null {
  if (data.length < BLOCK_SIZE) return null;
  const o = data.length - BLOCK_SIZE;
  if (data[o] !== 0x50 || data[o + 1] !== 0x47 || data[o + 2] !== 0x57 || data[o + 3] !== 0x4d)
    return null;
  const idx = new DataView(data.buffer, data.byteOffset + o + 4, 2).getUint16(0, true);
  return { variantIndex: idx, payload: data.slice(o + 6, o + 6 + 32) };
}

/** Generate HMAC payload for a variant (used for verification). */
export async function generateWatermarkPayload(
  assetId: string,
  variantIndex: number,
  secret: string,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`watermark:${assetId}:${variantIndex}:${secret}`),
  );
  return new Uint8Array(sig);
}
