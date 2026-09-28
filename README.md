# Publicação Vercel

Aplicação web Next.js 16 com catálogo AniList/Kitsu. O aplicativo nativo Lynx fica em `../lynx-client` e não é hospedado como site Vercel.

Neste repositório GitHub, a aplicação Next.js está na raiz: configure **Root Directory** como `.`. Somente no ZIP com vários aplicativos ela fica em `vercel-web/`. No projeto Vercel, conecte um banco Redis compatível com a API REST Upstash e configure as variáveis de `.env.example` como segredos do projeto. `ADMIN_ACCESS_TOKEN` deve ser um número de 20 dígitos, entregue fora do código e do ZIP. Não comite esses valores. Execute `npm ci` e `npm run build` para validar. O painel protegido fica em `/dev`, com autenticação por token sem solicitar nome ou email; `/admin` redireciona para `/dev`.

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

O teste HTTP inicia e encerra um servidor local na porta 3100 e força configuração vazia, sem usar credenciais reais. Os testes de Redis usam respostas simuladas. A versão de produção vinculada ao branch `main` foi publicada na Vercel e o catálogo `/site.html` e a API pública `/api/ads` responderam em 26/09/2026. Valide o login do proprietário diretamente no painel `/dev` e as configurações de proteção da implantação antes de distribuir o link. Consulte `VERIFICATION.md` para os testes locais anteriores ao deploy.

## Player de vídeo

Na ficha de um anime, vídeos do YouTube informados no campo `streamingEpisodes` do AniList podem ser abertos num player com seleção, anterior/próximo e tela cheia. O YouTube fornece seus próprios comandos, idioma e legendas; nem todo título possui vídeos incorporáveis, e disponibilidade varia por região. As demais plataformas são acessadas pelos links originais delas.

Em **Minha mídia**, abra um arquivo do dispositivo: controles nativos mais avanço/retorno de 10 segundos, velocidades de 0,5× a 2×, modo cinema, tela cheia e janela flutuante onde houver suporte. Adicione até oito legendas locais `.vtt` de até 2 MB, reconhecidas como PT-BR ou inglês quando o nome do arquivo contiver o idioma. A posição de reprodução é salva apenas no navegador e oferecida para continuar quando o mesmo arquivo for selecionado de novo. Arquivos de vídeo e legendas não são enviados ao servidor. Não há catálogo de vídeos hospedado por este projeto, transcodificação de formatos ou tradução automática de legendas.
# Filmes e séries

As abas **Filmes** e **Séries** consultam o TMDB pelo servidor. Configure `TMDB_READ_ACCESS_TOKEN` nas variáveis de ambiente da Vercel (token de leitura da API do TMDB) para habilitar busca, pôsteres, sinopses, trailers e provedores de assinatura no Brasil. Sem token, a interface informa que falta configuração e oferece pesquisa externa no IMDb. O token nunca deve entrar no JavaScript público.

O botão **Assistir** de cada anime abre o player para vídeos incorporáveis fornecidos pelo AniList; quando não há vídeo, leva às fontes oficiais disponíveis. Filmes e séries reproduzem trailers do YouTube no player e oferecem links externos para serviços de exibição. A ficha do IMDb é acessada pelo identificador informado pelo TMDB; a API comercial do IMDb não foi conectada. O botão Seekee abre a página oficial do aplicativo Android: a assinatura VIP e as credenciais do usuário não são transmitidas ao AnyMesPhoenixPlay e não há integração com stream do Seekee.

## Página Cinema

O botão **Assistir** e os vídeos disponíveis abrem `/watch.html` em uma nova aba. A página tem uma lista de até 20 vídeos incorporáveis do YouTube, navegação entre eles, modo tela cheia e link para a fonte. Arquivos locais são reproduzidos em um player nativo com ajuste de velocidade, atalhos, legendas VTT, janela flutuante e retomada neste navegador. Os arquivos não são enviados ao servidor. A página não exibe publicidade própria; não interfere na publicidade, nas regras nem no controle de qualidade de serviços de terceiros. O vídeo incorporado é servido pelo YouTube, não há hospedagem ou transcodificação de vídeo nesta aplicação. O Seekee não fornece um stream web integrado nesta versão.

O catálogo agora oferece **Em alta**, **Mais populares** e **Mais bem avaliados** via AniList, com busca, gêneros e Kitsu como fonte alternativa. A página Cinema usa um player HTML5 próprio para arquivos pessoais e integra vídeos incorporáveis via iframe autorizado do YouTube. A presença de um anime no catálogo não significa que existam episódios completos incorporáveis para ele. O embedmovies.org não foi integrado: seus termos informam que agrega links de terceiros e não garante a legalidade do conteúdo; sem confirmação de direitos não é uma fonte segura de episódios completos. Para títulos sem vídeo incorporável, o aplicativo lista as plataformas oficiais disponíveis.
