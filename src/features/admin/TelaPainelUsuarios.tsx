import { useEffect, useMemo, useState } from 'react';
import { SheetCard } from '@/components/SheetCard';
import { Field } from '@/components/Field';
import { Alerta } from '@/components/Alerta';
import {
  adminAlterarSenha,
  adminDefinirBloqueio,
  adminDefinirGratuidade,
  adminEnviarPushTeste,
  adminForcarRerregistroDispositivos,
  adminListarUsuarios,
  adminRessincronizarNotificacoes,
  type ResultadoEnvioTeste,
  type UsuarioPainel,
} from './api';

/** Espelha `MAX_ALVOS_TESTE` no servidor — aqui só para avisar antes da chamada. */
const MAX_ALVOS_TESTE = 20;

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

/*
 * Para "último push" a hora é o que importa: o que se quer saber é se o envio
 * bateu com o horário da rotina (15:00, 16:00...), não só o dia.
 */
function formatarDataHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function ModalSenha({ usuario, onFechar, onSalvo }: { usuario: UsuarioPainel; onFechar: () => void; onSalvo: () => void }) {
  const [novaSenha, setNovaSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (novaSenha.length < 6) {
      setErro('A senha precisa de pelo menos 6 caracteres.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await adminAlterarSenha(usuario.uid, novaSenha);
      onSalvo();
    } catch {
      setErro('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5" style={{ background: 'var(--surface-card)' }}>
        <h2 className="t-title text-ink">Alterar senha</h2>
        <p className="t-label mt-1 text-ink-muted">{usuario.email ?? usuario.uid}</p>

        <div className="mt-4 space-y-3">
          {erro ? <Alerta tom="danger" titulo={erro} /> : null}
          <Field
            rotulo="Nova senha"
            type="password"
            minLength={6}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            autoFocus
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="t-label px-4 py-2 text-ink-muted hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="rounded-full bg-emerald-600 px-5 py-2 t-label font-semibold text-white hover:bg-emerald-700 disabled:opacity-45"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalGratuidade({ usuario, onFechar, onSalvo }: { usuario: UsuarioPainel; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState(
    usuario.freeTrialEndsAt ? usuario.freeTrialEndsAt.slice(0, 10) : '',
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!data) {
      setErro('Escolha uma data.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await adminDefinirGratuidade(usuario.uid, new Date(`${data}T23:59:59`).getTime());
      onSalvo();
    } catch {
      setErro('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: 'var(--surface-card)' }}>
        <h2 className="t-title text-ink">Tempo de gratuidade</h2>
        <p className="t-label mt-1 text-ink-muted">{usuario.email ?? usuario.uid}</p>

        <div className="mt-4 space-y-3">
          {erro ? <Alerta tom="danger" titulo={erro} /> : null}
          <Field rotulo="Gratuidade até" type="date" value={data} onChange={(e) => setData(e.target.value)} autoFocus />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="t-label px-4 py-2 text-ink-muted hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="rounded-full bg-emerald-600 px-5 py-2 t-label font-semibold text-white hover:bg-emerald-700 disabled:opacity-45"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/*
 * Disparo direcionado: os alvos vêm prontos de quem abriu o modal (uma linha da
 * tabela ou a seleção por checkbox). Chama `adminEnviarPushTeste`, que exercita
 * o mesmo caminho de envio das rotinas agendadas — inclusive a poda.
 *
 * O modal não fecha sozinho ao concluir: o resultado POR ALVO é o produto da
 * ação. `0 dispositivo(s)` é o desfecho que mais importa ver (conta sem token
 * ativo), e ele desapareceria num fechamento automático.
 */
function ModalEnvioTeste({
  alvos,
  onFechar,
  onEnviado,
}: {
  alvos: UsuarioPainel[];
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [titulo, setTitulo] = useState('Teste de notificação');
  const [corpo, setCorpo] = useState('Se você recebeu isso, o push está funcionando neste aparelho.');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoEnvioTeste[] | null>(null);

  async function enviar() {
    if (!titulo.trim() || !corpo.trim()) {
      setErro('Preencha título e mensagem.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await adminEnviarPushTeste({
        titulo: titulo.trim(),
        corpo: corpo.trim(),
        uids: alvos.map((alvo) => alvo.uid),
      });
      setResultados(resposta.resultados);
      onEnviado();
    } catch {
      setErro('Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl p-5"
        style={{ background: 'var(--surface-card)' }}
      >
        <h2 className="t-title text-ink">Enviar push de teste</h2>
        <p className="t-label mt-1 text-ink-muted">
          {alvos.length === 1
            ? (alvos[0].email ?? alvos[0].uid)
            : `${alvos.length} destinatário(s) selecionado(s)`}
        </p>

        {alvos.length > 1 ? (
          <ul
            className="mt-2 max-h-28 overflow-y-auto rounded-xl px-3 py-2"
            style={{ background: 'var(--surface-sunken)' }}
          >
            {alvos.map((alvo) => (
              <li key={alvo.uid} className="t-label text-ink-muted">
                {alvo.email ?? alvo.uid}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 space-y-3">
          {erro ? <Alerta tom="danger" titulo={erro} /> : null}

          {resultados ? (
            <div>
              <p className="t-label text-ink">Resultado</p>
              <ul className="mt-1 space-y-1">
                {resultados.map((resultado) => (
                  <li
                    key={resultado.uid}
                    className="t-label"
                    style={{ color: resultado.enviados > 0 ? 'var(--ok)' : 'var(--danger)' }}
                  >
                    {resultado.email ?? resultado.uid} — {resultado.erro ?? `${resultado.enviados} dispositivo(s)`}
                  </li>
                ))}
              </ul>
              <p className="t-caption mt-2 text-ink-muted">
                O painel só mostra "Recebido" depois que o aparelho confirmar de fato.
              </p>
            </div>
          ) : (
            <>
              <Field
                rotulo="Título"
                required
                maxLength={80}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                autoFocus
              />
              <div className="flex flex-col">
                <label htmlFor="corpo-teste" className="t-caption text-ink-muted">
                  Mensagem
                </label>
                <textarea
                  id="corpo-teste"
                  required
                  rows={3}
                  maxLength={200}
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                  className="mt-1.5 block w-full border px-4 py-2.5 t-body text-ink outline-none"
                  style={{
                    borderRadius: 'var(--r-field)',
                    background: 'var(--surface-sunken)',
                    borderColor: 'var(--border-hair)',
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="t-label px-4 py-2 text-ink-muted hover:text-ink">
            {resultados ? 'Fechar' : 'Cancelar'}
          </button>
          {resultados ? null : (
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando}
              className="rounded-full bg-emerald-600 px-5 py-2 t-label font-semibold text-white hover:bg-emerald-700 disabled:opacity-45"
            >
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/*
 * Célula "Notificações". Fechada por padrão: como a poda nunca apaga um
 * registro, só o marca como `inativo`, o histórico cresce para sempre e
 * imprimi-lo inteiro em toda linha torna a tabela ilegível.
 *
 * O que NÃO pode ficar escondido é o sintoma: conta sem dispositivo e
 * dispositivo fantasma continuam visíveis com a célula fechada — é para
 * acusá-los que esta coluna existe.
 */
function CelulaNotificacoes({
  usuario,
  expandido,
  onAlternar,
}: {
  usuario: UsuarioPainel;
  expandido: boolean;
  onAlternar: () => void;
}) {
  const ativos = usuario.dispositivos.filter((dispositivo) => dispositivo.status === 'ativo');
  const inativos = usuario.dispositivos.length - ativos.length;
  /*
   * `usuario.tokens` é o agregado `totalDispositivosAtivos` do doc do usuário;
   * `ativos` vem da subcoleção. Divergência entre os dois é justamente o que
   * "Ressincronizar notificações" conserta — mostramos o maior para não exibir
   * um falso "sem dispositivo" enquanto o agregado está atrasado.
   */
  const totalAtivos = Math.max(usuario.tokens, ativos.length);

  // Ativos primeiro: o inativo é histórico, não é o que se está diagnosticando.
  const ordenados = [...usuario.dispositivos].sort((a, b) =>
    a.status === b.status ? 0 : a.status === 'ativo' ? -1 : 1,
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="t-label rounded-full px-2.5 py-1"
          style={{
            background: totalAtivos > 0 ? 'var(--ok-soft)' : 'var(--danger-soft)',
            color: totalAtivos > 0 ? 'var(--ok)' : 'var(--danger)',
          }}
        >
          {totalAtivos > 0
            ? `${totalAtivos} dispositivo${totalAtivos > 1 ? 's' : ''} ativo${totalAtivos > 1 ? 's' : ''}`
            : 'Sem dispositivo'}
        </span>
      </div>

      {usuario.dispositivos.length > 0 || usuario.ultimoPushEnviadoEm ? (
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={expandido}
          className="t-label mt-1 text-ink-muted hover:text-ink hover:underline"
        >
          {expandido
            ? 'Ocultar detalhes'
            : `Ver detalhes${inativos > 0 ? ` (${inativos} inativo${inativos > 1 ? 's' : ''})` : ''}`}
        </button>
      ) : null}

      {expandido ? (
        <div className="mt-1">
          <p className="t-label text-ink-muted">
            Enviado: {formatarDataHora(usuario.ultimoPushEnviadoEm)}
            <br />
            Recebido: {formatarDataHora(usuario.ultimoPushRecebidoEm)}
          </p>
          {ordenados.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {ordenados.map((dispositivo) => (
                <li
                  key={dispositivo.id}
                  className="t-label text-ink-muted"
                  style={{ opacity: dispositivo.status === 'ativo' ? 1 : 0.6 }}
                >
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      background: 'var(--surface-sunken)',
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {dispositivo.plataforma ?? 'desconhecida'} · {dispositivo.status}
                  </span>
                  <br />
                  últ. recebido: {formatarDataHora(dispositivo.ultimoRecebimentoEm)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function TelaPainelUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [alterandoBloqueio, setAlterandoBloqueio] = useState<string | null>(null);

  const [modalSenha, setModalSenha] = useState<UsuarioPainel | null>(null);
  const [modalGratuidade, setModalGratuidade] = useState<UsuarioPainel | null>(null);
  const [alvosTeste, setAlvosTeste] = useState<UsuarioPainel[] | null>(null);

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const [ressincronizando, setRessincronizando] = useState(false);
  const [resultadoRessincronizacao, setResultadoRessincronizacao] = useState<string | null>(null);

  const [rerregistrando, setRerregistrando] = useState<string | null>(null);


  async function recarregar() {
    setErro(null);
    setCarregando(true);
    try {
      const lista = await adminListarUsuarios();
      setUsuarios(lista);
    } catch {
      setErro('Não foi possível carregar os usuários.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter(
      (usuario) =>
        usuario.email?.toLowerCase().includes(termo) ||
        usuario.displayName?.toLowerCase().includes(termo),
    );
  }, [usuarios, busca]);

  /*
   * Sai de `usuarios`, não de `usuariosFiltrados`: quem foi selecionado antes
   * de digitar na busca continua valendo como destinatário — a seleção é a
   * intenção do admin, o filtro é só uma lente sobre a tabela.
   */
  const usuariosSelecionados = useMemo(
    () => usuarios.filter((usuario) => selecionados.has(usuario.uid)),
    [usuarios, selecionados],
  );

  const todosFiltradosSelecionados =
    usuariosFiltrados.length > 0 &&
    usuariosFiltrados.every((usuario) => selecionados.has(usuario.uid));

  function alternarExpandido(uid: string) {
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(uid)) proximo.delete(uid);
      else proximo.add(uid);
      return proximo;
    });
  }

  function alternarSelecionado(uid: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(uid)) proximo.delete(uid);
      else proximo.add(uid);
      return proximo;
    });
  }

  /*
   * "Selecionar todos" age só sobre os FILTRADOS: com uma busca ativa, marcar
   * a base inteira seria justamente a surpresa que o disparo direcionado
   * existe para evitar.
   */
  function alternarTodosFiltrados() {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      for (const usuario of usuariosFiltrados) {
        if (todosFiltradosSelecionados) proximo.delete(usuario.uid);
        else proximo.add(usuario.uid);
      }
      return proximo;
    });
  }

  async function alternarBloqueio(usuario: UsuarioPainel) {
    setAlterandoBloqueio(usuario.uid);
    try {
      await adminDefinirBloqueio(usuario.uid, !usuario.disabled);
      setUsuarios((atual) =>
        atual.map((item) => (item.uid === usuario.uid ? { ...item, disabled: !item.disabled } : item)),
      );
    } catch {
      setErro('Não foi possível atualizar o bloqueio deste usuário.');
    } finally {
      setAlterandoBloqueio(null);
    }
  }

  /*
   * Desativa os registros de dispositivo da conta, forçando o app a gerar um
   * token novo no próximo uso. Para quando os registros estão obsoletos mas o
   * FCM ainda os aceita: os envios "dão certo", nada chega no aparelho, e
   * esperar a poda automática levaria dias de silêncio acumulado.
   */
  async function forcarRerregistro(usuario: UsuarioPainel) {
    const alvo = usuario.email ?? usuario.uid;
    if (
      !window.confirm(
        `Desativar os ${usuario.dispositivos.length} registro(s) de dispositivo de ${alvo}? ` +
          'O app vai registrar um token novo automaticamente no próximo uso.',
      )
    ) {
      return;
    }

    setRerregistrando(usuario.uid);
    setErro(null);
    try {
      const { desativados } = await adminForcarRerregistroDispositivos(usuario.uid);
      setResultadoRessincronizacao(`${desativados} dispositivo(s) desativado(s) para ${alvo}.`);
      await recarregar();
    } catch {
      setErro('Não foi possível resetar os dispositivos deste usuário.');
    } finally {
      setRerregistrando(null);
    }
  }

  /*
   * Ação manual, não um botão de rotina: recalcula `notificacoesAtivas` e
   * `totalDispositivosAtivos` em TODA a base a partir da subcoleção
   * `dispositivos` de cada usuário. Útil se os campos agregados algum dia
   * divergirem por edição manual no Firestore.
   */
  async function ressincronizarNotificacoes() {
    setRessincronizando(true);
    setResultadoRessincronizacao(null);
    setErro(null);
    try {
      const { totalUsuarios, atualizados } = await adminRessincronizarNotificacoes();
      setResultadoRessincronizacao(
        `${atualizados} de ${totalUsuarios} conta(s) corrigida(s).`,
      );
      await recarregar();
    } catch {
      setErro('Não foi possível ressincronizar as notificações.');
    } finally {
      setRessincronizando(false);
    }
  }

  /*
   * Desativa os registros de inscrição da conta, forçando o app a criar uma
   * inscrição nova no próximo uso.
   */
  const bordaHair = { borderColor: 'var(--border-hair)' };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="t-title text-ink">Usuários</h1>
        <button
          type="button"
          onClick={() => void ressincronizarNotificacoes()}
          disabled={ressincronizando}
          className="t-label rounded-full border px-3 py-1.5 text-ink-muted disabled:opacity-50"
          style={bordaHair}
        >
          {ressincronizando ? 'Ressincronizando…' : 'Ressincronizar notificações'}
        </button>
        <input
          type="search"
          placeholder="Buscar por e-mail ou nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-h-11 w-64 max-w-full border px-4 t-body text-ink outline-none"
          style={{ borderRadius: 'var(--r-field)', background: 'var(--surface-sunken)', borderColor: 'var(--border-hair)' }}
        />
      </div>

      {erro ? <Alerta tom="danger" titulo={erro} /> : null}
      {resultadoRessincronizacao ? <Alerta tom="ok" titulo={resultadoRessincronizacao} /> : null}

      {selecionados.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ borderColor: 'var(--border-hair)', background: 'var(--surface-sunken)' }}
        >
          <span className="t-label text-ink">{selecionados.size} usuário(s) selecionado(s)</span>
          <button
            type="button"
            onClick={() => setAlvosTeste(usuariosSelecionados)}
            disabled={selecionados.size > MAX_ALVOS_TESTE}
            className="rounded-full bg-emerald-600 px-4 py-1.5 t-label font-semibold text-white hover:bg-emerald-700 disabled:opacity-45"
          >
            Enviar push de teste
          </button>
          <button
            type="button"
            onClick={() => setSelecionados(new Set())}
            className="t-label text-ink-muted hover:text-ink hover:underline"
          >
            Limpar seleção
          </button>
          {selecionados.size > MAX_ALVOS_TESTE ? (
            <span className="t-label" style={{ color: 'var(--danger)' }}>
              Máximo de {MAX_ALVOS_TESTE} por disparo de teste.
            </span>
          ) : null}
        </div>
      ) : null}

      <SheetCard>
        {carregando ? (
          <p className="t-body text-ink-muted">Carregando…</p>
        ) : usuariosFiltrados.length === 0 ? (
          <p className="t-body text-ink-muted">Nenhum usuário encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="t-caption text-ink-muted">
                  <th className="border-b px-3 py-2 font-medium" style={bordaHair}>
                    <input
                      type="checkbox"
                      checked={todosFiltradosSelecionados}
                      onChange={alternarTodosFiltrados}
                      aria-label="Selecionar todos os usuários listados"
                    />
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={bordaHair}>
                    Usuário
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={bordaHair}>
                    Criado em
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={bordaHair}>
                    Gratuidade até
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={bordaHair}>
                    Notificações
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={bordaHair}>
                    Status
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={bordaHair}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.uid} className="t-body text-ink">
                    <td className="border-b px-3 py-2.5 align-top" style={bordaHair}>
                      <input
                        type="checkbox"
                        checked={selecionados.has(usuario.uid)}
                        onChange={() => alternarSelecionado(usuario.uid)}
                        aria-label={'Selecionar ' + (usuario.email ?? usuario.uid)}
                      />
                    </td>
                    <td className="border-b px-3 py-2.5 align-top" style={bordaHair}>
                      <p>{usuario.displayName ?? '—'}</p>
                      <p className="t-label text-ink-muted">{usuario.email ?? usuario.uid}</p>
                    </td>
                    <td className="border-b px-3 py-2.5 align-top" style={bordaHair}>
                      {formatarData(usuario.criadoEm)}
                    </td>
                    <td className="border-b px-3 py-2.5 align-top" style={bordaHair}>
                      {formatarData(usuario.freeTrialEndsAt)}
                    </td>
                    <td className="border-b px-3 py-2.5 align-top" style={bordaHair}>
                      {/*
                        Sem dispositivo registrado a pessoa nunca recebe lembrete: as
                        rotinas agendadas iteram apenas quem tem token, então ela é
                        ignorada em silêncio, sem aparecer em nenhum contador de falha.
                      */}
                      <CelulaNotificacoes
                        usuario={usuario}
                        expandido={expandidos.has(usuario.uid)}
                        onAlternar={() => alternarExpandido(usuario.uid)}
                      />
                    </td>
                    <td className="border-b px-3 py-2.5 align-top" style={bordaHair}>
                      <span
                        className="t-label rounded-full px-2.5 py-1"
                        style={{
                          background: usuario.disabled ? 'var(--danger-soft)' : 'var(--ok-soft)',
                          color: usuario.disabled ? 'var(--danger)' : 'var(--ok)',
                        }}
                      >
                        {usuario.disabled ? 'Bloqueado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="border-b px-3 py-2.5 align-top" style={bordaHair}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAlvosTeste([usuario])}
                          className="t-label text-ink-muted hover:text-ink hover:underline"
                        >
                          Enviar teste
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalSenha(usuario)}
                          className="t-label text-ink-muted hover:text-ink hover:underline"
                        >
                          Alterar senha
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalGratuidade(usuario)}
                          className="t-label text-ink-muted hover:text-ink hover:underline"
                        >
                          Gratuidade
                        </button>
                        <button
                          type="button"
                          disabled={alterandoBloqueio === usuario.uid}
                          onClick={() => void alternarBloqueio(usuario)}
                          className={
                            't-label hover:underline disabled:opacity-45 ' +
                            (usuario.disabled ? 'text-emerald-600' : 'text-red-600')
                          }
                        >
                          {usuario.disabled ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        {usuario.dispositivos.length > 0 ? (
                          <button
                            type="button"
                            disabled={rerregistrando === usuario.uid}
                            onClick={() => void forcarRerregistro(usuario)}
                            className="t-label text-ink-muted hover:text-ink hover:underline disabled:opacity-45"
                          >
                            {rerregistrando === usuario.uid ? 'Resetando…' : 'Resetar dispositivos'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetCard>

      {modalSenha ? (
        <ModalSenha usuario={modalSenha} onFechar={() => setModalSenha(null)} onSalvo={() => setModalSenha(null)} />
      ) : null}
      {modalGratuidade ? (
        <ModalGratuidade
          usuario={modalGratuidade}
          onFechar={() => setModalGratuidade(null)}
          onSalvo={() => {
            setModalGratuidade(null);
            void recarregar();
          }}
        />
      ) : null}
      {alvosTeste ? (
        <ModalEnvioTeste
          alvos={alvosTeste}
          onFechar={() => setAlvosTeste(null)}
          /*
           * Recarrega ao fundo: o envio move `ultimoPushEnviadoEm` e pode ter
           * podado dispositivos, então a tabela por trás do modal já precisa
           * refletir isso quando ele fechar.
           */
          onEnviado={() => void recarregar()}
        />
      ) : null}
    </div>
  );
}
