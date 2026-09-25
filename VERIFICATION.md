# Verificação desta revisão — 2026-09-24

Escopo: aplicação `vercel-web`, DevTools e cópias do frontend estático. O cliente Lynx e o backend legado Sites não foram reconstruídos nesta revisão.

| Verificação | Resultado |
| --- | --- |
| `npm test` | 12 testes aprovados: assinatura, expiração e rotação de sessão, cookies, origem, limites de login e de JSON, erros de gravação no cliente |
| `npm run build` | Build otimizado Next.js 16.3.4 e verificação TypeScript aprovados |
| `npm run test:http` | 11 verificações HTTP locais aprovadas: cabeçalhos, bloqueio sem sessão, origem externa, falha fechada sem configuração, página `/dev` e redirecionamento |
| `node --check public/app.js` e `node --check public/admin-console.js` | Sintaxe aprovada |
| `npm audit --omit=dev` em `vercel-web` | Nenhuma vulnerabilidade conhecida retornada para as dependências de produção nesta consulta |
| Deploy pelo plugin Vercel | Bloqueado: `McpServerError: Tool deploy_to_vercel not found`; não foi criada uma publicação |

Mudanças verificadas: limite de login com incremento e expiração em uma única operação Redis; rejeição de cookies com sufixos extras; limite real de 1 KiB por corpo JSON; validação de origem compatível com a normalização local do Next.js; confirmação de gravação somente após resposta válida; sessão inválida retorna ao login; comandos serializados; histórico com tokens numéricos ocultos; escapes nos atributos de imagens; cabeçalhos de proteção no servidor.

Os testes de Redis usam respostas simuladas. As verificações HTTP executam a aplicação compilada sem credenciais. Não houve validação com Redis real, sessão administrativa no navegador, publicação de produção ou medição de desempenho sob carga. A auditoria cobre apenas as dependências de produção de `vercel-web`, não os outros aplicativos do ZIP. Esses resultados não são garantia de ausência de falhas.

O pacote não inclui credenciais. Anúncios continuam sendo apenas um espaço controlável; não há rede publicitária nem pagamentos conectados. O identificador fornecido anteriormente tem formato `scl_`, documentado como ID de conector pela Vercel, e não foi tratado como token de publicação.
