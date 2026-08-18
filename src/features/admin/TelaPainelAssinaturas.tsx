import { useEffect, useState } from 'react';
import { SheetCard } from '@/components/SheetCard';
import { StatBig } from '@/components/StatBig';
import { adminMetricas } from './api';

const COLUNAS = ['Usuário', 'Plano', 'Status', 'Início', 'Próxima cobrança'];

export function TelaPainelAssinaturas() {
  const [totalAssinantes, setTotalAssinantes] = useState<number | null>(null);

  useEffect(() => {
    adminMetricas()
      .then((dados) => setTotalAssinantes(dados.totalAssinantes))
      .catch(() => setTotalAssinantes(0));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="t-title text-ink">Assinaturas</h1>

      <SheetCard>
        <StatBig
          sobre="card"
          escala="stat"
          rotulo="Total de assinantes"
          valor={totalAssinantes ?? '—'}
        />
      </SheetCard>

      <SheetCard titulo="Histórico de assinaturas" subtitulo="Layout pronto para quando um gateway de pagamento for integrado">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="t-caption text-ink-muted">
                {COLUNAS.map((coluna) => (
                  <th key={coluna} className="border-b px-3 py-2 font-medium" style={{ borderColor: 'var(--border-hair)' }}>
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLUNAS.length} className="px-3 py-8 text-center t-body text-ink-muted">
                  Nenhuma assinatura registrada ainda.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SheetCard>
    </div>
  );
}
