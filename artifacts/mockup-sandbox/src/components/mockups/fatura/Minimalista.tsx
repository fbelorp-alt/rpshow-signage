export function Minimalista() {
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=00020126580014br.gov.bcb.pix0136claudio%40rpshow.com.br5204000053039865405150.005802BR5913RPShow%20OnSign6014Ribeirao%20Preto6304ABCD&size=150x150&margin=4";
  return (
    <div style={{ background: "#fafafa", minHeight: "100vh", padding: "48px 32px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 4, boxShadow: "0 1px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
        {/* Thin accent line */}
        <div style={{ height: 3, background: "#79B4B0" }} />

        <div style={{ padding: "36px 40px" }}>
          {/* Header: brand left, invoice right */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111", letterSpacing: -.3 }}>RPShow OnSign</div>
              <div style={{ fontSize: 10, color: "#999", marginTop: 5, lineHeight: 1.8 }}>
                CNPJ 43.738.727/0001-83<br />
                Ribeirão Preto – SP<br />
                rpshow.com.br · (16) 98220-8695
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#bbb", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Fatura</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#111", letterSpacing: -1 }}>#2026-0042</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#999" }}>21/07/2026</span>
                <span style={{ display: "inline-block", border: "1px solid #f59e0b", color: "#f59e0b", borderRadius: 4, fontSize: 8.5, fontWeight: 700, padding: "2px 10px", letterSpacing: .3 }}>PENDENTE</span>
              </div>
            </div>
          </div>

          {/* Horizontal divider */}
          <div style={{ borderTop: "1px solid #f0f0f0", marginBottom: 28 }} />

          {/* Bill to + amount highlight */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 8.5, color: "#bbb", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Cobrado de</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>Fabiano Belo</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>belo@exemplo.com</div>
              <div style={{ marginTop: 12, display: "flex", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 8, color: "#bbb", textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>Mês de ref.</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>Julho / 2026</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: "#bbb", textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>Vencimento</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>31/07/2026</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: "#bbb", textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>Tela</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>Loja Centro</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", paddingLeft: 32, borderLeft: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 8.5, color: "#bbb", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Total a pagar</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#79B4B0", letterSpacing: -1 }}>R$ 150</div>
              <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>,00</div>
              <div style={{ fontSize: 9, color: "#bbb", marginTop: 6, fontStyle: "italic" }}>Cento e cinquenta reais</div>
            </div>
          </div>

          {/* Items table — minimal */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 28 }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid #111" }}>
                <th style={{ textAlign: "left", fontSize: 8.5, fontWeight: 800, color: "#111", textTransform: "uppercase", letterSpacing: .8, paddingBottom: 10 }}>Descrição</th>
                <th style={{ textAlign: "right", fontSize: 8.5, fontWeight: 800, color: "#111", textTransform: "uppercase", letterSpacing: .8, paddingBottom: 10 }}>Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ paddingTop: 14, paddingBottom: 12, color: "#333", verticalAlign: "top", borderBottom: "1px solid #f0f0f0" }}>
                  Sinalização Digital — Plano Mensal
                  <span style={{ display: "block", fontSize: 10, color: "#aaa", marginTop: 3 }}>Tela: Loja Centro · Belo LTDA · Julho/2026</span>
                </td>
                <td style={{ paddingTop: 14, paddingBottom: 12, textAlign: "right", fontWeight: 700, color: "#333", borderBottom: "1px solid #f0f0f0" }}>150,00</td>
              </tr>
              <tr>
                <td style={{ paddingTop: 12, paddingBottom: 12, color: "#999", borderBottom: "1px solid #f0f0f0" }}>Taxas de instalação</td>
                <td style={{ paddingTop: 12, paddingBottom: 12, textAlign: "right", fontWeight: 700, color: "#999", borderBottom: "1px solid #f0f0f0" }}>0,00</td>
              </tr>
              <tr>
                <td style={{ paddingTop: 16, fontWeight: 800, fontSize: 13, color: "#111", borderTop: "2px solid #111" }}>Total</td>
                <td style={{ paddingTop: 16, textAlign: "right", fontWeight: 900, fontSize: 16, color: "#79B4B0", borderTop: "2px solid #111" }}>R$ 150,00</td>
              </tr>
            </tbody>
          </table>

          {/* PIX section — horizontal, full width */}
          <div style={{ background: "#f8fbfb", border: "1px solid #e5efee", borderRadius: 8, padding: "18px 22px", display: "flex", gap: 24, alignItems: "center", marginBottom: 28 }}>
            <div style={{ border: "1px solid #dde8e7", borderRadius: 8, padding: 4, background: "#fff", flexShrink: 0 }}>
              <img src={qrUrl} width={90} height={90} alt="QR PIX" style={{ display: "block", borderRadius: 4 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#79B4B0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Pagamento via PIX</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 2 }}>claudio@rpshow.com.br</div>
              <div style={{ fontSize: 10, color: "#999", marginBottom: 10 }}>Banco Cora · Ag. 0001 · C/C 4660759-7</div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ flex: 1, fontSize: 8, fontFamily: "monospace", border: "1px solid #dde8e7", borderRadius: 5, padding: "5px 8px", background: "#fff", color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>00020126580014br.gov.bcb.pix...</div>
                <button style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, border: "1.5px solid #79B4B0", color: "#79B4B0", background: "#fff", padding: "4px 12px", borderRadius: 5, cursor: "pointer" }}>Copiar</button>
              </div>
            </div>
            <div style={{ textAlign: "right", paddingLeft: 16, borderLeft: "1px solid #e5efee" }}>
              <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>Total PIX</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#79B4B0" }}>R$ 150,00</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#79B4B0" }}>RPShow OnSign</div>
            <div style={{ textAlign: "center" }}>
              <button style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #ddd", color: "#555", background: "#fff", padding: "8px 22px", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                🖨 Imprimir / PDF
              </button>
            </div>
            <div style={{ fontSize: 9, color: "#bbb", textAlign: "right", lineHeight: 1.7 }}>
              rpshow.com.br<br />(16) 98220-8695
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
