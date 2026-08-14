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
  const { permissao, habilitando, tokenSalvo, erro, habilitar } = useNotificacoes();

  const [testando, setTestando] = useState(false);
  const [testeEnviado, setTesteEnviado] = useState(false);
  const [erroTeste, setErroTeste] = useState<string | null>(null);

  const habilitado = permissao === 'granted' && tokenSalvo;

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
      setErroTeste(MENSAGEM_TESTE_ERRO);
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
          {permissao === 'denied' ? (
            <Alerta tom="warn" titulo="Notificações bloqueadas">
              Você negou a permissão para este site. Habilite pelas configurações do navegador para
              receber os lembretes.
            </Alerta>
          ) : null}

          {habilitado ? (
            <Alerta tom="ok" titulo="Notificações habilitadas">
              Você vai receber os lembretes de aplicação, sintomas e check-in neste dispositivo.
            </Alerta>
          ) : (
            <Button larguraTotal onClick={() => void habilitar()} disabled={habilitando}>
              {habilitando ? 'Habilitando…' : 'Habilitar Notificações'}
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
