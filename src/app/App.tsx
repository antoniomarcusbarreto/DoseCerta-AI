import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { TelaAuth } from '@/features/auth/TelaAuth';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { DadosProvider } from '@/features/dados/DadosProvider';
import { DadosEvolucaoProvider } from '@/features/dados/DadosEvolucaoProvider';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { TelaHistorico } from '@/features/aplicacao/TelaHistorico';
import { TelaMedicamentos } from '@/features/medicamento/TelaMedicamentos';
import { TelaLembretes } from '@/features/notificacoes/TelaLembretes';
import { TelaMeusDados } from '@/features/conta/TelaMeusDados';
import { TelaTratamento } from '@/features/protocolo/TelaTratamento';
import { TelaTermos } from '@/features/legal/TelaTermos';
import { TelaPrivacidade } from '@/features/legal/TelaPrivacidade';
import { AuthGate } from './AuthGate';
import { Home } from './Home';
import { KitchenSink } from './KitchenSink';
import { LandingPage } from './LandingPage';
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
import { TelaSuporte } from '@/features/suporte/TelaSuporte';
import { TelaCopiloto } from '@/features/copiloto/TelaCopiloto';
import { AdminGate } from '@/features/admin/AdminGate';
import { PainelLayout } from '@/features/admin/PainelLayout';
import { TelaPainelLogin } from '@/features/admin/TelaPainelLogin';
import { TelaPainelDashboard } from '@/features/admin/TelaPainelDashboard';
import { TelaPainelUsuarios } from '@/features/admin/TelaPainelUsuarios';
import { TelaPainelAssinaturas } from '@/features/admin/TelaPainelAssinaturas';

/** Casca de tema/confirmação da área de pacientes — nunca monta em /painel. */
function AreaPaciente() {
  return (
    <ThemeProvider>
      <ConfirmProvider>
        <Outlet />
      </ConfirmProvider>
    </ThemeProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Painel administrativo oculto — sem <Link> em lugar nenhum do app,
            só alcançável digitando a URL. Sessão própria (OTP + Custom
            Token), isolada da autenticação de pacientes. Deliberadamente
            FORA do ThemeProvider/ConfirmProvider: é um ambiente interno com
            cores fixas, que não deve herdar a preferência de tema de
            paciente nenhum. */}
        <Route path="/painel" element={<TelaPainelLogin />} />
        <Route
          element={
            <AdminGate>
              <PainelLayout />
            </AdminGate>
          }
        >
          <Route path="/painel/dashboard" element={<TelaPainelDashboard />} />
          <Route path="/painel/usuarios" element={<TelaPainelUsuarios />} />
          <Route path="/painel/assinaturas" element={<TelaPainelAssinaturas />} />
        </Route>

        <Route element={<AreaPaciente />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/entrar" element={<TelaAuth modo="entrar" />} />
          <Route path="/criar-conta" element={<TelaAuth modo="criar" />} />
          <Route path="/termos" element={<TelaTermos />} />
          <Route path="/privacidade" element={<TelaPrivacidade />} />

          {/* Vitrine do design system: aberta, sem depender de sessão. */}
          <Route path="/kitchen-sink" element={<KitchenSink />} />

          {/* Tela cheia própria, fora da Casca/NavLateral/BarraAbas: um input
              fixo no rodapé mais teclado virtual brigaria com a barra de
              abas fixa se ficasse dentro do Layout padrão. Só precisa de
              AuthGate — não consome dados de DadosProvider. */}
          <Route
            path="/copiloto"
            element={
              <AuthGate>
                <TelaCopiloto />
              </AuthGate>
            }
          />

          {/* Área autenticada. O DadosProvider fica acima do Layout para que
              todas as abas leiam da mesma assinatura do Firestore. */}
          <Route
            element={
              <AuthGate>
                <DadosProvider>
                  <DadosEvolucaoProvider>
                    <Layout />
                  </DadosEvolucaoProvider>
                </DadosProvider>
              </AuthGate>
            }
          >
            <Route path="/inicio" element={<Home />} />
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
            <Route path="/ajustes/suporte" element={<TelaSuporte />} />
            <Route path="/ajustes/lembretes" element={<TelaLembretes />} />
            <Route path="/ajustes/meus-dados" element={<TelaMeusDados />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
