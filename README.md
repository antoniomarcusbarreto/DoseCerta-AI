# DoseCerta

PWA para acompanhamento de canetas emagrecedoras (GLP-1: semaglutida, tirzepatida, liraglutida): aplicações, titulação de dose, rodízio de local, estoque e validade da caneta, peso e efeitos colaterais.

> **Não é um dispositivo médico.** O app organiza e registra; não prescreve. Toda sugestão de titulação ou de conduta em dose esquecida é informação de apoio e não substitui orientação de quem prescreveu.

## Rodando

```bash
npm install
npm run dev          # http://localhost:5173
```

O app sobe sem Firebase configurado — nesse estado o login fica desabilitado, mas a rota `/kitchen-sink` funciona.

### Firebase

```bash
cp .env.example .env.local   # e preencha as chaves VITE_FIREBASE_*
```

As chaves `VITE_*` são públicas por natureza: o que protege os dados são as `firestore.rules`, não o segredo delas.

```bash
firebase deploy --only firestore:rules   # publicar as regras
firebase emulators:start                 # auth :9099 · firestore :8080
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm run typecheck` | Só a checagem de tipos |
| `npm test` | Testes das regras de domínio (Vitest) |
| `npm run icones` | Regera os PNGs do manifest a partir de `public/icons/icon.svg` |

## Estrutura

```
src/
├─ app/          Casca: rotas, Layout, BarraAbas, ErrorBoundary, AuthGate,
│                Home, Ajustes, Evolução, KitchenSink
├─ components/   Design system (Hero, StatBig, HairlineChart, ArcGauge…)
├─ features/
│  ├─ auth/      Login, cadastro, validação de sessão
│  ├─ dados/     DadosProvider (assinatura única) + repositório de escritas
│  ├─ protocolo/ Onboarding, FormProtocolo, TelaTratamento
│  ├─ medicamento/ Catálogo: TelaMedicamentos, FormMedicamento, semente
│  └─ aplicacao/ FolhaRegistro, TelaHistorico
├─ domain/       Regras puras, sem React nem Firebase — testáveis isoladamente
├─ lib/          Firebase, Firestore tipado, service worker
└─ styles/       tokens.css + escala tipográfica
```

### Navegação

Barra de abas fixa com quatro itens: **Início**, **Histórico**, **Evolução** e **Ajustes**. Quatro é deliberado — funcionalidades novas entram na lista de Ajustes (Tratamento, Medicamentos, Canetas, Lembretes, Meus dados), então a barra não cresce. Cinco rótulos já ficam apertados em tela estreita e o alvo de toque encolhe junto.

Sem protocolo cadastrado o onboarding toma a tela inteira: abas vazias na primeira abertura só confundiriam.

**`/kitchen-sink`** é a vitrine do design system com dados falsos. Serve para revisar o visual sem depender de sessão nem de dados reais — use-a como referência ao criar telas novas.

## Decisões que não são óbvias no código

- **O catálogo de medicamentos é semeado, não embutido.** As canetas mais usadas entram em `users/{uid}/medicamentos` na primeira abertura da conta, com o slug da entrada como id do documento e um marcador de versão em `users/{uid}/meta/catalogo` gravado no mesmo lote. Daí em diante a lista é do usuário: editar e excluir são livres, e a semente nunca reescreve uma versão já aplicada — por isso um medicamento excluído não volta sozinho, e uma versão nova do app só acrescenta as entradas novas. O marcador mora num doc próprio porque `garantirPerfil` reescreve o doc de perfil inteiro a cada login. Para evoluir o catálogo, veja as regras no topo de `src/domain/catalogo.ts`.
- **O catálogo lista doses, não indica dose.** `Medicamento.dosesMg` são as doses que existem na bula do produto, oferecidas como opções factuais: nenhuma vem pré-selecionada, nenhum plano de titulação é montado, e o formulário sempre aceita uma dose fora da lista (manipulado, fracionamento). Há um teste em `catalogo.test.ts` que falha se alguém adicionar campo de recomendação ao catálogo.
- **Service worker network-first.** Cache-first puro congelaria o shell do app: uma vez cacheados o `index.html` e o bundle, seguiriam sendo servidos mesmo após um deploy com correção. Suba `CACHE_NAME` em `public/sw.js` junto com qualquer correção relevante. O listener de `controllerchange` recarrega abas já abertas quando um SW novo assume.
- **Sessão revalidada ao voltar ao primeiro plano.** PWA em celular não recarrega a página ao trocar de app; sem isso, uma conta excluída seguiria "logada" indefinidamente. Só um conjunto fechado de códigos derruba a sessão (`src/features/auth/sessao.ts`) — erro de rede nunca derruba, senão o app pediria login a cada oscilação.
- **Herói é posicionado.** Elementos com `position: relative` pintam acima do conteúdo em fluxo. Qualquer `main` que suba por cima do herói com margem negativa precisa de `relative z-10`, ou o topo do primeiro card fica escondido.
- **Contraste acima da referência visual.** O design de origem usa cinzas abaixo do mínimo WCAG. Mantivemos a estética (hairline, monocromático, número gigante leve), mas `--ink-muted` e `--on-hero-muted` passam em AA. O cinza quase invisível vive só em `--ink-faint`, restrito a ornamento.
- **Gradiente completo só no herói.** A base do gradiente é quase branca. Telas que são texto branco sobre gradiente de ponta a ponta (login, splash, erro) usam apenas o trecho escuro — no gradiente inteiro o rodapé ficaria ilegível.
- **`base="auto"` no gráfico de peso.** Ancorar peso em zero achata a série: 89 e 98 kg viram barras quase idênticas.
- **Mudar de dose cria um protocolo novo.** O anterior é arquivado (`ativo: false`), não apagado. As aplicações antigas continuam apontando para o protocolo que valia na época — é isso que permite cruzar a data de cada degrau com peso e efeito colateral depois. Ajustar dia/horário, por outro lado, edita no lugar: não é degrau de titulação. Por isso `TelaTratamento` trava medicamento e dose no modo "Ajustar".
- **`DadosProvider` acima do `Layout`.** Chamar os hooks de consulta em cada tela abriria um listener por tela montada. Com o provider é um listener por coleção e todas as abas leem do mesmo estado.
- **Nada de `navigate()` imperativo após login.** Quem redireciona é o estado de auth. Navegar na mão cria uma corrida: o `AuthGate` olha a sessão antes do `onAuthStateChanged` propagar, vê `null` e devolve a pessoa para a tela de entrar.

## Estado atual

Fases 1 e 2 concluídas e validadas contra o projeto real (`dosecertaai-edaa2`): casca, design system, PWA, autenticação, regras do Firestore, regras de domínio com testes, cadastro de protocolo, registro de aplicação com rodízio de local e histórico.

Ciclo verificado de ponta a ponta: criar conta → protocolo → registrar aplicação → recarregar → entrar de novo em navegador limpo, com os dados vindo do servidor. As regras foram verificadas negando leitura entre contas diferentes (403 em todas as coleções).

Faltam: estoque e validade da caneta (Fase 3), peso e efeitos colaterais (Fase 4), lembretes push (Fase 5), relatório e exclusão de conta (Fase 6).
