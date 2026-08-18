import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArcGauge } from '@/components/ArcGauge';
import { Button } from '@/components/Button';
import { GraficoEvolucaoPeso } from '@/components/GraficoEvolucaoPeso';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { useDados } from '@/features/dados/DadosProvider';
import { useEvolucao } from '@/features/dados/DadosEvolucaoProvider';

export function Home() {
  const { uid } = useDados();
  const { planos, refeicoesHoje, hidratacaoHoje } = useEvolucao();
  const [modo, setModo] = useState<'consumo' | 'meta'>('consumo');

  if (!uid) return null;

  // As metas dos anéis vêm sempre do Plano Alimentar ativo — não importa se
  // ele nasceu de upload de PDF, criação manual ou IA, todos gravam nos
  // mesmos três campos (proteinGoalG/kcalGoal/waterGoalMl) do PlanoAlimentar.
  const planoAtivo = planos.find((p) => p.isActive) ?? null;

  const proteinaConsumida = refeicoesHoje.reduce((soma, r) => soma + r.macros.protein, 0);
  const caloriasConsumidas = refeicoesHoje.reduce((soma, r) => soma + r.macros.kcal, 0);
  const aguaConsumida = hidratacaoHoje.reduce((soma, r) => soma + r.amount_ml, 0);

  const proteina = { valor: Math.round(proteinaConsumida), meta: planoAtivo?.proteinGoalG ?? 0 };
  const calorias = { valor: Math.round(caloriasConsumidas), meta: planoAtivo?.kcalGoal ?? 0 };
  const agua = { valor: Math.round(aguaConsumida), meta: planoAtivo?.waterGoalMl ?? 0 };

  return (
    <Pagina
      hero={
        <Hero titulo={<span className="font-extrabold">Dose Certa<span className="text-teal-500">-AI</span></span>}>
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Hoje</p>
            <p className="mt-1.5 text-3xl font-light tracking-tight text-on-hero sm:text-4xl lg:text-5xl">
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            </p>
          </div>
        </Hero>
      }
    >
      <SheetCard
        titulo="Resumo Nutricional de Hoje"
        acao={
          planoAtivo ? (
            <Button
              variante="fantasma"
              onClick={() => setModo((m) => (m === 'consumo' ? 'meta' : 'consumo'))}
            >
              {modo === 'consumo' ? 'Ver metas' : 'Ver consumo'}
            </Button>
          ) : null
        }
      >
        {planoAtivo ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <ArcGauge
              compacto
              valor={proteina.valor}
              max={proteina.meta || 1}
              exibicao={`${modo === 'consumo' ? proteina.valor : proteina.meta}g`}
              legenda="Proteínas"
              tom="ok"
            />
            <ArcGauge
              compacto
              valor={calorias.valor}
              max={calorias.meta || 1}
              exibicao={`${modo === 'consumo' ? calorias.valor : calorias.meta} kcal`}
              legenda="Calorias"
              tom="neutro"
            />
            <ArcGauge
              compacto
              valor={agua.valor}
              max={agua.meta || 1}
              exibicao={`${modo === 'consumo' ? agua.valor : agua.meta}ml`}
              legenda="Água"
              tom="ok"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <div className="grid w-full grid-cols-3 gap-2 opacity-30 grayscale sm:gap-3" aria-hidden="true">
              <ArcGauge compacto valor={0} max={1} exibicao="" legenda="Proteínas" tom="neutro" />
              <ArcGauge compacto valor={0} max={1} exibicao="" legenda="Calorias" tom="neutro" />
              <ArcGauge compacto valor={0} max={1} exibicao="" legenda="Água" tom="neutro" />
            </div>
            <p className="t-body max-w-sm text-ink-muted">
              Ative um Plano Alimentar (Manual, Upload ou via IA) para acompanhar suas metas diárias.
            </p>
            <Link to="/evolucao/dieta">
              <Button variante="secundaria">Ir para Plano Alimentar</Button>
            </Link>
          </div>
        )}
      </SheetCard>

      <SheetCard titulo="Curva de Evolução">
        <GraficoEvolucaoPeso />
      </SheetCard>
    </Pagina>
  );
}
