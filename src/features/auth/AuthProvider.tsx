import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getIdTokenResult,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { onSnapshot } from 'firebase/firestore';
import { getAuthCliente, getFunctionsCliente, getGoogleProvider, firebaseConfigurado } from '@/lib/firebase';
import { garantirPerfil } from '@/features/dados/repositorio';
import { refEstadoConta } from '@/lib/firestore';
import * as biometriaService from '@/lib/biometriaService';
import { detectarAndroid, detectarIOS, limparEstadoLocal, rodandoComoPWAInstalado, validarSessao } from './sessao';

/** Conflito detectado: já existe conta com este e-mail por outro método de login. */
type VinculoPendente = { email: string; credencial: AuthCredential };

type AuthContexto = {
  usuario: User | null;
  carregando: boolean;
  /** `true` quando a sessão atual é a do painel administrativo (custom claim `admin`). */
  ehAdmin: boolean;
  /** `true` enquanto o claim de admin do usuário atual ainda está sendo lido. */
  carregandoClaims: boolean;
  /** Preenchido quando a sessão caiu sozinha, para explicar o porquê no login. */
  motivoSaida: string | null;
  /** Preenchido quando o login por Google esbarra num e-mail já cadastrado por senha. */
  vinculoPendente: VinculoPendente | null;
  entrar: (email: string, senha: string) => Promise<void>;
  criarConta: (nome: string, email: string, senha: string) => Promise<void>;
  enviarCodigoRecuperacao: (email: string) => Promise<void>;
  redefinirSenhaComCodigo: (email: string, codigo: string, novaSenha: string) => Promise<void>;
  alterarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
  entrarComGoogle: () => Promise<void>;
  entrarComBiometria: () => Promise<void>;
  vincularComSenha: (senha: string) => Promise<void>;
  cancelarVinculo: () => void;
  sair: () => Promise<void>;
};

const CODIGOS_POPUP_CANCELADO = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

/**
 * Mesmo raciocínio do `criarConta`: a escrita do perfil no Firestore não pode
 * derrubar um login que já aconteceu de verdade no Auth. `merge: true` em
 * `garantirPerfil` também é o que torna seguro chamar isto em todo login por
 * Google (não só no primeiro).
 */
async function garantirPerfilPosLogin(usuario: User): Promise<void> {
  try {
    await garantirPerfil(usuario.uid, usuario.displayName || usuario.email || 'Usuário');
  } catch (falha) {
    console.warn('[DoseCerta] perfil será criado depois:', falha);
  }
}

function paraVinculoPendente(erro: unknown): VinculoPendente | null {
  if (typeof erro !== 'object' || erro === null || !('code' in erro)) return null;
  if ((erro as { code: unknown }).code !== 'auth/account-exists-with-different-credential') return null;
  const credencial = GoogleAuthProvider.credentialFromError(erro as never);
  const email = (erro as { customData?: { email?: string } }).customData?.email;
  if (!credencial || !email) return null;
  return { email, credencial };
}

const Contexto = createContext<AuthContexto | null>(null);

const MSG_SESSAO_ENCERRADA =
  'Sua sessão foi encerrada porque esta conta não está mais ativa. Entre novamente.';

const MSG_CONTA_SUSPENSA = 'Sua conta foi suspensa. Entre em contato com o suporte.';

const MSG_SENHA_ALTERADA = 'Senha alterada com sucesso. Faça login novamente.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [authPronto, setAuthPronto] = useState(false);
  const [redirectPronto, setRedirectPronto] = useState(false);
  const carregando = firebaseConfigurado && !(authPronto && redirectPronto);
  const [ehAdmin, setEhAdmin] = useState(false);
  const [carregandoClaims, setCarregandoClaims] = useState(firebaseConfigurado);
  const [motivoSaida, setMotivoSaida] = useState<string | null>(null);
  const [vinculoPendente, setVinculoPendente] = useState<VinculoPendente | null>(null);
  const usuarioRef = useRef<User | null>(null);

  usuarioRef.current = usuario;

  /*
   * O claim `admin` só existe na sessão sintética do painel (/painel) — é o
   * que diferencia essa sessão de um paciente comum sem depender de nenhum
   * doc em `users/`. Recalcula sempre que a sessão muda.
   */
  useEffect(() => {
    if (!usuario) {
      setEhAdmin(false);
      setCarregandoClaims(false);
      return;
    }
    let cancelado = false;
    setCarregandoClaims(true);
    getIdTokenResult(usuario)
      .then((resultado) => {
        if (!cancelado) setEhAdmin(resultado.claims.admin === true);
      })
      .catch(() => {
        if (!cancelado) setEhAdmin(false);
      })
      .finally(() => {
        if (!cancelado) setCarregandoClaims(false);
      });
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  const derrubarSessao = useCallback(async (mensagem: string = MSG_SESSAO_ENCERRADA) => {
    setMotivoSaida(mensagem);
    try {
      await signOut(getAuthCliente());
    } catch {
      // Se nem o signOut passa, o teardown local abaixo já resolve.
    }
    limparEstadoLocal();
    setUsuario(null);
  }, []);

  useEffect(() => {
    if (!firebaseConfigurado) return;

    const auth = getAuthCliente();
    const cancelar = onAuthStateChanged(auth, async (proximo) => {
      if (proximo && !(await validarSessao(proximo))) {
        await derrubarSessao();
        setAuthPronto(true);
        return;
      }
      setUsuario(proximo);
      setAuthPronto(true);
    });

    return cancelar;
  }, [derrubarSessao]);

  /*
   * Revalidar ao voltar ao primeiro plano é essencial em PWA: trocar de app no
   * celular não recarrega a página, então sem isto uma conta excluída seguiria
   * "logada" por dias.
   */
  useEffect(() => {
    if (!firebaseConfigurado) return;

    const aoVoltar = async () => {
      if (document.visibilityState !== 'visible') return;
      const atual = usuarioRef.current;
      if (!atual) return;
      if (!(await validarSessao(atual))) await derrubarSessao();
    };

    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [derrubarSessao]);

  /*
   * Kickout em tempo real: sem isto, uma conta bloqueada no painel admin
   * continua com acesso total até o ID token expirar sozinho (até 1h) ou o
   * app voltar ao primeiro plano (efeito acima). O doc `estado/conta` é
   * escrito só pela Cloud Function `adminDefinirBloqueio` via Admin SDK —
   * ver `firestore.rules` — então o próprio cliente não tem como reverter.
   */
  useEffect(() => {
    if (!firebaseConfigurado || !usuario) return;

    const cancelar = onSnapshot(refEstadoConta(usuario.uid), (snap) => {
      if (snap.data()?.bloqueado) void derrubarSessao(MSG_CONTA_SUSPENSA);
    });

    return cancelar;
  }, [usuario, derrubarSessao]);

  /*
   * Em PWA instalado, `entrarComGoogle` navega embora via `signInWithRedirect`
   * em vez de abrir popup — o resultado só chega quando a página volta a
   * carregar, então precisa ser coletado uma vez no boot.
   */
  useEffect(() => {
    if (!firebaseConfigurado) return;

    getRedirectResult(getAuthCliente())
      .then(async (resultado) => {
        if (!resultado) return;
        await garantirPerfilPosLogin(resultado.user);
      })
      .catch((falha) => {
        const pendente = paraVinculoPendente(falha);
        if (pendente) {
          setVinculoPendente(pendente);
          return;
        }
        console.warn('[DoseCerta] falha ao concluir login por redirect:', falha);
        setMotivoSaida('Não foi possível concluir o login. Tente novamente.');
      })
      .finally(() => setRedirectPronto(true));
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    setMotivoSaida(null);
    await signInWithEmailAndPassword(getAuthCliente(), email, senha);
  }, []);

  const criarConta = useCallback(async (nome: string, email: string, senha: string) => {
    setMotivoSaida(null);
    const credencial = await createUserWithEmailAndPassword(getAuthCliente(), email, senha);
    if (nome.trim()) await updateProfile(credencial.user, { displayName: nome.trim() });

    /*
     * O perfil no Firestore é complementar: a conta em si já existe no Auth.
     * Se esta escrita falhar (regras ainda não publicadas, offline no momento
     * do cadastro), a conta NÃO pode ser reportada como falha — isso deixaria
     * um usuário criado no Auth e uma mensagem de erro na tela, sem caminho de
     * volta. O perfil é reconciliado no próximo boot.
     */
    try {
      await garantirPerfil(credencial.user.uid, nome.trim() || email);
    } catch (falha) {
      console.warn('[DoseCerta] perfil será criado depois:', falha);
    }
  }, []);

  const enviarCodigoRecuperacao = useCallback(async (email: string) => {
    const chamar = httpsCallable(getFunctionsCliente(), 'enviarCodigoRecuperacao');
    await chamar({ email });
  }, []);

  const redefinirSenhaComCodigo = useCallback(async (email: string, codigo: string, novaSenha: string) => {
    const chamar = httpsCallable(getFunctionsCliente(), 'redefinirSenhaComCodigo');
    await chamar({ email, codigo, novaSenha });
  }, []);

  const alterarSenha = useCallback(async (senhaAtual: string, novaSenha: string) => {
    const auth = getAuthCliente();
    const atual = auth.currentUser;
    if (!atual?.email) throw new Error('Nenhum usuário autenticado.');

    const credencial = EmailAuthProvider.credential(atual.email, senhaAtual);
    await reauthenticateWithCredential(atual, credencial);
    await updatePassword(atual, novaSenha);

    await signOut(auth);
    limparEstadoLocal();
    setMotivoSaida(MSG_SENHA_ALTERADA);
  }, []);

  const entrarComGoogle = useCallback(async () => {
    setMotivoSaida(null);
    setVinculoPendente(null);
    const auth = getAuthCliente();
    const provider = getGoogleProvider();

    if (rodandoComoPWAInstalado() || detectarAndroid() || detectarIOS()) {
      // A promise resolve ao navegar embora; o resultado real chega via
      // `getRedirectResult` quando a página recarrega. Vale para qualquer
      // navegador móvel, não só o PWA instalado: é o `signInWithPopup` em
      // contexto mobile que o Google trata como WebView não-confiável e
      // rebaixa para a tela de QR/cross-device.
      await signInWithRedirect(auth, provider);
      return;
    }

    try {
      const credencial = await signInWithPopup(auth, provider);
      await garantirPerfilPosLogin(credencial.user);
    } catch (falha) {
      const codigo =
        typeof falha === 'object' && falha !== null && 'code' in falha
          ? String((falha as { code: unknown }).code)
          : '';
      if (CODIGOS_POPUP_CANCELADO.has(codigo)) return; // usuário desistiu, não é erro
      const pendente = paraVinculoPendente(falha);
      if (pendente) {
        setVinculoPendente(pendente);
        return;
      }
      throw falha;
    }
  }, []);

  const entrarComBiometria = useCallback(async () => {
    setMotivoSaida(null);
    const token = await biometriaService.entrarComBiometria();
    await signInWithCustomToken(getAuthCliente(), token);
  }, []);

  const vincularComSenha = useCallback(
    async (senha: string) => {
      if (!vinculoPendente) return;
      const credencial = await signInWithEmailAndPassword(
        getAuthCliente(),
        vinculoPendente.email,
        senha,
      );
      await linkWithCredential(credencial.user, vinculoPendente.credencial);
      await garantirPerfilPosLogin(credencial.user);
      setVinculoPendente(null);
    },
    [vinculoPendente],
  );

  const cancelarVinculo = useCallback(() => setVinculoPendente(null), []);

  const sair = useCallback(async () => {
    await signOut(getAuthCliente());
    limparEstadoLocal();
    setMotivoSaida(null);
  }, []);

  const valor = useMemo<AuthContexto>(
    () => ({
      usuario,
      carregando,
      ehAdmin,
      carregandoClaims,
      motivoSaida,
      vinculoPendente,
      entrar,
      criarConta,
      enviarCodigoRecuperacao,
      redefinirSenhaComCodigo,
      alterarSenha,
      entrarComGoogle,
      entrarComBiometria,
      vincularComSenha,
      cancelarVinculo,
      sair,
    }),
    [
      usuario,
      carregando,
      ehAdmin,
      carregandoClaims,
      motivoSaida,
      vinculoPendente,
      entrar,
      criarConta,
      enviarCodigoRecuperacao,
      redefinirSenhaComCodigo,
      alterarSenha,
      entrarComGoogle,
      entrarComBiometria,
      vincularComSenha,
      cancelarVinculo,
      sair,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): AuthContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return contexto;
}
