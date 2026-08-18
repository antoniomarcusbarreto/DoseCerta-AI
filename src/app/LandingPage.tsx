import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button } from '@/components/Button';
import { ArcGauge } from '@/components/ArcGauge';
import { SheetCard } from '@/components/SheetCard';
import { Carregando } from '@/components/Carregando';

const COR_MARCA = '#14b8a6';

function IconeCompartilhar() {
  return (
    <svg viewBox="0 0 24 24" className="inline-block size-4 shrink-0 align-text-bottom" aria-hidden="true">
      <path
        d="M12 3v12m0-12l-3.5 3.5M12 3l3.5 3.5M6 11v8a1 1 0 001 1h10a1 1 0 001-1v-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeMenu() {
  return (
    <svg viewBox="0 0 24 24" className="inline-block size-4 shrink-0 align-text-bottom" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
    </svg>
  );
}

const LINKS_NAV = [
  { href: '#funcionalidades', rotulo: 'Funcionalidades' },
  { href: '#planos', rotulo: 'Planos' },
  { href: '#instalacao', rotulo: 'Instalação' },
];

// TODO: adicionar aqui o card "Análise de progresso por IA" quando integrarmos
// o Gemini Vision na galeria de fotos de evolução.
const FUNCIONALIDADES = [
  {
    emoji: '📸',
    titulo: 'Scanner de Refeições',
    descricao: 'Tire uma foto do prato: a IA calcula calorias e macros na hora, sem precisar digitar nada.',
  },
  {
    emoji: '📄',
    titulo: 'Importação de Dieta (PDF)',
    descricao: 'A IA lê o PDF do seu nutricionista e configura suas metas no app automaticamente.',
  },
  {
    emoji: '🪄',
    titulo: 'Geração de Dieta',
    descricao: 'Sem plano em mãos? A IA monta um plano nutricional provisório com base no seu peso e objetivo.',
  },
  {
    emoji: '💬',
    titulo: 'Co-piloto Inteligente',
    descricao:
      'Chat com IA que cruza seus sintomas, aplicações e dieta para tirar dúvidas na hora, sem precisar procurar.',
  },
];

type Passo = { texto: string; icone?: ReactNode };

const PASSOS_IOS: Passo[] = [
  { texto: 'Abra o site no Safari.' },
  { texto: 'Toque no ícone de Compartilhar', icone: <IconeCompartilhar /> },
  { texto: 'Selecione "Adicionar à Tela de Início".' },
];

const PASSOS_ANDROID: Passo[] = [
  { texto: 'Abra o site no Chrome.' },
  { texto: 'Toque no menu', icone: <IconeMenu /> },
  { texto: 'Selecione "Adicionar à tela inicial".' },
];

/** Mock ilustrativo do dashboard real (anéis de meta + curva), com dados fictícios. */
function VisualDashboard() {
  return (
    <div className="relative">
      {/* Brilho suave na cor da marca atrás do card, para o mockup não ficar "solto" no gradiente do herói. */}
      <div
        className="absolute -inset-6 -z-10 rounded-[32px] opacity-50 blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${COR_MARCA}, transparent)` }}
        aria-hidden="true"
      />
      <div className="rounded-[calc(var(--r-card)+6px)] border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm">
        <SheetCard>
          <p className="t-caption text-ink-muted">Hoje</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <ArcGauge compacto valor={92} max={110} exibicao="92g" legenda="Proteínas" tom="ok" />
            <ArcGauge compacto valor={1450} max={1800} exibicao="1450" legenda="Calorias" tom="neutro" />
            <ArcGauge compacto valor={1800} max={2500} exibicao="1.8L" legenda="Água" tom="ok" />
          </div>

          <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border-hair)' }}>
            <p className="t-label text-ink-muted">Curva de evolução</p>
            <svg viewBox="0 0 280 90" className="mt-2 w-full" role="img" aria-label="Curva de peso cruzada com aplicações">
              <polyline
                points="0,10 40,18 80,24 120,38 160,44 200,58 240,64 280,70"
                fill="none"
                stroke={COR_MARCA}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {[40, 120, 200].map((x, i) => (
                <circle key={x} cx={x} cy={[18, 38, 58][i]} r="4" fill="#a855f7" />
              ))}
            </svg>
            <p className="t-caption mt-1 text-ink-faint">Peso · Aplicações da medicação</p>
          </div>
        </SheetCard>
      </div>
    </div>
  );
}

function Cabecalho() {
  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur-md"
      style={{ background: 'color-mix(in srgb, var(--surface-page) 85%, transparent)', borderColor: 'var(--border-hair)' }}
    >
      <div className="faixa flex h-16 items-center justify-between gap-4">
        <span className="t-title shrink-0 text-xl font-extrabold text-ink">
          Dose Certa<span className="text-teal-500">-AI</span>
        </span>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
          {LINKS_NAV.map((link) => (
            <a key={link.href} href={link.href} className="t-label text-ink-muted transition-colors hover:text-ink">
              {link.rotulo}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link to="/entrar">
            <Button variante="secundaria">Entrar</Button>
          </Link>
          <Link to="/criar-conta">
            <Button variante="primaria">Criar Conta</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function SecaoHero() {
  return (
    <section className="relative isolate" style={{ background: 'var(--grad-hero)' }}>
      <div className="faixa grid gap-10 py-12 md:py-24 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-16">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-on-hero md:text-5xl lg:text-6xl">
            Maximize os resultados do seu tratamento. Deixe a IA cuidar da sua nutrição.
          </h1>
          <p className="t-body mt-6 max-w-xl text-lg text-on-hero-muted">
            O único aplicativo que cruza a evolução do seu peso com as aplicações da sua medicação, garantindo a
            proteção da sua massa muscular com Inteligência Artificial.
          </p>
          <div className="mt-8">
            <Link to="/criar-conta">
              <Button variante="primaria" sobre="hero">
                Comece seu Teste de 7 Dias Grátis
              </Button>
            </Link>
          </div>
        </div>

        <VisualDashboard />
      </div>
    </section>
  );
}

function SecaoFuncionalidades() {
  return (
    <section id="funcionalidades" className="faixa py-12 md:py-24">
      <h2 className="text-2xl leading-tight font-bold text-ink md:text-4xl lg:text-5xl">O que a IA faz por você</h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FUNCIONALIDADES.map((item) => (
          <SheetCard
            key={item.titulo}
            className="border border-transparent transition-all duration-200 hover:-translate-y-1 hover:border-teal-500/50"
          >
            <span className="text-3xl" aria-hidden="true">
              {item.emoji}
            </span>
            <h3 className="t-title mt-3 text-ink">{item.titulo}</h3>
            <p className="t-body mt-2 text-ink-muted">{item.descricao}</p>
          </SheetCard>
        ))}
      </div>
    </section>
  );
}

function SecaoPrecos() {
  return (
    <section id="planos" className="py-12 md:py-24" style={{ background: 'var(--surface-desk)' }}>
      <div className="faixa">
        <h2 className="text-2xl leading-tight font-bold text-ink md:text-4xl lg:text-5xl">
          Planos para todo momento do tratamento
        </h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <SheetCard titulo="Básico" subtitulo="Gratuito">
            <ul className="t-body mt-2 space-y-2 text-ink-muted">
              <li>Registro de peso, sintomas e hidratação</li>
              <li>Gestão completa das aplicações da medicação (lembretes e histórico)</li>
              <li>Montagem manual de plano alimentar e refeições</li>
              <li>Gráficos de evolução simples e alertas de rotina</li>
            </ul>
            <div className="mt-6">
              <Link to="/criar-conta">
                <Button variante="secundaria" larguraTotal>
                  Criar conta grátis
                </Button>
              </Link>
            </div>
          </SheetCard>

          <div
            className="rounded-[var(--r-card)] p-5 lg:p-6"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', border: '2px solid var(--hero-1)' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="t-caption rounded-full px-3 py-1 text-white"
                style={{ background: 'var(--hero-1)' }}
              >
                Recomendado
              </span>
              <span className="t-caption rounded-full px-3 py-1" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
                7 Dias Grátis
              </span>
            </div>

            <h3 className="t-title mt-4 text-ink">Dose Certa AI — PRO</h3>
            <p className="mt-1 text-2xl font-light text-ink">
              R$ 29,90<span className="t-label text-ink-muted">/mês</span>
            </p>
            <p className="t-label text-ink-muted">ou R$ 197,00/ano</p>

            <ul className="t-body mt-4 space-y-2 text-ink-muted">
              <li>Tudo do plano Básico</li>
              <li>📸 Scanner de Refeições: foto do prato → IA calcula calorias e macros na hora</li>
              <li>📄 Importação de Dieta (PDF): a IA lê o PDF do seu nutricionista e configura o app</li>
              <li>🪄 Geração de Dieta: IA monta seu plano nutricional provisório com base no seu peso</li>
              <li>💬 Co-piloto Inteligente: chat com IA que cruza sintomas, aplicações e dieta</li>
            </ul>
            <div className="mt-6">
              <Link to="/criar-conta">
                <Button
                  variante="primaria"
                  larguraTotal
                  style={{ background: '#0d9488', color: '#ffffff' }}
                >
                  Começar teste grátis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BlocoInstalacao({ titulo, passos }: { titulo: string; passos: Passo[] }) {
  return (
    <SheetCard titulo={titulo}>
      <ol className="t-body space-y-2 text-ink-muted">
        {passos.map((passo, i) => (
          <li key={passo.texto} className="flex gap-2">
            <span className="t-label shrink-0 text-ink">{i + 1}.</span>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {passo.texto}
              {passo.icone}
            </span>
          </li>
        ))}
      </ol>
    </SheetCard>
  );
}

function SecaoInstalacao() {
  return (
    <section id="instalacao" className="faixa py-12 md:py-24">
      <h2 className="text-2xl leading-tight font-bold text-ink md:text-4xl lg:text-5xl">Leve, sem loja de aplicativos</h2>
      <p className="t-body mt-4 max-w-2xl text-ink-muted">
        O Dose Certa AI é um app leve que instala direto do navegador — sem baixar nada da App Store ou da Play
        Store. Em poucos toques ele fica na sua tela de início, como qualquer outro app.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <BlocoInstalacao titulo="iOS (Safari)" passos={PASSOS_IOS} />
        <BlocoInstalacao titulo="Android (Chrome)" passos={PASSOS_ANDROID} />
      </div>
    </section>
  );
}

function Rodape() {
  return (
    <footer className="border-t py-10" style={{ borderColor: 'var(--border-hair)' }}>
      <div className="faixa flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <span className="t-title text-ink">
          Dose Certa<span className="text-teal-500">-AI</span>
        </span>
        <p className="t-label text-ink-muted">© {new Date().getFullYear()} Dose Certa AI. Todos os direitos reservados.</p>
        <div className="flex gap-4">
          <Link to="/termos" className="t-label text-ink-muted hover:text-ink">
            Termos
          </Link>
          <Link to="/privacidade" className="t-label text-ink-muted hover:text-ink">
            Privacidade
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const { usuario, carregando } = useAuth();

  if (carregando) return <Carregando />;
  if (usuario) return <Navigate to="/inicio" replace />;

  return (
    <div className="min-h-dvh bg-page">
      <Cabecalho />
      <SecaoHero />
      <SecaoFuncionalidades />
      <SecaoPrecos />
      <SecaoInstalacao />
      <Rodape />
    </div>
  );
}
