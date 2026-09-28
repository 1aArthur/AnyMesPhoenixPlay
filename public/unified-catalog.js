'use strict';
(() => {
  const search = document.querySelector('#search');
  const cards = document.querySelector('#cards');
  const status = document.querySelector('#status');
  if (!search || !cards || !status) return;
  let timer = 0;
  let controller = null;
  let active = false;

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const poster = value => /^https:\/\//.test(String(value || '')) ? value : '';

  function setActive(value) {
    active = value;
    document.body.classList.toggle('unified-search-active', value);
  }

  function card(item) {
    const button = document.createElement('button');
    button.className = 'card unified-card';
    button.type = 'button';
    button.setAttribute('aria-label', `Abrir ${item.title}`);
    const image = poster(item.poster);
    button.innerHTML = `<div class="poster">${image ? `<img src="${esc(image)}" loading="lazy" alt="Capa de ${esc(item.title)}">` : ''}${item.rating ? `<span class="rating">★ ${esc(item.rating)}</span>` : ''}</div><h3>${esc(item.title)}</h3><p>${esc(item.year || 'Ano indisponível')} · ${item.kind === 'tv' ? 'Série' : item.kind === 'movie' ? 'Filme' : esc(item.format || 'Anime')}</p><small class="unified-source">${esc(item.source)}</small>`;
    button.addEventListener('click', () => open(item));
    return button;
  }

  async function open(item) {
    if (item.kind === 'anime' && item.source === 'anilist' && typeof window.openDetail === 'function') {
      window.openDetail(Number(item.id));
      return;
    }
    const dialog = document.querySelector('#detailDialog');
    const content = document.querySelector('#detailContent');
    if (!dialog || !content) return;
    dialog.showModal();
    content.textContent = 'Carregando detalhes...';
    if (item.kind === 'anime') {
      content.innerHTML = `<div class="detail-head"><div>${item.poster ? `<img src="${esc(item.poster)}" alt="Capa de ${esc(item.title)}">` : ''}</div><div><div class="eyebrow small">ANYMES / ${esc(item.source.toUpperCase())}</div><h2>${esc(item.title)}</h2><p class="small-note">${esc(item.year || 'Ano indisponível')} · ${esc(item.format || 'Anime')}</p></div></div><p class="detail-desc">${esc(item.description || 'Sinopse não disponível.')}</p><p class="small-note">Esta fonte fornece dados de catálogo. A reprodução no AnyMes usa apenas embeds/fontes que autorizem incorporação.</p>`;
      return;
    }
    const type = item.kind === 'tv' ? 'tv' : 'movie';
    try {
      const response = await fetch(`/api/catalog/tmdb?type=${type}&id=${encodeURIComponent(String(item.id).split(':').pop())}`);
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Detalhes indisponíveis.');
      const actions = [];
      if (Array.isArray(data.trailers) && data.trailers.length) actions.push(`<button class="primary" id="unifiedTrailer">▶ Trailer autorizado</button>`);
      if (data.providerUrl) actions.push(`<a class="secondary" href="${esc(data.providerUrl)}" target="_blank" rel="noopener noreferrer">Onde assistir ↗</a>`);
      content.innerHTML = `<div class="detail-head"><div>${data.poster ? `<img src="${esc(data.poster)}" alt="Capa de ${esc(data.title)}">` : ''}</div><div><div class="eyebrow small">ANYMES / ${type === 'tv' ? 'SÉRIE' : 'FILME'}</div><h2>${esc(data.title)}</h2><p class="small-note">${esc(data.year || 'Ano indisponível')}</p><div class="screen-actions">${actions.join('')}</div></div></div><p class="detail-desc">${esc(data.overview || 'Sinopse não disponível.')}</p><p class="small-note">Disponibilidade e reprodução completa dependem das plataformas que oferecem o título na sua região.</p>`;
      document.querySelector('#unifiedTrailer')?.addEventListener('click', () => window.AMPPPlayer?.openPage({anime:data.title,entries:data.trailers,index:0}));
    } catch (error) { content.textContent = error.message || 'Falha ao carregar detalhes.'; }
  }

  async function load() {
    controller?.abort();
    controller = new AbortController();
    const query = search.value.trim();
    if (query.length < 2) {
      setActive(false);
      status.textContent = '';
      return;
    }
    setActive(true);
    status.textContent = 'Pesquisando em AniList, Kitsu, AniLiberty/Kitsune e TMDB...';
    cards.replaceChildren();
    try {
      const response = await fetch('/api/catalog/unified?q=' + encodeURIComponent(query), {signal:controller.signal});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Falha na pesquisa unificada.');
      const items = Array.isArray(data.items) ? data.items : [];
      items.forEach(item => cards.append(card(item)));
      status.textContent = items.length ? `${items.length} resultados · ${data.sources.join(' · ')}` : 'Nenhum título encontrado.';
    } catch (error) {
      if (error.name === 'AbortError') return;
      status.textContent = error.message || 'Falha na pesquisa.';
    }
  }

  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(load, 280);
  }, true);

  window.addEventListener('anymes:view', event => {
    if (event.detail.view === 'discover') return;
    setActive(false);
  });
})();
