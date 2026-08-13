import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy initialization of Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "AstroVision Sky Lens Server" });
});

// NASA APOD proxy endpoint (with fallback if NASA key not set or limit reached)
app.get("/api/nasa/apod", async (_req, res) => {
  try {
    const nasaApiKey = process.env.NASA_API_KEY || "DEMO_KEY";
    const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${nasaApiKey}`);
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    throw new Error("NASA APOD response not ok");
  } catch (error) {
    // Return high quality astronomy fallback data
    return res.json({
      title: "Nebulosa de Órion (M42) pelo Telescópio Espacial James Webb",
      date: new Date().toISOString().split("T")[0],
      explanation: "A Grande Nebulosa de Órion (Messier 42) é um berçário estelar maciço localizado a cerca de 1.344 anos-luz da Terra. Revelada em detalhes impressionantes pelo JWST e Hubble, mostra jatos protoestelares, filamentos de poeira cósmica e jovens estrelas brilhantes no trapézio central.",
      url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop",
      hdurl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop",
      media_type: "image",
      copyright: "NASA / ESA / CSA / STScI"
    });
  }
});

// Sky Lens / Astro AI identification endpoint
app.post("/api/identify-sky", async (req, res) => {
  try {
    const {
      azimuth,
      altitude,
      latitude,
      longitude,
      targetCandidate,
      nearbyCandidates,
      imageBase64,
      userQuery,
    } = req.body;

    const promptText = `
Você é o AstroLens AI, um astrofísico e guia estelar do aplicativo de astronomia em tempo real.
O usuário está apontando a câmera do celular para o céu noturno na seguinte orientação:
- Azimute: ${azimuth != null ? azimuth.toFixed(1) + '°' : 'Não informado'} (${getCompassDirection(azimuth)})
- Altitude/Elevação: ${altitude != null ? altitude.toFixed(1) + '° acima do horizonte' : 'Não informado'}
- Localização do Observador: Lat ${latitude ? latitude.toFixed(4) : '0'}, Lon ${longitude ? longitude.toFixed(4) : '0'}
- Alvo mais próximo calculado na mira: ${targetCandidate ? JSON.stringify(targetCandidate) : 'Área do céu aberta / Constelações'}
- Outros astros próximos no campo de visão: ${nearbyCandidates ? JSON.stringify(nearbyCandidates) : 'Vários corpos celestes'}
${userQuery ? `- Pergunta específica do usuário: "${userQuery}"` : ''}

Por favor, forneça uma análise astronômica completa, precisa e fascinante no formato JSON em Português do Brasil com a seguinte estrutura exata:
{
  "name": "Nome principal do astro/constelação/planeta (ex: Sírius, Cruzeiro do Sul, Júpiter, etc)",
  "scientificName": "Designação astronômica ou catálogo (ex: Alpha Canis Majoris, HIP 32349, etc)",
  "type": "star" | "planet" | "constellation" | "galaxy" | "nebula" | "satellite" | "cluster",
  "constellation": "Nome da constelação onde se encontra",
  "apparentMagnitude": "Magnitude aparente (ex: -1.46)",
  "distance": "Distância aproximada (ex: 8.6 anos-luz ou 4.2 AU)",
  "spectralClassOrComposition": "Tipo espectral ou composição química/atmosférica principal",
  "shortSummary": "Breve resumo cativante de 2 frases sobre o que o usuário está vendo.",
  "mythologyAndHistory": "História, mitologia (grega, egípcia ou indígena tupi-guarani brasileira) ou contexto histórico desta estrela/planeta.",
  "astrophysicsFacts": [
    "Fato científico 1 fascinante e detalhado",
    "Fato científico 2 sobre temperatura, massa, satélites ou evolução estelar",
    "Fato científico 3 sobre dados recentes da NASA / Telescópio James Webb ou Hubble"
  ],
  "observationTips": "Dicas de observação: visibilidade a olho nu, com binóculo 10x50 ou telescópio amador.",
  "curiosity": "Uma curiosidade surpreendente que quase ninguém sabe."
}
Responda APENAS com o JSON válido, sem blocos markdown externos ou textos adicionais.
`;

    const ai = getGeminiClient();
    
    let contentParts: any[] = [];
    if (imageBase64 && typeof imageBase64 === "string" && imageBase64.startsWith("data:image")) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }
    contentParts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: { parts: contentParts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(cleaned);

    return res.json({
      success: true,
      data: parsedData,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/identify-sky:", error);

    // Provide rich fallback object if API key is not configured or fails
    const fallbackTarget = req.body?.targetCandidate?.name || "Corpo Celeste Observado";
    return res.json({
      success: true,
      data: {
        name: fallbackTarget,
        scientificName: req.body?.targetCandidate?.scientificName || "Astro Identificado",
        type: req.body?.targetCandidate?.type || "star",
        constellation: req.body?.targetCandidate?.constellation || "Céu Noturno",
        apparentMagnitude: req.body?.targetCandidate?.mag ? String(req.body.targetCandidate.mag) : "Visível a olho nu",
        distance: req.body?.targetCandidate?.dist || "Centenas de anos-luz",
        spectralClassOrComposition: "Estrela luminosa da sequência principal",
        shortSummary: `Você está apontando diretamente para ${fallbackTarget}. Um astro brilhante em posição de destaque na abóbada celeste nesta noite.`,
        mythologyAndHistory: "Há milênios, navegadores e astrônomos de civilizações antigas usavam estes alinhamentos estelares como bússola cósmica no céu noturno.",
        astrophysicsFacts: [
          "A luz que você está vendo agora viajou pelo espaço interestelar até atingir seus olhos.",
          "Sua posição aparente no céu varia continuamente com a rotação axial e translação da Terra.",
          "Astrônomos da NASA e ESO utilizam espectrografia para medir a composição química e velocidade radial deste corpo celeste."
        ],
        observationTips: "Em locais com baixa poluição luminosa (Bortle 1-4), pode ser observado com grande nitidez a olho nu ou com binóculos astronômicos.",
        curiosity: "A cor das estrelas revela sua temperatura superficial: azuladas são superquentes (mais de 20.000 K), enquanto avermelhadas são mais frias (cerca de 3.000 K)."
      },
      fallback: true
    });
  }
});

function getCompassDirection(deg?: number): string {
  if (deg == null) return "Desconhecido";
  const normalized = ((deg % 360) + 360) % 360;
  const directions = ["Norte", "Nordeste", "Leste", "Sudeste", "Sul", "Sudoeste", "Oeste", "Noroeste"];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AstroVision server running on http://localhost:${PORT}`);
  });
}

startServer();
