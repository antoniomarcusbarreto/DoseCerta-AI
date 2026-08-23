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

type Diagnostico = {
  dispositivo: {
    tokens: number;
    achadoPelaVarredura: boolean;
    usuariosNaBase: number;
    usuariosComToken: number;
    ultimoPushEnviadoEm: string | null;
    ultimoPushRecebidoEm: string | null;
    atrasoMs: number | null;
  };
  avaliadoEm: string;
  rotinas: { rotina: string; dispararia: boolean; detalhe: string }[];
  execucoes: Record<string, { executadaEm: string; resumo: Record<string, unknown> }>;
};

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
    resetando,
    sincronizarDispositivo,
    resetarNotificacoes,
  } = useNotificacoes();

  const [testando, setTestando] = useState(false);
  const [testeEnviado, setTesteEnviado] = useState(false);
  const [erroTeste, setErroTeste] = useState<string | null>(null);
  const [resetFeito, setResetFeito] = useState(false);
  const [diagnosticando, setDiagnosticando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [erroDiagnostico, setErroDiagnostico] = useState<string | null>(null);

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

  // Limpeza profunda: apaga o token local (IndexedDB), desregistra todos os
  // service workers do site e remove o token do Firestore, pra sair de
  // qualquer estado corrompido antes de recomeçar do zero. Recarrega a
  // página em seguida — sem isso o SW recém-desregistrado deixaria o app
  // num limbo até o próximo carregamento natural.
  async function resetar() {
    const confirmado = window.confirm(
      'Isso vai apagar as notificações salvas neste dispositivo e recarregar a página. Continuar?',
    );
    if (!confirmado) return;

    await resetarNotificacoes();
    setResetFeito(true);
    window.setTimeout(() => window.location.reload(), 1200);
  }

  async function diagnosticar() {
    setDiagnosticando(true);
    setErroDiagnostico(null);
    try {
      const chamar = httpsCallable<void, Diagnostico>(getFunctionsCliente(), 'diagnosticarNotificacoes');
      const resposta = await chamar();
      setDiagnostico(resposta.data);
    } catch (falha) {
      console.error('[DoseCerta] falha ao diagnosticar notificações:', falha);
      setErroDiagnostico(
        falha instanceof Error && falha.message ? falha.message : 'Não foi possível diagnosticar.',
      );
    } finally {
      setDiagnosticando(false);
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

      {!precisaInstalar ? (
        <SheetCard titulo="Solução de problemas">
          <div className="space-y-3">
            <p className="t-label text-ink-muted">
              Se as notificações continuarem falhando mesmo depois de sincronizar, isso pode ser um
              estado corrompido salvo neste navegador. O reset apaga esses dados locais e recarrega
              a página.
            </p>
            <Button
              variante="fantasma"
              larguraTotal
              onClick={() => void resetar()}
              disabled={resetando}
              className="text-danger"
            >
              {resetando ? 'Limpando…' : 'Reset Total de Notificações'}
            </Button>
            {resetFeito ? (
              <Alerta tom="ok" titulo="Cache de notificações limpo!">
                Recarregando a página…
              </Alerta>
            ) : null}

            <div className="border-t pt-3" style={{ borderColor: 'var(--border-hair)' }}>
              <p className="t-label text-ink-muted">
                O diagnóstico mostra, sem enviar nada, se o servidor enxerga este dispositivo e por
                que cada lembrete automático dispararia ou não agora.
              </p>
              <div className="mt-3">
                <Button
                  variante="secundaria"
                  larguraTotal
                  onClick={() => void diagnosticar()}
                  disabled={diagnosticando}
                >
                  {diagnosticando ? 'Diagnosticando…' : 'Diagnosticar rotinas'}
                </Button>
              </div>
            </div>

            {erroDiagnostico ? <Alerta tom="danger" titulo={erroDiagnostico} /> : null}

            {diagnostico ? (
              <div className="space-y-3">
                <div
                  className="p-3"
                  style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--r-field)' }}
                >
                  <p className="t-label text-ink">Dispositivo</p>
                  <p className="t-caption mt-1 text-ink-muted">
                    {diagnostico.dispositivo.tokens} token(s) salvo(s) ·{' '}
                    {diagnostico.dispositivo.achadoPelaVarredura
                      ? 'o servidor encontra esta conta'
                      : 'o servidor NÃO encontra esta conta'}
                  </p>
                  <p className="t-caption mt-0.5 text-ink-faint">
                    Base: {diagnostico.dispositivo.usuariosComToken} de{' '}
                    {diagnostico.dispositivo.usuariosNaBase} conta(s) com notificação
                  </p>
                  <p className="t-caption mt-0.5 text-ink-faint">
                    Último push enviado: {diagnostico.dispositivo.ultimoPushEnviadoEm ?? 'nunca'} · recebido
                    pelo dispositivo: {diagnostico.dispositivo.ultimoPushRecebidoEm ?? 'nunca'}
                    {diagnostico.dispositivo.atrasoMs !== null
                      ? ` (atraso de ${Math.round(diagnostico.dispositivo.atrasoMs / 1000)}s)`
                      : ''}
                  </p>
                </div>

                <ul className="space-y-2">
                  {diagnostico.rotinas.map((item) => (
                    <li key={item.rotina}>
                      <p className="t-label text-ink">
                        {item.dispararia ? '✅' : '⛔'} {item.rotina}
                      </p>
                      <p className="t-caption mt-0.5 text-ink-muted">{item.detalhe}</p>
                    </li>
                  ))}
                </ul>

                <div
                  className="p-3"
                  style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--r-field)' }}
                >
                  <p className="t-label text-ink">Última execução das rotinas no servidor</p>
                  {Object.keys(diagnostico.execucoes).length === 0 ? (
                    <p className="t-caption mt-1 text-ink-muted">
                      Nenhuma rotina registrou execução ainda. Os registros começam na próxima vez
                      que cada horário for atingido.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {Object.entries(diagnostico.execucoes).map(([nome, dados]) => (
                        <li key={nome} className="t-caption text-ink-muted">
                          <span className="text-ink">{nome}</span> — {dados.executadaEm}
                          <br />
                          <span className="text-ink-faint">
                            {Object.entries(dados.resumo)
                              .map(([chave, valor]) => `${chave}: ${String(valor)}`)
                              .join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="t-caption text-ink-faint">Avaliado em {diagnostico.avaliadoEm}</p>
              </div>
            ) : null}
          </div>
        </SheetCard>
      ) : null}
    </Pagina>
  );
}
