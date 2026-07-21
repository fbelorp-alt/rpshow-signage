export function Classica() {
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=00020126580014br.gov.bcb.pix0136claudio%40rpshow.com.br5204000053039865405150.005802BR5913RPShow%20OnSign6014Ribeirao%20Preto6304ABCD&size=150x150&margin=4";
  return (
    <div style={{ background: "#f0f4f4", minHeight: "100vh", padding: "32px 24px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ background: "#fff", maxWidth: 760, margin: "0 auto", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,.10)" }}>
        {/* Teal header strip */}
        <div style={{ background: "linear-gradient(135deg, #79B4B0 0%, #5a9e9a 100%)", padding: "22px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, background: "rgba(255,255,255,.22)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff" }}>R</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 17, color: "#fff", letterSpacing: .3 }}>RPShow OnSign</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.75)", marginTop: 2 }}>CNPJ 43.738.727/0001-83 · Ribeirão Preto – SP</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Fatura</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>#2026-0042</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.75)", marginTop: 3 }}>Emitida em 21/07/2026</div>
            <div style={{ display: "inline-block", marginTop: 6, background: "rgba(255,255,255,.2)", border: "1.5px solid rgba(255,255,255,.5)", color: "#fff", borderRadius: 20, fontSize: 9, fontWeight: 800, padding: "3px 14px", letterSpacing: .3 }}>PENDENTE</div>
          </div>
        </div>

        <div style={{ padding: "24px 32px" }}>
          {/* Subscriber + Due date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 14, marginBottom: 18 }}>
            <div style={{ border: "1.5px solid #e8ecec", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#79B4B0", textTransform: "uppercase", letterSpacing: .8, marginBottom: 12 }}>Assinante</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Nome", "Fabiano Belo"], ["E-mail", "belo@exemplo.com"], ["Mês de Ref.", "Julho / 2026"], ["Nº da Fatura", "#2026-0042"], ["Emissão", "21/07/2026"], ["Vencimento", "31/07/2026"]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 8, color: "#bbb", textTransform: "uppercase", letterSpacing: .6, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ border: "1.5px solid #e8ecec", borderRadius: 10, padding: 16, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <div style={{ fontSize: 9, color: "#aaa" }}>Vencimento</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#1a1a2e" }}>31/07/2026</div>
              <div style={{ width: 40, height: 1.5, background: "#e8ecec" }} />
              <div style={{ fontSize: 9, color: "#aaa" }}>Total</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#79B4B0" }}>R$ 150,00</div>
            </div>
          </div>

          {/* Items + PIX side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14, marginBottom: 18 }}>
            <div style={{ border: "1.5px solid #e8ecec", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#79B4B0", textTransform: "uppercase", letterSpacing: .8, marginBottom: 12 }}>Descrição</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 8, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: .6, paddingBottom: 8, borderBottom: "1.5px solid #eee" }}>Item</th>
                    <th style={{ textAlign: "right", fontSize: 8, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: .6, paddingBottom: 8, borderBottom: "1.5px solid #eee" }}>R$</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={2} style={{ fontSize: 8.5, fontWeight: 800, color: "#79B4B0", textTransform: "uppercase", paddingTop: 12, paddingBottom: 4 }}>Serviços Mensais</td></tr>
                  <tr>
                    <td style={{ paddingBottom: 8, color: "#1a1a2e", verticalAlign: "top", borderBottom: "1px solid #f4f4f4" }}>
                      Sinalização Digital
                      <span style={{ display: "block", fontSize: 10, color: "#aaa", marginTop: 1 }}>Tela: Loja Centro · Belo LTDA</span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, borderBottom: "1px solid #f4f4f4" }}>150,00</td>
                  </tr>
                  <tr><td colSpan={2} style={{ fontSize: 8.5, fontWeight: 800, color: "#79B4B0", textTransform: "uppercase", paddingTop: 12, paddingBottom: 4 }}>Eventuais</td></tr>
                  <tr>
                    <td style={{ paddingBottom: 8, color: "#1a1a2e", borderBottom: "1px solid #f4f4f4" }}>Taxas de instalação</td>
                    <td style={{ textAlign: "right", fontWeight: 700, borderBottom: "1px solid #f4f4f4" }}>0,00</td>
                  </tr>
                  <tr>
                    <td style={{ paddingTop: 12, fontWeight: 800, fontSize: 13, borderTop: "1.5px solid #ddd" }}>TOTAL</td>
                    <td style={{ paddingTop: 12, textAlign: "right", fontWeight: 900, fontSize: 13, color: "#79B4B0", borderTop: "1.5px solid #ddd" }}>R$ 150,00</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ fontSize: 10, color: "#aaa", fontStyle: "italic", paddingTop: 4, textAlign: "right" }}>Cento e cinquenta reais</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* PIX box */}
            <div style={{ border: "1.5px solid #e8ecec", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#1a1a2e", textTransform: "uppercase", letterSpacing: .5 }}>Pague com PIX</div>
              <div style={{ border: "1.5px solid #eee", borderRadius: 8, padding: 4, background: "#fafafa" }}>
                <img src={qrUrl} width={130} height={130} alt="QR PIX" style={{ display: "block", borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1a1a2e" }}>R$ 150,00</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#1a1a2e" }}>claudio@rpshow.com.br</div>
              <div style={{ fontSize: 9, color: "#aaa" }}>Banco Cora · C/C 4660759-7</div>
              <div style={{ width: "100%", marginTop: 4 }}>
                <div style={{ fontSize: 8, color: "#aaa", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>PIX Copia e Cola</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ flex: 1, fontSize: 7.5, fontFamily: "monospace", border: "1px solid #ddd", borderRadius: 6, padding: "5px 7px", background: "#f9f9f9", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>00020126580014br.gov...</div>
                  <button style={{ flexShrink: 0, fontSize: 8.5, fontWeight: 700, border: "1.5px solid #79B4B0", color: "#79B4B0", background: "#fff", padding: "4px 9px", borderRadius: 6, cursor: "pointer" }}>Copiar</button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #eee", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#79B4B0" }}>RPShow OnSign</div>
            <div style={{ fontSize: 9, color: "#bbb", textAlign: "right", lineHeight: 1.7 }}>Comprovante de prestação de serviços de sinalização digital.<br />rpshow.com.br · (16) 98220-8695</div>
          </div>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1.5px solid #79B4B0", color: "#79B4B0", background: "#fff", padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              🖨 Imprimir / Baixar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
