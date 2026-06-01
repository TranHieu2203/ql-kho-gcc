import { headers } from 'next/headers';

/**
 * Extract IP + UserAgent từ headers cho audit log.
 * Phải gọi trong context có headers() (server action / route handler / RSC).
 *
 * IP precedence: X-Forwarded-For (proxy first) → X-Real-IP → fallback 'unknown'.
 * UA giới hạn 256 ký tự để chống log injection bằng UA dài.
 */
export function getRequestMeta(): { ipAddress: string | null; userAgent: string | null } {
  try {
    const h = headers();
    const xff = h.get('x-forwarded-for');
    const ip =
      (xff && xff.split(',')[0]?.trim()) ||
      h.get('x-real-ip') ||
      h.get('cf-connecting-ip') ||
      null;
    const ua = h.get('user-agent')?.slice(0, 256) ?? null;
    return { ipAddress: ip, userAgent: ua };
  } catch {
    // Không có headers context (vd background job) → null
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Trả về 1 key ổn định cho rate-limiting theo IP.
 * Default 'unknown' nếu không xác định được — bảo vệ chung tránh fallthrough.
 */
export function getClientIpKey(): string {
  const { ipAddress } = getRequestMeta();
  return ipAddress ?? 'unknown';
}
