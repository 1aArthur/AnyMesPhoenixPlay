import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/catalog/tmdb/route.ts';

test('TMDB endpoint reports missing server credential without contacting upstream', async () => {
  const before = process.env.TMDB_READ_ACCESS_TOKEN;
  delete process.env.TMDB_READ_ACCESS_TOKEN;
  try {
    const response = await GET(new Request('https://example.test/api/catalog/tmdb?type=movie'));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /TMDB_READ_ACCESS_TOKEN/);
  } finally {
    if (before === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
    else process.env.TMDB_READ_ACCESS_TOKEN = before;
  }
});

test('TMDB endpoint rejects malformed IDs before accessing upstream', async () => {
  const before = process.env.TMDB_READ_ACCESS_TOKEN;
  process.env.TMDB_READ_ACCESS_TOKEN = 'test-token';
  try {
    const response = await GET(new Request('https://example.test/api/catalog/tmdb?type=tv&id=1%2Fwatch%2Fproviders'));
    assert.equal(response.status, 400);
  } finally {
    if (before === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
    else process.env.TMDB_READ_ACCESS_TOKEN = before;
  }
});
