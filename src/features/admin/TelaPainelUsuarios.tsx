import { useEffect, useMemo, useState } from 'react';
import { SheetCard } from '@/components/SheetCard';
import { Field } from '@/components/Field';
import { Alerta } from '@/components/Alerta';
import {
  adminAlterarSenha,
  adminDefinirBloqueio,
  adminDefinirGratuidade,
  adminForcarRerregistroDispositivos,
  adminListarUsuarios,
  adminMigrarDispositivos,
  adminRessincronizarNotificacoes,
  type DispositivoPainel,
  type UsuarioPainel,
} from './api';

/*
 * Silêncio acumulado é o que denuncia um registro obsoleto que o FCM ainda
 * aceita — os envios "dão certo" e nada chega. Metade do limiar de poda do
 * servidor (15), para o painel acusar o problema antes de a rotina agir.
 */
const ENVIOS_SEM_CONFIRMACAO_SUSPEITO = 8;

function ehFantasma(dispositivo: DispositivoPainel): boolean {
  return (
    dispositivo.status === 'ativo' &&
    dispositivo.enviosSemConfirmacao >= ENVIOS_SEM_CONFIRMACAO_SUSPEITO
  );
}

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

export function TelaPainelUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [alterandoBloqueio, setAlterandoBloqueio] = useState<string | null>(null);

  const [modalSenha, setModalSenha] = useState<UsuarioPainel | null>(null);
  const [modalGratuidade, setModalGratuidade] = useState<UsuarioPainel | null>(null);

  const [ressincronizando, setRessincronizando] = useState(false);
  const [resultadoRessincronizacao, setResultadoRessincronizacao] = useState<string | null>(null);

  const [rerregistrando, setRerregistrando] = useState<string | null>(null);

  const [migrando, setMigrando] = useState(false);
  const [migracaoConcluida, setMigracaoConcluida] = useState(false);
  const [resultadoMigracao, setResultadoMigracao] = useState<string | null>(null);

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
   * Migração única do modelo antigo (`fcmTokens` array) para a subcoleção
   * `dispositivos`. Roda sem apagar os arrays antigos — só depois de validar
   * o modelo novo (contagens no painel batendo, um envio de teste chegando)
   * é que faz sentido chamar `apagarArraysAntigos`.
   */
  async function migrarDispositivos() {
    setMigrando(true);
    setResultadoMigracao(null);
    setErro(null);
    try {
      const resumo = await adminMigrarDispositivos(false);
      setResultadoMigracao(
        `${resumo.usuariosMigrados} conta(s) migrada(s), ${resumo.dispositivosCriados} dispositivo(s) criado(s), ` +
          `${resumo.usuariosSemToken} sem token, ${resumo.falhas.length} falha(s).`,
      );
      setMigracaoConcluida(resumo.falhas.length === 0 && resumo.usuariosMigrados > 0);
      await recarregar();
    } catch {
      setErro('Não foi possível migrar os dispositivos.');
    } finally {
      setMigrando(false);
    }
  }

  async function apagarArraysAntigos() {
    if (!window.confirm('Isso apaga fcmTokens/saudeTokens de todos os usuários já migrados. Confirmar?')) {
      return;
    }
    setMigrando(true);
    setErro(null);
    try {
      const resumo = await adminMigrarDispositivos(true);
      setResultadoMigracao(`Arrays antigos apagados de ${resumo.arraysAntigosApagados} conta(s).`);
      setMigracaoConcluida(false);
    } catch {
      setErro('Não foi possível apagar os arrays antigos.');
    } finally {
      setMigrando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="t-title text-ink">Usuários</h1>
        <button
          type="button"
          onClick={() => void migrarDispositivos()}
          disabled={migrando}
          className="t-label rounded-full border px-3 py-1.5 text-ink-muted disabled:opacity-50"
          style={{ borderColor: 'var(--border-hair)' }}
        >
          {migrando ? 'Migrando…' : 'Migrar para subcoleção de dispositivos'}
        </button>
        {migracaoConcluida ? (
          <button
            type="button"
            onClick={() => void apagarArraysAntigos()}
            disabled={migrando}
            className="t-label rounded-full border px-3 py-1.5 text-ink-muted disabled:opacity-50"
            style={{ borderColor: 'var(--border-hair)' }}
          >
            Apagar arrays antigos
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void ressincronizarNotificacoes()}
          disabled={ressincronizando}
          className="t-label rounded-full border px-3 py-1.5 text-ink-muted disabled:opacity-50"
          style={{ borderColor: 'var(--border-hair)' }}
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
      {resultadoMigracao ? <Alerta tom="ok" titulo={resultadoMigracao} /> : null}
      {resultadoRessincronizacao ? <Alerta tom="ok" titulo={resultadoRessincronizacao} /> : null}

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
                  <th className="border-b px-3 py-2 font-medium" style={{ borderColor: 'var(--border-hair)' }}>
                    Usuário
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={{ borderColor: 'var(--border-hair)' }}>
                    Criado em
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={{ borderColor: 'var(--border-hair)' }}>
                    Gratuidade até
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={{ borderColor: 'var(--border-hair)' }}>
                    Notificações
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={{ borderColor: 'var(--border-hair)' }}>
                    Status
                  </th>
                  <th className="border-b px-3 py-2 font-medium" style={{ borderColor: 'var(--border-hair)' }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.uid} className="t-body text-ink">
                    <td className="border-b px-3 py-2.5" style={{ borderColor: 'var(--border-hair)' }}>
                      <p>{usuario.displayName ?? '—'}</p>
                      <p className="t-label text-ink-muted">{usuario.email ?? usuario.uid}</p>
                    </td>
                    <td className="border-b px-3 py-2.5" style={{ borderColor: 'var(--border-hair)' }}>
                      {formatarData(usuario.criadoEm)}
                    </td>
                    <td className="border-b px-3 py-2.5" style={{ borderColor: 'var(--border-hair)' }}>
                      {formatarData(usuario.freeTrialEndsAt)}
                    </td>
                    <td className="border-b px-3 py-2.5" style={{ borderColor: 'var(--border-hair)' }}>
                      {/*
                        Sem dispositivo registrado a pessoa nunca recebe lembrete: as
                        rotinas agendadas iteram apenas quem tem token, então ela é
                        ignorada em silêncio, sem aparecer em nenhum contador de falha.
                      */}
                      <span
                        className="t-label rounded-full px-2.5 py-1"
                        style={{
                          background: usuario.tokens > 0 ? 'var(--ok-soft)' : 'var(--danger-soft)',
                          color: usuario.tokens > 0 ? 'var(--ok)' : 'var(--danger)',
                        }}
                      >
                        {usuario.tokens > 0
                          ? `${usuario.tokens} dispositivo${usuario.tokens > 1 ? 's' : ''}`
                          : 'Sem dispositivo'}
                      </span>
                      {usuario.tokens > 0 ? (
                        <p className="t-label mt-1 text-ink-muted">
                          Enviado: {formatarDataHora(usuario.ultimoPushEnviadoEm)}
                          <br />
                          Recebido: {formatarDataHora(usuario.ultimoPushRecebidoEm)}
                        </p>
                      ) : null}
                      {usuario.dispositivos.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {usuario.dispositivos.map((dispositivo) => (
                            <li key={dispositivo.id} className="t-label text-ink-muted">
                              <span
                                className="rounded-full px-2 py-0.5"
                                style={{
                                  background: ehFantasma(dispositivo)
                                    ? 'var(--danger-soft)'
                                    : 'var(--surface-sunken)',
                                  color: ehFantasma(dispositivo) ? 'var(--danger)' : 'var(--ink-muted)',
                                }}
                              >
                                {dispositivo.plataforma ?? 'desconhecida'} · {dispositivo.status}
                                {dispositivo.enviosSemConfirmacao > 0
                                  ? ` · ${dispositivo.enviosSemConfirmacao} sem confirmar`
                                  : null}
                              </span>
                              <br />
                              últ. recebido: {formatarDataHora(dispositivo.ultimoRecebimentoEm)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="border-b px-3 py-2.5" style={{ borderColor: 'var(--border-hair)' }}>
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
                    <td className="border-b px-3 py-2.5" style={{ borderColor: 'var(--border-hair)' }}>
                      <div className="flex flex-wrap gap-2">
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
                          className={`t-label hover:underline disabled:opacity-45 ${
                            usuario.disabled ? 'text-emerald-600' : 'text-red-600'
                          }`}
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
    </div>
  );
}
