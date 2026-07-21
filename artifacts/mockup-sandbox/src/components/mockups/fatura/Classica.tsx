export function Classica() {
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=00020126580014br.gov.bcb.pix0136claudio%40rpshow.com.br5204000053039865405150.005802BR5913RPShow%20OnSign6014Ribeirao%20Preto6304ABCD&size=160x160&margin=4";

  const S = {
    page: { background: "#eef2f2", minHeight: "100vh", padding: "32px 20px", fontFamily: "'Segoe UI', Arial, sans-serif" } as React.CSSProperties,
    card: { background: "#fff", maxWidth: 780, margin: "0 auto", borderRadius: 14, overflow: "hidden", boxShadow: "0 6px 32px rgba(0,0,0,.10)", border: "2px solid #c8dcda" } as React.CSSProperties,
    // Header teal
    header: { background: "linear-gradient(135deg,#79B4B0 0%,#5a9e9a 100%)", padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
    logoBox: { width: 50, height: 50, background: "rgba(255,255,255,.18)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,.35)", fontWeight: 900, fontSize: 24, color: "#fff" } as React.CSSProperties,
    brandName: { fontWeight: 900, fontSize: 18, color: "#fff", letterSpacing: 0.2 } as React.CSSProperties,
    brandSub: { fontSize: 10, color: "rgba(255,255,255,.75)", marginTop: 3, lineHeight: 1.7 } as React.CSSProperties,
    docNum: { fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 2 } as React.CSSProperties,
    docLabel: { fontSize: 8.5, color: "rgba(255,255,255,.7)", textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 4 } as React.CSSProperties,
    badge: (c: string) => ({ display: "inline-block", marginTop: 6, background: "rgba(255,255,255,.15)", border: `2px solid ${c}`, color: c, borderRadius: 20, fontSize: 9, fontWeight: 800, padding: "3px 14px", letterSpacing: 0.3 }),
    // Body
    body: { padding: "24px 32px" } as React.CSSProperties,
    // Section box
    box: { border: "2px solid #c8dcda", borderRadius: 10, padding: "16px 20px", marginBottom: 16 } as React.CSSProperties,
    boxTitle: { fontSize: 9, fontWeight: 800, color: "#79B4B0", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e5efee" } as React.CSSProperties,
    label: { fontSize: 8, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: 0.7, display: "block", marginBottom: 2 } as React.CSSProperties,
    value: { fontSize: 12, fontWeight: 700, color: "#1a1a2e" } as React.CSSProperties,
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" } as React.CSSProperties,
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 20px" } as React.CSSProperties,
  };

  const Field = ({ label, value, span }: { label: string; value: string; span?: boolean }) => (
    <div style={span ? { gridColumn: "span 2" } : {}}>
      <span style={S.label}>{label}</span>
      <span style={S.value}>{value}</span>
    </div>
  );

  const ExtratoBadge = ({ color, text }: { color: string; text: string }) => (
    <span style={{ background: color + "18", border: `1.5px solid ${color}40`, color, borderRadius: 20, fontSize: 8.5, fontWeight: 800, padding: "2px 10px" }}>{text}</span>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* ── HEADER ── */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={S.logoBox}>R</div>
            <div>
              <div style={S.brandName}>RPShow OnSign</div>
              <div style={S.brandSub}>
                CNPJ 43.738.727/0001-83 · Ribeirão Preto – SP<br />
                rpshow.com.br · (16) 98220-8695
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.docLabel}>Fatura de Serviços</div>
            <div style={S.docNum}>#2026-0042</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.75)" }}>Emitida em 21/07/2026</div>
            <span style={S.badge("rgba(255,255,255,.9)")}>PENDENTE</span>
          </div>
        </div>

        <div style={S.body}>
          {/* ── FAIXA RESUMO ── */}
          <div style={{ background: "#f4f9f9", border: "2px solid #c8dcda", borderRadius: 10, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            {[
              ["Assinante", "Fabiano Belo"],
              ["Mês de Referência", "Julho / 2026"],
              ["Vencimento", "31/07/2026"],
            ].map(([l, v]) => (
              <div key={l}>
                <span style={{ ...S.label, display: "block" }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e" }}>{v}</span>
              </div>
            ))}
            <div style={{ textAlign: "right" }}>
              <span style={{ ...S.label, display: "block" }}>Total da Fatura</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#79B4B0" }}>R$ 150,00</span>
            </div>
          </div>

          {/* ── CADASTRO DO ASSINANTE ── */}
          <div style={S.box}>
            <div style={S.boxTitle}>🧾 Cadastro do Assinante</div>
            <div style={S.grid3}>
              <Field label="Nome completo" value="Fabiano Belo" />
              <Field label="E-mail" value="belo@exemplo.com" />
              <Field label="CNPJ" value="12.345.678/0001-90" />
              <Field label="Razão Social" value="Belo Comunicação Visual LTDA" />
              <Field label="Segmento" value="Comunicação Visual" />
              <Field label="Plano" value="OnSign Standard" />
              <Field label="Início do contrato" value="01/01/2025" />
              <Field label="Status da assinatura" value="Ativo" />
              <Field label="Telas contratadas" value="1 tela" />
            </div>
          </div>

          {/* ── DADOS DA TELA / ESTABELECIMENTO ── */}
          <div style={S.box}>
            <div style={S.boxTitle}>📺 Local de Exibição — Tela</div>
            <div style={{ ...S.grid3, marginBottom: 14 }}>
              <Field label="Nome da tela" value="Loja Centro" />
              <Field label="Código" value="SCR-0007" />
              <Field label="Status" value="Online" />
              <Field label="Empresa do local" value="Belo LTDA" />
              <Field label="CNPJ do local" value="12.345.678/0001-90" />
              <Field label="Cidade" value="Ribeirão Preto – SP" />
              <Field label="Endereço" value="Rua das Flores, 123 – Centro, Ribeirão Preto – SP, 14010-000" span />
              <Field label="Resolução configurada" value="1920 × 1080 px" />
              <Field label="Orientação" value="Paisagem (0°)" />
            </div>
          </div>

          {/* ── EXTRATO DO MÊS — estilo fatura de cartão ── */}
          <div style={S.box}>
            <div style={S.boxTitle}>📊 Extrato de Exibição — Julho / 2026</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #c8dcda" }}>
                  {["Período", "Tela", "Tipo de serviço", "Dias ativos", "Status", "Valor (R$)"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 8, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.6, paddingBottom: 8, paddingRight: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { period: "01/07–31/07/2026", tela: "Loja Centro", tipo: "Sinalização Digital", dias: "31 dias", status: "Ativo", val: "150,00" },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1.5px solid #eef2f2" }}>
                    <td style={{ padding: "10px 10px 10px 0", color: "#555", fontSize: 11 }}>{r.period}</td>
                    <td style={{ padding: "10px 10px 10px 0", color: "#1a1a2e", fontWeight: 700 }}>{r.tela}</td>
                    <td style={{ padding: "10px 10px 10px 0", color: "#555" }}>
                      {r.tipo}
                      <span style={{ display: "block", fontSize: 9.5, color: "#aaa" }}>Plano Mensal OnSign</span>
                    </td>
                    <td style={{ padding: "10px 10px 10px 0", color: "#555" }}>{r.dias}</td>
                    <td style={{ padding: "10px 10px 10px 0" }}><ExtratoBadge color="#10b981" text="Ativo" /></td>
                    <td style={{ padding: "10px 0 10px 0", fontWeight: 800, color: "#1a1a2e", textAlign: "right" }}>{r.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totalizadores estilo extrato */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "2px solid #c8dcda", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {[
                ["Serviços mensais", "R$ 150,00"],
                ["Serviços eventuais", "R$ 0,00"],
                ["Descontos", "R$ 0,00"],
                ["TOTAL DA FATURA", "R$ 150,00"],
              ].map(([l, v], i) => (
                <div key={l} style={{ textAlign: i === 3 ? "right" : "left" }}>
                  <span style={{ ...S.label, display: "block" }}>{l}</span>
                  <span style={{ fontSize: i === 3 ? 16 : 13, fontWeight: 900, color: i === 3 ? "#79B4B0" : "#1a1a2e" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "right", fontSize: 10, color: "#aaa", fontStyle: "italic", marginTop: 4 }}>
              Cento e cinquenta reais
            </div>
          </div>

          {/* ── PAGAMENTO PIX ── */}
          <div style={{ border: "2px solid #c8dcda", borderRadius: 10, padding: "16px 20px", marginBottom: 16, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center" }}>
            {/* QR */}
            <div style={{ border: "2px solid #c8dcda", borderRadius: 10, padding: 5, background: "#f4f9f9" }}>
              <img src={qrUrl} width={140} height={140} alt="QR Code PIX" style={{ display: "block", borderRadius: 6 }} />
            </div>
            {/* Dados */}
            <div>
              <div style={S.boxTitle}>💠 Pague com PIX</div>
              <div style={S.grid2}>
                <Field label="Chave PIX (e-mail)" value="claudio@rpshow.com.br" />
                <Field label="Beneficiário" value="RPShow OnSign" />
                <Field label="Banco" value="Banco Cora" />
                <Field label="Conta" value="Ag. 0001 · C/C 4660759-7" />
              </div>
              <div style={{ marginTop: 12 }}>
                <span style={{ ...S.label, display: "block" }}>PIX Copia e Cola</span>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, fontSize: 8, fontFamily: "monospace", border: "2px solid #c8dcda", borderRadius: 6, padding: "6px 10px", background: "#f4f9f9", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    00020126580014br.gov.bcb.pix0136claudio@rpshow.com.br...
                  </div>
                  <button style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, border: "2px solid #79B4B0", color: "#79B4B0", background: "#fff", padding: "5px 14px", borderRadius: 6, cursor: "pointer" }}>Copiar</button>
                </div>
              </div>
            </div>
            {/* Valor */}
            <div style={{ textAlign: "center", padding: "0 8px", borderLeft: "2px solid #e5efee" }}>
              <span style={{ ...S.label, display: "block" }}>Total PIX</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#79B4B0", display: "block" }}>R$ 150,00</span>
              <span style={{ fontSize: 9, color: "#aaa" }}>venc. 31/07/2026</span>
            </div>
          </div>

          {/* ── OBS / NOTAS ── */}
          <div style={{ border: "2px solid #f0e8c8", borderRadius: 10, padding: "12px 18px", background: "#fffdf3", marginBottom: 16 }}>
            <span style={{ ...S.label, color: "#c9a227" }}>Observações</span>
            <span style={{ fontSize: 11, color: "#7a6820" }}>Pagamento referente ao mês de Julho/2026. Em caso de dúvidas, entre em contato via WhatsApp (16) 98220-8695.</span>
          </div>

          {/* ── FOOTER ── */}
          <div style={{ borderTop: "2px solid #c8dcda", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#79B4B0" }}>RPShow OnSign</div>
              <div style={{ fontSize: 9, color: "#bbb", marginTop: 2 }}>CNPJ 43.738.727/0001-83</div>
            </div>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "2px solid #79B4B0", color: "#79B4B0", background: "#fff", padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              🖨 Imprimir / Baixar PDF
            </button>
            <div style={{ fontSize: 9, color: "#bbb", textAlign: "right", lineHeight: 1.8 }}>
              Comprovante de serviços de sinalização digital.<br />
              rpshow.com.br · (16) 98220-8695
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
