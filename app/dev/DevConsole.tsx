'use client';
import { useRef, useState } from 'react';
import { adminRequest } from '../../lib/admin-client';

type Props = {
  busy: boolean;
  onAdsChange: (enabled: boolean) => Promise<void>;
  onRefresh: () => Promise<boolean>;
  onError: (error: unknown) => void;
  onLogout: () => Promise<void>;
};
export default function DevConsole({ busy, onAdsChange, onRefresh, onError, onLogout }: Props) {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<string[]>(['Digite help para conhecer os comandos.']);
  const history = useRef<string[]>([]);
  const cursor = useRef(0);
  const pending = useRef(false);
  const [running, setRunning] = useState(false);
  const redact = (line: string) => line.replace(/\b\d{20}\b/g, '[oculto]');
  const append = (line: string) => setLines(previous => [...previous.slice(-79), redact(line).slice(0, 900)]);
  async function execute(value: string) {
    if (pending.current || busy) return;
    value = value.trim().slice(0, 240);
    const [command, ...args] = value.trim().slice(0, 240).split(/\s+/);
    if (!command) return;
    pending.current = true;
    setRunning(true);
    history.current = [...history.current.slice(-39), redact(value)];
    cursor.current = history.current.length;
    append(`> ${value.replace(/\b\d{20}\b/g, '[oculto]')}`);
    const action = args[0]?.toLowerCase();
    try {
      switch (command.toLowerCase()) {
        case 'help': append('help, status, ads on|off|status, health, favorites count|export, storage, theme #RRGGBB, open site, clear, logout'); break;
        case 'status': {
          const current = await onRefresh();
          append(`Sessão autorizada. Espaço de anúncios ${current ? 'visível' : 'oculto'}; campanhas conectadas: nenhuma.`);
          break;
        }
        case 'ads':
          if (action === 'status' || !action) append(`Espaço global: ${await onRefresh() ? 'visível' : 'oculto'}.`);
          else if (action === 'on' || action === 'off') { await onAdsChange(action === 'on'); append('Alteração global salva.'); }
          else append('Uso: ads status | on | off');
          break;
        case 'health': {
          const data = await adminRequest<{ ok?: boolean; storage?: string; latencyMs?: number }>('/api/admin/health');
          if (data.ok !== true) throw new Error('Armazenamento indisponível.');
          append(`Armazenamento: ${data.storage || 'indisponível'}; latência: ${data.latencyMs ?? '?'} ms.`);
          break;
        }
        case 'favorites': {
          const items = JSON.parse(localStorage.getItem('anymes-favorites') || '{}') as Record<string, unknown>;
          if (action === 'count' || !action) append(`${Object.keys(items).length} favoritos neste navegador.`);
          else if (action === 'export') {
            const url = URL.createObjectURL(new Blob([JSON.stringify(Object.values(items), null, 2)], { type: 'application/json' }));
            const link = document.createElement('a'); link.href = url; link.download = 'anymes-favoritos.json'; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000); append('Favoritos exportados deste navegador.');
          } else append('Uso: favorites count | export');
          break;
        }
        case 'storage': append(`Preferências locais: ~${['anymes-favorites','anymes-accent'].reduce((n,k) => n + (localStorage.getItem(k) || '').length * 2,0)} bytes.`); break;
        case 'theme':
          if (args[0] && /^#[0-9a-f]{6}$/i.test(args[0])) { localStorage.setItem('anymes-accent', JSON.stringify(args[0])); append('Cor salva para este navegador. Abra o catálogo para visualizar.'); }
          else append('Uso: theme #RRGGBB');
          break;
        case 'open': if (action === 'site') location.assign('/site.html'); else append('Uso: open site'); break;
        case 'clear': setLines([]); break;
        case 'logout': {
          await onLogout();
          break;
        }
        default: append('Comando desconhecido. Digite help.');
      }
    } catch (error) {
      onError(error);
      append(error instanceof Error ? error.message : 'Comando indisponível agora.');
    } finally {
      pending.current = false;
      setRunning(false);
    }
  }
  return <section style={{marginTop:28}} aria-busy={running}><h2>Console administrativo</h2><div role="log" aria-live="polite" style={{background:'#090a11',padding:16,border:'1px solid #343543',borderRadius:10,height:160,overflow:'auto',whiteSpace:'pre-wrap',font:'13px/1.6 monospace'}}>{lines.map((line,index)=><div key={index}>{line}</div>)}</div><form onSubmit={(event)=>{event.preventDefault();if(pending.current||busy)return;void execute(input);setInput('');}}><label htmlFor="cmd">Comando</label><input id="cmd" disabled={running||busy} value={input} onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==='ArrowUp'&&history.current.length){event.preventDefault();cursor.current=Math.max(0,cursor.current-1);setInput(history.current[cursor.current]);}if(event.key==='ArrowDown'&&history.current.length){event.preventDefault();cursor.current=Math.min(history.current.length,cursor.current+1);setInput(history.current[cursor.current]||'');}}} maxLength={240} autoComplete="off" placeholder="Digite help e pressione Enter" style={{width:'100%',boxSizing:'border-box',padding:12,margin:'8px 0',background:'#11131c',border:'1px solid #555',borderRadius:8,color:'white'}}/></form></section>;
}
