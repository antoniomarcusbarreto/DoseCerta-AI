export type OpcaoAba<T extends string> = { valor: T; rotulo: string };

export function SeletorAba<T extends string>({
  opcoes,
  abaAtiva,
  aoMudar,
}: {
  opcoes: readonly OpcaoAba<T>[];
  abaAtiva: T;
  aoMudar: (valor: T) => void;
}) {
  return (
    <div
      className="overflow-x-auto touch-pan-x no-scrollbar"
      style={{ display: "flex", gap: 6 }}
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === abaAtiva;
        return (
          <button
            key={opcao.valor}
            type="button"
            onClick={() => aoMudar(opcao.valor)}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: ativo ? "1px solid transparent" : "1px solid var(--border-hair)",
              background: ativo ? "var(--ink)" : "transparent",
              color: ativo ? "var(--surface-card)" : "var(--ink-muted)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
