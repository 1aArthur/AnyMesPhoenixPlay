'use strict';
(() => {
  const core = window.AMPPPlayerCore;
  const dialog = document.querySelector('#watchDialog');
  const video = document.querySelector('#localVideo');
  if (!core || !dialog || !video) return;

  const watchFrame = document.querySelector('#watchFrame');
  const watchList = document.querySelector('#watchList');
  const watchTitle = document.querySelector('#watchTitle');
  const watchEpisode = document.querySelector('#watchEpisode');
  const watchStatus = document.querySelector('#watchStatus');
  const watchExternal = document.querySelector('#watchExternal');
  const previous = document.querySelector('#watchPrevious');
  const next = document.querySelector('#watchNext');
  let episodes = [];
  let position = 0;

  function selectEpisode(index) {
    if (!episodes[index]) return;
    position = index;
    const item = episodes[index];
    watchEpisode.textContent = item.title;
    watchFrame.title = 'YouTube: ' + item.title;
    watchFrame.src = 'https://www.youtube-nocookie.com/embed/' + item.id + '?playsinline=1&rel=0';
    watchExternal.href = 'https://www.youtube.com/watch?v=' + item.id;
    watchStatus.textContent = 'Reprodução pelo YouTube. Legendas, idioma e velocidade dependem das opções do vídeo.';
    previous.disabled = index === 0;
    next.disabled = index === episodes.length - 1;
    [...watchList.children].forEach((row, offset) => {
      row.querySelector('button').setAttribute('aria-current', offset === index ? 'true' : 'false');
    });
  }

  function open({ anime, entries, index = 0 }) {
    const choices = core.availableEpisodes(entries);
    if (!choices.length) return false;
    video.pause();
    episodes = choices;
    watchTitle.textContent = String(anime || 'Anime').slice(0, 140);
    watchList.replaceChildren();
    choices.forEach((item, number) => {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'watch-choice';
      button.textContent = `${number + 1}. ${item.title}`;
      button.addEventListener('click', () => selectEpisode(number));
      row.append(button);
      watchList.append(row);
    });
    if (!dialog.open) dialog.showModal();
    selectEpisode(Math.max(0, Math.min(Number(index) || 0, choices.length - 1)));
    return true;
  }

  function openPage({ anime, entries, index = 0 }) {
    const url = core.watchPageUrl(anime, entries, index);
    if (!url) return false;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
    return true;
  }

  previous.addEventListener('click', () => selectEpisode(position - 1));
  next.addEventListener('click', () => selectEpisode(position + 1));
  dialog.addEventListener('close', () => {
    watchFrame.removeAttribute('src'); // Stop sound, buffering and background playback.
    episodes = [];
    watchList.replaceChildren();
  });
  document.querySelector('#watchFullscreen').addEventListener('click', async () => {
    const stage = document.querySelector('#watchStage');
    try {
      if (!document.fullscreenElement) await stage.requestFullscreen();
      else await document.exitFullscreen();
    } catch { watchStatus.textContent = 'Tela cheia indisponível neste navegador.'; }
  });

  let mediaUrl = null;
  let captionUrls = [];
  let progressKey = null;
  let lastSavedAt = 0;
  const libraryDialog = document.querySelector('#libraryDialog');
  const resume = document.querySelector('#resumeLocal');
  const progress = document.querySelector('#videoProgress');
  const timing = document.querySelector('#videoTime');
  const subtitleSelect = document.querySelector('#subtitleTracks');
  const subtitleStatus = document.querySelector('#subtitleStatus');
  const videoStatus = document.querySelector('#videoStatus');

  function saveProgress(force = false) {
    if (!progressKey || !Number.isFinite(video.duration) || video.duration <= 0 || !Number.isFinite(video.currentTime)) return;
    const now = Date.now();
    if (!force && now - lastSavedAt < 5000) return;
    lastSavedAt = now;
    try {
      if (video.currentTime < 10 || video.duration - video.currentTime < 15) localStorage.removeItem(progressKey);
      else localStorage.setItem(progressKey, JSON.stringify({ at: Math.floor(video.currentTime), updatedAt: now }));
    } catch { /* Storage can be disabled or full; playback still works. */ }
  }

  function releaseSubtitles() {
    for (const track of video.querySelectorAll('track')) track.remove();
    for (const url of captionUrls) URL.revokeObjectURL(url);
    captionUrls = [];
    subtitleSelect.replaceChildren(new Option('Desligada', 'off'));
    subtitleStatus.textContent = 'Legenda: sem arquivo';
  }

  function setLocalFile(file) {
    if (!(file instanceof File) || !(file.type.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/i.test(file.name))) return false;
    video.pause();
    const oldUrl = mediaUrl;
    mediaUrl = URL.createObjectURL(file);
    video.src = mediaUrl;
    video.load();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    progressKey = core.resumeKey(file);
    lastSavedAt = 0;
    resume.hidden = true;
    progress.value = '0';
    timing.textContent = '0:00 / 0:00';
    videoStatus.textContent = 'Arquivo local: ' + file.name;
    const download = document.querySelector('#downloadLocal');
    download.href = mediaUrl;
    download.download = file.name;
    download.hidden = false;
    releaseSubtitles();
    return true;
  }

  function setSubtitles(files) {
    releaseSubtitles();
    const chosen = [...files].filter(file => file instanceof File && /\.vtt$/i.test(file.name) && file.size <= 2 * 1024 * 1024).slice(0, 8);
    for (const file of chosen) {
      const url = URL.createObjectURL(file);
      captionUrls.push(url);
      const language = core.subtitleLanguage(file.name);
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = `${language.label} · ${file.name}`;
      track.srclang = language.code;
      track.src = url;
      video.append(track);
      subtitleSelect.append(new Option(track.label, String(captionUrls.length - 1)));
    }
    subtitleStatus.textContent = chosen.length ? `${chosen.length} legenda(s) VTT disponível(is)` : 'Nenhuma legenda VTT válida (até 2 MB por arquivo).';
  }

  document.querySelector('#videoFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file && !setLocalFile(file)) videoStatus.textContent = 'Selecione um arquivo de vídeo compatível com seu navegador.';
    event.target.value = '';
  });
  document.querySelector('#subtitleFile').addEventListener('change', event => {
    if (event.target.files?.length) setSubtitles(event.target.files);
    event.target.value = '';
  });
  subtitleSelect.addEventListener('change', () => {
    [...video.textTracks].forEach((track, index) => { track.mode = String(index) === subtitleSelect.value ? 'showing' : 'disabled'; });
  });
  document.querySelector('#playbackSpeed').addEventListener('change', event => { video.playbackRate = Number(event.target.value); });
  document.querySelector('#seekBack').addEventListener('click', () => { if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.currentTime - 10); });
  document.querySelector('#seekForward').addEventListener('click', () => { if (Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10); });
  progress.addEventListener('input', () => { if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration * Number(progress.value) / 100; });
  document.querySelector('#videoFullscreen').addEventListener('click', async () => {
    try { if (!document.fullscreenElement) await video.requestFullscreen(); else await document.exitFullscreen(); }
    catch { videoStatus.textContent = 'Tela cheia indisponível neste navegador.'; }
  });
  const pip = document.querySelector('#videoPip');
  pip.disabled = !document.pictureInPictureEnabled || !video.requestPictureInPicture;
  pip.addEventListener('click', async () => {
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); }
    catch { videoStatus.textContent = 'Janela flutuante indisponível neste navegador.'; }
  });
  document.querySelector('#videoTheater').addEventListener('click', () => libraryDialog.classList.toggle('theater'));
  video.addEventListener('loadedmetadata', () => {
    if (!progressKey || !Number.isFinite(video.duration)) return;
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey) || 'null');
      if (saved && Number.isFinite(saved.at) && saved.at >= 15 && saved.at < video.duration - 15 &&
          Number.isFinite(saved.updatedAt) && Date.now() - saved.updatedAt < 90 * 86400000) {
        resume.textContent = 'Continuar em ' + core.formatTime(saved.at);
        resume.hidden = false;
        resume.onclick = () => { video.currentTime = saved.at; resume.hidden = true; void video.play().catch(() => {}); };
      }
    } catch { /* Corrupt local state never blocks playback. */ }
  });
  video.addEventListener('timeupdate', () => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      progress.value = String(Math.round(video.currentTime / video.duration * 100));
      timing.textContent = core.formatTime(video.currentTime) + ' / ' + core.formatTime(video.duration);
      saveProgress();
    }
  });
  video.addEventListener('pause', () => saveProgress(true));
  video.addEventListener('ended', () => { if (progressKey) try { localStorage.removeItem(progressKey); } catch {} });
  video.addEventListener('error', () => { videoStatus.textContent = 'O navegador não conseguiu reproduzir este formato de vídeo.'; });
  window.addEventListener('pagehide', () => saveProgress(true));
  libraryDialog.addEventListener('close', () => { video.pause(); saveProgress(true); });
  window.AMPPPlayer = { open, openPage, setLocalFile, setSubtitles };
})();
