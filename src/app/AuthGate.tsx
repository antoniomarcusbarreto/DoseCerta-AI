import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

/** Splash em gradiente enquanto o Firebase decide se há sessão. */
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

export function AuthGate({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();
  const local = useLocation();

  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  return <>{children}</>;
}
