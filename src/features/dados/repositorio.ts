import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as refStorage, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFunctionsCliente, getStorageCliente } from '@/lib/firebase';
import {
  colAplicacoes,
  colBowelLogs,
  colCanetas,
  colFotosProgresso,
  colHidratacao,
  colHistoricoPeso,
  colMedicamentos,
  colMensagensSessao,
  colPlanosAlimentares,
  colProtocolos,
  colRefeicoes,
  colSessoesChat,
  colSintomas,
  refAgenda,
  refPerfil,
  refSementeCatalogo,
  refUsuario,
} from '@/lib/firestore';
import { proximaAplicacao } from '@/domain/aplicacao';
import { CATALOGO_VERSAO, entradasPendentes, paraMedicamento } from '@/domain/catalogo';
import { calcularMetaHidratacao } from '@/domain/hidratacao';
import { calcularMetaCalorica, calcularMetaProteina, macrosProporcionais } from '@/domain/refeicao';
import type {
  AnguloFoto,
  Aplicacao,
  MacrosRefeicao,
  Medicamento,
  Perfil,
  PlanoAlimentar,
  Protocolo,
  Refeicao,
  RegistroFoto,
  RegistroHidratacao,
  RegistroIntestino,
  RegistroPeso,
  RegistroRefeicao,
  RegistroSintoma,
} from '@/domain/tipos';

/**
 * Escritas no Firestore.
 *
 * Regra da casa: nenhuma regra de negócio mora aqui. Este módulo orquestra
 * `src/domain` e o Firestore; o cálculo em si é sempre da função pura.
 *
 * Invariante que mantém DadosProvider/DadosEvolucaoProvider sempre em dia sem
 * nenhuma sincronização manual: toda escrita aqui usa `new Date()` (nunca
 * `serverTimestamp()`) em qualquer campo usado por `orderBy`/`where` das
 * consultas em tempo real. O SDK do Firestore aplica escritas pendentes ao
 * cache local antes da confirmação do servidor — os listeners `onSnapshot`
 * dos providers já recebem o valor novo na hora, desde que o cache local
 * consiga avaliar os filtros da query contra o dado escrito. `serverTimestamp()`
 * grava `null` localmente até o servidor responder, então um campo assim
 * usado em `orderBy`/`where` faria o documento sumir ou desordenar na tela até
 * o round-trip completar — reintroduzindo exatamente o "stale data" que este
 * padrão existe para evitar.
 */

export async function garantirPerfil(uid: string, nome: string): Promise<void> {
  const perfil: Perfil = { nome, alturaCm: null, criadoEm: new Date() };
  // merge: chamado a cada login, não pode sobrescrever a altura já preenchida.
  await setDoc(refPerfil(uid), perfil, { merge: true });
}

export async function atualizarPerfil(uid: string, campos: Partial<Perfil>): Promise<void> {
  await setDoc(refPerfil(uid), campos as Perfil, { merge: true });
}

/**
 * Recalcula e grava o doc denormalizado da agenda.
 *
 * Precisa rodar depois de QUALQUER mudança em protocolo ou aplicações, senão
 * o lembrete dispara na data velha. `notificadaEm` volta a null porque a nova
 * data ainda não foi notificada.
 */
export async function sincronizarAgenda(
  uid: string,
  protocolo: Protocolo | null,
  aplicacoes: Aplicacao[],
): Promise<void> {
  if (!protocolo?.ativo) {
    await setDoc(refAgenda(uid), { proximaEm: null, notificadaEm: null, protocoloId: null });
    return;
  }

  await setDoc(refAgenda(uid), {
    proximaEm: proximaAplicacao(protocolo, aplicacoes),
    notificadaEm: null,
    protocoloId: protocolo.id,
  });
}

export type NovoProtocolo = Omit<Protocolo, 'id' | 'criadoEm' | 'ativo'>;

/**
 * Cria um protocolo e o torna o ativo.
 *
 * O modelo é de um protocolo ativo por vez: mudar de medicamento arquiva o
 * anterior em vez de apagá-lo, para o histórico de aplicações continuar
 * explicável depois.
 */
export async function criarProtocolo(
  uid: string,
  novo: NovoProtocolo,
  /**
   * Histórico já existente. Importa ao trocar de dose: sem ele, a agenda
   * agendaria a próxima ocorrência do dia-alvo mesmo tendo havido aplicação
   * ontem — o que marcaria uma dose fora do intervalo.
   */
  aplicacoesExistentes: Aplicacao[] = [],
): Promise<string> {
  const anteriores = await getDocs(query(colProtocolos(uid), where('ativo', '==', true)));

  const lote = writeBatch(getDb());
  anteriores.forEach((snap) => lote.update(snap.ref, { ativo: false }));
  await lote.commit();

  const criadoEm = new Date();
  const criado = await addDoc(colProtocolos(uid), { ...novo, ativo: true, criadoEm } as Protocolo);

  await sincronizarAgenda(
    uid,
    { ...novo, id: criado.id, ativo: true, criadoEm },
    aplicacoesExistentes,
  );

  return criado.id;
}

export async function atualizarProtocolo(
  uid: string,
  protocoloId: string,
  campos: Partial<Protocolo>,
): Promise<void> {
  await updateDoc(doc(colProtocolos(uid), protocoloId), campos);
}

export type NovaAplicacao = Omit<Aplicacao, 'id' | 'criadoEm'>;

/**
 * Registra uma aplicação e, no mesmo lote, dá baixa na dose da caneta.
 *
 * O lote é o que impede o estado inconsistente clássico: aplicação gravada
 * mas estoque intacto (ou o contrário) se a rede cair no meio.
 */
export async function registrarAplicacao(
  uid: string,
  nova: NovaAplicacao,
  protocolo: Protocolo,
  aplicacoesAnteriores: Aplicacao[],
): Promise<string> {
  const lote = writeBatch(getDb());

  const refNova = doc(colAplicacoes(uid));
  lote.set(refNova, { ...nova, criadoEm: new Date() } as Aplicacao);

  if (nova.canetaId && nova.status === 'aplicada') {
    // `increment` resolve no servidor: duas abas registrando ao mesmo tempo
    // não sobrescrevem a contagem uma da outra.
    lote.update(doc(colCanetas(uid), nova.canetaId), { dosesUsadas: increment(1) });
  }

  await lote.commit();

  const registrada: Aplicacao = { ...nova, id: refNova.id, criadoEm: new Date() };
  await sincronizarAgenda(uid, protocolo, [...aplicacoesAnteriores, registrada]);

  return refNova.id;
}

export async function excluirAplicacao(
  uid: string,
  aplicacaoId: string,
  protocolo: Protocolo | null,
  aplicacoesRestantes: Aplicacao[],
): Promise<void> {
  await deleteDoc(doc(colAplicacoes(uid), aplicacaoId));
  await sincronizarAgenda(uid, protocolo, aplicacoesRestantes);
}

export type NovoMedicamento = Omit<Medicamento, 'id' | 'criadoEm'>;

export async function criarMedicamento(uid: string, novo: NovoMedicamento): Promise<string> {
  const criado = await addDoc(colMedicamentos(uid), {
    ...novo,
    criadoEm: new Date(),
  } as Medicamento);
  return criado.id;
}

export async function atualizarMedicamento(
  uid: string,
  medicamentoId: string,
  campos: Partial<Medicamento>,
): Promise<void> {
  await updateDoc(doc(colMedicamentos(uid), medicamentoId), campos);
}

/**
 * Exclui o medicamento do catálogo da conta, e nada mais.
 *
 * Protocolos e canetas guardam o nome denormalizado, então nenhum registro
 * quebra e o histórico continua legível. O `medicamentoId` que sobrar
 * apontando para o nada é absorvido na leitura — varrer o histórico para
 * limpá-lo seria escrita em massa sem ganho.
 */
export async function excluirMedicamento(uid: string, medicamentoId: string): Promise<void> {
  await deleteDoc(doc(colMedicamentos(uid), medicamentoId));
}

/**
 * Semeia o catálogo embutido na conta, uma vez por versão.
 *
 * O id do documento é o `slug` da entrada, e não um id sorteado: se esta
 * função rodar duas vezes (duas abas, StrictMode, marcador perdido), o segundo
 * commit sobrescreve o mesmo doc em vez de duplicar o medicamento.
 *
 * O marcador entra no MESMO lote, então o commit é atômico: é impossível a
 * versão avançar sem os documentos entrarem.
 */
export async function semearMedicamentos(uid: string, versaoAplicada: number): Promise<void> {
  const pendentes = entradasPendentes(versaoAplicada);
  if (pendentes.length === 0) return;

  const lote = writeBatch(getDb());
  const criadoEm = new Date();

  pendentes.forEach((entrada) => {
    lote.set(doc(colMedicamentos(uid), entrada.slug), {
      ...paraMedicamento(entrada),
      criadoEm,
    } as Medicamento);
  });
  lote.set(refSementeCatalogo(uid), { versao: CATALOGO_VERSAO, semeadoEm: criadoEm });

  await lote.commit();
}

/**
 * Marca o catálogo como nunca semeado, para o hook repor a lista original.
 *
 * Só pode ser chamado a partir de uma ação explícita do usuário — é a única
 * situação em que faz sentido trazer de volta o que ele mesmo excluiu.
 */
export async function reporCatalogo(uid: string): Promise<void> {
  await semearMedicamentos(uid, 0);
}

export type NovoRegistroPeso = Omit<RegistroPeso, 'id'>;

export async function criarRegistroPeso(uid: string, novo: NovoRegistroPeso): Promise<string> {
  const criado = await addDoc(colHistoricoPeso(uid), novo as RegistroPeso);
  return criado.id;
}

/** Progressive profiling: só é chamado na primeira vez que a pessoa registra um peso sem altura salva. */
export async function atualizarAltura(uid: string, height: number): Promise<void> {
  await setDoc(refUsuario(uid), { height }, { merge: true });
}

export type NovoRegistroHidratacao = Omit<RegistroHidratacao, 'id'>;

export async function criarRegistroHidratacao(
  uid: string,
  novo: NovoRegistroHidratacao,
): Promise<string> {
  const criado = await addDoc(colHidratacao(uid), novo as RegistroHidratacao);
  return criado.id;
}

export async function excluirRegistroHidratacao(uid: string, registroId: string): Promise<void> {
  await deleteDoc(doc(colHidratacao(uid), registroId));
}

/**
 * `editadaManualmente` precisa ser sempre explícito: geração automática (a
 * partir do peso) grava `false`; edição pela pessoa ou aceite de uma
 * recalculação sugerida gravam `true`/`false` conforme o caso, nunca fica
 * implícito no call site.
 */
export async function atualizarMetaHidratacao(
  uid: string,
  hydration_goal: number,
  editadaManualmente: boolean,
): Promise<void> {
  await setDoc(
    refUsuario(uid),
    { hydration_goal, metaEditadaManualmente: editadaManualmente },
    { merge: true },
  );
}

export type NovoRegistroSintoma = Omit<RegistroSintoma, 'id'>;

export async function criarRegistroSintoma(
  uid: string,
  novo: NovoRegistroSintoma,
): Promise<string> {
  const criado = await addDoc(colSintomas(uid), novo as RegistroSintoma);
  return criado.id;
}

export async function excluirRegistroSintoma(uid: string, registroId: string): Promise<void> {
  await deleteDoc(doc(colSintomas(uid), registroId));
}

export type NovoRegistroIntestino = Omit<RegistroIntestino, 'id'>;

export async function criarRegistroIntestino(
  uid: string,
  novo: NovoRegistroIntestino,
): Promise<string> {
  const criado = await addDoc(colBowelLogs(uid), novo as RegistroIntestino);
  return criado.id;
}

export async function excluirRegistroIntestino(uid: string, registroId: string): Promise<void> {
  await deleteDoc(doc(colBowelLogs(uid), registroId));
}

export type NovoPlanoAlimentar = Omit<PlanoAlimentar, 'id' | 'createdAt'>;

/**
 * Preenche com a regra padrão do app qualquer meta do plano que tenha vindo
 * zerada (= não informada manualmente nem extraída de um upload). Valor > 0
 * já presente nunca é sobrescrito — nem pelo piso calórico, que só entra
 * quando não há nenhuma estimativa de calorias.
 */
async function completarMetasPlano(
  uid: string,
  metas: Pick<PlanoAlimentar, 'proteinGoalG' | 'kcalGoal' | 'waterGoalMl'>,
): Promise<Pick<PlanoAlimentar, 'proteinGoalG' | 'kcalGoal' | 'waterGoalMl'>> {
  const precisaPeso = metas.proteinGoalG <= 0 || metas.kcalGoal <= 0 || metas.waterGoalMl <= 0;
  const pesoKg = precisaPeso
    ? ((await getDocs(query(colHistoricoPeso(uid), orderBy('recordedAt', 'desc'), limit(1)))).docs[0]?.data()
        .weight ?? null)
    : null;

  return {
    proteinGoalG: metas.proteinGoalG > 0 ? metas.proteinGoalG : calcularMetaProteina(pesoKg),
    kcalGoal: metas.kcalGoal > 0 ? metas.kcalGoal : calcularMetaCalorica(pesoKg),
    waterGoalMl: metas.waterGoalMl > 0 ? metas.waterGoalMl : calcularMetaHidratacao(pesoKg),
  };
}

/**
 * Cria um plano alimentar. Se `isActive`, arquiva (isActive:false) todos os
 * outros planos da conta antes — mesmo desenho de `criarProtocolo`: um plano
 * ativo por vez.
 */
export async function criarPlanoAlimentar(uid: string, novo: NovoPlanoAlimentar): Promise<string> {
  if (novo.isActive) {
    const anteriores = await getDocs(
      query(colPlanosAlimentares(uid), where('isActive', '==', true)),
    );
    const lote = writeBatch(getDb());
    anteriores.forEach((snap) => lote.update(snap.ref, { isActive: false }));
    await lote.commit();
  }

  const metas = await completarMetasPlano(uid, novo);

  const criado = await addDoc(colPlanosAlimentares(uid), {
    ...novo,
    ...metas,
    createdAt: new Date(),
  } as PlanoAlimentar);

  // A meta de água do plano ativo manda na meta de hidratação do app inteiro
  // — sem isso, TelaHidratacao e o anel do Dashboard podem mostrar dois
  // números diferentes no mesmo dia.
  if (novo.isActive) {
    await atualizarMetaHidratacao(uid, metas.waterGoalMl, true);
  }

  return criado.id;
}

export async function excluirPlanoAlimentar(uid: string, planoId: string): Promise<void> {
  await deleteDoc(doc(colPlanosAlimentares(uid), planoId));
}

/**
 * Gera um plano provisório via IA a partir do peso informado e já cria/ativa
 * como Plano Alimentar — reaproveita `criarPlanoAlimentar` por inteiro, então
 * herda de graça o arquivamento dos outros planos, o preenchimento de metas
 * por peso e a sincronia com a meta de hidratação.
 */
export async function gerarPlanoAlimentarComIA(uid: string, weightKg: number): Promise<string> {
  const chamar = httpsCallable<{ weightKg: number }, { title: string; meals: Refeicao[] }>(
    getFunctionsCliente(),
    'gerarPlanoAlimentarIA',
  );
  const { data } = await chamar({ weightKg });

  return criarPlanoAlimentar(uid, {
    title: data.title,
    isActive: true,
    meals: data.meals,
    proteinGoalG: 0,
    kcalGoal: 0,
    waterGoalMl: 0,
  });
}

export async function atualizarPlanoAlimentar(
  uid: string,
  planoId: string,
  campos: Partial<PlanoAlimentar>,
): Promise<void> {
  await updateDoc(doc(colPlanosAlimentares(uid), planoId), campos);

  if (campos.waterGoalMl !== undefined && campos.waterGoalMl > 0) {
    await atualizarMetaHidratacao(uid, campos.waterGoalMl, true);
  }
}

/**
 * Sobe a foto para `users/{uid}/progress_photos/{arquivo}` e cria o registro
 * correspondente no Firestore. Nome do arquivo prefixado com um id aleatório
 * para duas fotos com o mesmo nome de arquivo não colidirem no Storage.
 */
export async function uploadFotoProgresso(
  uid: string,
  arquivo: File,
  angle: AnguloFoto,
): Promise<string> {
  const storagePath = `users/${uid}/progress_photos/${crypto.randomUUID()}-${arquivo.name}`;
  const referenciaArquivo = refStorage(getStorageCliente(), storagePath);

  await uploadBytes(referenciaArquivo, arquivo);
  const imageUrl = await getDownloadURL(referenciaArquivo);

  const criado = await addDoc(colFotosProgresso(uid), {
    imageUrl,
    storagePath,
    angle,
    recordedAt: new Date(),
  } as RegistroFoto);
  return criado.id;
}

/** Remove o arquivo do Storage e o registro do Firestore. */
export async function excluirFotoProgresso(uid: string, foto: RegistroFoto): Promise<void> {
  try {
    await deleteObject(refStorage(getStorageCliente(), foto.storagePath));
  } catch (falha) {
    // Arquivo já removido (ex.: exclusão duplicada) não deve impedir a
    // limpeza do doc — só um erro de fato inesperado é logado.
    const codigo = (falha as { code?: string }).code;
    if (codigo !== 'storage/object-not-found') throw falha;
  }
  await deleteDoc(doc(colFotosProgresso(uid), foto.id));
}

/**
 * Sobe a foto do prato para `users/{uid}/meals/{mealId}.jpg`. Não cria o
 * registro no Firestore — isso só acontece depois que a IA responde (ver
 * `criarRefeicaoPendente`).
 */
export async function uploadFotoRefeicao(
  uid: string,
  arquivo: File,
): Promise<{ imageUrl: string; storagePath: string }> {
  const storagePath = `users/${uid}/meals/${crypto.randomUUID()}.jpg`;
  const referenciaArquivo = refStorage(getStorageCliente(), storagePath);

  await uploadBytes(referenciaArquivo, arquivo);
  const imageUrl = await getDownloadURL(referenciaArquivo);

  return { imageUrl, storagePath };
}

/**
 * Cria o registro assim que a foto termina de subir (ou a descrição em texto
 * é enviada), com status `analyzing` — antes de chamar a IA, não depois. É o
 * que torna a análise resiliente a reload/fechar a aba no meio do caminho: o
 * rascunho existe no Firestore desde o início, então
 * `finalizarAnaliseRefeicao`/`marcarErroAnaliseRefeicao` só precisam
 * atualizá-lo, e a tela consegue retomar de onde parou.
 *
 * `imageUrl`/`storagePath` (origem foto) e `description` (origem texto) são
 * mutuamente exclusivos — o chamador passa um dos dois preenchido e o outro
 * `null`.
 */
export async function criarRefeicaoEmAnalise(
  uid: string,
  dados: Pick<RegistroRefeicao, 'imageUrl' | 'storagePath' | 'description'>,
): Promise<string> {
  const nova: Omit<RegistroRefeicao, 'id'> = {
    ...dados,
    items: [],
    macros: { protein: 0, carbs: 0, fat: 0, kcal: 0 },
    aiFeedback: '',
    status: 'analyzing',
    analysisError: null,
    consumedPercentage: null,
    createdAt: new Date(),
  };
  const criado = await addDoc(colRefeicoes(uid), nova as RegistroRefeicao);
  return criado.id;
}

/** Grava o resultado da IA e move o registro para `pending` (aguardando confirmação). */
export async function finalizarAnaliseRefeicao(
  uid: string,
  mealId: string,
  resultado: Pick<RegistroRefeicao, 'items' | 'macros' | 'aiFeedback'>,
): Promise<void> {
  await updateDoc(doc(colRefeicoes(uid), mealId), {
    ...resultado,
    status: 'pending',
    analysisError: null,
  });
}

/** Marca a análise como falha (erro ou timeout), preservando o registro para o usuário descartar ou tentar de novo. */
export async function marcarErroAnaliseRefeicao(
  uid: string,
  mealId: string,
  analysisError: string,
): Promise<void> {
  await updateDoc(doc(colRefeicoes(uid), mealId), { status: 'error', analysisError });
}

/** Atualiza os itens de uma refeição ainda pendente (usado pela edição manual antes de confirmar). */
export async function atualizarItensRefeicaoPendente(
  uid: string,
  mealId: string,
  items: RegistroRefeicao['items'],
): Promise<void> {
  await updateDoc(doc(colRefeicoes(uid), mealId), { items });
}

/**
 * Confirma quanto da refeição foi de fato consumido: recalcula os macros
 * proporcionalmente e marca como `completed`.
 */
export async function confirmarRefeicao(
  uid: string,
  mealId: string,
  percentual: number,
  macrosBase: MacrosRefeicao,
): Promise<void> {
  await updateDoc(doc(colRefeicoes(uid), mealId), {
    status: 'completed',
    consumedPercentage: percentual,
    macros: macrosProporcionais(macrosBase, percentual),
  });
}

/** Remove a foto do Storage associada à refeição, se houver — refeições de origem texto não têm nenhuma. */
async function excluirFotoRefeicaoSeExistir(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(refStorage(getStorageCliente(), storagePath));
  } catch (falha) {
    const codigo = (falha as { code?: string }).code;
    if (codigo !== 'storage/object-not-found') throw falha;
  }
}

/** Descarta um scan pendente: remove a foto do Storage (se houver) e o registro do Firestore. */
export async function descartarRefeicaoPendente(
  uid: string,
  refeicao: Pick<RegistroRefeicao, 'id' | 'storagePath'>,
): Promise<void> {
  await excluirFotoRefeicaoSeExistir(refeicao.storagePath);
  await deleteDoc(doc(colRefeicoes(uid), refeicao.id));
}

/** Exclui uma refeição já concluída: remove a foto do Storage (se houver) e o registro do Firestore. */
export async function excluirRefeicao(
  uid: string,
  refeicao: Pick<RegistroRefeicao, 'id' | 'storagePath'>,
): Promise<void> {
  await excluirFotoRefeicaoSeExistir(refeicao.storagePath);
  await deleteDoc(doc(colRefeicoes(uid), refeicao.id));
}

const PAGINA_EXCLUSAO_MENSAGENS = 450;

/**
 * Apaga uma sessão de chat inteira: a subcoleção `mensagens` não some junto
 * com o doc da sessão (Firestore não faz cascade delete), então é preciso
 * esvaziá-la em páginas antes — sem limite de tamanho de conversa, a
 * paginação repete até a coleção esvaziar.
 */
export async function excluirSessaoChat(uid: string, sessaoId: string): Promise<void> {
  const colMensagens = colMensagensSessao(uid, sessaoId);

  for (;;) {
    const pagina = await getDocs(query(colMensagens, limit(PAGINA_EXCLUSAO_MENSAGENS)));
    if (pagina.empty) break;

    const lote = writeBatch(getDb());
    pagina.docs.forEach((snap) => lote.delete(snap.ref));
    await lote.commit();

    if (pagina.size < PAGINA_EXCLUSAO_MENSAGENS) break;
  }

  await deleteDoc(doc(colSessoesChat(uid), sessaoId));
}

/* ---- Consultas prontas -------------------------------------------------- */

/**
 * Todos os protocolos, do mais novo ao mais antigo.
 *
 * Traz também os arquivados de propósito: mudar de dose cria um protocolo
 * novo, e o histórico de aplicações só continua explicável meses depois se
 * der para ver qual degrau valia em cada época.
 */
export const consultaProtocolos = (uid: string) =>
  query(colProtocolos(uid), orderBy('criadoEm', 'desc'));

export const consultaAplicacoes = (uid: string, maximo = 60) =>
  query(colAplicacoes(uid), orderBy('dataHora', 'desc'), limit(maximo));

export const consultaCanetasAtivas = (uid: string) =>
  query(colCanetas(uid), where('ativa', '==', true));

export const consultaHistoricoPeso = (uid: string, maximo = 5) =>
  query(colHistoricoPeso(uid), orderBy('recordedAt', 'desc'), limit(maximo));

export const consultaPlanosAlimentares = (uid: string) =>
  query(colPlanosAlimentares(uid), orderBy('createdAt', 'desc'));

export const consultaFotosProgresso = (uid: string) =>
  query(colFotosProgresso(uid), orderBy('recordedAt', 'desc'));

/** Refeições concluídas do dia corrente (hora local do dispositivo), da mais recente à mais antiga. */
export const consultaRefeicoesDeHojeConcluidas = (uid: string) => {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date();
  fimDoDia.setHours(23, 59, 59, 999);

  return query(
    colRefeicoes(uid),
    where('status', '==', 'completed'),
    where('createdAt', '>=', inicioDoDia),
    where('createdAt', '<=', fimDoDia),
    orderBy('createdAt', 'desc'),
  );
};

/** Todas as refeições concluídas do usuário, da mais recente à mais antiga. */
export const consultaTodasRefeicoesConcluidas = (uid: string, maximo = 200) =>
  query(colRefeicoes(uid), where('status', '==', 'completed'), orderBy('createdAt', 'desc'), limit(maximo));

/** Registros de hidratação do dia corrente (hora local do dispositivo), do mais recente ao mais antigo. */
export const consultaHidratacaoHoje = (uid: string) => {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date();
  fimDoDia.setHours(23, 59, 59, 999);

  return query(
    colHidratacao(uid),
    where('recordedAt', '>=', inicioDoDia),
    where('recordedAt', '<=', fimDoDia),
    orderBy('recordedAt', 'desc'),
  );
};

/** Sintomas registrados nos últimos 7 dias, do mais recente ao mais antigo. */
export const consultaSintomasUltimos7Dias = (uid: string) => {
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  seteDiasAtras.setHours(0, 0, 0, 0);

  return query(
    colSintomas(uid),
    where('recordedAt', '>=', seteDiasAtras),
    orderBy('recordedAt', 'desc'),
  );
};

/**
 * Últimos registros de evacuação, do mais recente ao mais antigo, sem corte por
 * data — o alerta de constipação precisa enxergar o último registro mesmo que
 * tenha sido há semanas.
 */
export const consultaIntestinoRecentes = (uid: string, maximo = 10) =>
  query(colBowelLogs(uid), orderBy('recordedAt', 'desc'), limit(maximo));

/**
 * O catálogo da conta, sem ordenação do servidor.
 *
 * A ordem de exibição sai de `ordenarMedicamentos`: a ordenação do Firestore é
 * por byte e jogaria "Ávita" para depois de "Zempneo". De quebra, evita índice.
 */
export const consultaMedicamentos = (uid: string) => query(colMedicamentos(uid));

export const consultaSessoesChat = (uid: string) =>
  query(colSessoesChat(uid), orderBy('updatedAt', 'desc'));

export const consultaMensagensSessao = (uid: string, sessaoId: string, maximo = 200) =>
  query(colMensagensSessao(uid, sessaoId), orderBy('createdAt', 'asc'), limit(maximo));
