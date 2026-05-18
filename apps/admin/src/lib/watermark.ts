/**
 * Browser-side watermark engine.
 *
 * Runs in the admin's browser to generate watermarked variants before upload.
 * Uses Web Crypto API for HMAC-SHA256.
 *
 * Each variant gets a 38-byte watermark block appended to the file:
 *   [PGWM] [variantIndex:u16LE] [HMAC-SHA256:32 bytes]
 *
 * Forensic extraction reads the last 38 bytes to identify leaked variants.
 */

const WATERMARK_MAGIC = new TextEncoder().encode("PGWM");
const BLOCK_SIZE = 38; // 4 + 2 + 32

export type WatermarkProgress = {
  variantIndex: number;
  totalVariants: number;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
};

async function generatePayload(
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

async function createVariant(
  original: ArrayBuffer,
  assetId: string,
  variantIndex: number,
  secret: string,
): Promise<ArrayBuffer> {
  const payload = await generatePayload(assetId, variantIndex, secret);
  const block = new Uint8Array(BLOCK_SIZE);
  block.set(WATERMARK_MAGIC, 0);
  new DataView(block.buffer).setUint16(4, variantIndex, true);
  block.set(payload, 6);

  const src = new Uint8Array(original);
  const out = new Uint8Array(src.length + BLOCK_SIZE);
  out.set(src, 0);
  out.set(block, src.length);
  return out.buffer;
}

export async function generateVariants(
  file: File,
  assetId: string,
  variantCount: number,
  secret: string,
  onProgress?: (p: WatermarkProgress) => void,
): Promise<{ variantIndex: number; data: ArrayBuffer }[]> {
  const original = await file.arrayBuffer();
  const results: { variantIndex: number; data: ArrayBuffer }[] = [];

  for (let v = 0; v < variantCount; v++) {
    onProgress?.({ variantIndex: v, totalVariants: variantCount, status: "processing" });
    try {
      results.push({ variantIndex: v, data: await createVariant(original, assetId, v, secret) });
      onProgress?.({ variantIndex: v, totalVariants: variantCount, status: "done" });
    } catch (e) {
      onProgress?.({ variantIndex: v, totalVariants: variantCount, status: "error", error: String(e) });
      throw e;
    }
  }
  return results;
}

export function extractWatermark(
  data: ArrayBuffer,
): { variantIndex: number; payload: string } | null {
  const bytes = new Uint8Array(data);
  if (bytes.length < BLOCK_SIZE) return null;
  const o = bytes.length - BLOCK_SIZE;
  if (bytes[o] !== 0x50 || bytes[o + 1] !== 0x47 || bytes[o + 2] !== 0x57 || bytes[o + 3] !== 0x4d)
    return null;
  const idx = new DataView(bytes.buffer, bytes.byteOffset + o + 4, 2).getUint16(0, true);
  const payload = Array.from(bytes.slice(o + 6, o + 6 + 32))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { variantIndex: idx, payload };
}
