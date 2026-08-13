import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { criarProtocolo } from '@/features/dados/repositorio';
import { useDados } from '@/features/dados/DadosProvider';
import { Casca } from '@/app/Casca';
import { FormProtocolo } from './FormProtocolo';

/**
 * Primeira execução: sem protocolo não há o que acompanhar, então esta tela
 * toma o lugar da navegação até existir um tratamento cadastrado.
 *
 * Casca sem navegação de propósito — abas ou menu lateral vazios na primeira
 * abertura só confundiriam. E `layout="foco"`: cadastrar o protocolo é tarefa
 * única, então a coluna continua estreita mesmo no desktop.
 */
export function Onboarding({ uid, onPronto }: { uid: string; onPronto?: () => void }) {
  const { medicamentos, medicamentosCarregando } = useDados();

  return (
    <Casca comNavegacao={false}>
      <Pagina
        layout="foco"
        hero={
          <Hero titulo="Seu tratamento">
            <div className="mt-6">
              <p className="t-caption text-on-hero-muted">Primeiro passo</p>
              <h2 className="t-stat mt-1.5 text-on-hero">Cadastre seu protocolo</h2>
              <p className="t-body mt-3 text-on-hero-muted">
                Use exatamente o que está na sua prescrição. Você pode ajustar depois.
              </p>
            </div>
          </Hero>
        }
      >
        <SheetCard>
          <FormProtocolo
            medicamentos={medicamentos}
            carregandoMedicamentos={medicamentosCarregando}
            rotuloEnvio="Salvar protocolo"
            onEnviar={async (valores) => {
              await criarProtocolo(uid, { ...valores, planoTitulacao: [], iniciadoEm: new Date() });
              // A navegação reage sozinha pelo onSnapshot; o callback é só
              // para quem abrir esta tela a partir de outro fluxo.
              onPronto?.();
            }}
          />
        </SheetCard>

        <SheetCard>
          <p className="t-label text-ink-muted">
            O DoseCerta organiza e registra o seu tratamento. Ele não prescreve e não substitui a
            orientação de quem acompanha você.
          </p>
        </SheetCard>
      </Pagina>
    </Casca>
  );
}
