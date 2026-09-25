# Publicação Vercel

Aplicação web Next.js 16 com catálogo AniList/Kitsu. O aplicativo nativo Lynx fica em `../lynx-client` e não é hospedado como site Vercel.

No projeto Vercel configure **Root Directory** como `vercel-web`, conecte um banco Redis compatível com a API REST Upstash e configure as variáveis de `.env.example` como segredos do projeto. `ADMIN_ACCESS_TOKEN` deve ser um número de 20 dígitos, entregue fora do código e do ZIP. Não comite esses valores. Execute `npm ci` e `npm run build` para validar. O painel protegido fica em `/dev`, com autenticação por token sem solicitar nome ou email; `/admin` redireciona para `/dev`.

O estado do espaço publicitário é persistido no Redis e é consultado pelos visitantes ativos a cada 10 segundos, além do carregamento inicial. Ele representa somente um espaço vazio: não há rede de anúncios ou processamento de pagamentos configurados. Se as variáveis não estiverem configuradas ou o Redis estiver indisponível, o painel falha fechado e o espaço permanece oculto. Tentativas de login são limitadas por rede em uma janela de cinco minutos. O painel `/dev` agora mostra um console para consultar o estado, controlar o espaço, testar armazenamento, exportar favoritos locais, ajustar preferências e encerrar a sessão. O catálogo também disponibiliza comandos detalhados via DevTools, histórico com ↑/↓ e conclusão com Tab; nenhum comando executa JavaScript arbitrário.

Ao editar o frontend da raiz, sincronize `public/app.js`, `admin-console.js`, `style.css` e `site.html` com `vercel-web/public/` antes de publicar. Imagens e arquivos enviados pelo visitante permanecem apenas no navegador, conforme a interface.


## Segurança e validação

O servidor exige sessão assinada para as operações administrativas. O cookie tem `HttpOnly`, `SameSite=Strict`, `Secure` em produção e validade de oito horas. Trocar `ADMIN_ACCESS_TOKEN` invalida as sessões existentes; sair remove o cookie deste navegador. Não há revogação individual de cookies copiados antes do logout.

O limite de oito tentativas de login por IP a cada cinco minutos usa uma única operação Redis `EVAL`, com incremento e expiração atômicos. A chave não armazena o IP em texto. A identificação depende do cabeçalho `X-Forwarded-For` sobrescrito pela Vercel; fora dela, o proxy precisa tratar esse cabeçalho. Isso limita tentativas de login e não equivale a um firewall ou bloqueio global de IP.

As gravações exigem a mesma origem. Os corpos JSON são limitados a 1 KiB, inclusive sem `Content-Length`. O catálogo recebe uma política de conteúdo que permite scripts locais e o player `youtube-nocookie.com`; as respostas recebem proteção contra incorporação da própria aplicação, detecção incorreta de MIME e acesso a câmera, microfone e localização. O console serializa comandos e só confirma uma alteração depois da resposta válida do servidor. As mensagens de sessão expirada voltam ao formulário de acesso.

Validação local (Node.js 24):

```sh
npm ci
npm test
npm run build
npm run test:http
npm audit --omit=dev
```

O teste HTTP inicia e encerra um servidor local na porta 3100 e força configuração vazia, sem usar credenciais reais. Os testes de Redis usam respostas simuladas; uma conexão Redis real e a publicação ainda precisam ser verificadas no ambiente de destino. Consulte `VERIFICATION.md` para os resultados desta revisão.
