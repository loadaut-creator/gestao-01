# Campanhas

Administradores e gerentes podem criar campanhas, definir setor, período, situação, regras e premiação opcionais, e importar ou substituir o ranking. A ordem dos cartões é salva por arraste ou pelos botões de subir e descer. Dados e rankings são persistidos no D1 e incluídos nos backups.

## Planilha

Aceita `.xlsx` e `.csv`. O leitor sugere as colunas `Vendedor` e `Venda` (ou `Vlr Geral`). Para quantidade, selecione `Venda Un` ou a coluna correspondente. A prévia permite corrigir o mapeamento antes de salvar.

Na estrutura `Cargo | Vendedor | Filial`, `Vendedor`, `Venda`, o cargo é mantido nas linhas seguintes quando as células estão vazias ou mescladas. A coluna de cargo permite filtrar o setor escolhido. Sem essa coluna, a lista inteira é considerada pertencente ao setor da campanha.

Linhas de totalização, nomes vazios, valores vazios e negativos são ignorados. Valores zero são aceitos. Cada linha válida permanece independente, inclusive nomes iguais; não há cadastro ou vínculo obrigatório com a Equipe. O ranking é ordenado do maior para o menor, com posições compartilhadas nos empates (1, 1, 3). A busca mantém as posições originais.

## Publicação

Funcionários consultam somente campanhas publicadas dentro do período vigente, com lista completa, busca por nome, posição e vendas. Rascunhos, campanhas futuras e encerradas ficam na administração. O link do Power BI fica restrito à administração e serve como referência; não existe sincronização automática. Para atualizar os valores, publique uma nova planilha.

Alterar setor ou forma de medição sem enviar outra planilha exige confirmar a retirada do ranking anterior. A revisão do documento impede sobrescrever alterações concorrentes. Limites: 100 campanhas, 20 mil linhas por ranking e 12 MB por gravação na API.
