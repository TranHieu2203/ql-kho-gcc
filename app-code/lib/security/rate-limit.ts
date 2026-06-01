/**
 * In-memory rate limiter cho self-host quy mô nhỏ.
 * Restart server → reset state (chấp nhận được cho 1-3 user).
 *
 * Hai chế độ:
 *   - username bucket (5 attempts / 5 phút) — chống brute-force 1 account
 *   - IP bucket (30 attempts / 10 phút)     — chống spray nhiều username từ 1 IP
 */

type Bucket = { count: number; resetAt: number };

const usernameMap = new Map<string, Bucket>();
const ipMap = new Map<string, Bucket>();

const USERNAME_WINDOW = 5 * 60_000;
const USERNAME_MAX = 5;
const IP_WINDOW = 10 * 60_000;
const IP_MAX = 30;

function check(map: Map<string, Bucket>, key: string, max: number, windowMs: number, now: number) {
  const rec = map.get(key);
  if (rec && rec.resetAt > now && rec.count >= max) {
    return { blocked: true, retryAfterMs: rec.resetAt - now };
  }
  return { blocked: false, retryAfterMs: 0 };
}

function bump(map: Map<string, Bucket>, key: string, windowMs: number, now: number) {
  const rec = map.get(key);
  if (!rec || rec.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    rec.count += 1;
  }
}

/**
 * Gọi TRƯỚC khi check password.
 * Trả về { blocked: true, message } nếu một trong 2 bucket đã hết quota.
 */
export function checkLoginRateLimit(username: string, ip: string): { blocked: false } | { blocked: true; message: string } {
  const now = Date.now();
  // Cleanup expired entries occasionally (every ~100 calls — cheap)
  if (Math.floor(now / 1000) % 60 === 0) cleanup(now);

  const userKey = username.toLowerCase();
  const u = check(usernameMap, userKey, USERNAME_MAX, USERNAME_WINDOW, now);
  if (u.blocked) {
    const mins = Math.ceil(u.retryAfterMs / 60_000);
    return { blocked: true, message: `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${mins} phút.` };
  }
  const i = check(ipMap, ip, IP_MAX, IP_WINDOW, now);
  if (i.blocked) {
    const mins = Math.ceil(i.retryAfterMs / 60_000);
    return { blocked: true, message: `Quá nhiều yêu cầu từ địa chỉ này. Thử lại sau ${mins} phút.` };
  }
  return { blocked: false };
}

/** Gọi khi password SAI — tăng count cả 2 bucket. */
export function bumpLoginAttempt(username: string, ip: string) {
  const now = Date.now();
  bump(usernameMap, username.toLowerCase(), USERNAME_WINDOW, now);
  bump(ipMap, ip, IP_WINDOW, now);
}

/** Gọi khi password ĐÚNG — clear username bucket (giữ IP bucket tránh credential stuffing 1-success). */
export function clearLoginAttempt(username: string) {
  usernameMap.delete(username.toLowerCase());
}

function cleanup(now: number) {
  for (const [k, v] of usernameMap) if (v.resetAt <= now) usernameMap.delete(k);
  for (const [k, v] of ipMap) if (v.resetAt <= now) ipMap.delete(k);
}
