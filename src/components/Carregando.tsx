/** Splash em gradiente enquanto o Firebase decide se há sessão. */
export function Carregando() {
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
