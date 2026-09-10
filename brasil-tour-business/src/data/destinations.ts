export type Marker = {
  id: string;
  city: string;
  lat: number;
  lon: number;
};

export type Market = {
  id: string;
  country: string;
  /** Resumo curto exibido no topo do painel lateral. */
  summary: string;
  cities: string[];
  services: string[];
  markers: Marker[];
};

// Coordenadas reais dos mercados atendidos pela Brasil Tour & Business.
export const MARKETS: Market[] = [
  {
    id: "brasil",
    country: "Brasil",
    summary:
      "Base da operação: roteiros de natureza, cultura e negócios em duas das paisagens mais singulares do país.",
    cities: ["Rio de Janeiro", "Parintins (AM)"],
    services: [
      "Turismo & Viagens",
      "Assessoria Internacional",
      "Intermediação & Conexões",
    ],
    markers: [
      { id: "rio-de-janeiro", city: "Rio de Janeiro", lat: -22.91, lon: -43.17 },
      { id: "parintins", city: "Parintins (AM)", lat: -2.63, lon: -56.74 },
    ],
  },
  {
    id: "eua",
    country: "Estados Unidos",
    summary:
      "Ponte estratégica entre negócios brasileiros e o mercado norte-americano, com base em Miami.",
    cities: ["Miami"],
    services: [
      "Business & Negócios",
      "Assessoria Internacional",
      "Representação & Articulação",
    ],
    markers: [{ id: "miami", city: "Miami", lat: 25.76, lon: -80.19 }],
  },
  {
    id: "franca",
    country: "França",
    summary: "Curadoria de experiências e conexões institucionais a partir de Paris.",
    cities: ["Paris"],
    services: [
      "Turismo & Viagens",
      "Representação & Articulação",
      "Intermediação & Conexões",
    ],
    markers: [{ id: "paris", city: "Paris", lat: 48.86, lon: 2.35 }],
  },
  {
    id: "monaco",
    country: "Mônaco",
    summary: "Acesso discreto a experiências e círculos de alto padrão em Monte Carlo.",
    cities: ["Monte Carlo"],
    services: ["Turismo & Viagens", "Business & Negócios"],
    markers: [{ id: "monte-carlo", city: "Monte Carlo", lat: 43.73, lon: 7.42 }],
  },
  {
    id: "canada",
    country: "Canadá",
    summary: "Suporte a projetos, viagens e novas conexões a partir de Vancouver.",
    cities: ["Vancouver"],
    services: ["Assessoria Internacional", "Intermediação & Conexões"],
    markers: [{ id: "vancouver", city: "Vancouver", lat: 49.28, lon: -123.12 }],
  },
  {
    id: "marrocos",
    country: "Marrocos",
    summary: "Roteiros exclusivos e articulação comercial a partir de Marrakech.",
    cities: ["Marrakech"],
    services: ["Turismo & Viagens", "Representação & Articulação"],
    markers: [{ id: "marrakech", city: "Marrakech", lat: 31.63, lon: -7.99 }],
  },
];

export type FlatMarker = Marker & { market: Market };

export const ALL_MARKERS: FlatMarker[] = MARKETS.flatMap((market) =>
  market.markers.map((marker) => ({ ...marker, market }))
);
