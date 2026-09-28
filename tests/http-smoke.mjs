// Run via `npm run test:http` after a production build. No external services or real secrets.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const base = 'http://127.0.0.1:3100';
const env = { ...process.env };
for (const key of ['ADMIN_ACCESS_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) env[key] = '';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local server did not become ready')), 15000);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Local server exited: ${code}`)); });
    server.stdout.on('data', data => { if (data.toString().includes('Ready')) { clearTimeout(timeout); resolve(); } });
  });
  const site = await fetch(base + '/site.html');
  assert.equal(site.status, 200);
  const markup = await site.text();
  assert.match(markup, /id=\"watchDialog\"/);
  assert.match(markup, /data-sort=\"POPULARITY_DESC\"/);
  assert.match(markup, /data-sort=\"SCORE_DESC\"/);
  assert.match(markup, /id=\"subtitleTracks\"/);
  assert.match(markup, /src=\"\.\/anime-player-core\.js\"[\s\S]*src=\"\.\/anime-player\.js\"/);
  for (const resource of ['/anime-player-core.js', '/anime-player.js']) {
    const asset = await fetch(base + resource);
    assert.equal(asset.status, 200, resource);
    assert.match(asset.headers.get('content-type') || '', /javascript/, resource);
  }
  assert.match(site.headers.get('content-security-policy') || '', /script-src 'self'/);
  assert.match(site.headers.get('content-security-policy') || '', /frame-src https:\/\/www.youtube-nocookie.com/);
  const watch = await fetch(base + '/watch.html');
  assert.equal(watch.status, 200);
  const watchHtml = await watch.text();
  assert.match(watchHtml, /id="cloudFrame"/);
  assert.match(watchHtml, /id="personalVideo"/);
  assert.match(watch.headers.get('content-security-policy') || '', /frame-src https:\/\/www.youtube-nocookie.com/);
  assert.equal(watch.headers.get('x-robots-tag'), 'noindex, nofollow');
  for (const resource of ['/watch-app.js', '/watch.css']) assert.equal((await fetch(base + resource)).status, 200, resource);
  assert.equal(site.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(site.headers.get('x-frame-options'), 'DENY');
  assert.equal(site.headers.get('x-powered-by'), null);
  console.log('PASS static catalog security headers');
  const cases = [
    ['/api/admin/ads', {}, 403],
    ['/api/admin/ads', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{"enabled":true}' }, 403],
    ['/api/admin/health', {}, 403],
    ['/api/admin/logout', { method: 'POST', headers: { Origin: base } }, 403],
    ['/api/admin/login', { method: 'POST', headers: { Origin: 'https://foreign.example.test', 'Content-Type': 'application/json' }, body: '{}' }, 403],
    ['/api/admin/login', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' }, 503],
    ['/api/ads', {}, 503],
    ['/api/catalog/kitsu/episodes?id=invalid', {}, 400],
  ];
  for (const [path, options, status] of cases) {
    const response = await fetch(base + path, options);
    assert.equal(response.status, status, path);
    if (path.includes('/admin/')) assert.match(response.headers.get('cache-control') || '', /no-store/, path);
    const body = await response.json();
    if (path === '/api/ads') assert.equal(body.enabled, false);
    console.log(`PASS ${options.method || 'GET'} ${path}: ${status}`);
  }
  const dev = await fetch(base + '/dev');
  assert.equal(dev.status, 200);
  assert.equal(dev.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await dev.text(), /AnyMesPhoenixPlay \/ DevTools/);
  console.log('PASS /dev rendered and noindex');
  const redirect = await fetch(base + '/admin', { redirect: 'manual' });
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get('location'), '/dev');
  console.log('PASS /admin redirects to /dev');
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
}
