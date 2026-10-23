# Venda diária por hora

Autorizado pelo administrador: exportar o Power BI e importar no site publicado a cada hora, com o acumulado do próprio dia. A data sempre usa America/Sao_Paulo. Nunca usar a prévia localhost. O processo depende deste computador e da sessão do navegador disponíveis. Nenhuma senha fica neste documento, no código ou no agendamento.

## Fonte validada

Relatório: https://app.powerbi.com/groups/me/reports/202b790b-d196-4e09-b1ac-126e3efedf99/ReportSection25c4c7570b22613d8596?ctid=4cc09079-3932-4229-90f4-9f9ba38989d5&experience=power-bi

Usar a página **Indicadores**, tabela por **Vendedor**, que contém Venda, Clientes, Ticket Médio, Gen/Sim e MP. A página denominada Vendas Diárias apresenta indicadores gerais e não é a tabela importada. Não selecionar Venda Ant nem Venda Un como venda atual.

## Executar

1. Usar exclusivamente cua_repl para o navegador. Reutilizar a sessão do Power BI no navegador do aplicativo. Se pedir senha, MFA, CAPTCHA ou novo consentimento, interromper e pedir intervenção do usuário; não procurar credenciais em mensagens antigas ou arquivos. Não salvar autenticação adicional sem autorização.
2. Ler o estado atual, abrir Indicadores e atualizar os visuais. Garantir que Data de início e Data de término sejam ambas o dia atual em São Paulo. Validar os dois campos depois da alteração. Confirmar visualização por vendedor e ausência de seleção de um vendedor específico ou de filtros de produto/setor que restrinjam a loja. Não modificar configurações administrativas nem o modelo do Power BI.
3. Exportar a tabela com **Dados com layout atual**, formato **.xlsx estático**. Não usar Dados resumidos (inclui níveis inferiores da hierarquia) nem Excel com conexão dinâmica. O layout validado contém 27 colunas.
4. Para abrir o menu do visual, obter estado/screenshot atual e interagir com um cabeçalho da tabela. Um clique direito exibe a barra do visual, mas seu menu de contexto não tem Exportar dados. Clicar em Mais opções **da barra do visual** e então Exportar dados. Em testes, os índices nativos de acessibilidade funcionaram; seletores Playwright de elementos transitórios nem sempre funcionaram. Sempre obter índices novos, nunca reutilizar números deste teste nem coordenadas fixas.
5. Capturar o download e executar a verificação local, sem modificar o arquivo:

   `python scripts/check-bi-export.py CAMINHO_DO_DOWNLOAD --date AAAA-MM-DD`

   Usar o Python fornecido por load_workspace_dependencies. O utilitário lê o rodapé Filtros aplicados para validar o dia (fim exclusivo no dia seguinte), detecta valores vazios, linhas de totalização/rodapé e linhas inválidas. Não imprimir listas de pessoas nem dados integrais em logs.
6. Só prosseguir se `ready` for true. Se todas as vendas estiverem vazias ou sem valores positivos, não importar e manter a venda já salva. Se a data do rodapé não corresponder ao dia atual, formato divergir ou houver linhas inválidas, interromper. Nunca trocar pela data anterior para conseguir um valor.
7. Abrir https://muralindiana.online/importacao-bi/ na sessão administrativa existente. Se precisar entrar novamente, solicitar ao usuário. Anexar o Excel na opção **Importação venda diária**. Manter as colunas Vendedor, Venda, Clientes, Ticket Médio, Gen/Sim e MP; nunca Venda Un. Aplicar a mesma data atual no calendário e avançar.
8. Na validação, o site exclui automaticamente linhas com Vendedor igual a Total, Total Geral ou iniciado por Filtros aplicados:. Conferir que a quantidade de excluídas corresponde ao utilitário e que nenhuma linha de vendedor necessária foi excluída. Essas linhas não entram na gravação mesmo quando estão depois das 20 primeiras da prévia. Não alterar o arquivo original nem reativar linhas de resumo. Se a contagem divergir, parar antes de salvar.
9. Conferir que não há erros de mapeamento/linhas, que há colaboradores ativos reconhecidos e que a prévia tem venda positiva. Não cadastrar nem ativar pessoas automaticamente. Avançar e conferir o total dos colaboradores elegíveis; ele pode diferir do total bruto porque o site limita a loja aos ativos dos três setores.
10. Confirmar **Salvar informações do arquivo**. Um aviso de importação já existente significa sucesso sem mudança. O sistema usa o registro diário mais recente de cada dia, sem somar snapshots horários entre si. As importações de período já salvas são preservadas. Não excluir importações existentes.
11. Conferir no histórico que o novo registro é Diária e corresponde ao dia atual. Conferir em Início o total diário e em Vendas o total de hoje. Não dividir o acumulado do mês pelos dias nem somar snapshots horários. Se a sessão expirar ou os valores divergirem, parar e informar o erro.

## Primeiro teste

Exportação realizada em 22/10/2026 com início e fim em 22/10/2026. Layout atual: 27 colunas, sem Venda preenchida nessa leitura. A importação foi validada na primeira etapa e não foi salva, evitando substituir dados por zero. O agendamento precisa repetir a leitura; não há confirmação de uma primeira gravação positiva de 22/10.
