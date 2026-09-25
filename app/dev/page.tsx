'use client';
import { useEffect, useRef, useState } from 'react';
import { AdminRequestError, adminRequest, fetchAdsState, saveAdsState } from '../../lib/admin-client';
import DevConsole from './DevConsole';

const buttonStyle = { padding: '13px 18px', background: '#ff8c60', border: 0, borderRadius: 8 };

export default function DevTools() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const mutationPending = useRef(false);

  function reportError(error: unknown) {
    if (error instanceof AdminRequestError && (error.status === 401 || error.status === 403)) setEnabled(null);
    setMessage(error instanceof Error ? error.message : 'Operação indisponível.');
  }

  async function refresh() {
    try {
      const current = await fetchAdsState();
      setEnabled(current);
      return current;
    } catch (error) {
      reportError(error);
      throw error;
    }
  }

  useEffect(() => {
    let active = true;
    void fetchAdsState().then(current => { if (active) setEnabled(current); }).catch(error => {
      if (active && !(error instanceof AdminRequestError && error.status === 403)) reportError(error);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mutationPending.current) return;
    mutationPending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await adminRequest('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      setToken('');
      await refresh();
    } catch (error) {
      setToken('');
      reportError(error);
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function toggle(next: boolean) {
    if (mutationPending.current) throw new Error('Aguarde a operação em andamento.');
    mutationPending.current = true;
    setBusy(true);
    setMessage('');
    try {
      setEnabled(await saveAdsState(next));
      setMessage('Alteração salva. Os visitantes ativos recebem a atualização em até 10 segundos.');
    } catch (error) {
      reportError(error);
      throw error;
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function logout() {
    await adminRequest('/api/admin/logout', { method: 'POST' });
    setEnabled(null);
    setToken('');
    setMessage('Sessão encerrada.');
  }

  return <main style={{ maxWidth: 760, margin: '6vh auto', padding: 28, background: '#171920', borderRadius: 18 }}>
    <h1>AnyMesPhoenixPlay / DevTools</h1>
    {loading ? <p role="status">Verificando sessão…</p> : enabled === null ? <>
      <p>Digite o token para acessar o painel.</p>
      <form onSubmit={submit}>
        <label htmlFor="token">Token de acesso (20 dígitos)</label>
        <input id="token" type="password" inputMode="numeric" pattern="[0-9]{20}" maxLength={20} autoComplete="off"
          value={token} onChange={event => setToken(event.target.value)} required disabled={busy}
          style={{ width: '100%', padding: 13, margin: '10px 0 18px', boxSizing: 'border-box' }} />
        <button type="submit" disabled={busy} style={buttonStyle}>{busy ? 'Verificando…' : 'Entrar'}</button>
      </form>
    </> : <>
      <p>Espaço de anúncios: <strong>{enabled ? 'visível' : 'oculto'}</strong> para todos os visitantes.</p>
      <p>Nenhuma campanha ou rede de anúncios está conectada.</p>
      <button type="button" disabled={busy} onClick={() => { void toggle(!enabled).catch(() => {}); }} style={buttonStyle}>
        {busy ? 'Salvando…' : enabled ? 'Ocultar para todos' : 'Mostrar para todos'}
      </button>
      <DevConsole busy={busy} onAdsChange={toggle} onRefresh={refresh} onError={reportError} onLogout={logout} />
    </>}
    <p role="status">{message}</p>
    <a href="/site.html" style={{ color: '#ffad80' }}>Voltar ao catálogo</a>
  </main>;
}
