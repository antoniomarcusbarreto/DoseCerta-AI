import { useEffect, useState } from 'react';
import { Share, SquarePlus, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { detectarIOS } from '@/features/auth/sessao';
import { aoCapturarPrompt, limparPromptInstalacao, obterPromptInstalacao } from '@/lib/promptInstalacao';
import { useAmbiente } from '@/lib/useAmbiente';

const CHAVE_DISPENSADO = 'instalacao-wizard-dispensado';

type Plataforma = 'ios' | 'android' | null;

export function InstalacaoWizard() {
  const { isPWA, isMobile } = useAmbiente();
  const [dispensado, setDispensado] = useState(
    () => localStorage.getItem(CHAVE_DISPENSADO) === '1',
  );
  const [plataforma, setPlataforma] = useState<Plataforma>(null);

  useEffect(() => {
    if (isPWA || !isMobile) return;

    if (detectarIOS()) {
      setPlataforma('ios');
      return;
    }

    if (obterPromptInstalacao()) {
      setPlataforma('android');
      return;
    }

    return aoCapturarPrompt(() => setPlataforma('android'));
  }, [isPWA, isMobile]);

  function fechar() {
    localStorage.setItem(CHAVE_DISPENSADO, '1');
    setDispensado(true);
  }

  async function instalar() {
    const evento = obterPromptInstalacao();
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    limparPromptInstalacao();
    fechar();
  }

  if (dispensado || !plataforma) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Instalar o Dose Certa"
    >
      <div aria-hidden="true" onClick={fechar} className="absolute inset-0" />

      <div className="folha relative w-full max-w-sm bg-card p-5">
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-4 top-4 text-ink-muted"
        >
          <X size={20} />
        </button>

        <h2 className="t-title pr-8 text-ink">Instale o Dose Certa</h2>
        <p className="t-label mt-1 text-ink-muted">
          Tenha o app na sua tela de início, com acesso rápido e experiência de aplicativo nativo.
        </p>

        {plataforma === 'ios' ? (
          <ol className="mt-5 space-y-4">
            <li className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink">
                <Share size={18} />
              </span>
              <p className="t-label mt-1.5 text-ink">
                Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta para cima) na
                barra inferior.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink">
                <SquarePlus size={18} />
              </span>
              <p className="t-label mt-1.5 text-ink">
                Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.
              </p>
            </li>
          </ol>
        ) : (
          <div className="mt-5">
            <Button variante="primaria" larguraTotal onClick={instalar}>
              <Smartphone size={18} />
              Instalar Aplicativo
            </Button>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <Button variante="fantasma" onClick={fechar}>
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
