import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CreditCard, LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';

const ITENS_MENU = [
  { to: '/painel/dashboard', rotulo: 'Dashboard', Icone: LayoutDashboard },
  { to: '/painel/usuarios', rotulo: 'Usuários', Icone: Users },
  { to: '/painel/assinaturas', rotulo: 'Assinaturas', Icone: CreditCard },
];

function ConteudoMenu({ onNavegar }: { onNavegar?: () => void }) {
  const { sair } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <p className="text-lg font-extrabold text-white">
          Dose Certa<span className="text-teal-400">-AI</span>
        </p>
        <p className="t-caption mt-0.5 text-slate-400">Painel administrativo</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {ITENS_MENU.map(({ to, rotulo, Icone }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavegar}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 t-label transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icone className="size-5 shrink-0" />
            {rotulo}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-6">
        <button
          type="button"
          onClick={() => void sair()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 t-label text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-5 shrink-0" />
          Sair
        </button>
      </div>
    </div>
  );
}

export function PainelLayout() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="min-h-dvh" style={{ background: 'var(--surface-page)' }}>
      <div className="flex min-h-dvh">
        <aside
          className="hidden w-64 shrink-0 lg:block"
          style={{ background: '#1b232c', borderRight: '1px solid rgba(255,255,255,0.08)' }}
        >
          <ConteudoMenu />
        </aside>

        {menuAberto ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Fechar menu"
              className="absolute inset-0 bg-black/50"
              onClick={() => setMenuAberto(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64" style={{ background: '#1b232c' }}>
              <div className="flex justify-end p-3">
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setMenuAberto(false)}
                  className="rounded-full p-2 text-slate-400 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
              <ConteudoMenu onNavegar={() => setMenuAberto(false)} />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header
            className="flex items-center gap-3 px-4 py-3 lg:hidden"
            style={{ background: '#1b232c', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMenuAberto(true)}
              className="rounded-full p-2 text-slate-300 hover:text-white"
            >
              <Menu className="size-5" />
            </button>
            <p className="t-label text-white">Painel administrativo</p>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
