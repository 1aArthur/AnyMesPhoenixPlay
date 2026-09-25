import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

const cookieName = 'ampp_owner';
const secret = () => createHash('sha256').update((process.env.ADMIN_ACCESS_TOKEN || '') + ':session').digest('hex');
export const ready = () => Boolean(/^\d{20}$/.test(process.env.ADMIN_ACCESS_TOKEN || '') && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const equals = (a: string, b: string) => timingSafeEqual(Buffer.from(createHash('sha256').update(a).digest()), Buffer.from(createHash('sha256').update(b).digest()));
export function validToken(candidate: string) { return ready() && /^\d{20}$/.test(candidate) && equals(candidate, process.env.ADMIN_ACCESS_TOKEN || ''); }
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('hex'); }
export function newSession() { const issued = String(Date.now()); return `${issued}.${sign(issued)}`; }
export function isOwner(request: NextRequest) {
  if (!ready()) return false;
  const value = request.cookies.get(cookieName)?.value || '';
  if (!/^\d{13}\.[a-f0-9]{64}$/.test(value)) return false;
  const [issued, signature] = value.split('.');
  const age = Date.now() - Number(issued);
  return age >= 0 && age < 8 * 60 * 60 * 1000 && timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(issued), 'hex'));
}
export function ownerCookie(value: string) { return { name: cookieName, value, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 8 * 60 * 60 }; }
export async function redis(command: Array<string | number>): Promise<unknown> {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base?.startsWith('https://') || !token) throw new Error('Armazenamento indisponível');
  const response = await fetch(base, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Armazenamento indisponível');
  const result = await response.json() as { result?: unknown; error?: string };
  if (result.error) throw new Error('Armazenamento indisponível');
  return result.result;
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const received = new URL(origin);
    // NextURL normalizes 127.0.0.1 to localhost. Host retains the browser's
    // actual authority; do not accept arbitrary X-Forwarded-Host values.
    const host = request.headers.get('host') || request.nextUrl.host;
    return received.origin === origin && received.protocol === request.nextUrl.protocol && received.host === host.toLowerCase();
  } catch { return false; }
}

// Increment and expiry must succeed together, including after a server restart.
const loginWindowScript = `
local attempts = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { attempts, ttl }
`;

export async function loginLimit(ip: string) {
  const key = `ampp:login:${createHmac('sha256', secret()).update(ip).digest('hex')}`;
  const result = await redis(['EVAL', loginWindowScript, 1, key, 300]);
  if (!Array.isArray(result) || result.length !== 2 ||
      !Number.isSafeInteger(result[0]) || result[0] < 1 ||
      !Number.isSafeInteger(result[1]) || result[1] < 0 || result[1] > 300) {
    throw new Error('Autenticação indisponível');
  }
  return { allowed: result[0] <= 8, retryAfter: Math.max(1, result[1]) };
}
