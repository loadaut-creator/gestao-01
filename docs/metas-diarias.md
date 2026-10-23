# Metas diárias individuais

Em **Metas → Metas diárias por colaborador**, o administrador escolhe o dia no calendário, o colaborador ativo e o valor de vendas em reais. Salvar novamente a mesma pessoa e data atualiza a meta; outras pessoas e datas são preservadas. Não há divisão automática da meta mensal.

Em **Minhas vendas**, o colaborador consulta sua meta diária, vendas importadas da data, valor faltante e atingimento. O calendário abre no dia atual de São Paulo e permite consultar outras datas. A importação diária mais recente da data é utilizada; importações mensais não substituem dados diários. Ausência de importação é exibida como sem dados, e ausência de meta como “Meta não definida”.

As metas são armazenadas no D1 e incluídas no backup, com compatibilidade com backups antigos. O servidor permite gravação apenas por administradores e retorna ao colaborador somente suas próprias metas. Uma revisão impede sobrescrita concorrente. Não são criados valores demonstrativos em produção.
