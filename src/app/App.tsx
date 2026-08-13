import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { TelaAuth } from '@/features/auth/TelaAuth';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { DadosProvider } from '@/features/dados/DadosProvider';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { TelaHistorico } from '@/features/aplicacao/TelaHistorico';
import { TelaMedicamentos } from '@/features/medicamento/TelaMedicamentos';
import { TelaTratamento } from '@/features/protocolo/TelaTratamento';
import { AuthGate } from './AuthGate';
import { Home } from './Home';
import { KitchenSink } from './KitchenSink';
import { Layout } from './Layout';
import { TelaAjustes } from './TelaAjustes';
import { TelaEvolucao } from './TelaEvolucao';
import { TelaDieta } from '@/features/evolucao/TelaDieta';
import { TelaGaleria } from '@/features/evolucao/TelaGaleria';
import { TelaHidratacao } from '@/features/evolucao/TelaHidratacao';
import { TelaHistoricoRefeicoes } from '@/features/evolucao/TelaHistoricoRefeicoes';
import { TelaIntestino } from '@/features/evolucao/TelaIntestino';
import { TelaPesosMedidas } from '@/features/evolucao/TelaPesosMedidas';
import { TelaScanner } from '@/features/evolucao/TelaScanner';
import { TelaSintomas } from '@/features/evolucao/TelaSintomas';

export function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ConfirmProvider>
          <Routes>
            <Route path="/entrar" element={<TelaAuth modo="entrar" />} />
            <Route path="/criar-conta" element={<TelaAuth modo="criar" />} />

            {/* Vitrine do design system: aberta, sem depender de sessão. */}
            <Route path="/kitchen-sink" element={<KitchenSink />} />

            {/* Área autenticada. O DadosProvider fica acima do Layout para que
                todas as abas leiam da mesma assinatura do Firestore. */}
            <Route
              element={
                <AuthGate>
                  <DadosProvider>
                    <Layout />
                  </DadosProvider>
                </AuthGate>
              }
            >
              <Route path="/" element={<Home />} />
              <Route path="/historico" element={<TelaHistorico />} />
              <Route path="/evolucao" element={<TelaEvolucao />} />
              <Route path="/evolucao/pesos" element={<TelaPesosMedidas />} />
              <Route path="/evolucao/hidratacao" element={<TelaHidratacao />} />
              <Route path="/evolucao/sintomas" element={<TelaSintomas />} />
              <Route path="/evolucao/intestino" element={<TelaIntestino />} />
              <Route path="/evolucao/dieta" element={<TelaDieta />} />
              <Route path="/evolucao/scanner" element={<TelaScanner />} />
              <Route path="/evolucao/historico-refeicoes" element={<TelaHistoricoRefeicoes />} />
              <Route path="/evolucao/galeria" element={<TelaGaleria />} />
              <Route path="/ajustes" element={<TelaAjustes />} />
              <Route path="/ajustes/tratamento" element={<TelaTratamento />} />
              <Route path="/ajustes/medicamentos" element={<TelaMedicamentos />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConfirmProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
