import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { erro: Error | null };

/**
 * Sem um boundary no root, qualquer crash de renderização (cache corrompido,
 * estado inconsistente) derruba a árvore inteira para uma tela branca sem
 * saída — e o único jeito de recuperar vira limpar os dados do navegador.
 *
 * O botão de recuperação limpa o estado local suspeito antes de recarregar,
 * cobrindo inclusive causas que ainda não previmos.
 */
export class ErrorBoundary extends Component<Props, State> {
  // Em setups sem @types/react completos, `props` não é exposto como membro
  // herdado; a declaração corrige o tipo sem mudar nada em runtime.
  declare props: Props;

  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[DoseCerta] erro não tratado:', erro, info.componentStack);
  }

  private recuperar = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage bloqueado (modo privado); recarregar mesmo assim.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center"
        style={{ background: 'linear-gradient(180deg, var(--hero-0) 0%, var(--hero-1) 100%)' }}
      >
        <div>
          <p className="t-caption text-on-hero-muted">Algo saiu do lugar</p>
          <h1 className="t-stat mt-2 text-on-hero">Não foi possível abrir o app</h1>
          <p className="t-body mt-3 max-w-sm text-on-hero-muted">
            Seus registros continuam salvos. Tentar de novo costuma resolver.
          </p>
        </div>
        <button
          type="button"
          onClick={this.recuperar}
          className="t-label min-h-11 rounded-full px-6"
          style={{ background: 'var(--on-hero)', color: 'var(--hero-0)' }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
}
