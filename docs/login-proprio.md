# Login próprio — ativação

A tela `/login/` usa o desenho do Visão 308. O administrador entra pelo usuário definido em ADMIN_USERNAME; funcionários usam a matrícula exata cadastrada na Equipe. A função é exibida no painel, mas não concede privilégios administrativos. A inativação ou remoção do funcionário bloqueia novas consultas, inclusive com uma sessão que já estava aberta.

## Preparação

1. Exporte um backup da nuvem em Configurações antes da mudança.
2. No banco D1 `gestao-001-prod`, abra Console e execute `migrations/0002_site_login.sql`. Isso acrescenta tabelas de sessões e tentativas; não apaga funcionários, metas ou vendas.
3. Em Pages → gestao-01 → Settings → Variables and secrets, selecione Production e configure:

| Nome | Tipo | Valor |
| --- | --- | --- |
| ADMIN_USERNAME | Text | indiana@308 |
| ADMIN_PASSWORD_HASH | Secret | hash administrativo gerado localmente |
| EMPLOYEE_PASSWORD_HASH | Secret | hash da senha padrão dos funcionários gerado localmente |
| SITE_LOGIN_ENABLED | Text | 1 |

Os dois hashes estão no arquivo local ignorado `.env.login-setup`, preparado no computador do projeto. Copie os valores completos, incluindo os `$`. Não coloque as senhas em texto puro nesses campos. O arquivo não é enviado ao GitHub. Para gerar novos hashes, use PBKDF2-HMAC-SHA256 com 100.000 iterações, salt aleatório e saída de 32 bytes; formato `pbkdf2-sha256-100000$salt$hex`. A senha administrativa e a senha padrão são as informadas pelo usuário nesta conversa; não são mostradas na tela pública.

Mantenha CLOUD_ENABLED=1, DB e STORE_ID como já configurados. As variáveis ACCESS_* podem ficar temporariamente configuradas para permitir reversão. SITE_LOGIN_ENABLED não definido ou diferente de 1 mantém o login anterior pelo Access.

4. Faça um novo deployment. Com a proteção do Cloudflare Access ainda ativa, abra `https://muralindiana.online/login/` e teste o login administrativo próprio.
5. Confirme que o administrador abre Equipe e Vendas, que uma matrícula ativa vê só seus resultados e que sair encerra a sessão própria.
6. Somente depois desses testes, retire a proteção externa do Cloudflare Access da aplicação do domínio, para que a equipe veja diretamente o login do site. Isso é uma configuração da aplicação Access; não exclua o projeto Pages nem o banco D1. Sem esse ajuste, a tela externa da Cloudflare continua aparecendo antes da tela própria.

## Comportamento

- Não há troca obrigatória de senha nesta versão, conforme solicitado.
- A senha padrão é compartilhada pelos funcionários; o administrador deve manter cadastros/status corretos.
- Nenhuma senha nem cookie de sessão é armazenado no JavaScript ou localStorage.
- Cookie de sessão HttpOnly, Secure, SameSite=Lax. O banco armazena apenas o hash do token aleatório.
- Sessão de 8 horas; opção Manter conectado dura 7 dias.
- Limite por IP e por usuário/IP para tentativas de login, com espera de 15 minutos quando excedido.
- Funcionário recebe só seu cadastro e suas linhas de vendas; totais e contagens são recalculados no servidor. Não recebe equipe completa, metas gerais, modelos, usuários ou auditoria. Parâmetros de URL não ampliam seu acesso.
- Cada requisição confere o status atual da Equipe.
- Nome com vínculo ambíguo no BI não libera vendas para nenhum funcionário. Corrija o identificador do cadastro antes de liberar esse resultado.
- O administrador pode usar os módulos existentes; funcionários veem o painel Minhas vendas, sem ações de gestão.
- O logout invalida a sessão no banco. Limpar o cookie ou voltar no navegador não restaura a sessão encerrada.

## Reversão

Se o login próprio apresentar erro, mantenha ou reative primeiro a proteção Cloudflare Access, configure SITE_LOGIN_ENABLED=0 e publique novamente. Isso volta ao acesso anterior sem apagar dados. Não retire a proteção externa enquanto ainda estiver usando a autenticação anterior.

## Conferência

Teste usuário/senha incorretos, status inativo, sessão expirada, logout, funcionário sem vendas e uma tentativa de trocar a matrícula pela URL. Não use dados reais em testes automatizados. A suíte `npm run test:cloud` cobre as permissões e as sessões com banco SQLite em memória.
