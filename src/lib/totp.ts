/** RFC 6238 TOTP with ±1 step tolerance (no external deps). */
import crypto from "crypto";
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let bits = 0, val = 0, out = "";
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) out += ALPHA[(val << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  let bits = 0, val = 0; const out: number[] = [];
  for (const c of s.toUpperCase()) { const i = ALPHA.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function totp(secretB32: string, time = Date.now()): string {
  const counter = Math.floor(time / 30000);
  const buf = Buffer.alloc(8); buf.writeUInt32BE(0, 0); buf.writeUInt32BE(counter, 4);
  const hmac = crypto.createHmac("sha1", base32Decode(secretB32)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24 | (hmac[off + 1] & 0xff) << 16 | (hmac[off + 2] & 0xff) << 8 | (hmac[off + 3] & 0xff)) % 1_000_000;
  return String(code).padStart(6, "0");
}
export function verifyTotp(secretB32: string | null, code: string): boolean {
  if (!secretB32 || !/^\d{6}$/.test(code)) return false;
  for (const skew of [-30000, 0, 30000]) if (totp(secretB32, Date.now() + skew) === code) return true;
  return false;
}
