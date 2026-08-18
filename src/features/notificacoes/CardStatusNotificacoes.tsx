import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { SheetCard } from '@/components/SheetCard';
import { detectarAndroid, detectarIOS, rodandoComoPWAInstalado } from '@/features/auth/sessao';
import { aoCapturarPrompt, limparPromptInstalacao, obterPromptInstalacao } from '@/lib/promptInstalacao';

type Plataforma = 'ios' | 'android' | 'web';

function detectarPlataforma(): Plataforma {
  if (detectarIOS()) return 'ios';
  if (detectarAndroid()) return 'android';
  return 'web';
}

/**
 * Reforço visível assim que o usuário entra em Ajustes: enquanto o app não
 * está instalado ou a permissão de notificação não foi aceita, mostra o que
 * falta — com passos diferentes por plataforma, já que instalar (e pedir
 * permissão) funciona de um jeito no iOS, outro no Android e outro no
 * desktop. Some sozinho assim que os dois requisitos são satisfeitos.
 */
export function CardStatusNotificacoes() {
  const navegar = useNavigate();
  const plataforma = detectarPlataforma();

  const [instalado] = useState(() => rodandoComoPWAInstalado());
  const [permitido] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );
  const [promptDisponivel, setPromptDisponivel] = useState(() => Boolean(obterPromptInstalacao()));
  const [instalando, setInstalando] = useState(false);

  useEffect(() => {
    if (instalado || plataforma !== 'android') return;
    return aoCapturarPrompt(() => setPromptDisponivel(true));
  }, [instalado, plataforma]);

  async function instalar() {
    const evento = obterPromptInstalacao();
    if (!evento) return;
    setInstalando(true);
    try {
      await evento.prompt();
      await evento.userChoice;
      limparPromptInstalacao();
      setPromptDisponivel(false);
    } finally {
      setInstalando(false);
    }
  }

  // No iOS a permissão nem pode ser pedida fora do modo instalado — sem
  // sentido mostrar dois avisos separados nesse caso, o de instalação já
  // explica o motivo.
  const mostrarAvisoNotificacao = !permitido && (instalado || plataforma !== 'ios');

  if (instalado && permitido) return null;

  return (
    <SheetCard
      titulo="Notificações"
      subtitulo="Os lembretes só chegam com o app instalado e a permissão do navegador aceita."
    >
      <div className="space-y-3">
        {!instalado ? (
          <Alerta tom="warn" titulo="Instale o app no seu dispositivo">
            {plataforma === 'ios' ? (
              <>
                No iPhone, toque no ícone de <strong>Compartilhar</strong> no Safari e depois em{' '}
                <strong>"Adicionar à Tela de Início"</strong>. As notificações só funcionam com o
                app instalado.
              </>
            ) : plataforma === 'android' ? (
              <>
                <p>Instale o Dose Certa para ter acesso rápido e receber notificações.</p>
                {promptDisponivel ? (
                  <div className="mt-3">
                    <Button variante="secundaria" onClick={() => void instalar()} disabled={instalando}>
                      {instalando ? 'Instalando…' : 'Instalar Aplicativo'}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1">
                    Abra o menu do navegador (⋮) e toque em <strong>"Instalar aplicativo"</strong>.
                  </p>
                )}
              </>
            ) : (
              <>
                No computador, use o ícone de instalação na barra de endereço ou o menu do
                navegador (⋮) e escolha <strong>"Instalar Dose Certa"</strong>.
              </>
            )}
          </Alerta>
        ) : null}

        {mostrarAvisoNotificacao ? (
          <Alerta tom="warn" titulo="Ative as notificações">
            <p>Falta permitir as notificações no navegador para receber os lembretes.</p>
            <div className="mt-3">
              <Button variante="secundaria" onClick={() => navegar('/ajustes/lembretes')}>
                Ir para Lembretes
              </Button>
            </div>
          </Alerta>
        ) : null}
      </div>
    </SheetCard>
  );
}
