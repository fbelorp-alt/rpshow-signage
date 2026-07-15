import { useQuery } from "@tanstack/react-query";
import { Printer, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MediaEntry {
  mediaName: string;
  mediaUrl: string | null;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  totalPlays: number;
  dailyAvg: number;
  insertionPct: number;
  playsByDay: Record<string, number>;
}
interface ScreenEntry {
  screenName: string;
  medias: MediaEntry[];
  totalPlays: number;
}
interface ComprovanteData {
  campaignName: string | null;
  clientName: string | null;
  issuedAt: string;
  screens: ScreenEntry[];
  summary: {
    medias: Omit<MediaEntry, "insertionPct" | "playsByDay">[];
    totalPlays: number;
    totalDays: number;
    dailyAvg: number;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBR(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function n(v: number) {
  return v.toLocaleString("pt-BR");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Comprovante() {
  const params = new URLSearchParams(window.location.search);
  const campaignGroupId = params.get("campaignGroupId") ?? undefined;
  const clientName      = params.get("clientName")      ?? undefined;
  const startDate       = params.get("startDate")       ?? undefined;
  const endDate         = params.get("endDate")         ?? undefined;

  const qp = new URLSearchParams();
  if (campaignGroupId) qp.set("campaignGroupId", campaignGroupId);
  if (clientName)      qp.set("clientName",      clientName);
  if (startDate)       qp.set("startDate",        startDate);
  if (endDate)         qp.set("endDate",           endDate);

  const { data, isLoading, isError } = useQuery<ComprovanteData>({
    queryKey: ["/api/reports/comprovante", qp.toString()],
    queryFn: async () => {
      const r = await fetch(`/api/reports/comprovante?${qp.toString()}`);
      if (!r.ok) throw new Error("Erro ao carregar comprovante");
      return r.json();
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Carregando comprovante…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-2 text-red-500 text-sm">
        <AlertCircle className="w-4 h-4" /> Não foi possível carregar os dados.
      </div>
    );
  }

  const issuedDate = new Date(data.issuedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // Collect all distinct dates across ALL screens for the daily grid
  const allDates = Array.from(
    new Set(data.screens.flatMap(sc => sc.medias.flatMap(m => Object.keys(m.playsByDay))))
  ).sort();

  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "Arial, sans-serif", color: "#000", fontSize: "12px" }}>

      {/* Print button — hidden when printing */}
      <div className="print:hidden flex justify-end p-4 bg-gray-50 border-b border-gray-200">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Salvar PDF
        </button>
      </div>

      <div className="p-8 max-w-[1100px] mx-auto">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-800">
          <div>
            <div className="text-lg font-bold uppercase tracking-wide text-gray-800">
              Comprovante de Veiculação de Campanha
            </div>
            <div className="mt-2 space-y-0.5 text-[13px]">
              <div><span className="font-bold">CLIENTE</span>&nbsp;&nbsp;&nbsp;{data.clientName ?? "—"}</div>
              {data.campaignName && (
                <div className="flex gap-8">
                  <span><span className="font-bold">CAMPANHA</span>&nbsp;&nbsp;&nbsp;{data.campaignName}</span>
                </div>
              )}
              {(startDate || endDate) && (
                <div>
                  <span className="font-bold">PERÍODO DA CAMPANHA</span>&nbsp;&nbsp;&nbsp;
                  {fmtBR(startDate)} a {fmtBR(endDate)}
                </div>
              )}
            </div>
          </div>
          <div className="text-right text-[11px] text-gray-600">
            <div className="font-bold text-base text-gray-800">RPShow OnSign</div>
            <div>Data de Emissão: {issuedDate}</div>
          </div>
        </div>

        {/* ── Media thumbnails ──────────────────────────────────────────────── */}
        {(() => {
          const uniqueMedias = Array.from(
            new Map(
              data.screens.flatMap(sc => sc.medias)
                .filter(m => m.mediaUrl)
                .map(m => [m.mediaName, m])
            ).values()
          );
          if (uniqueMedias.length === 0) return null;
          return (
            <div className="mb-6">
              <SectionTitle>Mídias da Campanha</SectionTitle>
              <div className="flex flex-wrap gap-3 mt-2">
                {uniqueMedias.map(m => (
                  <div key={m.mediaName} className="text-center">
                    <img
                      src={m.mediaUrl!}
                      alt={m.mediaName}
                      style={{ width: 110, height: 70, objectFit: "cover", border: "1px solid #ccc", borderRadius: 2 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="text-[9px] text-gray-500 mt-0.5 max-w-[110px] truncate">{m.mediaName}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Per-screen tables ─────────────────────────────────────────────── */}
        {data.screens.map(screen => (
          <div key={screen.screenName} className="mb-6 break-inside-avoid">
            <SectionTitle>{screen.screenName}</SectionTitle>

            {/* Main stats table */}
            <table className="w-full border-collapse text-[11px] mb-2">
              <thead>
                <tr style={{ backgroundColor: "#5a5a5a", color: "#fff" }}>
                  <th className="border border-gray-400 px-2 py-1 text-left">Mídia</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">Período da Publicação</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">Dias Veiculando</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">Inserções Veiculadas</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">% do Painel</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">Média Diária</th>
                </tr>
              </thead>
              <tbody>
                {screen.medias.map((m, i) => (
                  <tr key={m.mediaName} style={{ backgroundColor: i % 2 === 0 ? "#f9f9f9" : "#fff" }}>
                    <td className="border border-gray-300 px-2 py-1">{m.mediaName}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {fmtBR(m.periodStart)} a {fmtBR(m.periodEnd)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{m.totalDays}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-medium">{n(m.totalPlays)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{m.insertionPct.toFixed(2)}%</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{n(m.dailyAvg)}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: "#ddd", fontWeight: "bold" }}>
                  <td className="border border-gray-400 px-2 py-1" colSpan={3}>Total</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{n(screen.totalPlays)}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">100%</td>
                  <td className="border border-gray-400 px-2 py-1 text-center"></td>
                </tr>
              </tbody>
            </table>

            {/* Daily grid — show only if ≤ 31 days to keep readable */}
            {allDates.length <= 31 && allDates.length > 0 && (
              <div className="overflow-x-auto mb-3">
                <table className="border-collapse text-[9px]" style={{ minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th className="border border-gray-300 px-1 py-0.5 text-left bg-gray-100" style={{ minWidth: 120 }}>
                        Mídia / Dia
                      </th>
                      {allDates.map(d => (
                        <th key={d} className="border border-gray-300 px-0.5 py-0.5 text-center bg-gray-100" style={{ minWidth: 26 }}>
                          {d.slice(8)}
                        </th>
                      ))}
                      <th className="border border-gray-300 px-1 py-0.5 text-center bg-gray-200 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screen.medias.map((m, i) => (
                      <tr key={m.mediaName} style={{ backgroundColor: i % 2 === 0 ? "#f9f9f9" : "#fff" }}>
                        <td className="border border-gray-300 px-1 py-0.5 truncate" style={{ maxWidth: 160 }}>{m.mediaName}</td>
                        {allDates.map(d => (
                          <td key={d} className="border border-gray-300 px-0.5 py-0.5 text-center">
                            {m.playsByDay[d] ? n(m.playsByDay[d]) : ""}
                          </td>
                        ))}
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-bold bg-gray-50">{n(m.totalPlays)}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: "#ddd", fontWeight: "bold" }}>
                      <td className="border border-gray-300 px-1 py-0.5">Total</td>
                      {allDates.map(d => {
                        const dayTotal = screen.medias.reduce((s, m) => s + (m.playsByDay[d] ?? 0), 0);
                        return (
                          <td key={d} className="border border-gray-300 px-0.5 py-0.5 text-center">
                            {dayTotal > 0 ? n(dayTotal) : ""}
                          </td>
                        );
                      })}
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{n(screen.totalPlays)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* ── Campaign summary ──────────────────────────────────────────────── */}
        {data.summary && data.summary.medias.length > 0 && (
          <div className="break-inside-avoid">
            <SectionTitle>Resumo da Campanha</SectionTitle>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr style={{ backgroundColor: "#5a5a5a", color: "#fff" }}>
                  <th className="border border-gray-400 px-2 py-1 text-left">Mídia</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">Período da Publicação</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">Dias Veiculando</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">Inserções Veiculadas</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">Média de Inserções Diárias</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.medias.map((m, i) => (
                  <tr key={m.mediaName} style={{ backgroundColor: i % 2 === 0 ? "#f9f9f9" : "#fff" }}>
                    <td className="border border-gray-300 px-2 py-1">{m.mediaName}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {fmtBR(m.periodStart)} a {fmtBR(m.periodEnd)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{m.totalDays}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-medium">{n(m.totalPlays)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{n(m.dailyAvg)}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: "#ddd", fontWeight: "bold" }}>
                  <td className="border border-gray-400 px-2 py-1" colSpan={3}>Totais da Campanha</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{n(data.summary.totalPlays)}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{n(data.summary.dailyAvg)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {data.screens.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            Nenhum dado de exibição encontrado para os filtros selecionados.
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-[9px] text-gray-400 text-center">
          RPShow OnSign · Comprovante gerado em {issuedDate} · Dados baseados nos registros de exibição do sistema
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4 landscape; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-bold text-white px-2 py-1 mb-1 text-[11px] uppercase tracking-wide"
      style={{ backgroundColor: "#333" }}
    >
      {children}
    </div>
  );
}
