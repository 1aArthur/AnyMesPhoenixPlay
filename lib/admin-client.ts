export class AdminRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function adminRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AdminRequestError('Não foi possível conectar ao servidor. Tente novamente.', 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 403 ? 'Sessão expirada ou acesso negado. Entre novamente.' :
      (typeof body?.error === 'string' ? body.error.slice(0, 200) : 'O servidor recusou a operação.');
    throw new AdminRequestError(message, response.status);
  }
  if (!body || typeof body !== 'object') throw new AdminRequestError('Resposta inválida do servidor.', 502);
  return body as T;
}

export async function fetchAdsState() {
  const data = await adminRequest<{ enabled: unknown }>('/api/admin/ads');
  if (typeof data.enabled !== 'boolean') throw new AdminRequestError('Estado do espaço indisponível.', 502);
  return data.enabled;
}

export async function saveAdsState(enabled: boolean) {
  const data = await adminRequest<{ enabled: unknown }>('/api/admin/ads', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
  });
  if (data.enabled !== enabled) throw new AdminRequestError('O servidor não confirmou a alteração.', 502);
  return enabled;
}
