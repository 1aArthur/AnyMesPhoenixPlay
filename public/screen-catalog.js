'use strict';
(() => {
  const section = document.querySelector('#screenCatalog');
  const cards = document.querySelector('#screenCards');
  const status = document.querySelector('#screenStatus');
  const search = document.querySelector('#search');
  const more = document.querySelector('#screenMore');
  let type = 'movie', page = 1, query = '', hasMore = false, controller, debounce;
  function node(tag, className, value) { const n = document.createElement(tag); if (className) n.className = className; if (value) n.textContent = value; return n; }
  function link(text, href) { const a = node('a', 'secondary', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
  async function load(append = false) {
    controller?.abort(); const active = new AbortController(); controller = active;
    status.textContent = append ? 'Carregando mais...' : 'Buscando títulos...'; more.hidden = true;
    if (!append) cards.replaceChildren();
    try {
      const params = new URLSearchParams({ type, page: String(page), q: query });
      const response = await fetch('/api/catalog/tmdb?' + params, { signal: active.signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Falha ao carregar títulos.');
      if (controller !== active || section.hidden) return;
      for (const item of data.items || []) {
        const button = node('button', 'card'); button.type = 'button';
        button.setAttribute('aria-label', `Ver ${item.title}`);
        const poster = node('div', 'poster');
        if (item.poster) { const img = node('img'); img.src = item.poster; img.loading = 'lazy'; img.alt = `Capa de ${item.title}`; poster.append(img); }
        if (item.rating) poster.append(node('span', 'rating', `★ ${Number(item.rating).toFixed(1)}`));
        button.append(poster, node('h3', '', item.title), node('p', '', `${item.year || 'Ano indisponível'} · ${type === 'tv' ? 'Série' : 'Filme'}`));
        button.onclick = () => openDetail(item.id, type);
        cards.append(button);
      }
      hasMore = data.hasMore === true; more.hidden = !hasMore;
      status.textContent = cards.childElementCount ? '' : 'Nenhum título encontrado.';
    } catch (error) { if (error.name !== 'AbortError') { status.textContent = error.message; if (append) page--; if (!append) { const fallback = link('Pesquisar no IMDb ↗', 'https://www.imdb.com/find/?q=' + encodeURIComponent(query || (type === 'tv' ? 'series' : 'movies'))); fallback.className = 'secondary'; cards.append(fallback); } } }
  }
  async function openDetail(id, requestedType) {
    const dialog = document.querySelector('#detailDialog');
    const content = document.querySelector('#detailContent');
    content.textContent = 'Carregando detalhes...'; dialog.showModal();
    try {
      const response = await fetch(`/api/catalog/tmdb?type=${requestedType}&id=${encodeURIComponent(id)}`);
      const m = await response.json();
      if (!response.ok) throw Error(m.error || 'Detalhes indisponíveis.');
      if (!dialog.open) return;
      content.replaceChildren();
      const head = node('div', 'detail-head');
      const poster = m.poster ? node('img') : node('div');
      if (m.poster) { poster.src = m.poster; poster.alt = `Capa de ${m.title}`; }
      const info = node('div'); info.append(node('div', 'eyebrow small', `ANYMES / ${requestedType === 'tv' ? 'SÉRIE' : 'FILME'}`), node('h2', '', m.title), node('p', 'small-note', m.year));
      const actions = node('div', 'screen-actions');
      if (m.trailers?.length) { const play = node('button', 'primary', '▶ Assistir ao trailer'); play.onclick = () => window.AMPPPlayer?.open({ anime: m.title, entries: m.trailers, index: 0 }); actions.append(play); }
      if (m.providerUrl) actions.append(link('Onde assistir ↗', m.providerUrl));
      if (m.imdbId) actions.append(link('IMDb ↗', `https://www.imdb.com/title/${m.imdbId}/`));
      else actions.append(link('Buscar no IMDb ↗', `https://www.imdb.com/find/?q=${encodeURIComponent(m.title)}`));
      actions.append(link('Abrir app Seekee ↗', 'https://play.google.com/store/apps/details?id=com.enzo.paulo'));
      info.append(actions); head.append(poster, info); content.append(head);
      content.append(node('p', 'detail-desc', m.overview || 'Sinopse não disponível.'));
      const provider = node('p', 'small-note', m.providers?.length ? `Disponível por assinatura no Brasil: ${m.providers.join(', ')}. Confirme a oferta na plataforma.` : 'Nenhuma opção de assinatura informada para o Brasil. Consulte as plataformas disponíveis.'); content.append(provider);
      content.append(node('p', 'small-note', 'O player reproduz apenas trailers autorizados. Para filmes e episódios completos, acesse o serviço disponível com sua própria conta. O Seekee abre no aplicativo, sem compartilhar sua senha.'));
    } catch (error) { if (dialog.open) content.textContent = error.message || 'Falha ao carregar detalhes.'; }
  }
  window.addEventListener('anymes:view', event => {
    if (event.detail.view !== 'movie' && event.detail.view !== 'tv') { controller?.abort(); return; }
    type = event.detail.view; query = ''; page = 1;
    document.querySelector('#screenTitle').textContent = type === 'movie' ? 'Filmes' : 'Séries';
    load();
  });
  search.addEventListener('input', () => {
    if (section.hidden) return;
    clearTimeout(debounce); query = search.value.trim(); page = 1;
    debounce = setTimeout(() => load(), 350);
  });
  more.onclick = () => { if (hasMore && !section.hidden) { page++; load(true); } };
  document.querySelector('#screenRefresh').onclick = () => { page = 1; load(); };
})();
