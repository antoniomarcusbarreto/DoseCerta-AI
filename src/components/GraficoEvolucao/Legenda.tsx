export type FormaLegenda = "quadrado" | "linha" | "circulo";

export type ItemLegenda = {
  cor: string;
  rotulo: string;
  forma: FormaLegenda;
};

function Marcador({ cor, forma }: { cor: string; forma: FormaLegenda }) {
  if (forma === "linha") {
    return (
      <span
        style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: cor, flexShrink: 0 }}
      />
    );
  }
  if (forma === "circulo") {
    return (
      <span
        style={{
          display: "inline-block",
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: cor,
          border: "1.5px solid var(--surface-card)",
          boxShadow: `0 0 0 1px ${cor}`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: cor, flexShrink: 0 }} />
  );
}

/** Legenda discreta acima do gráfico, explicando o que cada cor/forma
 * representa e (quando relevante) a qual eixo Y pertence. */
export function Legenda({ itens }: { itens: ItemLegenda[] }) {
  return (
    <div className="text-xs" style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 10 }}>
      {itens.map((item) => (
        <div key={item.rotulo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Marcador cor={item.cor} forma={item.forma} />
          <span style={{ color: "var(--ink-muted)" }}>{item.rotulo}</span>
        </div>
      ))}
    </div>
  );
}
