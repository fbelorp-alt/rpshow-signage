export function DarkPremium() {
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=00020126580014br.gov.bcb.pix0136claudio%40rpshow.com.br5204000053039865405150.005802BR5913RPShow%20OnSign6014Ribeirao%20Preto6304ABCD&size=150x150&margin=4";
  return (
    <div style={{ background: "#111827", minHeight: "100vh", padding: "32px 24px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        {/* Dark header */}
        <div style={{ background: "#1f2937", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #374151" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, background: "linear-gradient(135deg, #79B4B0, #5a9e9a)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff" }}>R</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#f9fafb", letterSpacing: .3 }}>RPShow OnSign</div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>CNPJ 43.738.727/0001-83 · Ribeirão Preto – SP</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>Fatura</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#79B4B0" }}>#2026-0042</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3 }}>Emitida em 21/07/2026</div>
            <div style={{ display: "inline-block", marginTop: 6, background: "rgba(245,158,11,.1)", border: "1.5px solid rgba(245,158,11,.4)", color: "#f59e0b", borderRadius: 20, fontSize: 9, fontWeight: 800, padding: "3px 14px" }}>PENDENTE</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ background: "#18202e", padding: "28px 32px" }}>
          {/* Summary bar */}
          <div style={{ background: "#1f2937", borderRadius: 12, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, border: "1px solid #374151" }}>
            {[["Assinante", "Fabiano Belo"], ["Mês de Referência", "Julho / 2026"], ["Vencimento", "31/07/2026"], ["Total", "R$ 150,00"]].map(([l, v], i) => (
              <div key={l} style={{ textAlign: i === 3 ? "right" : "left" }}>
                <div style={{ fontSize: 8.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: .7, marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: i === 3 ? 20 : 13, fontWeight: i === 3 ? 900 : 700, color: i === 3 ? "#79B4B0" : "#f9fafb" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 16, marginBottom: 20 }}>
            {/* Items table */}
            <div style={{ background: "#1f2937", borderRadius: 12, padding: "18px 22px", border: "1px solid #374151" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#79B4B0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Descrição da Fatura</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 8, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: .6, paddingBottom: 10, borderBottom: "1px solid #374151" }}>Item</th>
                    <th style={{ textAlign: "right", fontSize: 8, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: .6, paddingBottom: 10, borderBottom: "1px solid #374151" }}>R$</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={2} style={{ fontSize: 8.5, fontWeight: 800, color: "#4b7b78", textTransform: "uppercase", paddingTop: 12, paddingBottom: 4 }}>Serviços Mensais</td></tr>
                  <tr>
                    <td style={{ paddingBottom: 10, color: "#e5e7eb", verticalAlign: "top", borderBottom: "1px solid #374151" }}>
                      Sinalização Digital
                      <span style={{ display: "block", fontSize: 10, color: "#6b7280", marginTop: 2 }}>Tela: Loja Centro · Belo LTDA</span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#e5e7eb", borderBottom: "1px solid #374151" }}>150,00</td>
                  </tr>
                  <tr><td colSpan={2} style={{ fontSize: 8.5, fontWeight: 800, color: "#4b7b78", textTransform: "uppercase", paddingTop: 12, paddingBottom: 4 }}>Eventuais</td></tr>
                  <tr>
                    <td style={{ paddingBottom: 10, color: "#e5e7eb", borderBottom: "1px solid #374151" }}>Taxas de instalação</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#e5e7eb", borderBottom: "1px solid #374151" }}>0,00</td>
                  </tr>
                  <tr>
                    <td style={{ paddingTop: 14, fontWeight: 800, fontSize: 13, color: "#f9fafb" }}>TOTAL DA FATURA</td>
                    <td style={{ paddingTop: 14, textAlign: "right", fontWeight: 900, fontSize: 15, color: "#79B4B0" }}>R$ 150,00</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ fontSize: 10, color: "#6b7280", fontStyle: "italic", paddingTop: 4, textAlign: "right" }}>Cento e cinquenta reais</td>
                  </tr>
                </tbody>
              </table>

              {/* Subscriber detail */}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #374151", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Nome", "Fabiano Belo"], ["E-mail", "belo@exemplo.com"], ["Nº da Fatura", "#2026-0042"], ["Emissão", "21/07/2026"]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: .6, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e5e7eb" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* PIX */}
            <div style={{ background: "#1f2937", borderRadius: 12, padding: 16, border: "1px solid #374151", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#79B4B0", textTransform: "uppercase", letterSpacing: 1 }}>Pague com PIX</div>
              <div style={{ border: "1px solid #374151", borderRadius: 10, padding: 5, background: "#111827" }}>
                <img src={qrUrl} width={130} height={130} alt="QR PIX" style={{ display: "block", borderRadius: 6, filter: "invert(1)" }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#79B4B0" }}>R$ 150,00</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#e5e7eb" }}>claudio@rpshow.com.br</div>
              <div style={{ fontSize: 9, color: "#6b7280" }}>Banco Cora · C/C 4660759-7</div>
              <div style={{ width: "100%", marginTop: 4 }}>
                <div style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>PIX Copia e Cola</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ flex: 1, fontSize: 7.5, fontFamily: "monospace", border: "1px solid #374151", borderRadius: 6, padding: "5px 7px", background: "#111827", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>00020126580014br.gov...</div>
                  <button style={{ flexShrink: 0, fontSize: 8.5, fontWeight: 700, border: "1.5px solid #79B4B0", color: "#79B4B0", background: "transparent", padding: "4px 9px", borderRadius: 6, cursor: "pointer" }}>Copiar</button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #374151", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#79B4B0" }}>RPShow OnSign</div>
            <div style={{ fontSize: 9, color: "#6b7280", textAlign: "right", lineHeight: 1.7 }}>Comprovante de prestação de serviços de sinalização digital.<br />rpshow.com.br · (16) 98220-8695</div>
          </div>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1.5px solid #79B4B0", color: "#79B4B0", background: "transparent", padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              🖨 Imprimir / Baixar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
