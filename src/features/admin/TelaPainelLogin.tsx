import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { firebaseConfigurado, getAuthCliente } from '@/lib/firebase';
import { useAuth } from '@/features/auth/AuthProvider';
import { iniciarLoginAdmin, verificarLoginAdmin } from './api';

type Etapa = 'email' | 'codigo';

const MENSAGEM_ERRO: Record<string, string> = {
  'functions/failed-precondition': 'Solicite um novo código.',
  'functions/deadline-exceeded': 'Código expirado. Solicite um novo.',
  'functions/resource-exhausted': 'Muitas tentativas. Solicite um novo código.',
  'functions/invalid-argument': 'Código incorreto.',
};

function codigoDoErro(erro: unknown): string {
  return typeof erro === 'object' && erro !== null && 'code' in erro
    ? String((erro as { code: unknown }).code)
    : '';
}

function traduzirErro(erro: unknown): string {
  return MENSAGEM_ERRO[codigoDoErro(erro)] ?? 'Não foi possível concluir. Tente novamente.';
}

/**
 * Tela de login do painel administrativo — deliberadamente sem nenhum link de
 * volta para o app comum, e não referenciada por nenhum <Link> do resto do
 * app. Só é alcançada digitando /painel na barra de endereço.
 */
export function TelaPainelLogin() {
  const { usuario, ehAdmin, carregandoClaims } = useAuth();

  const [etapa, setEtapa] = useState<Etapa>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (usuario && !carregandoClaims && ehAdmin) {
    return <Navigate to="/painel/dashboard" replace />;
  }

  async function enviarEmail(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await iniciarLoginAdmin(email);
      setEtapa('codigo');
    } catch (falha) {
      setErro(traduzirErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCodigo(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const token = await verificarLoginAdmin(codigo);
      await signInWithCustomToken(getAuthCliente(), token);
    } catch (falha) {
      setErro(traduzirErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="flex min-h-dvh flex-col justify-center px-0 md:px-6 pb-10"
      style={{
        background: 'linear-gradient(180deg, #3b4c5e 0%, #6c8496 100%)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
      }}
    >
      <div className="mx-auto w-full px-4 md:max-w-md md:p-8 md:bg-white/5 md:backdrop-blur-md md:border md:border-white/10 md:shadow-2xl md:rounded-2xl">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">
            Dose Certa<span className="text-teal-400">-AI</span>
          </h1>
          <h2 className="text-xl md:text-2xl font-medium text-slate-300 mt-2">Painel</h2>
          {etapa === 'email' ? (
            <p className="t-body mt-3 text-slate-400">Acesso restrito. Digite o e-mail autorizado.</p>
          ) : (
            <p className="t-body mt-3 text-slate-400">
              Se o e-mail informado for autorizado, um código foi enviado. Digite-o abaixo.
            </p>
          )}
        </div>

        {!firebaseConfigurado ? (
          <p
            className="t-label mt-8 rounded-[14px] border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-md"
            role="status"
          >
            Firebase ainda não configurado.
          </p>
        ) : null}

        {etapa === 'email' ? (
          <form onSubmit={enviarEmail} className="mt-8 space-y-4">
            <div className="flex flex-col">
              <label htmlFor="email-painel" className="t-caption text-slate-300">
                E-mail
              </label>
              <input
                id="email-painel"
                type="email"
                inputMode="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                placeholder="voce@exemplo.com"
                className={`mt-1.5 block min-h-11 w-full rounded-[14px] border ${erro ? 'border-red-500' : 'border-white/20'} bg-white/5 px-4 t-body text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500`}
              />
              {erro ? <p className="t-label mt-1.5 text-red-500">{erro}</p> : null}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={enviando || !firebaseConfigurado}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none bg-teal-600 hover:bg-teal-700 text-white font-bold h-12"
              >
                {enviando ? 'Enviando…' : 'Enviar código'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={confirmarCodigo} className="mt-8 space-y-4">
            <div className="flex flex-col">
              <label htmlFor="codigo-painel" className="t-caption text-slate-300">
                Código recebido
              </label>
              <input
                id="codigo-painel"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="mt-1.5 block min-h-11 w-full rounded-[14px] border border-white/20 bg-white/5 px-4 t-body tracking-[0.3em] text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500"
              />
              {erro ? <p className="t-label mt-1.5 text-red-500">{erro}</p> : null}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={enviando || !firebaseConfigurado}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none bg-teal-600 hover:bg-teal-700 text-white font-bold h-12"
              >
                {enviando ? 'Verificando…' : 'Entrar'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setEtapa('email');
                setCodigo('');
                setErro(null);
              }}
              className="w-full text-center text-sm text-slate-400 hover:text-white hover:underline"
            >
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
