import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { Carregando } from '@/components/Carregando';

export function AuthGate({ children }: { children: ReactNode }) {
  const { usuario, carregando, ehAdmin, carregandoClaims } = useAuth();
  const local = useLocation();

  if (carregando || carregandoClaims) return <Carregando />;
  if (!usuario) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  // Sessão do painel administrativo não tem doc em `users/` — não pode cair aqui.
  if (ehAdmin) return <Navigate to="/painel" replace />;
  return <>{children}</>;
}
