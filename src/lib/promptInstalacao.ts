type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let eventoCapturado: EventoInstalacao | null = null;
const ouvintes = new Set<() => void>();

/**
 * Precisa ser importado (com efeito colateral) antes que o Chrome dispare o
 * evento — se o listener chegar depois, o navegador já descartou o prompt.
 */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  eventoCapturado = e as EventoInstalacao;
  ouvintes.forEach((cb) => cb());
});

export function obterPromptInstalacao(): EventoInstalacao | null {
  return eventoCapturado;
}

/** Avisa quando o evento chega depois que o componente já montou. */
export function aoCapturarPrompt(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

export function limparPromptInstalacao(): void {
  eventoCapturado = null;
}
