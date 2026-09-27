import { test } from 'node:test';
import assert from 'node:assert/strict';
import player from '../public/anime-player-core.js';

test('YouTube sources are validated before any embed is constructed', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=Abc_123-xyz',
    'https://m.youtube.com/watch?v=Abc_123-xyz&list=something',
    'https://www.youtube.com/embed/Abc_123-xyz',
    'https://youtu.be/Abc_123-xyz',
  ]) assert.equal(player.youtubeId(url), 'Abc_123-xyz');
  for (const url of [
    'http://www.youtube.com/watch?v=Abc_123-xyz',
    'https://youtube.com.evil.test/watch?v=Abc_123-xyz',
    'https://evil.test/@youtube.com/watch?v=Abc_123-xyz',
    'https://foo@youtube.com/watch?v=Abc_123-xyz',
    'https://youtu.be/not-an-id',
    'https://youtube.com/redirect?q=https://youtu.be/Abc_123-xyz',
    'javascript:alert(1)',
    null,
  ]) assert.equal(player.youtubeId(url), null, String(url));
});

test('episode list removes invalid and duplicate videos, caps count and bounds labels', () => {
  const entries = [{ url: 'https://youtu.be/Abc_123-xyz', title: '<img onerror=alert(1)>' },
    { url: 'https://www.youtube.com/watch?v=Abc_123-xyz', title: 'duplicado' },
    { url: 'https://bad.example.test/video', title: 'inválido' }];
  assert.deepEqual(player.availableEpisodes(entries), [{ id: 'Abc_123-xyz', title: '<img onerror=alert(1)>' }]);
  assert.deepEqual(player.availableEpisodes(null), []);
  const many = Array.from({ length: 110 }, (_, i) => ({ url: `https://youtu.be/${String(i).padStart(11, '0')}`, title: 'X'.repeat(400) }));
  assert.equal(player.availableEpisodes(many).length, 40);
  assert.equal(player.availableEpisodes(many)[0].title.length, 120);
});

test('resume uses file identity and rejects malformed file metadata', () => {
  const a = { name: 'anime.mp4', size: 12000, lastModified: 1720000000000 };
  assert.equal(player.resumeKey(a), player.resumeKey({ ...a }));
  assert.notEqual(player.resumeKey(a), player.resumeKey({ ...a, size: 12001 }));
  assert.equal(player.resumeKey({ ...a, size: Number.POSITIVE_INFINITY }), null);
  assert.equal(player.resumeKey({ ...a, lastModified: -1 }), null);
});

test('watch page receives only validated YouTube IDs, bounded titles and episode index', () => {
  assert.equal(player.watchPageUrl('X', [{ url: 'https://evil.example/watch?v=Abc_123-xyz' }]), null);
  const url = new URL(player.watchPageUrl('A'.repeat(300), [
    { url: 'https://youtu.be/Abc_123-xyz', title: 'Episódio 1' },
    { url: 'https://www.youtube.com/watch?v=123456789ab', title: 'Episódio 2' },
    { url: 'https://evil.example/watch?v=123456789ab', title: 'Outro' },
  ], 300), 'https://example.test');
  assert.equal(url.pathname, '/watch.html');
  assert.equal(url.searchParams.get('v'), 'Abc_123-xyz,123456789ab');
  assert.deepEqual(JSON.parse(url.searchParams.get('e')), ['Episódio 1', 'Episódio 2']);
  assert.equal(url.searchParams.get('i'), '1');
  assert.equal(url.searchParams.get('t').length, 140);
});

test('time and caption languages are displayed consistently', () => {
  assert.equal(player.formatTime(65.9), '1:05');
  assert.equal(player.formatTime(3661), '1:01:01');
  assert.equal(player.formatTime(Infinity), '0:00');
  assert.equal(player.subtitleLanguage('video.pt-BR.vtt').code, 'pt-BR');
  assert.equal(player.subtitleLanguage('video.en-US.vtt').code, 'en');
  assert.equal(player.subtitleLanguage('video.vtt').code, 'und');
});
