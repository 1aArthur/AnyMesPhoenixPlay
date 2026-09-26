'use strict';
// Small pure helpers shared by the browser player and its regression tests.
(function (scope) {
  function youtubeId(address) {
    if (typeof address !== 'string') return null;
    try {
      const url = new URL(address);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      const host = url.hostname.toLowerCase();
      let candidate = null;
      if (host === 'youtu.be' && /^\/[\w-]{11}\/?$/.test(url.pathname)) {
        candidate = url.pathname.slice(1, 12);
      } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
        if (url.pathname === '/watch') candidate = url.searchParams.get('v');
        else if (/^\/embed\/[\w-]{11}\/?$/.test(url.pathname)) candidate = url.pathname.split('/')[2];
      }
      return /^[A-Za-z0-9_-]{11}$/.test(candidate || '') ? candidate : null;
    } catch { return null; }
  }

  function availableEpisodes(entries) {
    if (!Array.isArray(entries)) return [];
    const known = new Set();
    return entries.slice(0, 100).flatMap(entry => {
      const id = youtubeId(entry?.url);
      if (!id || known.has(id)) return [];
      known.add(id);
      const title = String(entry?.title || 'Vídeo').trim().slice(0, 120) || 'Vídeo';
      return [{ id, title }];
    }).slice(0, 40);
  }

  function resumeKey(file) {
    if (!file || typeof file.name !== 'string' || !Number.isSafeInteger(file.size) ||
        !Number.isSafeInteger(file.lastModified) || file.size < 0 || file.lastModified < 0) return null;
    return 'ampp:resume:' + file.size + ':' + file.lastModified + ':' + file.name.slice(0, 160);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` :
      `${minutes}:${String(total % 60).padStart(2, '0')}`;
  }

  function subtitleLanguage(name) {
    const value = String(name || '').toLowerCase();
    if (/(?:^|[._-])(?:pt(?:-br)?|portugues|português)(?:[._-]|$)/.test(value)) return { code: 'pt-BR', label: 'Português (Brasil)' };
    if (/(?:^|[._-])(?:en(?:-us|-gb)?|eng|english|ingles|inglês)(?:[._-]|$)/.test(value)) return { code: 'en', label: 'English' };
    return { code: 'und', label: 'Legenda importada' };
  }

  const api = { youtubeId, availableEpisodes, resumeKey, formatTime, subtitleLanguage };
  scope.AMPPPlayerCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
