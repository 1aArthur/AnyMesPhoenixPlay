'use strict';
// Owner-only UI commands. Every server mutation still requires the HttpOnly session cookie.
(() => {
  const form = document.querySelector('#terminalForm');
  const previousInput = document.querySelector('#terminalInput');
  const output = document.querySelector('#terminalLog');
  if (!form || !previousInput || !output) return;
  // The older inline handlers are detached before replacing the terminal behavior.
  form.onsubmit = null;
  const input = previousInput.cloneNode(true);
  previousInput.replaceWith(input);
  const history = [];
  let cursor = 0;
  let pending = false;
  const print = (value) => {
    const entry = document.createElement('div');
    entry.textContent = String(value).replace(/\b\d{20}\b/g, '[oculto]').slice(0, 1600);
    output.append(entry);
    while (output.children.length > 120) output.firstElementChild.remove();
    output.scrollTop = output.scrollHeight;
  };
  const request = async (url, options) => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, signal: AbortSignal.timeout(8000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403) {
        document.querySelector('#adminOpen').hidden = true;
        document.querySelector('#adminAdSetting').hidden = true;
      }
      throw new Error(body.error || `Servidor respondeu ${response.status}`);
    }
    return body;
  };
  const exportFile = (filename, value) => {
    const objectURL = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = objectURL;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  };
  const known = 'help, status, health, ads, theme, catalog, search, genre, page, favorites, storage, music, video, panel, log, clear, logout';
  const commands = {
    help: async (args) => {
      const guide = {
        ads: 'ads status | on | off | refresh — espaço global, sem rede de anúncios',
        catalog: 'catalog anilist | kitsu | refresh — fonte e recarga',
        theme: 'theme show | #RRGGBB | reset — cor local',
        favorites: 'favorites count | export | clear CONFIRMAR — sua lista local',
        storage: 'storage stats — tamanho das preferências locais',
        media: 'music status | stop; video status | stop | speed <0.5..2>',
        navigation: 'search <título>; genre <nome|all>; page next; panel site | dev',
        tools: 'status; health; log export | clear; logout; clear',
      };
      print(args[0] ? (guide[args[0]] || `Tópico desconhecido. Use help.`) : `Comandos: ${known}. Use help <tópico>: ${Object.keys(guide).join(', ')}.`);
    },
    status: async () => {
      const ads = await request('/api/admin/ads');
      print(`Fonte: ${state.source}; página: ${state.page}; títulos: ${state.items.length}; favoritos: ${Object.keys(favorites).length}; espaço global: ${ads.enabled ? 'visível' : 'oculto'}; rede de anúncios: não conectada.`);
    },
    health: async () => {
      const info = await request('/api/admin/health');
      print(`Servidor: ${info.ok ? 'operacional' : 'indisponível'}; armazenamento: ${info.storage}; duração: ${info.latencyMs} ms.`);
    },
    ads: async ([action = 'status']) => {
      if (action === 'status' || action === 'refresh') {
        const data = await request('/api/admin/ads');
        adsEnabled = data.enabled === true;
        document.querySelector('#adToggle').checked = adsEnabled;
        renderAds();
        print(`Espaço global ${adsEnabled ? 'visível' : 'oculto'}. Não há campanhas conectadas.`);
      } else if (action === 'on' || action === 'off') {
        await setGlobalAds(action === 'on');
        print('Alteração salva no servidor para todos os visitantes.');
      } else print('Uso: ads status | on | off | refresh');
    },
    theme: async ([color = 'show']) => {
      if (color === 'show') print(`Cor atual: ${selectedColor}`);
      else if (color === 'reset') { setColor('#ff693a'); print('Cor local restaurada.'); }
      else if (/^#[a-f0-9]{6}$/i.test(color)) { setColor(color); print('Cor local atualizada.'); }
      else print('Uso: theme show | #RRGGBB | reset');
    },
    catalog: async ([action = 'refresh']) => {
      if (!['anilist', 'kitsu', 'refresh'].includes(action)) return print('Uso: catalog anilist | kitsu | refresh');
      if (action !== 'refresh') document.querySelector(`.source-tab[data-source="${action}"]`).click();
      else { state.page = 1; await loadCatalog(); }
      print(`Consulta solicitada: ${state.source}. Confira o estado no catálogo.`);
    },
    search: async (args) => {
      const query = args.join(' ').slice(0, 80);
      document.querySelector('#search').value = query;
      state.search = query;
      state.page = 1;
      setView('discover', false);
      await loadCatalog();
      print(query ? `Busca: ${query}` : 'Busca limpa.');
    },
    genre: async (args) => {
      if (!args.length) return print('Gêneros: all, Action, Adventure, Fantasy, Comedy, Slice of Life, Sci-Fi.');
      const value = args.join(' ').toLowerCase();
      const chip = [...document.querySelectorAll('.chip')].find(el => (el.dataset.genre || 'all').toLowerCase() === value);
      if (!chip) return print('Gênero desconhecido. Use genre para ver a lista.');
      chip.click();
      print(`Filtro: ${chip.textContent.trim()}.`);
    },
    page: async ([action]) => {
      if (action !== 'next') return print('Uso: page next');
      const button = document.querySelector('#loadMore');
      if (button.hidden || state.busy) return print('Não há outra página disponível agora.');
      button.click();
      print('Carregando próxima página...');
    },
    favorites: async ([action = 'count', confirmation]) => {
      if (action === 'count') print(`${Object.keys(favorites).length} favoritos neste navegador.`);
      else if (action === 'export') { exportFile('anymes-favoritos.json', JSON.stringify(Object.values(favorites), null, 2)); print('Lista exportada.'); }
      else if (action === 'clear' && confirmation === 'CONFIRMAR') { favorites = {}; store('anymes-favorites', favorites); if (state.view === 'favorites') renderFavorites(); print('Lista local apagada.'); }
      else print('Uso: favorites count | export | clear CONFIRMAR');
    },
    storage: async ([action = 'stats']) => {
      if (action !== 'stats') return print('Uso: storage stats');
      const bytes = ['anymes-favorites', 'anymes-accent'].reduce((sum, key) => sum + (localStorage.getItem(key) || '').length * 2, 0);
      print(`Preferências locais: aproximadamente ${bytes} bytes. Arquivos de mídia não são enviados nem armazenados no servidor.`);
    },
    music: async ([action = 'status']) => {
      const audio = document.querySelector('#musicAudio');
      if (action === 'status') print(`${songs.length} faixas carregadas; ${audio.paused ? 'pausado' : 'tocando'}.`);
      else if (action === 'stop') { audio.pause(); audio.currentTime = 0; print('Música parada.'); }
      else print('Uso: music status | stop');
    },
    video: async ([action = 'status', speed]) => {
      const video = document.querySelector('#localVideo');
      if (action === 'status') print(`Vídeo ${video.src ? 'aberto' : 'não carregado'}; velocidade ${video.playbackRate}×.`);
      else if (action === 'stop') { video.pause(); video.currentTime = 0; print('Vídeo parado.'); }
      else if (action === 'speed' && Number(speed) >= 0.5 && Number(speed) <= 2) { video.playbackRate = Number(speed); document.querySelector('#playbackSpeed').value = String(speed); print(`Velocidade: ${speed}×.`); }
      else print('Uso: video status | stop | speed <0.5..2>');
    },
    panel: async ([destination = 'site']) => {
      if (destination === 'dev') location.assign('/dev');
      else if (destination === 'site') { document.querySelector('#adminDialog').close(); print('Painel fechado.'); }
      else print('Uso: panel site | dev');
    },
    log: async ([action = 'export']) => {
      if (action === 'export') { exportFile('anymes-devtools-log.json', JSON.stringify([...output.children].map(node => node.textContent), null, 2)); print('Histórico local exportado.'); }
      else if (action === 'clear') output.replaceChildren();
      else print('Uso: log export | clear');
    },
    clear: async () => output.replaceChildren(),
    logout: async () => { await request('/api/admin/logout', { method: 'POST' }); location.assign('/dev'); },
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (pending) return;
    const line = input.value.trim().slice(0, 240);
    input.value = '';
    if (!line) return;
    history.push(line.replace(/\b\d{20}\b/g, '[oculto]'));
    if (history.length > 40) history.shift();
    cursor = history.length;
    print(`> ${line.replace(/\b\d{20}\b/g, '[oculto]')}`);
    const [operation, ...args] = line.split(/\s+/);
    const key = operation?.toLowerCase();
    const run = Object.hasOwn(commands, key) ? commands[key] : null;
    if (!run) return print('Comando desconhecido. Digite help.');
    pending = true;
    input.disabled = true;
    Promise.resolve().then(() => run(args)).catch(error => print(error instanceof Error ? error.message : 'Falha inesperada.')).finally(() => {
      pending = false;
      input.disabled = false;
      input.focus();
    });
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && history.length) { event.preventDefault(); cursor = Math.max(0, cursor - 1); input.value = history[cursor]; }
    if (event.key === 'ArrowDown' && history.length) { event.preventDefault(); cursor = Math.min(history.length, cursor + 1); input.value = history[cursor] || ''; }
    if (event.key === 'Tab') {
      const matches = Object.keys(commands).filter(command => command.startsWith(input.value.toLowerCase()));
      if (matches.length === 1) { event.preventDefault(); input.value = `${matches[0]} `; }
    }
  });
})();
