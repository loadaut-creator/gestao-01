# Importação por intervalo

- Venda diária: calendário com uma data e botão Aplicar.
- Período: selecionar primeiro e último dia no calendário e Aplicar. Intervalos inclusivos, dentro de um mês. Para meses diferentes, importar uma planilha por mês; o arquivo contém totais por vendedor e não permite repartir valores entre meses.
- Registros antigos por mês continuam válidos. Histórico e seletor do colaborador exibem as duas datas dos novos intervalos.
- Total mensal: registro mensal tem prioridade. Sem ele, utiliza intervalos mais recentes sem sobreposição, mais importações diárias fora dos dias cobertos. Intervalos antigos que sobrepõem os escolhidos são ignorados integralmente e sinalizados em Vendas: não se estima a venda de parte de um intervalo.
- Gráficos diários e meta diária continuam usando somente importações de um dia.
- A API valida datas, ordem e mês e inclui a data final na deduplicação. Os metadados usam o armazenamento existente, sem migração SQL.

## Conferência dos vendedores

A prévia separa correspondências na Equipe, colaboradores ativos de venda, nomes sem cadastro correspondente e cadastros inativos ou fora dos setores de venda. A matrícula também é aceita como identificador exato. Correspondências ambíguas não são vinculadas automaticamente. Os totais continuam considerando apenas colaboradores ativos de Balcão, Perfumaria e Caixa com vendas positivas.
