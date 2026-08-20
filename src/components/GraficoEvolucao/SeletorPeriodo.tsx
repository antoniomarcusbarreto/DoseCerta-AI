import { OPCOES_PERIODO, type PeriodoDias } from "./compartilhado";

export function SeletorPeriodo({
  periodo,
  aoMudar,
}: {
  periodo: PeriodoDias;
  aoMudar: (periodo: PeriodoDias) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "var(--border-hair)",
      }}
    >
      {OPCOES_PERIODO.map((opcao) => {
        const ativo = opcao.dias === periodo;
        return (
          <button
            key={opcao.dias}
            type="button"
            onClick={() => aoMudar(opcao.dias)}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              background: ativo ? "var(--surface-card)" : "transparent",
              color: ativo ? "var(--ink)" : "var(--ink-muted)",
              boxShadow: ativo ? "var(--shadow-card)" : "none",
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
