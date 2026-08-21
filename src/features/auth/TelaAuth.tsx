import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { firebaseConfigurado } from '@/lib/firebase';
import * as biometriaService from '@/lib/biometriaService';
import { Carregando } from '@/components/Carregando';
import { useAmbiente } from '@/lib/useAmbiente';
import { FolhaTermos } from '@/features/legal/FolhaTermos';
import { useAuth } from './AuthProvider';

type Modo = 'entrar' | 'criar';

const MENSAGEM_ERRO: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
  'auth/weak-password': 'A senha precisa de pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente de novo.',
};

function codigoDoErro(erro: unknown): string {
  return typeof erro === 'object' && erro !== null && 'code' in erro
    ? String((erro as { code: unknown }).code)
    : '';
}

function traduzirErro(erro: unknown): string {
  return MENSAGEM_ERRO[codigoDoErro(erro)] ?? 'Não foi possível concluir. Tente novamente.';
}

const MENSAGEM_ERRO_RECUPERACAO: Record<string, string> = {
  'functions/not-found': 'E-mail inválido ou não cadastrado.',
  'functions/invalid-argument': 'Código incorreto.',
  'functions/failed-precondition': 'Solicite um novo código.',
  'functions/deadline-exceeded': 'Código expirado. Solicite um novo.',
  'functions/resource-exhausted': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
};

function traduzirErroRecuperacao(erro: unknown): string {
  return MENSAGEM_ERRO_RECUPERACAO[codigoDoErro(erro)] ?? 'Não foi possível concluir. Tente novamente.';
}

export function TelaAuth({ modo }: { modo: Modo }) {
  const { isPWA, isMobile } = useAmbiente();
  const {
    usuario,
    carregando,
    entrar,
    criarConta,
    enviarCodigoRecuperacao,
    redefinirSenhaComCodigo,
    entrarComGoogle,
    entrarComBiometria,
    vinculoPendente,
    vincularComSenha,
    cancelarVinculo,
    motivoSaida,
  } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviandoGoogle, setEnviandoGoogle] = useState(false);
  const [enviandoBiometria, setEnviandoBiometria] = useState(false);
  const [senhaVinculo, setSenhaVinculo] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [folhaAberta, setFolhaAberta] = useState<'termos' | 'privacidade' | null>(null);

  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const [etapaRecuperacao, setEtapaRecuperacao] = useState<'email' | 'codigo' | 'sucesso'>('email');
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [codigoRecuperacao, setCodigoRecuperacao] = useState('');
  const [novaSenhaRecuperacao, setNovaSenhaRecuperacao] = useState('');
  const [confirmarSenhaRecuperacao, setConfirmarSenhaRecuperacao] = useState('');
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);
  const [erroRecuperacao, setErroRecuperacao] = useState<string | null>(null);

  const criando = modo === 'criar';

  function fecharRecuperacao() {
    setMostrarRecuperacao(false);
    setEtapaRecuperacao('email');
    setEmailRecuperacao('');
    setCodigoRecuperacao('');
    setNovaSenhaRecuperacao('');
    setConfirmarSenhaRecuperacao('');
    setErroRecuperacao(null);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (criando) await criarConta(nome, email, senha);
      else await entrar(email, senha);
    } catch (falha) {
      setErro(traduzirErro(falha));
      setEnviando(false);
    }
  }

  async function enviarCodigo(evento?: FormEvent) {
    evento?.preventDefault();
    setErroRecuperacao(null);
    setEnviandoRecuperacao(true);
    try {
      await enviarCodigoRecuperacao(emailRecuperacao);
      setEtapaRecuperacao('codigo');
    } catch (falha) {
      setErroRecuperacao(traduzirErroRecuperacao(falha));
    } finally {
      setEnviandoRecuperacao(false);
    }
  }

  async function confirmarRedefinicao(evento: FormEvent) {
    evento.preventDefault();
    setErroRecuperacao(null);

    if (novaSenhaRecuperacao !== confirmarSenhaRecuperacao) {
      setErroRecuperacao('As senhas não coincidem.');
      return;
    }

    setEnviandoRecuperacao(true);
    try {
      await redefinirSenhaComCodigo(emailRecuperacao, codigoRecuperacao, novaSenhaRecuperacao);
      setEtapaRecuperacao('sucesso');
    } catch (falha) {
      setErroRecuperacao(traduzirErroRecuperacao(falha));
    } finally {
      setEnviandoRecuperacao(false);
    }
  }

  async function continuarComGoogle() {
    setErro(null);
    setEnviandoGoogle(true);
    try {
      await entrarComGoogle();
    } catch (falha) {
      setErro(traduzirErro(falha));
    } finally {
      setEnviandoGoogle(false);
    }
  }

  async function continuarComBiometria() {
    setErro(null);
    setEnviandoBiometria(true);
    try {
      await entrarComBiometria();
    } catch (falha) {
      if (!biometriaService.eCancelamentoDoUsuario(falha)) setErro(traduzirErro(falha));
    } finally {
      setEnviandoBiometria(false);
    }
  }

  async function vincular(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await vincularComSenha(senhaVinculo);
      setSenhaVinculo('');
    } catch (falha) {
      setErro(traduzirErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <Carregando />;
  if (usuario) return <Navigate to="/inicio" replace />;

  if (vinculoPendente) {
    return (
      <div
        className="flex min-h-dvh flex-col justify-center px-0 md:px-6 pb-10"
        style={{
          background: 'var(--grad-hero)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
        }}
      >
        <div className="mx-auto w-full px-4 md:max-w-md md:p-8 md:bg-white/5 md:backdrop-blur-md md:border md:border-white/10 md:shadow-2xl md:rounded-2xl">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
              Dose Certa<span className="text-teal-400">-AI</span>
            </h1>
            <h2 className="text-xl md:text-2xl font-medium text-slate-300 mt-2">Vincular conta</h2>
            <p className="t-body mt-3 text-slate-400">
              Já existe uma conta com <strong className="text-white">{vinculoPendente.email}</strong>.
              Digite sua senha para vincular o Google a essa conta.
            </p>
          </div>

          <form onSubmit={vincular} className="mt-8 space-y-4">
            <div className="flex flex-col">
              <label htmlFor="senha-vinculo" className="t-caption text-slate-300">
                Senha
              </label>
              <input
                id="senha-vinculo"
                type="password"
                required
                autoFocus
                value={senhaVinculo}
                onChange={(e) => setSenhaVinculo(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? 'senha-vinculo-erro' : undefined}
                className={`mt-1.5 block min-h-11 w-full rounded-[14px] border ${erro ? 'border-red-500' : 'border-white/20'} bg-white/5 px-4 t-body text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500`}
              />
              {erro ? (
                <p id="senha-vinculo-erro" role="alert" className="t-label mt-1.5 text-red-500">
                  {erro}
                </p>
              ) : null}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={enviando}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none bg-teal-600 hover:bg-teal-700 text-white font-bold h-12"
              >
                {enviando ? 'Aguarde…' : 'Vincular'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setErro(null);
                setSenhaVinculo('');
                cancelarVinculo();
              }}
              className="w-full text-center text-sm text-slate-400 hover:text-white hover:underline"
            >
              Cancelar
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (mostrarRecuperacao) {
    return (
      <div
        className="flex min-h-dvh flex-col justify-center px-0 md:px-6 pb-10"
        style={{
          background: 'var(--grad-hero)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
        }}
      >
        <div className="mx-auto w-full px-4 md:max-w-md md:p-8 md:bg-white/5 md:backdrop-blur-md md:border md:border-white/10 md:shadow-2xl md:rounded-2xl">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
              Dose Certa<span className="text-teal-400">-AI</span>
            </h1>
            <h2 className="text-xl md:text-2xl font-medium text-slate-300 mt-2">Recuperar senha</h2>
            {etapaRecuperacao === 'email' ? (
              <p className="t-body mt-3 text-slate-400">
                Digite o e-mail da sua conta para receber um código de redefinição.
              </p>
            ) : null}
            {etapaRecuperacao === 'codigo' ? (
              <p className="t-body mt-3 text-slate-400">
                Enviamos um código para <strong className="text-white">{emailRecuperacao}</strong>. Digite-o
                abaixo junto com sua nova senha. Não encontrou? Verifique também a caixa de spam/lixo
                eletrônico.
              </p>
            ) : null}
          </div>

          {etapaRecuperacao === 'sucesso' ? (
            <div className="mt-8 space-y-4">
              <p
                className="t-label rounded-[14px] border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-md"
                role="status"
              >
                Senha redefinida com sucesso. Você já pode entrar com a nova senha.
              </p>
              <button
                type="button"
                onClick={fecharRecuperacao}
                className="w-full text-center text-sm text-slate-400 hover:text-white hover:underline"
              >
                Voltar ao login
              </button>
            </div>
          ) : null}

          {etapaRecuperacao === 'email' ? (
            <form onSubmit={enviarCodigo} className="mt-8 space-y-4">
              <div className="flex flex-col">
                <label htmlFor="email-recuperacao" className="t-caption text-slate-300">
                  E-mail
                </label>
                <input
                  id="email-recuperacao"
                  type="email"
                  inputMode="email"
                  required
                  autoFocus
                  value={emailRecuperacao}
                  onChange={(e) => setEmailRecuperacao(e.target.value)}
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  aria-invalid={erroRecuperacao ? true : undefined}
                  aria-describedby={erroRecuperacao ? 'email-recuperacao-erro' : undefined}
                  className={`mt-1.5 block min-h-11 w-full rounded-[14px] border ${erroRecuperacao ? 'border-red-500' : 'border-white/20'} bg-white/5 px-4 t-body text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500`}
                />
                {erroRecuperacao ? (
                  <p id="email-recuperacao-erro" role="alert" className="t-label mt-1.5 text-red-500">
                    {erroRecuperacao}
                  </p>
                ) : null}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={enviandoRecuperacao || !firebaseConfigurado}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none bg-teal-600 hover:bg-teal-700 text-white font-bold h-12"
                >
                  {enviandoRecuperacao ? 'Enviando…' : 'Enviar código'}
                </button>
              </div>

              <button
                type="button"
                onClick={fecharRecuperacao}
                className="w-full text-center text-sm text-slate-400 hover:text-white hover:underline"
              >
                Voltar ao login
              </button>
            </form>
          ) : null}

          {etapaRecuperacao === 'codigo' ? (
            <form onSubmit={confirmarRedefinicao} className="mt-8 space-y-4">
              <div className="flex flex-col">
                <label htmlFor="codigo-recuperacao" className="t-caption text-slate-300">
                  Código recebido
                </label>
                <input
                  id="codigo-recuperacao"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={codigoRecuperacao}
                  onChange={(e) => setCodigoRecuperacao(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  aria-invalid={erroRecuperacao ? true : undefined}
                  aria-describedby={erroRecuperacao ? 'redefinicao-erro' : undefined}
                  className="mt-1.5 block min-h-11 w-full rounded-[14px] border border-white/20 bg-white/5 px-4 t-body tracking-[0.3em] text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="nova-senha-recuperacao" className="t-caption text-slate-300">
                  Nova senha
                </label>
                <input
                  id="nova-senha-recuperacao"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={novaSenhaRecuperacao}
                  onChange={(e) => setNovaSenhaRecuperacao(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  aria-invalid={erroRecuperacao ? true : undefined}
                  aria-describedby={erroRecuperacao ? 'redefinicao-erro' : undefined}
                  className="mt-1.5 block min-h-11 w-full rounded-[14px] border border-white/20 bg-white/5 px-4 t-body text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="confirmar-senha-recuperacao" className="t-caption text-slate-300">
                  Confirmar nova senha
                </label>
                <input
                  id="confirmar-senha-recuperacao"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmarSenhaRecuperacao}
                  onChange={(e) => setConfirmarSenhaRecuperacao(e.target.value)}
                  placeholder="••••••••"
                  aria-invalid={erroRecuperacao ? true : undefined}
                  aria-describedby={erroRecuperacao ? 'redefinicao-erro' : undefined}
                  className={`mt-1.5 block min-h-11 w-full rounded-[14px] border ${erroRecuperacao ? 'border-red-500' : 'border-white/20'} bg-white/5 px-4 t-body text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500`}
                />
                {erroRecuperacao ? (
                  <p id="redefinicao-erro" role="alert" className="t-label mt-1.5 text-red-500">
                    {erroRecuperacao}
                  </p>
                ) : null}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={enviandoRecuperacao || !firebaseConfigurado}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none bg-teal-600 hover:bg-teal-700 text-white font-bold h-12"
                >
                  {enviandoRecuperacao ? 'Aguarde…' : 'Redefinir senha'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => void enviarCodigo()}
                disabled={enviandoRecuperacao}
                className="w-full text-center text-sm text-slate-400 hover:text-white hover:underline disabled:opacity-45"
              >
                Reenviar código
              </button>

              <button
                type="button"
                onClick={fecharRecuperacao}
                className="w-full text-center text-sm text-slate-400 hover:text-white hover:underline"
              >
                Voltar ao login
              </button>
            </form>
          ) : null}
        </div>
      </div>
    );
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
          <h2 className="text-xl md:text-2xl font-medium text-slate-300 mt-2">
            {criando ? 'Criar conta' : 'Entrar'}
          </h2>
          <p className="t-body mt-3 text-slate-400">
            {criando
              ? 'Seus registros ficam apenas na sua conta e podem ser exportados ou apagados a qualquer momento.'
              : 'Acompanhe suas aplicações, o estoque da caneta e sua evolução.'}
          </p>
        </div>

        <form onSubmit={enviar} className="mt-8 space-y-4">
          {motivoSaida ? (
            <p className="t-label rounded-[14px] border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-md" role="status">
              {motivoSaida}
            </p>
          ) : null}

          {!firebaseConfigurado ? (
            <p className="t-label rounded-[14px] border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-md" role="status">
              Firebase ainda não configurado. Copie <code>.env.example</code> para{' '}
              <code>.env.local</code> e preencha as chaves para habilitar o login.
            </p>
          ) : null}

          {criando ? (
            <div className="flex flex-col">
              <label htmlFor="nome" className="t-caption text-slate-300">
                Como quer ser chamado
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                placeholder="Seu nome"
                className="mt-1.5 block min-h-11 w-full rounded-[14px] border border-white/20 bg-white/5 px-4 t-body text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500"
              />
            </div>
          ) : null}

          <div className="flex flex-col">
            <label htmlFor="email" className="t-caption text-slate-300">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="voce@exemplo.com"
              className="mt-1.5 block min-h-11 w-full rounded-[14px] border border-white/20 bg-white/5 px-4 t-body text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="senha" className="t-caption text-slate-300">
              Senha
            </label>
            <div className="relative mt-1.5">
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete={criando ? 'new-password' : 'current-password'}
                placeholder={criando ? 'Mínimo de 6 caracteres' : '••••••••'}
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? 'senha-erro' : undefined}
                className={`block min-h-11 w-full rounded-[14px] border ${erro ? 'border-red-500' : 'border-white/20'} bg-white/5 px-4 pr-12 t-body text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-teal-500`}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-0 top-0 h-full px-4 flex items-center justify-center text-slate-400 hover:text-white transition-colors focus:outline-none"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
            {erro ? (
              <p id="senha-erro" role="alert" className="t-label mt-1.5 text-red-500">
                {erro}
              </p>
            ) : null}
            {!criando ? (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setMostrarRecuperacao(true)}
                  className="text-sm text-slate-400 hover:text-white hover:underline"
                >
                  Esqueci minha senha?
                </button>
              </div>
            ) : null}
          </div>

          {criando ? (
            <label className="flex items-start gap-2 t-label text-slate-300">
              <input
                type="checkbox"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
                required
                className="mt-0.5 size-4 accent-teal-600"
              />
              <span>
                Li e concordo com os{' '}
                <button
                  type="button"
                  onClick={() => setFolhaAberta('termos')}
                  className="text-white underline"
                >
                  Termos de Uso
                </button>{' '}
                e a{' '}
                <button
                  type="button"
                  onClick={() => setFolhaAberta('privacidade')}
                  className="text-white underline"
                >
                  Política de Privacidade
                </button>
                , incluindo o processamento dos meus dados para fins de acompanhamento.
              </span>
            </label>
          ) : null}

          <div className="pt-2">
            <button
              type="submit"
              disabled={enviando || !firebaseConfigurado || (criando && !aceitouTermos)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none bg-teal-600 hover:bg-teal-700 text-white font-bold h-12"
            >
              {enviando ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}
            </button>
          </div>

          <div className="flex items-center gap-4 py-2">
            <hr className="flex-1 border-white/10" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">ou</span>
            <hr className="flex-1 border-white/10" />
          </div>

          <button
            type="button"
            onClick={continuarComGoogle}
            disabled={enviandoGoogle || !firebaseConfigurado}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full px-6 transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none bg-white/5 border border-white/20 text-white backdrop-blur-md h-12"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {enviandoGoogle ? 'Aguarde…' : 'Continuar com o Google'}
          </button>

          <p className="text-[11px] leading-snug text-center text-slate-400">
            Ao continuar com o Google, você concorda com nossos{' '}
            <button
              type="button"
              onClick={() => setFolhaAberta('termos')}
              className="underline text-slate-300 hover:text-white"
            >
              Termos de Uso
            </button>
            .
          </p>

          {!criando &&
          (isPWA || isMobile) &&
          biometriaService.suportaBiometria() &&
          biometriaService.dispositivoTemBiometria() ? (
            <button
              type="button"
              onClick={() => void continuarComBiometria()}
              disabled={enviandoBiometria || !firebaseConfigurado}
              className="w-full inline-flex items-center justify-center gap-3 rounded-full px-6 transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none bg-white/5 border border-white/20 text-white backdrop-blur-md h-12"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 .5 2.2M12 2a5 5 0 0 1 5 5v2c0 1.5-.3 3-1 4.3M7 9v0a5 5 0 0 0 1.5 3.6M7 9c0 5-2 8-3 9.5M12 9a3 3 0 0 1 3 3c0 3.5-1 6.5-2.5 8.5M12 9a3 3 0 0 0-3 3c0 1-.1 2-.4 3M15 12c0 4-1.5 7-3 8.5" />
              </svg>
              {enviandoBiometria ? 'Aguarde…' : 'Entrar com Biometria'}
            </button>
          ) : null}

          <p className="t-label pt-4 text-center text-slate-400">
            {criando ? 'Já tem conta? ' : 'Ainda não tem conta? '}
            <Link to={criando ? '/entrar' : '/criar-conta'} className="text-white underline">
              {criando ? 'Entrar' : 'Criar conta'}
            </Link>
          </p>
        </form>
      </div>

      <FolhaTermos
        aberto={folhaAberta !== null}
        conteudo={folhaAberta ?? 'termos'}
        aoFechar={() => setFolhaAberta(null)}
      />
    </div>
  );
}
