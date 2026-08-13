import { Link } from 'react-router-dom';
import { GraficoEvolucaoPeso } from '@/components/GraficoEvolucaoPeso';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';

const ScaleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
);

const CameraIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
);

const DropletIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
);

const ThermometerIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>
);

const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
);

const LightningIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);

export function TelaEvolucao() {
  return (
    <Pagina
      hero={
        <Hero titulo="Evolução">
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Registros de Saúde</p>
            <h2 className="t-stat mt-1.5 text-on-hero">Dashboard</h2>
          </div>
        </Hero>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Grid de Ações (Topo) */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/evolucao/pesos"
            className="flex flex-col items-center justify-center gap-3 bg-card rounded-xl p-4 shadow-md transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <div className="text-teal-500 bg-teal-500/10 p-3 rounded-full">
              <ScaleIcon className="w-6 h-6" />
            </div>
            <span className="font-semibold text-ink text-sm text-center">Peso e Medidas</span>
          </Link>
          
          <Link
            to="/evolucao/scanner"
            className="flex flex-col items-center justify-center gap-3 bg-card rounded-xl p-4 shadow-md transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <div className="text-amber-500 bg-amber-500/10 p-3 rounded-full">
              <CameraIcon className="w-6 h-6" />
            </div>
            <span className="font-semibold text-ink text-sm text-center">Refeições</span>
          </Link>
          
          <Link
            to="/evolucao/hidratacao"
            className="flex flex-col items-center justify-center gap-3 bg-card rounded-xl p-4 shadow-md transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <div className="text-blue-500 bg-blue-500/10 p-3 rounded-full">
              <DropletIcon className="w-6 h-6" />
            </div>
            <span className="font-semibold text-ink text-sm text-center">Hidratação</span>
          </Link>
          
          <Link
            to="/evolucao/sintomas"
            className="flex flex-col items-center justify-center gap-3 bg-card rounded-xl p-4 shadow-md transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <div className="text-rose-500 bg-rose-500/10 p-3 rounded-full">
              <ThermometerIcon className="w-6 h-6" />
            </div>
            <span className="font-semibold text-ink text-sm text-center">Sintomas</span>
          </Link>
        </div>

        {/* Seção de Gráfico (Meio) */}
        <div className="bg-card rounded-xl shadow-md p-5 flex flex-col gap-4">
          <h3 className="t-title text-ink">Curva de Evolução</h3>
          <GraficoEvolucaoPeso />
        </div>

        {/* Ações Secundárias (Base) */}
        <div className="flex flex-col gap-3">
          <Link
            to="/evolucao/dieta"
            className="flex items-center justify-start gap-4 bg-card rounded-xl p-4 shadow-md transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <div className="text-violet-500 bg-violet-500/10 p-2.5 rounded-lg shrink-0">
              <ClipboardIcon className="w-6 h-6" />
            </div>
            <span className="font-semibold text-ink text-left flex-1">Plano Alimentar</span>
          </Link>
          
          <Link
            to="/evolucao/galeria"
            className="flex items-center justify-start gap-4 bg-card rounded-xl p-4 shadow-md transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <div className="text-emerald-500 bg-emerald-500/10 p-2.5 rounded-lg shrink-0">
              <CameraIcon className="w-6 h-6" />
            </div>
            <span className="font-semibold text-ink text-left flex-1">Galeria de Progresso</span>
          </Link>
          
          <Link
            to="/evolucao/intestino"
            className="flex items-center justify-start gap-4 bg-card rounded-xl p-4 shadow-md transition-all active:scale-95 hover:-translate-y-0.5"
          >
            <div className="text-orange-500 bg-orange-500/10 p-2.5 rounded-lg shrink-0">
              <LightningIcon className="w-6 h-6" />
            </div>
            <span className="font-semibold text-ink text-left flex-1">Intestino e Digestão</span>
          </Link>
        </div>
      </div>
    </Pagina>
  );
}
