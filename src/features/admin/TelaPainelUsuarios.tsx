import { useEffect, useMemo, useState } from 'react';
import { SheetCard } from '@/components/SheetCard';
import { Field } from '@/components/Field';
import { Alerta } from '@/components/Alerta';
import { adminAlterarSenha, adminDefinirBloqueio, adminDefinirGratuidade, adminListarUsuarios, type UsuarioPainel } from './api';

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="t-title text-ink">Usuários</h1>
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
