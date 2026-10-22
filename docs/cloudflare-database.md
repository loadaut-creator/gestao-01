# Ativação do banco e login — Visão 308

O código tem dois modos. Sem CLOUD_ENABLED=1, o sistema continua local e permite exportar os registros. Com a nuvem ativada, o banco é a fonte dos dados; uma falha de API não muda silenciosamente para o armazenamento local. O banco nunca é acessado diretamente pelo navegador.

## 1. Exporte os registros existentes

Após publicar este código, abra Configurações e use **Exportar backup deste navegador**. Faça isso em cada endereço em que usou o sistema: localhost, gestao-01.pages.dev, muralindiana.online e www.muralindiana.online. Cada origem tem registros independentes. Guarde os JSON fora do navegador. Não limpe o armazenamento local.

## 2. Crie os bancos

No painel Cloudflare, abra **Storage & databases → D1 SQL Database → Create database**. Dependendo do idioma, o item pode aparecer como **D1**. Crie:

- `gestao-001-prod` para dados reais.
- `gestao-001-test` para validação, sem dados reais.

Abra cada banco, entre em **Console**, cole todo o conteúdo de `migrations/0001_cloud.sql` e execute. A migração pode ser executada novamente sem apagar os dados.

## 3. Conecte o banco ao Pages

Em **Workers & Pages → gestao-01 → Settings → Bindings → Add → D1 database**, use:

- Nome da variável/binding: **DB** (maiúsculo).
- Produção: `gestao-001-prod`.
- Preview: `gestao-001-test`.

Não use `.openai/hosting.json` nem o binding do ambiente Vinext local para configurar o Pages publicado. A API desta versão está em `functions/api/[[path]].ts`, empacotada automaticamente em `out/_worker.js` pelo script de build (modo avançado do Pages). Mantenha o build `npm run build:hostinger` e saída `out`.

## 4. Configure o login

No **Cloudflare Zero Trust / Cloudflare One**, defina sua organização e habilite **One-time PIN** em métodos de login. Crie uma aplicação **Access → Applications → Add application → Self-hosted** para `muralindiana.online`, abrangendo todos os caminhos (incluindo `/api/*`). Se o painel mostrar preço ou contratação, confira o plano antes de aceitar.

Na política **Allow**, inclua somente o e-mail **loadaut111@gmail.com** neste primeiro momento. Não use uma política que autorize qualquer e-mail. Copie da aplicação o **Application Audience (AUD)** e o domínio da organização (por exemplo, `sua-equipe.cloudflareaccess.com`). Configure também a proteção do endereço www ou use o redirecionamento descrito abaixo.

## 5. Variáveis do Pages

Em **gestao-01 → Settings → Variables and secrets**, crie para produção:

| Nome | Valor |
| --- | --- |
| `ADMIN_EMAIL` | `loadaut111@gmail.com` |
| `ACCESS_TEAM_DOMAIN` | domínio real da sua organização Cloudflare Access, sem caminho |
| `ACCESS_AUD` | AUD real da aplicação Access |
| `CANONICAL_HOST` | `muralindiana.online` |
| `STORE_ID` | `visao-308` |
| `CLOUD_ENABLED` | deixe `0` enquanto prepara e exporta os backups; use `1` para ativar |

Não são senhas, mas ficam na configuração do servidor, fora do código do navegador. O JWT recebido do Access é validado por assinatura, emissor, público e expiração; simplesmente enviar um cabeçalho com um e-mail não autoriza ninguém.

Para Preview, use o banco de teste e uma aplicação Access própria com AUD separado. Não reutilize o banco de produção. Mantenha CLOUD_ENABLED=0 até configurar essa proteção. Nunca habilite bypass de autenticação para testar.

Depois de mudar binding ou variáveis, faça **Deployments → Retry deployment** (ou um novo deploy). Mudanças de configuração não atualizam automaticamente uma implantação antiga.

## 6. Ative e migre

1. Confirme primeiro que o backup de cada origem foi exportado.
2. Ative CLOUD_ENABLED=1 e publique novamente.
3. Acesse `https://muralindiana.online`, entre com o código recebido em `loadaut111@gmail.com`.
4. Abra Configurações. O topo deve mostrar **Nuvem**, seu e-mail e seu perfil.
5. Selecione um backup JSON e confira a prévia. Diferenças em funcionários, metas ou importações com a mesma chave bloqueiam a migração: resolva os registros conflitantes antes de prosseguir.
6. Confirme a transferência. Uma repetição retoma os registros já confirmados sem duplicar importações idênticas. Se falhar no meio, a tela mostra o erro; os itens já confirmados permanecem na nuvem e o backup pode ser reaplicado.
7. Confira quantidades e totais de cada período. Só encerre a migração quando todos os backups necessários estiverem conferidos. Os dados locais não são apagados.

A migração inteira pode envolver várias transações: cada coleção de cadastro e cada importação são atômicas. Se o JSON ultrapassar 12 MB, é necessário dividi-lo antes da transferência. Arquivos originais XLSX/CSV ainda não são enviados ao R2: ficam armazenadas as linhas normalizadas e as colunas originais de cada registro, suficientes para os painéis e o backup.

## 7. Usuários e atualizações

O administrador inclui e-mails em **Configurações → Usuários autorizados**, escolhe o perfil e salva. Inclua os mesmos e-mails na política Allow do Access. Perfis:

- Administrador: consulta, cadastros, importações, exclusões e usuários.
- Gerente: consulta, equipe, metas e importações; sem exclusão de importações nem gestão de usuários.
- Consulta: somente leitura.

O acesso exige as duas verificações: a política Access e o cadastro ativo no banco. O administrador inicial é autorizado pela variável ADMIN_EMAIL enquanto não há cadastro próprio. Não altere essa variável para dar acesso temporário.

As mudanças são verificadas a cada 30 segundos enquanto a aba está visível e quando recebe foco. Para cadastros alterados em outro aparelho, uma mensagem pede atualização para não descartar formulários em edição. Escritas usam revisão: uma gravação antiga é rejeitada até atualizar e revisar. A exclusão e a criação de importações atualizam os painéis abertos.

O middleware redireciona www para o domínio principal quando CANONICAL_HOST está definido. O endereço pages.dev não recebe acesso aos dados sem um JWT válido da aplicação configurada; use o domínio principal para o login. O cache da API é desativado.

## 8. Backup e recuperação

Use Exportar backup da nuvem periodicamente e mantenha cópia fora da conta Cloudflare. O D1 possui Time Travel com retenção conforme o plano. Não declare o backup validado sem realizar uma restauração de teste em ambiente isolado e conferir as quantidades/totais. Não restaure produção para fazer esse teste.

O log de auditoria guarda autor, operação, recurso e data; fica disponível para o administrador em `/api/audit`. Não inclui senhas nem cópias dos dados pessoais no log.

## Aprovação em produção

- Sem sessão, `/api/state` e `/api/imports` não devolvem dados.
- Um usuário de consulta recebe 403 ao tentar gravar.
- Uma importação reaplicada não duplica vendas.
- Duas edições da mesma revisão: a segunda recebe 409.
- Os totais e filtros conferem no computador e no celular.
- Após sair, dados protegidos não são servidos pelo cache da API.
- A indisponibilidade da rede não gera confirmação de salvamento.
- Backup exportado e restauração em teste conferidos.

Referências: https://developers.cloudflare.com/d1/get-started/ e https://developers.cloudflare.com/pages/functions/bindings/ e https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
