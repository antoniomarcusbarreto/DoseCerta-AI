import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFunctionsCliente } from '@/lib/firebase';
import * as biometriaService from '@/lib/biometriaService';
import { useAmbiente } from '@/lib/useAmbiente';
import { useDialogoModal } from '@/lib/useDialogoModal';

const IconeVoltar = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path
      d="M14.5 5.5L8 12l6.5 6.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type ItemEmBreve = { titulo: string; descricao: string };

const itensEmBreve: ItemEmBreve[] = [{ titulo: 'Assinatura', descricao: 'Plano e forma de pagamento' }];

function codigoDoErro(erro: unknown): string {
  return typeof erro === 'object' && erro !== null && 'code' in erro
    ? String((erro as { code: unknown }).code)
    : '';
}

const MENSAGEM_ERRO_SENHA: Record<string, string> = {
  'auth/wrong-password': 'Senha atual incorreta.',
  'auth/invalid-credential': 'Senha atual incorreta.',
  'auth/weak-password': 'A nova senha precisa de pelo menos 6 caracteres.',
  'auth/requires-recent-login': 'Sessão expirada. Saia e entre novamente para trocar a senha.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente de novo.',
};

function traduzirErroSenha(erro: unknown): string {
  return MENSAGEM_ERRO_SENHA[codigoDoErro(erro)] ?? 'Não foi possível alterar a senha. Tente novamente.';
}

export function TelaMeusDados() {
  const navegar = useNavigate();
  const { isPWA, isMobile } = useAmbiente();
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [biometriaHabilitada, setBiometriaHabilitada] = useState(() =>
    biometriaService.dispositivoTemBiometria(),
  );
  const [habilitandoBiometria, setHabilitandoBiometria] = useState(false);
  const [erroBiometria, setErroBiometria] = useState<string | null>(null);

  async function habilitarBiometria() {
    setErroBiometria(null);
    setHabilitandoBiometria(true);
    try {
      await biometriaService.registrarBiometria();
      setBiometriaHabilitada(true);
    } catch (falha) {
      if (!biometriaService.eCancelamentoDoUsuario(falha)) {
        console.error('[TelaMeusDados] falha ao registrar biometria', falha);
        setErroBiometria('Não foi possível habilitar a biometria. Tente novamente.');
      }
    } finally {
      setHabilitandoBiometria(false);
    }
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Meus dados"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/ajustes')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6" />
        </Hero>
      }
    >
      <SheetCard>
        <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
          <li>
            <button
              type="button"
              onClick={() => setModalSenhaAberto(true)}
              className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="t-label text-ink">Alterar senha de acesso</p>
                <p className="t-label mt-0.5 text-ink-muted">Trocar a senha usada para entrar</p>
              </div>
            </button>
          </li>
          {itensEmBreve.map((item) => (
            <li key={item.titulo}>
              <div
                className="flex min-h-14 items-center justify-between gap-3 py-3 opacity-60"
                aria-disabled="true"
              >
                <div className="min-w-0">
                  <p className="t-label text-ink">{item.titulo}</p>
                  <p className="t-label mt-0.5 text-ink-muted">{item.descricao}</p>
                </div>
                <span className="t-caption shrink-0 text-ink-faint">em breve</span>
              </div>
            </li>
          ))}
        </ul>
      </SheetCard>

      {(isPWA || isMobile) && biometriaService.suportaBiometria() ? (
        <SheetCard
          titulo="Login biométrico"
          subtitulo="Entre com Face ID, Touch ID ou a biometria do seu celular, sem digitar senha."
        >
          <div className="space-y-3">
            {biometriaHabilitada ? (
              <Alerta tom="ok" titulo="Biometria habilitada neste dispositivo" />
            ) : (
              <Button larguraTotal onClick={() => void habilitarBiometria()} disabled={habilitandoBiometria}>
                {habilitandoBiometria ? 'Habilitando…' : 'Habilitar Login Biométrico'}
              </Button>
            )}
            {erroBiometria ? <Alerta tom="danger" titulo={erroBiometria} /> : null}
          </div>
        </SheetCard>
      ) : null}

      <SheetCard titulo="Excluir conta" subtitulo="Apaga permanentemente sua conta e todos os seus dados.">
        <Button
          variante="primaria"
          larguraTotal
          onClick={() => setModalExclusaoAberto(true)}
          style={{ background: 'var(--danger)' }}
        >
          Excluir conta e dados
        </Button>
      </SheetCard>

      {modalSenhaAberto ? <ModalAlterarSenha onFechar={() => setModalSenhaAberto(false)} /> : null}

      {modalExclusaoAberto ? (
        <ModalExcluirConta onFechar={() => setModalExclusaoAberto(false)} />
      ) : null}
    </Pagina>
  );
}

function ModalAlterarSenha({ onFechar }: { onFechar: () => void }) {
  const { alterarSenha } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    try {
      await alterarSenha(senhaAtual, novaSenha);
      onFechar();
    } catch (falha) {
      setErro(traduzirErroSenha(falha));
      setCarregando(false);
    }
  }

  const dialogoRef = useDialogoModal<HTMLFormElement>(() => {
    if (!carregando) onFechar();
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Alterar Senha de Acesso"
    >
      <div aria-hidden="true" onClick={() => !carregando && onFechar()} className="absolute inset-0" />

      <form ref={dialogoRef} onSubmit={confirmar} className="relative w-full max-w-sm rounded-2xl bg-card p-5">
        <h2 className="t-title text-ink">Alterar senha de acesso</h2>
        <p className="t-label mt-2 text-ink-muted">
          Depois de trocar a senha, você precisará entrar novamente.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex flex-col">
            <label htmlFor="senha-atual" className="t-caption text-ink-muted">
              Senha atual
            </label>
            <input
              id="senha-atual"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className="mt-1 min-h-11 rounded-[14px] border px-3 t-body"
              style={{ borderColor: 'var(--border-hair)' }}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="nova-senha" className="t-caption text-ink-muted">
              Nova senha
            </label>
            <input
              id="nova-senha"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="mt-1 min-h-11 rounded-[14px] border px-3 t-body"
              style={{ borderColor: 'var(--border-hair)' }}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="confirmar-senha" className="t-caption text-ink-muted">
              Confirmar nova senha
            </label>
            <input
              id="confirmar-senha"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="mt-1 min-h-11 rounded-[14px] border px-3 t-body"
              style={{ borderColor: 'var(--border-hair)' }}
            />
          </div>
        </div>

        {erro ? <p className="t-label mt-3 text-danger">{erro}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variante="fantasma" onClick={onFechar} disabled={carregando}>
            Cancelar
          </Button>
          <Button variante="primaria" type="submit" disabled={carregando}>
            {carregando ? (
              <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : null}
            Alterar senha
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Confirmação crítica de exclusão de conta. Não reaproveita `useConfirm`
 * (ConfirmContext) porque aquele fluxo fecha o modal de imediato ao
 * confirmar e não tem estado de carregamento/erro — aqui a ação é
 * assíncrona e pode falhar, e o usuário precisa poder tentar de novo sem
 * perder o contexto.
 */
function ModalExcluirConta({ onFechar }: { onFechar: () => void }) {
  const { sair } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmarExclusao() {
    setCarregando(true);
    setErro(null);
    try {
      const excluirConta = httpsCallable(getFunctionsCliente(), 'excluirContaUsuario');
      await excluirConta();
      await sair();
      onFechar();
    } catch (falha) {
      console.error('[TelaMeusDados] falha ao excluir conta', falha);
      setErro('Não foi possível excluir a conta. Tente novamente.');
      setCarregando(false);
    }
  }

  const dialogoRef = useDialogoModal<HTMLDivElement>(() => {
    if (!carregando) onFechar();
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Excluir Conta e Dados"
    >
      <div aria-hidden="true" onClick={() => !carregando && onFechar()} className="absolute inset-0" />

      <div ref={dialogoRef} className="relative w-full max-w-sm rounded-2xl bg-card p-5">
        <h2 className="t-title text-ink">Excluir Conta e Dados</h2>
        <p className="t-label mt-2 text-ink-muted">
          Atenção: Esta ação é permanente e irreversível. Todos os seus dados de tratamento,
          histórico do co-piloto, refeições e fotos enviadas serão apagados para sempre.
        </p>
        {erro ? <p className="t-label mt-3 text-danger">{erro}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variante="fantasma" onClick={onFechar} disabled={carregando}>
            Cancelar
          </Button>
          <Button
            variante="primaria"
            onClick={() => void confirmarExclusao()}
            disabled={carregando}
            style={{ background: 'var(--danger)' }}
          >
            {carregando ? (
              <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : null}
            Sim, excluir minha conta
          </Button>
        </div>
      </div>
    </div>
  );
}
