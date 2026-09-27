'use strict';
(() => {
  const core = window.AMPPPlayerCore;
  if (!core) return;
  const get = id => document.getElementById(id);
  const frame = get('cloudFrame'), video = get('personalVideo'), empty = get('emptyStage');
  const list = get('episodes'), previous = get('previous'), next = get('next');
  const status = get('playerMessage'), caption = get('caption'), source = get('openSource');
  let entries = [], index = 0, mediaUrl = null, captionUrls = [], progressKey = null, savedAt = 0, pageTitle = 'Seu espaço de assistir.';

  function start(listOfVideos, selected) {
    entries = listOfVideos;
    list.replaceChildren();
    entries.forEach((item, n) => {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = `${n + 1}. ${item.title}`;
      button.onclick = () => play(n);
      row.append(button); list.append(row);
    });
    get('count').textContent = `${entries.length} vídeo${entries.length === 1 ? '' : 's'}`;
    if (entries.length) play(selected);
  }

  function play(number) {
    if (!entries[number]) return;
    index = number;
    video.pause(); video.hidden = true;
    get('localControls').hidden = true; get('pip').hidden = true;
    frame.hidden = false; empty.hidden = true;
    get('featureTitle').textContent = pageTitle;
    frame.title = 'YouTube: ' + entries[number].title;
    frame.src = `https://www.youtube-nocookie.com/embed/${entries[number].id}?playsinline=1&rel=0`;
    source.href = `https://www.youtube.com/watch?v=${entries[number].id}`;
    source.hidden = false;
    get('sourcePill').textContent = '● VÍDEO INCORPORADO';
    get('nowPlaying').textContent = entries[number].title;
    get('featureSubtitle').textContent = entries[number].title;
    status.textContent = 'Vídeo hospedado pelo YouTube. Qualidade, legendas e anúncios seguem as opções da plataforma.';
    previous.disabled = number === 0; next.disabled = number === entries.length - 1;
    [...list.querySelectorAll('button')].forEach((button, n) => button.setAttribute('aria-current', String(n === number)));
  }

  function releaseCaptions() {
    video.querySelectorAll('track').forEach(track => track.remove());
    captionUrls.forEach(url => URL.revokeObjectURL(url)); captionUrls = [];
    caption.replaceChildren(new Option('Desligada', 'off'));
  }

  function saveProgress(force = false) {
    if (!progressKey || !Number.isFinite(video.duration) || !Number.isFinite(video.currentTime)) return;
    if (!force && Date.now() - savedAt < 5000) return;
    savedAt = Date.now();
    try {
      if (video.currentTime < 10 || video.duration - video.currentTime < 15) localStorage.removeItem(progressKey);
      else localStorage.setItem(progressKey, JSON.stringify({ at: Math.floor(video.currentTime), updatedAt: savedAt }));
    } catch { /* Storage is optional. */ }
  }

  get('videoFile').onchange = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !(file.type.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/i.test(file.name))) {
      status.textContent = 'Selecione um arquivo de vídeo compatível com o seu navegador.'; return;
    }
    saveProgress(true); video.pause(); frame.removeAttribute('src'); frame.hidden = true; empty.hidden = true;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = URL.createObjectURL(file); video.src = mediaUrl; video.load(); video.hidden = false;
    progressKey = core.resumeKey(file); savedAt = 0;
    releaseCaptions(); get('resume').hidden = true;
    get('localControls').hidden = false;
    get('pip').hidden = !document.pictureInPictureEnabled || !video.requestPictureInPicture;
    source.hidden = true; previous.disabled = true; next.disabled = true;
    [...list.querySelectorAll('button')].forEach(button => button.setAttribute('aria-current', 'false'));
    get('sourcePill').textContent = '● ARQUIVO LOCAL';
    get('nowPlaying').textContent = file.name;
    get('featureTitle').textContent = file.name.slice(0, 140);
    get('featureSubtitle').textContent = 'Reprodução privada, diretamente no navegador.';
    status.textContent = 'Este arquivo permanece no seu dispositivo. A qualidade depende do arquivo e dos formatos aceitos pelo navegador.';
  };

  get('captionFile').onchange = event => {
    releaseCaptions();
    const files = [...(event.target.files || [])].filter(file => /\.vtt$/i.test(file.name) && file.size <= 2 * 1024 * 1024).slice(0, 8);
    event.target.value = '';
    if (video.hidden) { status.textContent = 'Abra primeiro um vídeo local para adicionar legendas.'; return; }
    files.forEach(file => {
      const url = URL.createObjectURL(file); captionUrls.push(url);
      const language = core.subtitleLanguage(file.name);
      const track = document.createElement('track');
      track.kind = 'subtitles'; track.label = `${language.label} · ${file.name}`;
      track.srclang = language.code; track.src = url;
      video.append(track); caption.append(new Option(track.label, String(captionUrls.length - 1)));
    });
    status.textContent = files.length ? `${files.length} legenda(s) VTT adicionada(s).` : 'Nenhuma legenda VTT válida (limite de 2 MB por arquivo).';
  };

  caption.onchange = () => [...video.textTracks].forEach((track, n) => { track.mode = String(n) === caption.value ? 'showing' : 'disabled'; });
  get('speed').onchange = event => { video.playbackRate = Number(event.target.value); };
  get('back10').onclick = () => { if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.currentTime - 10); };
  get('forward10').onclick = () => { if (Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10); };
  get('seek').oninput = event => { if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration * Number(event.target.value) / 100; };
  video.onloadedmetadata = () => {
    if (!progressKey || !Number.isFinite(video.duration)) return;
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey) || 'null');
      if (saved && Number.isFinite(saved.at) && saved.at >= 15 && saved.at < video.duration - 15 &&
          Number.isFinite(saved.updatedAt) && Date.now() - saved.updatedAt < 90 * 86400000) {
        get('resume').textContent = 'Continuar em ' + core.formatTime(saved.at);
        get('resume').hidden = false;
        get('resume').onclick = () => { video.currentTime = saved.at; get('resume').hidden = true; void video.play().catch(() => {}); };
      }
    } catch { /* Ignore invalid local state. */ }
  };
  video.ontimeupdate = () => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      get('seek').value = String(Math.round(video.currentTime / video.duration * 100));
      get('timing').textContent = core.formatTime(video.currentTime) + ' / ' + core.formatTime(video.duration);
      saveProgress();
    }
  };
  video.onpause = () => saveProgress(true);
  video.onended = () => { if (progressKey) try { localStorage.removeItem(progressKey); } catch {} };
  video.onerror = () => { status.textContent = 'O navegador não conseguiu reproduzir este formato de vídeo.'; };
  previous.onclick = () => play(index - 1);
  next.onclick = () => play(index + 1);
  get('fullscreen').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await get('stage').requestFullscreen(); }
    catch { status.textContent = 'Tela cheia indisponível neste navegador.'; }
  };
  get('pip').onclick = async () => {
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); }
    catch { status.textContent = 'Janela flutuante indisponível neste navegador.'; }
  };
  document.addEventListener('keydown', event => {
    if (video.hidden || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); if (video.paused) void video.play().catch(() => {}); else video.pause(); }
    if (event.code === 'ArrowLeft') { event.preventDefault(); get('back10').click(); }
    if (event.code === 'ArrowRight') { event.preventDefault(); get('forward10').click(); }
  });
  window.addEventListener('pagehide', () => { saveProgress(true); frame.removeAttribute('src'); if (mediaUrl) URL.revokeObjectURL(mediaUrl); releaseCaptions(); });

  if (window.location.search.length <= 14000) {
    const params = new URLSearchParams(window.location.search);
    const ids = (params.get('v') || '').split(',').slice(0, 20);
    let titles = [];
    try { const parsed = JSON.parse(params.get('e') || '[]'); if (Array.isArray(parsed)) titles = parsed; } catch {}
    const chosen = ids.flatMap((id, n) => /^[A-Za-z0-9_-]{11}$/.test(id) ? [{ id, title: String(titles[n] || `Vídeo ${n + 1}`).slice(0, 120) }] : []);
    pageTitle = String(params.get('t') || 'Seu espaço de assistir.').slice(0, 140);
    get('featureTitle').textContent = pageTitle;
    document.title = `${pageTitle} · AnyMesPhoenixPlay Cinema`;
    start(chosen, Math.max(0, Math.min(Number.parseInt(params.get('i') || '0', 10) || 0, chosen.length - 1)));
  }
})();
