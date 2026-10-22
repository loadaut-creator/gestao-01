# gestao-01 — Visão 308

Painel de gestão comercial para farmácia, com equipe, importação de vendas, dashboard e metas por setor.

## Funcionalidades implementadas

- Equipe: cadastro em lote a partir do BI, reconhecimento de colaboradores, filtros e ativação/desativação.
- Importação: CSV e XLSX, fluxos separados para vendas diárias e períodos, validação e histórico com exclusão.
- Início: vendas diárias de funcionários ativos com valor de venda positivo.
- Vendas: indicadores, gráficos, filtros por mês, setor e funcionário; devoluções consideradas no desempenho individual.
- Metas: distribuição mensal por valor ou porcentagem, metas e resultados por setor.
- Campanhas com ranking de planilha, busca, publicação por período e ordenação de cartões: veja [documentação](docs/campanhas.md).
- Rankings gerais e relatórios são áreas previstas para próximas etapas.

## Dados

Funcionários e metas são armazenados no localStorage; importações ficam no IndexedDB do navegador. Os dados não são enviados junto com o código nem sincronizados entre dispositivos. Abrir o domínio publicado não transfere os registros salvos em localhost. Não há autenticação de usuários ou banco compartilhado nesta etapa.

## Desenvolvimento local

Requer Node.js 22.13 ou superior e npm.

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. Validação: `npx tsc --noEmit` e `npm run build`.

## Publicação na Hostinger

As telas implementadas funcionam como site estático. Gere a versão de publicação:

```sh
npm ci
npm run build:hostinger
```

A pasta `out/` contém o site completo. Publique **o conteúdo** dela na raiz de uma hospedagem Web ativa. O arquivo `index.html` deve estar na raiz, com `_next/` e as pastas das páginas ao lado. Os endereços `/metas/`, `/vendas/` e demais seções têm arquivos próprios e não dependem de redirecionamento de SPA.

Destino solicitado: `muralindiana.online`. Ter o domínio registrado não inclui necessariamente hospedagem; é preciso associá-lo a um plano que sirva esses arquivos. A exportação não exige um servidor Node.js em produção. O desenvolvimento local com Vinext continua disponível.

## Referências do projeto

- `docs/design-system.md`: identidade visual e acessibilidade.
- `docs/bi-importacao.md`: regras de importação e vínculo com a equipe.
- `AGENTS.md`: desenvolvimento por blocos autorizados.

Credenciais, dependências, arquivos de compilação e capturas locais ficam fora do repositório.

## Banco e autenticação na nuvem

A integração D1 + Pages Functions + Cloudflare Access está implementada com ativação controlada. Siga [o roteiro de ativação](docs/cloudflare-database.md). Sem CLOUD_ENABLED=1, a versão continua local para permitir o backup antes da migração. Valide a API com `npm run test:cloud`.

## Login próprio por usuário ou matrícula

A tela em `/login/` está pronta. Para substituir o Cloudflare Access por sessões próprias, siga [o roteiro de ativação](docs/login-proprio.md), aplique `migrations/0002_site_login.sql` e configure os hashes como Secrets do Pages. Sem SITE_LOGIN_ENABLED=1, o acesso anterior continua funcionando. O painel do colaborador e a API mostram somente as vendas vinculadas ao próprio cadastro ativo.
