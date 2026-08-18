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
- As metas nutricionais calculadas automaticamente (seção 8) são estimativas de apoio baseadas em peso corporal, não prescrições nutricionais — podem e devem ser ajustadas pelo usuário conforme orientação profissional.

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

## 5. Histórico de Refeições Expansível

As refeições registradas (do dia ou do histórico completo, agrupado por data) são exibidas em cartões que podem ser expandidos com um toque. Colapsado, o cartão mostra miniatura da foto, nome dos itens, calorias e percentual consumido. Expandido, revela o detalhamento completo dos macros, a lista de itens com quantidades já ajustadas ao percentual confirmado, e o feedback gerado pela IA.

## 6. Dashboard Central (Tela Início)

### Resumo Nutricional de Hoje

Na tela Início, um card com três anéis de progresso (Proteínas, Calorias e Água) mostra o quanto o usuário já consumiu no dia em relação às metas do seu Plano Alimentar Ativo:

- Cada anel soma o consumo do dia (proteína e calorias das refeições confirmadas no scanner; volume das hidratações registradas) e o cruza com a meta correspondente do plano ativo (proteína em g, calorias em kcal, água em ml).
- Um botão "Ver metas" / "Ver consumo" alterna o número exibido no centro de cada anel entre o valor já consumido e a meta do dia; o preenchimento visual do anel é sempre proporcional à meta.
- As metas funcionam da mesma forma independentemente de como o plano foi criado (manual, upload de arquivo ou gerado por IA).

**Regra de bloqueio**: se o usuário não tiver nenhum Plano Alimentar ativo, os três anéis aparecem zerados, acinzentados e desabilitados (não respondem a toque), acompanhados do texto "Ative um Plano Alimentar (Manual, Upload ou via IA) para acompanhar suas metas diárias." e de um botão "Ir para Plano Alimentar" que leva à tela de dieta para criação do plano.

### Curva de Evolução Cruzada

O gráfico principal da tela Início ("Curva de Evolução") exibe a evolução do peso do usuário ao longo do tempo sobrepondo marcadores visuais exatos dos dias em que houve aplicação de medicação:

- Dias em que o peso foi registrado e a dose foi aplicada recebem um marcador roxo preenchido no ponto do gráfico.
- Dias em que a dose foi aplicada mas o peso não foi registrado naquele dia recebem um marcador tracejado/vazado (posição estimada), para não deixar a aplicação "invisível" no gráfico mesmo sem pesagem naquele dia.
- Ao tocar/passar o mouse em um marcador de aplicação, um selo "Aplicação" aparece na dica (tooltip) daquele ponto.
- Essa curva permite ao usuário correlacionar visualmente a evolução do peso com a regularidade do tratamento.

## 7. Central de Aplicações

O menu antigamente chamado "Histórico" agora se chama **Aplicações**. É a central de gerenciamento da caneta e do tratamento, reunindo:

- **Contagem regressiva**: quantos dias faltam para a próxima aplicação da dose. Mostra "Hoje" quando a aplicação é no dia corrente, e um alerta visual quando a aplicação está atrasada, indicando os dias de atraso.
- **Registro de novas aplicações**: botão "Registrar aplicação" abre um formulário para lançar uma aplicação recém-realizada.
- **Dados e frequência do tratamento atual**: um card "Seu tratamento" mostra o medicamento em uso, a dose atual, a frequência (semanal, com o dia da semana, ou diária), o horário habitual de aplicação e a janela de tolerância para repor uma dose, com opção de alterar esses dados.
- Também reúne um resumo de aplicações feitas/puladas, orientação para quando uma dose é esquecida, um mini-gráfico das doses recentes e a lista completa de aplicações já registradas (com opção de exclusão).

## 8. Inteligência Nutricional (Cálculo Automático de Metas)

Sempre que um Plano Alimentar é criado — seja por upload, preenchimento manual ou geração por IA —, o aplicativo calcula automaticamente metas de segurança para os campos que não foram informados, usando o peso mais recente registrado pelo usuário:

- **Meta de proteína**: peso corporal (kg) × 1,35 g de proteína por kg.
- **Meta de calorias**: peso corporal (kg) × 24 kcal por kg, respeitando sempre um piso de segurança mínimo de 1.200 kcal diárias (a meta nunca fica abaixo desse valor).
- A meta de água também é preenchida automaticamente pelo mesmo mecanismo.
- Esse cálculo só preenche campos que estiverem vazios/zerados; se o usuário (ou a IA a partir de um upload) já informou um valor para proteína, calorias ou água, esse valor não é sobrescrito.
- O usuário pode revisar e editar essas metas a qualquer momento na tela "Plano Alimentar", dentro do card "Plano Ativo", na seção "Metas diárias deste plano", usando o botão "Editar metas" (campos de Proteína, Calorias e Água) e salvando com "Salvar metas".

## 9. Lembretes (Notificações Push)

O app envia lembretes automáticos (fuso horário de São Paulo) para apoiar a adesão ao tratamento e às metas nutricionais. Destacam-se dois lembretes nutricionais adicionados à grade:

- **16:00 — Alerta da tarde**: disparado se o consumo de proteína OU de calorias do dia estiver abaixo de 50% da meta do Plano Alimentar Ativo. Mensagem incentivando um lanche proteico ("Proteja sua massa muscular!").
- **20:00 — Reta final**: disparado se o consumo de proteína OU de calorias estiver abaixo de 80% da meta, ou se as calorias do dia ainda estiverem abaixo do piso de segurança de 1.200 kcal. Mensagem incentivando fechar o dia com um jantar equilibrado ("Ainda dá tempo de nutrir seu corpo hoje!").

Esses dois lembretes só fazem sentido (e só dependem de meta) quando há um Plano Alimentar ativo — sem plano, não há meta de referência para disparar o alerta.

Outros lembretes já existentes na mesma grade, para contexto: aviso diário de aplicação da dose (08:00), acompanhamento de sintomas relatados no dia anterior (10:00), lembretes de hidratação (15:00 e 19:00) e um check-in semanal de peso às sextas-feiras (18:00) caso não haja registro de peso há 7 dias.
