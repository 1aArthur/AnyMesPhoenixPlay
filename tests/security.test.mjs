import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isOwner, newSession, ownerCookie, validToken, loginLimit, sameOrigin } from '../lib/admin.ts';
import { readSmallJson } from '../lib/http.ts';
import { adminRequest, saveAdsState, fetchAdsState } from '../lib/admin-client.ts';

const keys = ['ADMIN_ACCESS_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'NODE_ENV'];
let previous;
beforeEach(() => {
  previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.ADMIN_ACCESS_TOKEN = '1'.repeat(20);
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-fixture-only';
  process.env.NODE_ENV = 'production';
});
afterEach(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
const ownerRequest = value => ({ cookies: { get: () => ({ value }) } });
const jsonRequest = (body, headers = {}) => new Request('https://app.example.test/api', {
  method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers },
});
const failsWith = status => error => error.status === status;

test('signed sessions work; altered, appended and malformed cookies are denied', () => {
  const session = newSession();
  assert.equal(isOwner(ownerRequest(session)), true);
  for (const value of ['', session + '.', session + '.extra', session + '.extra.more', session.slice(0, -1), session.replace(/^./, '9')]) {
    assert.equal(isOwner(ownerRequest(value)), false);
  }
  const last = session.at(-1);
  assert.equal(isOwner(ownerRequest(session.slice(0, -1) + (last === '0' ? '1' : '0'))), false);
});

test('sessions expire after eight hours and future timestamps are denied', t => {
  const issued = Date.now();
  const session = newSession();
  const clock = t.mock.method(Date, 'now', () => issued + 8 * 60 * 60 * 1000);
  assert.equal(isOwner(ownerRequest(session)), false);
  clock.mock.mockImplementation(() => issued - 1000);
  assert.equal(isOwner(ownerRequest(session)), false);
});

test('token rotation and missing configuration deny the existing session', () => {
  const session = newSession();
  assert.equal(validToken('1'.repeat(20)), true);
  assert.equal(validToken('2'.repeat(20)), false);
  assert.equal(validToken('1'.repeat(21)), false);
  process.env.ADMIN_ACCESS_TOKEN = '2'.repeat(20);
  assert.equal(isOwner(ownerRequest(session)), false);
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal(validToken('2'.repeat(20)), false);
  assert.equal(isOwner(ownerRequest(newSession())), false);
});

test('production cookie is HttpOnly, Secure and SameSite Strict', () => {
  const cookie = ownerCookie('fixture');
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, 'strict');
  assert.equal(cookie.path, '/');
  assert.equal(cookie.maxAge, 28800);
});

test('mutations reject absent, foreign and deceptive origins', () => {
  for (const origin of [null, 'https://evil.example.test', 'https://app.example.test.evil.test']) {
    assert.equal(sameOrigin({ headers: new Headers(origin ? { origin } : {}), nextUrl: new URL('https://app.example.test/api') }), false);
  }
  assert.equal(sameOrigin({ headers: new Headers({ origin: 'https://app.example.test' }), nextUrl: new URL('https://app.example.test/api') }), true);
  assert.equal(sameOrigin({ headers: new Headers({ origin: 'http://127.0.0.1:3100', host: '127.0.0.1:3100' }), nextUrl: new URL('http://localhost:3100/api') }), true);
  assert.equal(sameOrigin({ headers: new Headers({ origin: 'https://evil.example.test', host: 'app.example.test', 'x-forwarded-host': 'evil.example.test' }), nextUrl: new URL('https://app.example.test/api') }), false);
});

test('login rate limiting uses one atomic request and obscures the client IP', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    const command = JSON.parse(options.body);
    assert.equal(command[0], 'EVAL');
    assert.equal(command[2], 1);
    assert.equal(command[4], 300);
    assert.equal(command[3].includes('203.0.113.20'), false);
    return Response.json({ result: [9, 230] });
  });
  assert.deepEqual(await loginLimit('203.0.113.20'), { allowed: false, retryAfter: 230 });
  assert.equal(calls, 1);
});

test('eighth login is permitted, malformed rate-limit storage fails closed', async t => {
  let result = [8, 0];
  t.mock.method(globalThis, 'fetch', async () => Response.json({ result }));
  assert.deepEqual(await loginLimit('203.0.113.20'), { allowed: true, retryAfter: 1 });
  for (const invalid of [null, [0, 300], [1, -1], ['1', 300], [1, 301]]) {
    result = invalid;
    await assert.rejects(loginLimit('203.0.113.20'), /indisponível/);
  }
});

test('JSON parser accepts bounded objects and rejects malformed shapes and types', async () => {
  assert.deepEqual(await readSmallJson(jsonRequest('{"enabled":false}')), { enabled: false });
  for (const value of ['null', '[]', 'false', '{', '']) await assert.rejects(readSmallJson(jsonRequest(value)), failsWith(400));
  await assert.rejects(readSmallJson(jsonRequest('{}', { 'Content-Type': 'text/plain' })), failsWith(415));
});

test('body limit covers announced, unannounced, chunked and multibyte payloads', async () => {
  await assert.rejects(readSmallJson(jsonRequest('{}', { 'Content-Length': '4096' })), failsWith(413));
  await assert.rejects(readSmallJson(jsonRequest(JSON.stringify({ value: 'x'.repeat(1100) }))), failsWith(413));
  await assert.rejects(readSmallJson(jsonRequest(JSON.stringify({ value: 'ã'.repeat(600) }))), failsWith(413));
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(600)); controller.enqueue(new Uint8Array(600)); controller.close(); } });
  const request = new Request('https://app.example.test/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' });
  await assert.rejects(readSmallJson(request), failsWith(413));
});

test('DevTools rejects denied writes instead of confirming success', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Não foi possível salvar' }, { status: 503 }));
  await assert.rejects(saveAdsState(true), failsWith(503));
});

test('DevTools identifies an expired session and rejects a mismatched saved state', async t => {
  let response = Response.json({ error: 'Acesso negado' }, { status: 403 });
  t.mock.method(globalThis, 'fetch', async () => response);
  await assert.rejects(fetchAdsState(), failsWith(403));
  response = Response.json({ enabled: false });
  await assert.rejects(saveAdsState(true), /não confirmou/);
});

test('DevTools verifies successful writes and propagates invalid/network responses', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ enabled: true }));
  assert.equal(await saveAdsState(true), true);
  fetchMock.mock.mockImplementation(async () => new Response('bad gateway'));
  await assert.rejects(adminRequest('/api/admin/health'), failsWith(502));
  fetchMock.mock.mockImplementation(async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(fetchAdsState(), failsWith(0));
});
