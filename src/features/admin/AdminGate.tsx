import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

function Carregando() {
  return (
    <div
      className="grid min-h-dvh place-items-center"
      style={{ background: 'linear-gradient(180deg, var(--hero-0) 0%, var(--hero-1) 100%)' }}
      role="status"
      aria-label="Carregando"
    >
      <p className="t-caption text-on-hero-muted">DoseCerta</p>
    </div>
  );
}

/** Protege as rotas de /painel/* — exige a sessão sintética com claim `admin`. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { usuario, carregando, ehAdmin, carregandoClaims } = useAuth();

  if (carregando || carregandoClaims) return <Carregando />;
  if (!usuario || !ehAdmin) return <Navigate to="/painel" replace />;
  return <>{children}</>;
}
