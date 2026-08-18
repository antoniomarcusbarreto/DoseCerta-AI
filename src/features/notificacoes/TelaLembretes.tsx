import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { getFunctionsCliente } from '@/lib/firebase';
import { useAmbiente } from '@/lib/useAmbiente';
import { useNotificacoes } from './useNotificacoes';

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

const MENSAGEM_TESTE_ERRO = 'Não foi possível enviar a notificação de teste. Tente novamente.';

export function TelaLembretes() {
  const navegar = useNavigate();
  const { isPWA, isMobile } = useAmbiente();
  const {
    permissao,
    precisaInstalar,
    verificando,
    sincronizando,
    tokenConfirmado,
    erro,
    sincronizarDispositivo,
  } = useNotificacoes();

  const [testando, setTestando] = useState(false);
  const [testeEnviado, setTesteEnviado] = useState(false);
  const [erroTeste, setErroTeste] = useState<string | null>(null);

  const habilitado = permissao === 'granted' && tokenConfirmado;
  // Permissão já concedida, mas o token ainda não está confirmado no
  // servidor — não é "nunca pediu" (não faz sentido mostrar "Habilitar"
  // de novo) nem "já funciona" (o teste ia falhar). É esse terceiro estado
  // que precisa de um clique explícito do usuário pra tentar de novo.
  const precisaSincronizar = permissao === 'granted' && !tokenConfirmado && !verificando;

  // Notificação push é 100% mobile/PWA aqui — fora disso a tela inteira não
  // faz sentido (nem o aviso de "instale o app", que é redigido pro iOS).
  if (!isPWA && !isMobile) return null;

  async function testar() {
    setTestando(true);
    setErroTeste(null);
    setTesteEnviado(false);
    try {
      const testarNotificacao = httpsCallable(getFunctionsCliente(), 'testarNotificacao');
      await testarNotificacao();
      setTesteEnviado(true);
    } catch (falha) {
      console.error('[DoseCerta] falha ao testar notificação:', falha);
      // Erro do Functions SDK já vem com uma mensagem legível (a que a
      // própria Cloud Function definiu) — mostrar ela em vez da genérica
      // ajuda a diagnosticar sem precisar abrir o console do navegador.
      const mensagem = falha instanceof Error && falha.message ? falha.message : MENSAGEM_TESTE_ERRO;
      setErroTeste(mensagem);
    } finally {
      setTestando(false);
    }
  }

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Lembretes"
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
        titulo="Notificações"
        subtitulo="Receba um aviso no dia da aplicação, acompanhamento de sintomas e lembretes de check-in."
      >
        <div className="space-y-4">
          {precisaInstalar ? (
            <Alerta tom="warn" titulo="Instale o app para receber notificações">
              No iPhone, as notificações só funcionam com o Dose Certa instalado na Tela de Início.
              Toque no ícone de Compartilhar do Safari e depois em "Adicionar à Tela de Início" —
              depois volte aqui pelo atalho instalado.
            </Alerta>
          ) : permissao === 'denied' ? (
            <Alerta tom="warn" titulo="Notificações bloqueadas">
              Você negou a permissão para este site. Habilite pelas configurações do navegador para
              receber os lembretes.
            </Alerta>
          ) : verificando ? (
            <div className="flex min-h-11 items-center">
              <p className="t-label text-ink-muted">Verificando notificações…</p>
            </div>
          ) : habilitado ? (
            <Alerta tom="ok" titulo="Notificações habilitadas">
              Você vai receber os lembretes de aplicação, sintomas e check-in neste dispositivo.
            </Alerta>
          ) : precisaSincronizar ? (
            <>
              <Alerta tom="warn" titulo="Sincronize este dispositivo">
                A permissão já está concedida, mas não conseguimos confirmar o token de notificação
                no servidor. Toque para tentar de novo.
              </Alerta>
              <Button larguraTotal onClick={() => void sincronizarDispositivo()} disabled={sincronizando}>
                {sincronizando ? 'Sincronizando…' : 'Sincronizar Dispositivo'}
              </Button>
            </>
          ) : (
            <Button larguraTotal onClick={() => void sincronizarDispositivo()} disabled={sincronizando}>
              {sincronizando ? 'Habilitando…' : 'Habilitar Notificações'}
            </Button>
          )}

          {erro ? <Alerta tom="danger" titulo={erro} /> : null}

          {habilitado ? (
            <>
              <Button
                variante="secundaria"
                larguraTotal
                onClick={() => void testar()}
                disabled={testando}
              >
                {testando ? 'Enviando…' : 'Testar Notificação'}
              </Button>

              {testeEnviado ? (
                <Alerta tom="ok" titulo="Notificação de teste enviada">
                  Se não aparecer em alguns segundos, confira se o app está com permissão de
                  notificação no sistema.
                </Alerta>
              ) : null}
              {erroTeste ? <Alerta tom="danger" titulo={erroTeste} /> : null}
            </>
          ) : null}
        </div>
      </SheetCard>
    </Pagina>
  );
}
