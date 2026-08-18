import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { SidebarSessoes } from './SidebarSessoes';
import { useChatCopiloto } from './useChatCopiloto';
import { useSessoesChat } from './useSessoesChat';

const ALTURA_MAXIMA_TEXTAREA = 160;

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

const IconeMenu = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const IconeEnviar = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path
      d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function BolhaMensagem({ role, texto }: { role: 'user' | 'assistant'; texto: string }) {
  const doUsuario = role === 'user';
  return (
    <div className={`flex ${doUsuario ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--r-field)] px-4 py-2.5 t-body sm:max-w-[75%] ${
          doUsuario ? 'bg-blue-600 text-white' : 'bg-card text-ink'
        }`}
        style={doUsuario ? undefined : { boxShadow: 'var(--shadow-card)' }}
      >
        {texto}
      </div>
    </div>
  );
}

function BolhaDigitando() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 px-4 py-3"
        style={{ borderRadius: 'var(--r-field)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)' }}
        aria-label="Co-piloto está digitando"
        role="status"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full"
            style={{
              background: 'var(--ink-faint)',
              animation: `dosecerta-piscar 1.1s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Chat do Co-piloto de Hábitos: tela cheia própria, fora da Casca/NavLateral/
 * BarraAbas — um input fixo no rodapé mais teclado virtual brigaria com a
 * barra de abas fixa se ficasse dentro do layout padrão.
 *
 * Sessões: `sessaoAtivaId` null é "conversa nova" — a sessão só é criada de
 * verdade no backend quando a primeira mensagem é enviada (ver useChatCopiloto).
 */
export function TelaCopiloto() {
  const navegar = useNavigate();
  const [sessaoAtivaId, setSessaoAtivaId] = useState<string | null>(null);
  const [sidebarAberta, setSidebarAberta] = useState(false);

  const { sessoes, excluir } = useSessoesChat();
  const onSessaoCriada = useCallback((id: string) => setSessaoAtivaId(id), []);
  const { mensagens, mensagemPendente, respostaEmAndamento, enviando, erro, enviar } = useChatCopiloto(
    sessaoAtivaId,
    onSessaoCriada,
  );

  const [rascunho, setRascunho] = useState('');
  const fimDaListaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens, mensagemPendente, respostaEmAndamento]);

  /* Auto-resize: cresce com o texto até ALTURA_MAXIMA_TEXTAREA, depois passa
     a rolar. Reseta para 'auto' primeiro, senão o scrollHeight só cresce e
     nunca encolhe quando o texto diminui (ex.: depois de enviar). */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, ALTURA_MAXIMA_TEXTAREA)}px`;
  }, [rascunho]);

  /* Fecha o drawer mobile com Escape e trava o scroll do body enquanto está
     aberto — mesmo padrão de FolhaRegistro.tsx. */
  useEffect(() => {
    if (!sidebarAberta) return;
    const rolagemAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape') setSidebarAberta(false);
    }
    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.body.style.overflow = rolagemAntes;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [sidebarAberta]);

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    const texto = rascunho;
    if (!texto.trim() || enviando) return;
    setRascunho('');
    await enviar(texto);
  }

  function handleKeyDown(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      void handleSubmit(evento as unknown as FormEvent);
    }
  }

  function selecionarSessao(id: string) {
    setSessaoAtivaId(id);
    setSidebarAberta(false);
  }

  function novaConversa() {
    setSessaoAtivaId(null);
    setSidebarAberta(false);
  }

  async function excluirSessao(id: string) {
    await excluir(id);
    if (sessaoAtivaId === id) setSessaoAtivaId(null);
  }

  return (
    <div
      className="mx-auto flex h-dvh flex-col lg:my-6 lg:h-[calc(100dvh-3rem)] lg:max-w-4xl lg:overflow-hidden lg:rounded-[var(--r-card)] lg:border"
      style={{ background: 'var(--surface-page)', borderColor: 'var(--border-hair)' }}
    >
      <style>{`@keyframes dosecerta-piscar { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }`}</style>

      <header
        className="flex min-h-14 shrink-0 items-center gap-2 border-b px-2 lg:px-4"
        style={{
          background: 'var(--surface-card)',
          borderColor: 'var(--border-hair)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <button
          type="button"
          onClick={() => navegar('/ajustes')}
          aria-label="Voltar"
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-sunken"
        >
          <IconeVoltar />
        </button>
        <button
          type="button"
          onClick={() => setSidebarAberta(true)}
          aria-label="Histórico de conversas"
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-sunken lg:hidden"
        >
          <IconeMenu />
        </button>
        <p className="t-label truncate text-ink font-semibold">Co-piloto de Hábitos</p>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar fixa do desktop */}
        <div className="hidden w-64 shrink-0 border-r lg:block" style={{ borderColor: 'var(--border-hair)' }}>
          <SidebarSessoes
            sessoes={sessoes}
            sessaoAtivaId={sessaoAtivaId}
            onNovaConversa={novaConversa}
            onSelecionar={selecionarSessao}
            onExcluir={excluirSessao}
          />
        </div>

        {/* Drawer do mobile */}
        {sidebarAberta ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              aria-hidden="true"
              onClick={() => setSidebarAberta(false)}
              className="absolute inset-0 bg-black/50"
            />
            <div
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r"
              style={{ background: 'var(--surface-card)', borderColor: 'var(--border-hair)' }}
              role="dialog"
              aria-modal="true"
              aria-label="Histórico de conversas"
            >
              <SidebarSessoes
                sessoes={sessoes}
                sessaoAtivaId={sessaoAtivaId}
                onNovaConversa={novaConversa}
                onSelecionar={selecionarSessao}
                onExcluir={excluirSessao}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              {mensagens.length === 0 && !mensagemPendente ? (
                <p className="t-body px-2 text-ink-muted">
                  Oi! Sou o seu Co-piloto de Hábitos. Posso te apoiar com dicas de hidratação, bem-estar e
                  alimentação leve durante o seu tratamento. O que você gostaria de conversar?
                </p>
              ) : null}

              {mensagens.map((mensagem) => (
                <BolhaMensagem key={mensagem.id} role={mensagem.role} texto={mensagem.text} />
              ))}

              {mensagemPendente ? <BolhaMensagem role="user" texto={mensagemPendente} /> : null}

              {respostaEmAndamento ? (
                <BolhaMensagem role="assistant" texto={respostaEmAndamento} />
              ) : enviando ? (
                <BolhaDigitando />
              ) : null}

              <div ref={fimDaListaRef} />
            </div>
          </div>

          <div
            className="shrink-0 border-t px-4 pt-3"
            style={{
              background: 'var(--surface-card)',
              borderColor: 'var(--border-hair)',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {erro ? (
              <div className="mb-3">
                <Alerta tom="danger" titulo={erro} />
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={rascunho}
                onChange={(evento) => setRascunho(evento.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva sua mensagem…"
                rows={1}
                disabled={enviando}
                className="min-h-12 flex-1 resize-none overflow-y-auto border px-4 py-3 t-body text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-55"
                style={{
                  borderRadius: 'var(--r-field)',
                  background: 'var(--surface-sunken)',
                  borderColor: 'var(--border-hair)',
                  maxHeight: ALTURA_MAXIMA_TEXTAREA,
                }}
              />
              <button
                type="submit"
                disabled={!rascunho.trim() || enviando}
                aria-label="Enviar mensagem"
                className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-600 text-white transition-opacity hover:bg-blue-700 disabled:opacity-40"
              >
                <IconeEnviar />
              </button>
            </form>

            <p className="t-caption mt-2 pb-1 text-ink-faint">
              A inteligência artificial pode cometer erros e não substitui avaliação médica. Sempre
              consulte seu médico.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
