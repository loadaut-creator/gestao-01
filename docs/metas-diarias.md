# Metas diárias individuais

Em **Metas → Distribuição das metas por colaborador**, o administrador informa a quantidade de dias do mês (1 a 31) e salva. Sem ajuste, são usados os dias corridos do mês. A meta mensal do setor é dividida igualmente pela quantidade de colaboradores ativos do setor; a meta diária individual divide esse resultado pela quantidade de dias. Valores de exibição são arredondados para centavos. Inativos e pessoas de outros setores não participam da divisão. Os painéis dos setores exibem a quantidade ativa utilizada. Mudanças de equipe ativa ou da meta mensal recalculam a distribuição.

Na seção recolhida **Ajustar meta individual em uma data específica**, é possível definir uma exceção manual por colaborador e dia. Salvar novamente a mesma pessoa e data atualiza a exceção; outras pessoas e datas são preservadas. A exceção tem prioridade sobre o cálculo do setor somente naquela data.

Em **Minhas vendas**, o colaborador consulta sua meta diária calculada (ou a exceção manual), vendas importadas da data, valor faltante e atingimento. O calendário abre no dia atual de São Paulo e permite consultar outras datas. A importação diária mais recente da data é utilizada; importações mensais não substituem dados diários. Ausência de importação é exibida como sem dados, e ausência de meta como “Meta não definida”.

As metas são armazenadas no D1 e incluídas no backup, com compatibilidade com backups antigos. O servidor permite gravação apenas por administradores e retorna ao colaborador somente suas próprias metas. Uma revisão impede sobrescrita concorrente. Não são criados valores demonstrativos em produção.
