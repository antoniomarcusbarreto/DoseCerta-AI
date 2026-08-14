import { Outlet } from 'react-router-dom';
import { InstalacaoWizard } from '@/components/InstalacaoWizard';
import { Onboarding } from '@/features/protocolo/Onboarding';
import { useDados } from '@/features/dados/DadosProvider';
import { Casca } from './Casca';
import { RolarAoTopo } from './RolarAoTopo';

/** Splash em gradiente enquanto os dados da conta chegam. */
function Carregando() {
  return (
    <div
      className="grid min-h-dvh place-items-center"
      style={{ background: 'var(--grad-splash)' }}
      role="status"
    >
      <p className="t-caption text-on-hero-muted">Carregando seus dados…</p>
    </div>
  );
}

/**
 * Casca das telas autenticadas.
 *
 * Sem protocolo cadastrado não há o que navegar, então o onboarding toma a
 * tela inteira — abas vazias na primeira abertura só confundiriam.
 *
 * O splash sai ANTES da casca de propósito: ele ocupa a viewport inteira e
 * não deve reservar espaço para navegação que ainda não está na tela.
 */
export function Layout() {
  const { uid, protocolo, carregando } = useDados();

  if (!uid) return null;
  if (carregando) return <Carregando />;
  if (!protocolo) return <Onboarding uid={uid} />;

  return (
    <>
      <Casca>
        <RolarAoTopo />
        <Outlet />
      </Casca>
      <InstalacaoWizard />
    </>
  );
}
