# Base de Conhecimento — Dose Certa-AI

## 1. Visão Geral

O Dose Certa-AI é um PWA (Progressive Web App) de apoio e registro para acompanhamento de tratamentos com canetas emagrecedoras GLP-1 (semaglutida, tirzepatida, liraglutida). O aplicativo organiza aplicações de dose, titulação, rodízio de local de aplicação, controle de estoque e validade da caneta, evolução de peso e registro de efeitos colaterais.

De forma complementar, o app inclui um módulo de apoio nutricional (scanner de refeições por IA, planos alimentares, hidratação e registros de sintomas), reunidos na aba "Evolução".

O Dose Certa-AI não é um dispositivo médico.

## 2. Regras e Limitações

- O aplicativo NÃO prescreve doses, NÃO gera planos alimentares/dietas e NÃO substitui o acompanhamento de um médico ou nutricionista.
- As doses exibidas no app são as constantes na bula do produto; o app não indica nem recomenda dose alguma — a prescrição deve ser sempre seguida conforme orientação profissional.
- O papel do app é exclusivamente organizar e registrar o que o usuário informa (aplicações, refeições, peso, sintomas), funcionando como apoio e não como fonte de prescrição.
- Toda funcionalidade de análise por IA (scanner de refeições) apenas estima e registra o que está no prato com base na foto enviada; não avalia adequação nutricional, segurança ou emite recomendação médica.

## 3. Funcionalidade do Scanner de Refeições

O fluxo do scanner segue estes passos:

1. O usuário toca em "Escanear Prato" e tira (ou seleciona) uma foto da refeição.
2. A foto é enviada e uma IA (Gemini) analisa a imagem, identificando os itens do prato e estimando os macronutrientes do prato completo: proteínas, carboidratos, gorduras e calorias (kcal). A IA também gera um breve feedback textual comparando a refeição com o plano alimentar ativo do usuário, se houver.
3. O usuário pode revisar e editar os itens identificados antes de confirmar.
4. O usuário DEVE confirmar quanto da refeição realmente consumiu, escolhendo entre três opções: "Comi Tudo (100%)", "Comi Metade (50%)" ou "Comi Pouco (25%)".
5. Com base na opção escolhida, o sistema recalcula os macros proporcionalmente (cada valor — proteína, carboidrato, gordura, kcal — é multiplicado pelo percentual selecionado e arredondado), substituindo os valores originais estimados pela IA pelos valores efetivamente registrados como consumidos.
6. O usuário também pode descartar a análise pendente sem confirmá-la.

## 4. Resiliência de Dados (Rascunho Offline)

Ao tirar uma foto e iniciar a análise, é criado um registro de refeição pendente. Enquanto essa refeição não é confirmada (ou descartada) pelo usuário, o identificador desse rascunho fica salvo localmente no dispositivo (localStorage). Se o usuário fechar o app antes de confirmar, ao reabri-lo o app recupera automaticamente esse rascunho pendente e retoma a tela de confirmação de onde parou, sem perder a foto, os itens identificados ou os macros calculados. Caso o rascunho referenciado não seja mais encontrado, o app limpa a referência local e retorna à tela inicial do scanner.

## 5. Outros Módulos

- **Histórico de refeições expansível**: as refeições registradas (do dia ou do histórico completo, agrupado por data) são exibidas em cartões que podem ser expandidos com um toque. Colapsado, o cartão mostra miniatura da foto, nome dos itens, calorias e percentual consumido. Expandido, revela o detalhamento completo dos macros, a lista de itens com quantidades já ajustadas ao percentual confirmado, e o feedback gerado pela IA.
- **Gráfico de evolução de peso**: exibe a evolução do peso do usuário ao longo dos últimos registros, com destaque visual para os dias em que houve aplicação de dose, permitindo correlacionar visualmente o tratamento com a evolução do peso. O peso, a circunferência da cintura e observações são registrados manualmente pelo usuário em tela própria.
