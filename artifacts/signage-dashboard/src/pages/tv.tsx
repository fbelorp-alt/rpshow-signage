import { useState } from "react";
import { useLocation } from "wouter";

export default function TvEntry() {
  const [code, setCode] = useState("");
  const [, navigate] = useLocation();

  const handleConnect = () => {
    const trimmed = code.trim();
    if (trimmed) navigate(`/player/${trimmed}`);
  };

  return (
    <div className="w-screen h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-8">
      <img src="/logo-rpshow.png" alt="RPShow" className="h-28 w-auto object-contain" />

      <div className="flex flex-col items-center gap-4 w-72">
        <label className="text-xs font-semibold tracking-widest text-zinc-400 uppercase self-start">
          Código da Tela
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          placeholder="ex: 78335014"
          className="w-full bg-[#161b22] border border-zinc-700 rounded-xl px-5 py-4 text-center text-2xl font-bold text-white tracking-widest focus:outline-none focus:border-[#00b4d8]"
          autoFocus
        />
        <button
          onClick={handleConnect}
          className="w-full bg-[#00b4d8] hover:bg-[#0096b7] text-[#0d1117] font-bold text-lg py-4 rounded-xl transition-colors"
        >
          Conectar
        </button>
      </div>

      <p className="text-zinc-600 text-sm text-center max-w-xs">
        O código é exibido no painel de administração em<br />
        Telas → código da tela
      </p>
    </div>
  );
}
