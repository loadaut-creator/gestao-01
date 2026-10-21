# Regras de importação do BI — Bloco 03

## Arquivo de referência

O exemplo fornecido contém 27 colunas, separadas por tabulação. A **linha 1 é o cabeçalho** (começa em `Vendedor`, `% Part`, `Venda`); os registros dos vendedores começam na linha 2. Um arquivo CSV com ponto e vírgula, vírgula ou tabulação também é aceito; arquivos XLSX usam a primeira aba. O sistema não depende de integração automática com o BI. A página oferece painéis separados para venda diária (referência em dia) e período (referência em mês).

| Coluna de origem | Campo no sistema | Regra |
| --- | --- | --- |
| Vendedor | Vendedor / identificador BI | Texto; obrigatório. Vínculo por correspondência exata com o identificador BI cadastrado na Equipe. |
| Venda | Totais | Valor vendido até o momento, em reais. Se a célula estiver vazia, manter a linha com R$ 0,00. |
| Clientes | Clientes atendidos | Contagem inteira não negativa. |
| Ticket Médio | Ticket médio | Valor em reais. |
| Gen/Sim | Gen/Sim | Valor em reais, sem outra interpretação da sigla. |
| MP | MP | Valor em reais. |
| Venda Un | Nenhum | Não é usada no mapeamento nem nas validações. |

As colunas não usadas na tabela continuam preservadas no registro original para consulta posterior. No arquivo de referência não há Data, Setor nem Cliente premium. Esses campos não são derivados de outras métricas. O usuário informa o dia ou mês de referência. As colunas conhecidas são reconhecidas automaticamente ao anexar o arquivo.

## Validação e confirmação

- As colunas Vendedor e Venda são obrigatórias. Uma coluna não pode alimentar dois campos.
- O sistema aceita números no padrão brasileiro, com ponto para milhar e vírgula decimal, além de números simples de planilha.
- `(Em branco)` é aceito em campos opcionais. Em Venda, uma célula vazia ou marcada como `(Em branco)` é registrada como R$ 0,00 e sinalizada na prévia. Em Vendedor, gera erro.
- Linhas com erro são bloqueadas até sua exclusão ou correção no arquivo. Vendedor sem vínculo na Equipe gera aviso, sem bloquear.
- Linhas como canal ou totalização não são excluídas automaticamente, pois o arquivo não as identifica de forma confiável. O usuário as revisa na prévia.
- A confirmação grava apenas as linhas incluídas. O total da tela Início usa a importação diária mais recente, mesmo quando uma importação de período é salva depois. A tabela de vendedores da tela Início mostra somente funcionários ativos com Venda maior que zero no dia importado. Sem importação diária, a tela apresenta um estado vazio, sem valores demonstrativos.
- Escolhas de colunas para a tela Início são configuradas na importação diária e gravadas com ela. A tela Início mostra uma tabela única, pois o arquivo de referência não informa o setor de cada linha. A importação de período permanece no histórico separado por tipo.
- A Equipe é a fonte dos cargos e status. O cadastro em lote aceita texto colado com Matrícula, Nome, Cargo e Data Admissão (tabulações ou espaços duplos). O cargo é salvo exatamente como está no arquivo, inclusive funções fora da equipe de vendas. O identificador BI inicia com o nome e pode ser corrigido. Cada linha pode ser revisada antes de salvar; a matrícula existente é atualizada sem duplicação. A tela Importação BI mostra apenas o resultado do reconhecimento, sem seleção manual de cargo. O vínculo usa primeiro o identificador BI ou nome exato e aceita variações seguras de nome (partículas, uma letra divergente no primeiro nome ou último sobrenome, ou inicial intermediária), somente quando há um único funcionário correspondente. Os cargos ligados a Caixa, Balcão e Perfumaria alimentam a tabela de vendas; os demais ficam na Equipe sem entrar nela. Funcionários inativos não aparecem na tabela de vendas da tela Início, mesmo quando constam no arquivo. Nomes não classificados permanecem no histórico, sem aparecer nessa tabela.

O histórico é local ao navegador, armazenado em IndexedDB. Cada registro pode ser excluído após confirmação. Não há sincronização entre dispositivos nesta etapa.
