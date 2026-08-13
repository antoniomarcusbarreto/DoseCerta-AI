import { useId, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useAuth } from '@/features/auth/AuthProvider';

const ENDPOINT_SUPORTE = 'https://magenta-deer-711155.hostingersite.com/webhook/helpdesk-triagem';
const APP_VERSION = '1.0.0';
const MENSAGEM_ERRO = 'Não foi possível enviar sua mensagem no momento. Tente novamente mais tarde.';

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

/**
 * Canal de suporte: o texto vai para o webhook de triagem do n8n junto com
 * metadados de contexto (rota, navegador, versão) — sem isso, quem for
 * triar o relato não tem como saber onde o usuário estava nem o que rodou.
 */
export function TelaSuporte() {
  const { usuario } = useAuth();
  const location = useLocation();
  const navegar = useNavigate();
  const idMensagem = useId();

  const [email, setEmail] = useState(usuario?.email ?? '');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const valido = mensagem.trim().length >= 10;

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (!valido || enviando) return;

    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch(ENDPOINT_SUPORTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSource: 'DoseCerta-AI',
          userId: usuario?.uid ?? null,
          userName: usuario?.displayName ?? null,
          userEmail: email,
          message: mensagem.trim(),
          metadata: {
            currentRoute: location.pathname,
            userAgent: navigator.userAgent,
            appVersion: APP_VERSION,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!resposta.ok) throw new Error(`status ${resposta.status}`);

      setEnviado(true);
      setMensagem('');
    } catch (falha) {
      console.error('[DoseCerta] falha ao enviar suporte:', falha);
      setErro(MENSAGEM_ERRO);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Suporte e Feedback"
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
      <SheetCard
        titulo="Como podemos ajudar?"
        subtitulo="Envie sua dúvida, bug ou sugestão. Nossa equipe ou assistente de IA responderá em breve."
      >
        {enviado ? (
          <>
            <Alerta tom="ok" titulo="Mensagem enviada">
              Obrigado! Vamos responder em breve.
            </Alerta>
            <div className="mt-4">
              <Button larguraTotal onClick={() => navegar('/ajustes')}>
                Voltar para Ajustes
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              rotulo="Seu e-mail"
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              required
            />

            <div>
              <label htmlFor={idMensagem} className="t-caption text-ink-muted">
                Mensagem
              </label>
              <textarea
                id={idMensagem}
                className="mt-1.5 block min-h-32 w-full border px-4 py-3 t-body text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-55"
                style={{
                  borderRadius: 'var(--r-field)',
                  background: 'var(--surface-sunken)',
                  borderColor: 'var(--border-hair)',
                }}
                placeholder="Descreva o que aconteceu ou o que você precisa..."
                value={mensagem}
                onChange={(evento) => setMensagem(evento.target.value)}
                required
                minLength={10}
              />
            </div>

            {erro ? <Alerta tom="danger" titulo={erro} /> : null}

            <Button type="submit" larguraTotal disabled={!valido || enviando}>
              {enviando ? 'Enviando…' : 'Enviar Mensagem'}
            </Button>
          </form>
        )}
      </SheetCard>
    </Pagina>
  );
}
