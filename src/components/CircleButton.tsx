import type { ButtonHTMLAttributes, ReactNode } from 'react';

type CircleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Obrigatório: o botão só tem ícone, então precisa de nome acessível. */
  rotulo: string;
  children: ReactNode;
};

/**
 * Botão circular translúcido do herói. Mede 44px — os controles da referência
 * são menores, mas alvo de toque abaixo disso não se acerta com o polegar.
 */
export function CircleButton({ rotulo, children, className = '', ...props }: CircleButtonProps) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      className={`grid size-11 place-items-center rounded-full border text-on-hero transition-colors hover:bg-white/25 active:bg-white/30 ${className}`}
      style={{
        background: 'var(--surface-glass)',
        borderColor: 'var(--border-glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      {...props}
    >
      {children}
    </button>
  );
}
