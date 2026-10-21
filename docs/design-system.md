# Padrão visual e tipográfico do projeto

Este padrão vale para **todos os blocos futuros** da plataforma, até o usuário solicitar uma alteração explícita.

## Fonte e escala

Use somente Inter com fallbacks `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`. A fonte variável é carregada localmente e limitada aos pesos 400–700. Todos os tamanhos, pesos, alturas de linha e espaçamentos estão em tokens no `:root` de `app/globals.css`.

| Uso | Token | Tamanho | Peso | Altura de linha |
| --- | --- | --- | --- | --- |
| Destaque | `--font-display` | 36 px | 700 | 1,15 |
| H1 | `--font-h1` | 30 px | 700 | 1,25 |
| H2 | `--font-h2` | 24 px | 600 | 1,3 |
| H3 | `--font-h3` | 20 px | 600 | 1,4 |
| H4 | `--font-h4` | 16 px | 600 | 1,4 |
| Introdução | `--font-body-lg` | 16 px | 400 | 1,6 |
| Corpo | `--font-body` | 14 px | 400 | 1,5 |
| Label | `--font-label` | 13 px | 500 | 1,5 |
| Legenda | `--font-caption` | 12 px | 400 | 1,5 |

Preserve a hierarquia semântica dos títulos. Em telas pequenas, H1 pode cair para 28 px e H2 para 20 px. Não use informação essencial abaixo de 12 px.

## Cores, espaço e componentes

Preserve a identidade azul definida para a plataforma. Para leitura, use os tokens de texto, superfície, borda, foco e estados de `app/globals.css`. Use a escala `--space-1` a `--space-10`, baseada em múltiplos de 4 px. Evite números arbitrários quando houver token correspondente.

Tabelas: cabeçalhos 12 px/600, células 14 px/400, valores de destaque 14 px/600, linhas de aproximadamente 44–48 px, padding 16 px horizontal e 12 px vertical. Alinhe números à direita e use `font-variant-numeric: tabular-nums`. Garanta rolagem horizontal em telas estreitas sem esconder colunas essenciais.

Na tabela de vendas diárias, **MP é um valor monetário em reais**, não uma porcentagem. A regra de cálculo e a coluna de origem no BI ainda precisam ser definidas antes da implementação funcional.

Menus: 14 px/500, item ativo 14 px/600, altura aproximada de 40 px. Formulários: labels 13 px/500 acima do campo, controles 14 px com altura de 44 px, estados de foco, erro e desabilitado visíveis. Botões: 14 px/600 com altura de 44 px. Cards: padding de 16–24 px; indicadores destacados 28–36 px/700.

Mantenha foco visível por teclado, contraste legível, `prefers-reduced-motion`, responsividade e caminhos de navegação existentes. Toda tela e funcionalidade dos blocos futuros deve ser utilizável em celular, incluindo menu móvel, controles acionáveis por toque e tabelas com rolagem horizontal acessível quando necessário. Antes de adicionar novas telas, use os tokens e classes compartilhadas; não crie uma escala paralela.

## Escopo por blocos

O Bloco 01 contém apenas interface e dados demonstrativos. As regras reais, persistência e controles operacionais pertencem aos blocos correspondentes e exigem a aprovação explícita do usuário para avanço.
