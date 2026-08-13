import { Alerta } from '@/components/Alerta';
import { ArcGauge } from '@/components/ArcGauge';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Field } from '@/components/Field';
import { Select } from '@/components/Select';
import { GlassCard } from '@/components/GlassCard';
import { HairlineChart, type PontoHairline } from '@/components/HairlineChart';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { StatBig } from '@/components/StatBig';
import { Casca } from './Casca';

/*
 * Vitrine do design system com dados falsos.
 *
 * Existe para validar o visual contra os prints de referência ANTES de ligar
 * qualquer componente em dados reais. Nada aqui consulta o Firebase.
 */

/*
 * A altura da barra é a DOSE aplicada, não um booleano de adesão. Assim o
 * gráfico mostra a titulação subindo (0,25 → 0,5 → 1,0 mg) e uma dose pulada
 * aparece como falha, em vez de virar um cercado de barras iguais.
 */
const APLICACOES: PontoHairline[] = [
  { rotulo: '02/06', valor: 0.25, detalhe: '0,25 mg — abdômen esq.' },
  { rotulo: '09/06', valor: 0.25, detalhe: '0,25 mg — coxa dir.' },
  { rotulo: '16/06', valor: 0.5, detalhe: '0,5 mg — braço esq.' },
  { rotulo: '23/06', valor: 0, detalhe: 'Pulada — fora da janela' },
  { rotulo: '30/06', valor: 0.5, detalhe: '0,5 mg — abdômen dir.' },
  { rotulo: '07/07', valor: 0.5, detalhe: '0,5 mg — coxa esq.' },
  { rotulo: '14/07', valor: 1, detalhe: '1,0 mg — braço dir.' },
  { rotulo: '21/07', valor: 1, detalhe: '1,0 mg — abdômen esq.' },
  { rotulo: '28/07', valor: 1, detalhe: '1,0 mg — coxa dir.', destaque: true },
];

const PESO: PontoHairline[] = [
  { rotulo: 'mar', valor: 98.4, detalhe: '98,4 kg' },
  { rotulo: 'abr', valor: 96.1, detalhe: '96,1 kg' },
  { rotulo: 'mai', valor: 94.7, detalhe: '94,7 kg' },
  { rotulo: 'jun', valor: 92.9, detalhe: '92,9 kg' },
  { rotulo: 'jul', valor: 91.2, detalhe: '91,2 kg' },
  { rotulo: 'ago', valor: 89.8, detalhe: '89,8 kg', destaque: true },
];

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
    <g fill="currentColor">
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </g>
  </svg>
);

export function KitchenSink() {
  return (
    /* Mesma casca e mesmo esqueleto das telas reais, para a vitrine mostrar o
       layout como ele de fato aparece — inclusive no desktop. */
    <Casca comNavegacao={false}>
      <Pagina
        hero={
          <Hero
            titulo="Próxima aplicação"
            esquerda={
              <CircleButton rotulo="Voltar">
                <IconeVoltar />
              </CircleButton>
            }
            direita={
              <CircleButton rotulo="Mais opções">
                <IconeMenu />
              </CircleButton>
            }
            aside={
              <div className="mt-6 lg:mt-0">
                <HairlineChart
                  pontos={APLICACOES}
                  sobre="hero"
                  grade={[0.25, 0.5, 1]}
                  formatarEixoY={(v) => v.toLocaleString('pt-BR')}
                  maxRotulos={5}
                />
              </div>
            }
            acoes={
              <div className="mt-6 flex gap-3">
                <Button sobre="hero" larguraTotal>
                  Registrar aplicação
                </Button>
                <Button sobre="hero" variante="secundaria">
                  Adiar
                </Button>
              </div>
            }
          >
            <div className="mt-8">
              <StatBig rotulo="Semaglutida 1,0 mg · quinta-feira" valor="2" sufixo="dias" />
            </div>
          </Hero>
        }
      >
        <SheetCard titulo="Caneta em uso" subtitulo="Semaglutida 1,0 mg · lote 4B21F">
          <ArcGauge valor={3} max={4} legenda="doses restantes" badge="3 de 4" tom="ok" />
          <p className="t-label mt-4 text-center text-ink-muted">
            Aberta em 12/07 · descartar em 08/08
          </p>
        </SheetCard>

        <SheetCard
          titulo="Peso"
          subtitulo="Desde o início do tratamento"
          acao={
            <Button variante="fantasma" className="px-0">
              Ver tudo
            </Button>
          }
        >
          <div className="flex items-baseline justify-between">
            <StatBig rotulo="Atual" valor="89,8" sufixo="kg" sobre="card" escala="stat" />
            <span
              className="t-label rounded-full px-3 py-1.5"
              style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}
            >
              −8,6 kg
            </span>
          </div>
          <div className="mt-5">
            {/* base="auto": ancorar peso em 0 achataria 89 e 98 kg na mesma barra. */}
            <HairlineChart pontos={PESO} sobre="card" altura={140} maxRotulos={6} base="auto" />
          </div>
        </SheetCard>

        <SheetCard titulo="Estados de alerta">
          <div className="space-y-3">
            <Alerta tom="ok" titulo="Em dia">
              Última aplicação há 5 dias, dentro do esquema.
            </Alerta>
            <Alerta tom="warn" titulo="Caneta vence em 4 dias">
              Aberta em 12/07. Depois de 08/08 ela deve ser descartada.
            </Alerta>
            <Alerta tom="danger" titulo="Aplicação atrasada há 3 dias">
              Ainda dá tempo de aplicar hoje. Confirme a conduta com quem prescreveu.
            </Alerta>
          </div>
        </SheetCard>

        <SheetCard titulo="Vidro fosco" subtitulo="Sobre o gradiente, como na referência">
          <div
            className="flex flex-wrap gap-3 rounded-[var(--r-field)] p-5"
            style={{
              background: 'linear-gradient(180deg, var(--hero-0) 0%, var(--hero-1) 100%)',
            }}
          >
            <GlassCard destaque="−1,4 kg" legenda="Nas últimas 4 semanas" />
            <GlassCard destaque="+0,8%" legenda="Adesão no mês" onFechar={() => {}} />
          </div>
        </SheetCard>

        <SheetCard titulo="Botões e campos">
          <div className="flex flex-wrap gap-3">
            <Button>Primária</Button>
            <Button variante="secundaria">Secundária</Button>
            <Button variante="fantasma">Fantasma</Button>
            <Button disabled>Desabilitada</Button>
          </div>
          <div className="mt-5 space-y-4">
            <Field rotulo="Peso de hoje" placeholder="89,8" inputMode="decimal" />
            <Field rotulo="E-mail" placeholder="voce@exemplo.com" erro="E-mail inválido." />
            <Select
              rotulo="Medicamento"
              placeholder="Selecione o medicamento"
              defaultValue=""
              opcoes={[
                { valor: 'ozempic', rotulo: 'Ozempic' },
                { valor: 'mounjaro', rotulo: 'Mounjaro' },
                { valor: '__outro', rotulo: 'Outro (digitar)' },
              ]}
            />
            <Select
              rotulo="Dose (mg)"
              defaultValue="0,5"
              erro="Escolha uma dose."
              opcoes={[
                { valor: '0,25', rotulo: '0,25 mg' },
                { valor: '0,5', rotulo: '0,5 mg' },
              ]}
            />
          </div>
        </SheetCard>

        <SheetCard titulo="Herói em alerta" subtitulo="Gradiente deslocado para o quente">
          <div
            className="rounded-[var(--r-field)] p-5"
            style={{ background: 'var(--grad-hero-alerta)' }}
          >
            <StatBig rotulo="Aplicação atrasada" valor="3" sufixo="dias" />
          </div>
        </SheetCard>

        <SheetCard titulo="Escala tipográfica">
          <div className="space-y-3">
            <p className="t-display text-ink">60,00</p>
            <p className="t-stat text-ink">26.379</p>
            <p className="t-title text-ink">Título de seção</p>
            <p className="t-body text-ink">
              Corpo de texto. Hierarquia por tamanho e espaço, não por peso nem por cor.
            </p>
            <p className="t-label text-ink-muted">Rótulo secundário</p>
            <p className="t-caption text-ink-muted">Rótulo minúsculo</p>
          </div>
        </SheetCard>
      </Pagina>
    </Casca>
  );
}
