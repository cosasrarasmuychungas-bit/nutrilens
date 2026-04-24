import { useState, useRef, useCallback, useEffect } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

// ── Constants ─────────────────────────────────────────────────
const DEFAULT_GOALS = { calorias: 2200, proteinas: 150, carbohidratos: 250, grasas: 70 };
const DEFAULT_MEALS = [
  { id: "desayuno", label: "Desayuno", emoji: "☀️" },
  { id: "almuerzo", label: "Almuerzo", emoji: "🌤️" },
  { id: "comida",   label: "Comida",   emoji: "🌞" },
  { id: "merienda", label: "Merienda", emoji: "🌥️" },
  { id: "cena",     label: "Cena",     emoji: "🌙" },
];
const EMOJIS = ["☀️","🌤️","🌞","🌥️","🌙","🍳","🥗","🍱","🥪","🍜","🍕","🥩","🫕","🥣","🍇","🧃","☕","🍵"];
const DAYS   = ["L","M","X","J","V","S","D"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// 20 Imágenes de fondo relajantes, oscuras y de alta calidad
const BG_CAROUSEL = [
  "https://images.unsplash.com/photo-1506744626753-140026e64d7a?q=80&w=800&auto=format&fit=crop", // Montañas oscuras
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?q=80&w=800&auto=format&fit=crop", // Noche/Naturaleza
  "https://images.unsplash.com/photo-1434725039720-aaad6dd32fac?q=80&w=800&auto=format&fit=crop", // Paisaje niebla
  "https://images.unsplash.com/photo-1516214104703-d25078014692?q=80&w=800&auto=format&fit=crop", // Lago relajante
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop", // Bosque oscuro
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?q=80&w=800&auto=format&fit=crop", // Aurora y pinos
  "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=800&auto=format&fit=crop", // Bosque desde arriba
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=800&auto=format&fit=crop", // Montaña brumosa
  "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?q=80&w=800&auto=format&fit=crop", // Cima montañas
  "https://images.unsplash.com/photo-1500534623283-258267364177?q=80&w=800&auto=format&fit=crop", // Lago y montañas
  "https://images.unsplash.com/photo-1497449985806-ea5978a63ce5?q=80&w=800&auto=format&fit=crop", // Nubes grises
  "https://images.unsplash.com/photo-1418065460487-3ce7eb3694f4?q=80&w=800&auto=format&fit=crop", // Pinos y niebla
  "https://images.unsplash.com/photo-1504280365736-233bb9fa4c7b?q=80&w=800&auto=format&fit=crop", // Montañas silueta
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop", // Cordillera oscura
  "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=800&auto=format&fit=crop", // Arboles de noche
  "https://images.unsplash.com/photo-1428908728789-d2de8ae1e5e8?q=80&w=800&auto=format&fit=crop", // Rio sereno
  "https://images.unsplash.com/photo-1503195232765-a83d73db3900?q=80&w=800&auto=format&fit=crop", // Textura piedra natural
  "https://images.unsplash.com/photo-1439853949703-ff5a8d2503aa?q=80&w=800&auto=format&fit=crop", // Lago reflejo oscuro
  "https://images.unsplash.com/photo-1458668383970-45f4df210515?q=80&w=800&auto=format&fit=crop", // Lago cristalino
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop"  // Naturaleza profunda
];

const C = {
  bg:"#0a0a0b", surface:"#121214", surface2:"#1c1c1e", surface3:"#2c2c2e",
  border:"#27272a", border2:"#3f3f46",
  text:"#ffffff", text2:"#a1a1aa", text3:"#71717a",
  green:"#10b981", greenNeon:"#00ff66", yellow:"#eab308", orange:"#f97316",
  red:"#ef4444", blue:"#3b82f6", amber:"#f59e0b", pink:"#ec4899", purple:"#a855f7", cyan:"#00b7ff",
  // Slot accent colors
  slotColors: {
    "Desayuno":"#f97316", "Almuerzo":"#eab308", "Comida":"#3b82f6",
    "Merienda":"#a855f7", "Cena":"#ec4899",
  },
};

// Streak calculation
const getStreak = (history) => {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const ds = localDateStr(d);
    const has = history[ds]?.meals?.length > 0;
    if (i === 0 && !has) { d.setDate(d.getDate()-1); continue; }
    if (has) streak++; else break;
    d.setDate(d.getDate()-1);
  }
  return streak;
};

const slotColor = (slotLabel) => C.slotColors[slotLabel] || C.blue;

const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const ringColor = (pct) => pct < 50 ? C.greenNeon : pct < 80 ? C.yellow : pct < 100 ? C.orange : C.red;

const getDateStr = () => {
  const d = new Date();
  const days = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
};

const S = {
  pill: (on) => ({ padding:"7px 16px", borderRadius:100, border:`1px solid ${on ? C.blue+"66" : C.border}`, cursor:"pointer", background: on ? C.blue+"22" : C.surface2, color: on ? C.blue : C.text2, fontSize:12, fontWeight:700, transition:"all 0.15s" }),
  card: { background:C.surface, borderRadius:18, padding:"16px", border:`1px solid ${C.border}`, marginBottom:10 },
  label: { fontSize:12, color:C.text3, fontWeight:600, marginBottom:10, display:"block" },
  inp: { background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:12, padding:"12px 14px", color:C.text, fontSize:15, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
};

// ── Splash Screen ─────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1600);
    const t2 = setTimeout(onDone, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={{
      position:"fixed", inset:0, background:C.bg, zIndex:999,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      opacity: fading ? 0 : 1,
      transition: fading ? "opacity 0.5s ease" : "none",
      pointerEvents: fading ? "none" : "all",
    }}>
      <div style={{ animation:"splashLogo 1.2s cubic-bezier(.34,1.56,.64,1) forwards" }}>
        <img src="/icon-512.png" alt="NutriLens" style={{ width:110, height:110, borderRadius:26, display:"block", boxShadow:`0 20px 60px ${C.greenNeon}22` }} />
      </div>
      <div style={{ animation:"splashText 1.4s ease forwards", marginTop:18, textAlign:"center" }}>
        <div style={{ fontSize:26, fontWeight:900, letterSpacing:-0.5, color:C.text }}>NutriLens</div>
        <div style={{ fontSize:12, color:C.greenNeon, fontWeight:700, marginTop:4, letterSpacing:3, textTransform:"uppercase" }}>IA</div>
      </div>
      <style>{`
        @keyframes splashLogo {
          0%   { opacity:0; transform:scale(0.5); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes splashText {
          0%,40% { opacity:0; transform:translateY(12px); }
          100%   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── localStorage helpers ──────────────────────────────────────
const ls = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      if (key === "nl-history" && val && typeof val === "object") {
        try {
          const stripped = {};
          const today = new Date().toISOString().split("T")[0];
          for (const [date, day] of Object.entries(val)) {
            if (date === today) {
              stripped[date] = day;
            } else if (day.meals) {
              stripped[date] = { ...day, meals: day.meals.map(m => ({ ...m, thumbnail: null })) };
            }
          }
          localStorage.setItem(key, JSON.stringify(stripped));
          return true;
        } catch { return false; }
      }
      return false;
    }
  },
};

// ── API helpers ───────────────────────────────────────────────
function extractJSON(raw) {
  try { return JSON.parse(raw); } catch {}
  const stripped = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(stripped); } catch {}
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  throw new Error("No valid JSON in response");
}

async function callClaude(apiKey, system, userContent, maxTokens = 800) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  return extractJSON(text);
}

// ── Food analysis ─────────────────────────────────────────────
async function analyzeFood(apiKey, text, base64, mediaType, profile, goals) {
  const pCtx = profile ? `Usuario: objetivo=${profile.objetivo||"salud"}, dieta=${profile.dieta||"sin restricciones"}, restricciones=${profile.restricciones||"ninguna"}, peso=${profile.peso||75}kg.` : "";
  const userContent = base64
    ? [{ type:"image", source:{ type:"base64", media_type: mediaType||"image/jpeg", data:base64 } }, { type:"text", text:"Analiza esta comida con máxima precisión nutricional." }]
    : [{ type:"text", text:`Analiza este texto de comida: ${text}` }];
  return callClaude(apiKey,
    `Eres un nutricionista experto y un sistema de visión artificial avanzado. Tu tarea es analizar los alimentos. ${pCtx}
REGLAS VITALES Y ESTRICTAS:
1. IDENTIFICACIÓN PROFUNDA: Detecta cada ingrediente visible. Si hay salsas, aderezos o métodos de cocción (frito, empanado, a la plancha con aceite), estima y SUMA esas calorías ocultas (aceites/grasas).
2. CANTIDADES REALISTAS: Asigna gramos razonables basados en escalas estándar visuales (ej: 1 huevo=60g, 1 tostada normal=35g, cucharada de aceite=15g, filete mediano=150g).
3. DESCRIPCIÓN MINIMALISTA: La propiedad "descripcion" debe ser SOLO el nombre del plato genérico en 3 a 5 palabras máximo (ej: "Salmón con arroz y verduras"). ¡CERO explicaciones en este campo!
4. ESTRUCTURA DE PLATOS: En la lista "platos", el "nombre" debe incluir el ingrediente exacto y el peso estimado deducido (ej: "Arroz blanco cocido (150g)").
Genera SOLO un JSON válido en una sola línea. NADA de backticks, ni markdown, ni texto extra.
FORMATO EXACTO:
{"platos":[{"nombre":"ingrediente exacto (Xg)","calorias":N,"proteinas":N,"carbohidratos":N,"grasas":N}],"totalCalorias":N,"totalProteinas":N,"totalCarbohidratos":N,"totalGrasas":N,"descripcion":"nombre del plato ultra corto","consejoPerfil":"1 frase de 10 palabras si encaja con su objetivo"}
Si NO detectas comida: {"error":"No se detectó comida en la imagen."}`,
    userContent, 1000);
}

async function getRecommendations(apiKey, meals, remainingSlots, totals, goals) {
  const eaten = meals.map(m => `${m.slot}: ${m.totalCalorias} kcal`).join(", ");
  return callClaude(apiKey,
    `Eres nutricionista experto. Responde SOLO con JSON válido en una línea, sin backticks.
Formato: {"comidas":[{"comida":"nombre","opciones":[{"sugerencia":"nombre del plato","cantidad":"gramos exactos de cada ingrediente ej: 150g pechuga + 80g arroz cocido","calorias":número,"emoji":"🍗"},{"sugerencia":"...","cantidad":"...","calorias":número,"emoji":"🥗"},{"sugerencia":"...","cantidad":"...","calorias":número,"emoji":"🍜"}]}],"consejo":"frase corta"}
IMPORTANTE: "cantidad" debe tener los gramos exactos de cada ingrediente para no pasarse de calorías. Las calorías deben corresponder exactamente a esas cantidades. Adapta al contexto: pre-entreno=rápido sin cocinar, post-entreno=proteína, merienda=ligero, comida/cena=plato completo. Da 3 opciones por comida.`,
    `Comido: ${eaten||"nada"} (${Math.round(totals.cal)} kcal de ${goals.calorias}). Faltan: ${remainingSlots.join(", ")}. Macros consumidos P${Math.round(totals.p)}g C${Math.round(totals.c)}g G${Math.round(totals.g)}g. Objetivos P${goals.proteinas}g C${goals.carbohidratos}g G${goals.grasas}g.`,
    1200);
}

async function analyzeHealthScore(apiKey, base64) {
  return callClaude(apiKey,
    `Eres nutricionista. Analiza la comida. Responde SOLO con JSON en una sola línea sin backticks.
Formato: {"nombre":"plato","puntuacion":75,"categoria":"Buena","resumen":"frase corta","positivos":["p1","p2"],"negativos":["n1","n2"],"macros":{"proteinas":"medio","carbohidratos":"alto","grasas":"bajo","azucares":"bajo","fibra":"medio","sodio":"bajo"},"consejo":"consejo breve"}
Puntuacion entero 1-100. Macros valores: alto, medio o bajo.`,
    [{ type:"image", source:{ type:"base64", media_type:"image/jpeg", data:base64 } }, { type:"text", text:"Puntúa esta comida del 1 al 100." }],
    600);
}

// ── API Key Setup Screen ──────────────────────────────────────
function SetupScreen({ onSave }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!key.trim().startsWith("sk-ant-")) {
      setError("La clave debe empezar por sk-ant-");
      return;
    }
    onSave(key.trim());
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"-apple-system,'SF Pro Display',sans-serif" }}>
      <div style={{ maxWidth:380, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🥗</div>
          <div style={{ fontSize:11, color:C.text3, fontWeight:600, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Bienvenido a</div>
          <div style={{ fontSize:32, fontWeight:900, color:C.text, letterSpacing:-1 }}>NutriLens IA</div>
          <div style={{ fontSize:14, color:C.text2, marginTop:8, lineHeight:1.6 }}>Para usar la IA necesitas una clave de API de Anthropic. Es gratuito registrarse.</div>
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:24, marginBottom:16 }}>
          <div style={{ fontSize:11, color:C.text3, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Cómo obtener tu clave</div>
          {[
            ["1", "Ve a console.anthropic.com"],
            ["2", "Crea una cuenta gratuita"],
            ["3", "Ve a API Keys → Create Key"],
            ["4", "Copia la clave y pégala aquí"],
          ].map(([n, txt]) => (
            <div key={n} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
              <div style={{ width:22, height:22, borderRadius:"50%", background:C.surface2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:C.text3, flexShrink:0 }}>{n}</div>
              <div style={{ fontSize:13, color:C.text2, lineHeight:1.4, paddingTop:2 }}>{txt}</div>
            </div>
          ))}
        </div>

        <input
          type="password"
          value={key}
          onChange={e => { setKey(e.target.value); setError(""); }}
          placeholder="sk-ant-api03-..."
          style={{ ...S.inp, marginBottom:12, fontSize:13 }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
        />

        {error && <div style={{ color:C.red, fontSize:12, marginBottom:12 }}>⚠️ {error}</div>}

        <button onClick={handleSave} disabled={testing || !key.trim()}
          style={{ width:"100%", padding:"15px", background: testing||!key.trim() ? C.surface2 : C.greenNeon, border:"none", borderRadius:14, color: testing||!key.trim() ? C.text3 : "#000", fontWeight:900, fontSize:15, cursor: testing||!key.trim() ? "default" : "pointer" }}>
          {testing ? "Verificando..." : "Empezar →"}
        </button>

        <div style={{ textAlign:"center", marginTop:14, fontSize:11, color:C.text3 }}>
          Tu clave se guarda solo en este dispositivo y nunca se comparte.
        </div>
      </div>
    </div>
  );
}

// ── Onboarding Flow ───────────────────────────────────────────
const OB_STEPS = [
  { id:"nombre",       emoji:"👋", q:"¿Cómo te llamas?",                      type:"text",   placeholder:"Tu nombre...",         hint:"Para personalizar tu experiencia" },
  { id:"sexo",         emoji:"🧬", q:"¿Cuál es tu sexo biológico?",            type:"single", opts:["Hombre","Mujer"],             hint:"Afecta al cálculo del metabolismo" },
  { id:"edad",         emoji:"🎂", q:"¿Cuántos años tienes?",                  type:"number", placeholder:"Ej: 25",               hint:"Determina tu tasa metabólica basal", unit:"años" },
  { id:"altura",       emoji:"📏", q:"¿Cuánto mides?",                         type:"number", placeholder:"Ej: 175",              hint:"Necesario para calcular tu BMR", unit:"cm" },
  { id:"peso",         emoji:"⚖️",  q:"¿Cuánto pesas actualmente?",            type:"number", placeholder:"Ej: 75",               hint:"Tu peso actual en kilogramos", unit:"kg" },
  { id:"objetivo",     emoji:"🎯", q:"¿Cuál es tu objetivo principal?",        type:"single", opts:["Perder grasa corporal","Ganar músculo","Recomposición corporal","Mantener y tonificar","Mejorar salud general"], hint:"Define toda tu estrategia nutricional" },
  { id:"ritmo",        emoji:"⚡", q:"¿A qué ritmo quieres avanzar?",          type:"single", opts:["Suave — 0,25 kg/semana","Moderado — 0,5 kg/semana","Rápido — 1 kg/semana","Agresivo — máxima velocidad"], hint:"Afecta al déficit o superávit calórico" },
  { id:"actividad",    emoji:"🏃", q:"¿Cuál es tu nivel de actividad física?", type:"single", opts:["Sedentario (trabajo de escritorio)","Algo activo (1-2 días/sem)","Moderado (3-4 días/sem)","Muy activo (5-6 días/sem)","Atleta (entreno diario)"], hint:"Multiplicador del gasto calórico" },
  { id:"deportes",     emoji:"🏋️", q:"¿Qué deportes o actividades practicas?", type:"multi",  opts:["Musculación / gym","Running / cardio","Ciclismo","Natación","Fútbol / deportes equipo","Yoga / pilates","HIIT / crossfit","Artes marciales"], hint:"Selecciona todos los que hagas" },
  { id:"dieta",        emoji:"🥗", q:"¿Qué tipo de dieta prefieres?",          type:"single", opts:["Sin restricciones","Alta en proteína (>30%)","Bajo en carbohidratos / keto","Mediterránea","Flexible / IIFYM"], hint:"Adapta la distribución de macros" },
  { id:"restricciones",emoji:"🚫", q:"¿Tienes restricciones alimentarias?",   type:"multi",  opts:["Ninguna","Vegetariano","Vegano","Sin gluten","Sin lactosa","Sin mariscos","Sin frutos secos","Halal / Kosher"], hint:"Selecciona todas las que apliquen" },
  { id:"sueno",        emoji:"😴", q:"¿Cuántas horas duermes por noche?",      type:"single", opts:["Menos de 6h","6-7h","7-8h (ideal)","Más de 9h"], hint:"El sueño afecta directamente al metabolismo" },
  { id:"estres",       emoji:"🧠", q:"¿Cómo describirías tu nivel de estrés?", type:"single", opts:["Bajo — vivo tranquilo","Moderado — algunos días difíciles","Alto — trabajo/vida muy exigente","Muy alto — estrés constante"], hint:"El cortisol afecta la gestión del peso" },
];

function OnboardingFlow({ apiKey, onDone }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [customVal, setCustomVal] = useState("");
  const [numVal, setNumVal] = useState("");
  const [multiSel, setMultiSel] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");

  const s = OB_STEPS[step];
  const isLast = step === OB_STEPS.length - 1;
  const progress = ((step + 1) / OB_STEPS.length) * 100;

  const canNext = () => {
    if (s.type === "text")   return (answers[s.id]||"").trim().length > 0 || customVal.trim().length > 0;
    if (s.type === "number") return numVal.trim().length > 0 && !isNaN(parseFloat(numVal));
    if (s.type === "single") return !!(answers[s.id] || customVal.trim());
    if (s.type === "multi")  return multiSel.length > 0 || customVal.trim().length > 0;
    return false;
  };

  const getValue = () => {
    if (s.type === "text")   return customVal.trim() || answers[s.id] || "";
    if (s.type === "number") return parseFloat(numVal);
    if (s.type === "single") return customVal.trim() || answers[s.id] || "";
    if (s.type === "multi")  return customVal.trim() ? [...multiSel, customVal.trim()].join(", ") : multiSel.join(", ") || "Ninguna";
    return "";
  };

  const goNext = async () => {
    if (!canNext()) return;
    const val = getValue();
    const newAnswers = { ...answers, [s.id]: val };
    setAnswers(newAnswers);
    setCustomVal(""); setNumVal(""); setMultiSel([]);

    if (isLast) {
      setGenerating(true);
      let done = false;
      const finish = (prof) => {
        if (done) return;
        done = true;
        onDone(prof);
      };
      try {
        setGenStatus("Calculando tu metabolismo basal...");
        await new Promise(r => setTimeout(r, 600));
        setGenStatus("Analizando tu perfil completo...");
        const profileStr = Object.entries(newAnswers).map(([k,v])=>`${k}: ${v}`).join(", ");
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST",
          headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
          body: JSON.stringify({
            model:"claude-haiku-4-5-20251001", max_tokens:600,
            system:`Eres nutricionista experto. Calcula objetivos nutricionales diarios con la fórmula Mifflin-St Jeor. Responde SOLO con JSON en una línea sin backticks ni markdown.
Formato exacto: {"calorias":número,"proteinas":número,"carbohidratos":número,"grasas":número,"tmb":número,"tdee":número,"pasosObjetivo":número,"caloriasQuemar":número,"resumen":"frase motivadora corta","consejo":"consejo nutricional específico"}`,
            messages:[{ role:"user", content:`Perfil: ${profileStr}. Calcula TMB (Mifflin-St Jeor), TDEE (factor actividad), calorías objetivo (ajustado por meta y ritmo), macros, pasos y kcal a quemar. Todos los valores deben ser números enteros.` }]
          })
        });
        setGenStatus("Generando tu plan personalizado...");
        const data = await res.json();
        const text = data.content?.find(b=>b.type==="text")?.text || "{}";
        let parsed = {};
        try {
          const clean = text.replace(/```json|```/g,"").trim();
          const match = clean.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(match ? match[0] : clean);
        } catch {}
        const fb = calcFallback(newAnswers);
        const finalProfile = {
          ...newAnswers,
          calorias:      parseInt(parsed.calorias)      || fb.calorias,
          proteinas:     parseInt(parsed.proteinas)     || fb.proteinas,
          carbohidratos: parseInt(parsed.carbohidratos) || fb.carbohidratos,
          grasas:        parseInt(parsed.grasas)        || fb.grasas,
          tmb:           parseInt(parsed.tmb)           || fb.tmb,
          tdee:          parseInt(parsed.tdee)          || fb.tdee,
          pasosObjetivo: parseInt(parsed.pasosObjetivo) || 8000,
          caloriasQuemar:parseInt(parsed.caloriasQuemar)|| 300,
          resumen:       parsed.resumen  || "¡Tu plan está listo, a por ello!",
          consejo:       parsed.consejo  || "La constancia es la clave del éxito.",
        };
        finish(finalProfile);
      } catch(e) {
        const fb = calcFallback(newAnswers);
        finish({ ...newAnswers, ...fb, resumen:"¡Tu plan está listo!", consejo:"La constancia es la clave." });
      }
    } else {
      setStep(p => p + 1);
    }
  };

  const calcFallback = (ans) => {
    const peso = parseFloat(ans.peso)||75, altura = parseFloat(ans.altura)||175, edad = parseFloat(ans.edad)||25;
    const isMale = (ans.sexo||"Hombre").toLowerCase().includes("hombre");
    const tmb = isMale ? 10*peso + 6.25*altura - 5*edad + 5 : 10*peso + 6.25*altura - 5*edad - 161;
    const actMult = (ans.actividad||"").includes("Sedent") ? 1.2 : (ans.actividad||"").includes("Algo") ? 1.375 : (ans.actividad||"").includes("Moderado") ? 1.55 : (ans.actividad||"").includes("Muy") ? 1.725 : 1.9;
    const tdee = Math.round(tmb * actMult);
    const obj = ans.objetivo||"";
    const cals = obj.includes("Perder") ? tdee - 400 : obj.includes("Ganar") ? tdee + 300 : tdee;
    return { calorias:Math.round(cals), proteinas:Math.round(cals*0.30/4), carbohidratos:Math.round(cals*0.40/4), grasas:Math.round(cals*0.30/9), tmb:Math.round(tmb), tdee, pasosObjetivo:8000, caloriasQuemar:300 };
  };

  const toggleMulti = (opt) => {
    if (opt === "Ninguna") { setMultiSel(["Ninguna"]); return; }
    setMultiSel(p => {
      const without = p.filter(x => x !== "Ninguna");
      return without.includes(opt) ? without.filter(x=>x!==opt) : [...without, opt];
    });
  };

  if (generating) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"-apple-system,sans-serif" }}>
      <img src="/icon-512.png" alt="" style={{ width:80, height:80, borderRadius:20, marginBottom:24, animation:"splashLogo 0.8s ease forwards" }} />
      <div style={{ fontSize:18, fontWeight:900, marginBottom:8, textAlign:"center" }}>Creando tu plan personalizado</div>
      <div style={{ fontSize:13, color:C.greenNeon, marginBottom:32, textAlign:"center" }}>{genStatus}</div>
      <div style={{ width:240, background:C.surface2, borderRadius:6, height:6, overflow:"hidden" }}>
        <div style={{ height:"100%", width:"60%", background:C.greenNeon, borderRadius:6, animation:"shimmerBar 1.2s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes splashLogo{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"-apple-system,'SF Pro Display',sans-serif", color:C.text, maxWidth:430, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ padding:"24px 24px 0", position:"sticky", top:0, background:C.bg, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <img src="/icon-512.png" alt="" style={{ width:28, height:28, borderRadius:8 }} />
          <span style={{ fontSize:12, color:C.text3, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase" }}>NutriLens IA — Setup</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ fontSize:12, color:C.text3 }}>{step+1} / {OB_STEPS.length}</span>
          <span style={{ fontSize:12, color:C.greenNeon, fontWeight:700 }}>{Math.round(progress)}%</span>
        </div>
        <div style={{ background:C.surface2, borderRadius:6, height:6, overflow:"hidden", marginBottom:4 }}>
          <div style={{ width:`${progress}%`, height:"100%", background:`linear-gradient(90deg,${C.greenNeon}88,${C.greenNeon})`, borderRadius:6, transition:"width 0.5s ease" }} />
        </div>
      </div>

      {/* Question */}
      <div style={{ padding:"24px 24px 120px" }}>
        <div style={{ fontSize:44, marginBottom:12 }}>{s.emoji}</div>
        <div style={{ fontSize:22, fontWeight:900, marginBottom:6, lineHeight:1.2 }}>{s.q}</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:24, lineHeight:1.4 }}>{s.hint}</div>

        {s.type === "text" && (
          <input value={customVal || answers[s.id] || ""}
            onChange={e => { setCustomVal(e.target.value); setAnswers(p=>({...p,[s.id]:e.target.value})); }}
            onKeyDown={e => e.key==="Enter" && goNext()}
            placeholder={s.placeholder}
            style={{ ...S.inp, fontSize:18, padding:"14px 16px", borderColor:C.border }} autoFocus />
        )}

        {s.type === "number" && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <input type="number" value={numVal} onChange={e=>setNumVal(e.target.value)}
              onKeyDown={e => e.key==="Enter" && goNext()}
              placeholder={s.placeholder}
              style={{ ...S.inp, fontSize:24, fontWeight:900, textAlign:"center", flex:1, color:C.greenNeon, borderColor:C.border }} autoFocus />
            <span style={{ fontSize:16, color:C.text3, fontWeight:600, flexShrink:0 }}>{s.unit}</span>
          </div>
        )}

        {s.type === "single" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {s.opts.map(opt => {
              const sel = answers[s.id]===opt && !customVal;
              return (
                <button key={opt} onClick={()=>{ setAnswers(p=>({...p,[s.id]:opt})); setCustomVal(""); }}
                  style={{ padding:"14px 16px", borderRadius:14, border:`1.5px solid ${sel?C.greenNeon:C.border}`, background:sel?`${C.greenNeon}18`:C.surface, color:sel?C.greenNeon:C.text2, fontWeight:sel?700:500, fontSize:14, cursor:"pointer", textAlign:"left", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span>{opt}</span>
                  {sel && <span style={{ fontSize:16 }}>✓</span>}
                </button>
              );
            })}
            <input value={customVal} onChange={e=>{setCustomVal(e.target.value);setAnswers(p=>({...p,[s.id]:""}));}}
              placeholder="Otra opción (escribe aquí)..."
              style={{ ...S.inp, border:`1.5px solid ${customVal?C.greenNeon:C.border}`, marginTop:4 }} />
          </div>
        )}

        {s.type === "multi" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {s.opts.map(opt => {
              const sel = multiSel.includes(opt);
              return (
                <button key={opt} onClick={()=>toggleMulti(opt)}
                  style={{ padding:"13px 16px", borderRadius:14, border:`1.5px solid ${sel?C.greenNeon:C.border}`, background:sel?`${C.greenNeon}18`:C.surface, color:sel?C.greenNeon:C.text2, fontWeight:sel?700:500, fontSize:14, cursor:"pointer", textAlign:"left", transition:"all 0.15s", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${sel?C.greenNeon:C.border}`, background:sel?C.greenNeon:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:12, color:"#000" }}>
                    {sel && "✓"}
                  </div>
                  {opt}
                </button>
              );
            })}
            <input value={customVal} onChange={e=>setCustomVal(e.target.value)}
              placeholder="Otro (escribe aquí)..."
              style={{ ...S.inp, border:`1.5px solid ${customVal?C.greenNeon:C.border}`, marginTop:4 }} />
          </div>
        )}
      </div>

      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, padding:"12px 24px 28px", background:"rgba(10,10,11,0.95)", backdropFilter:"blur(16px)", borderTop:`1px solid ${C.border}`, display:"flex", gap:10 }}>
        {step > 0 && (
          <button onClick={()=>{ setStep(p=>p-1); setCustomVal(""); setNumVal(""); setMultiSel([]); }}
            style={{ flex:1, padding:"14px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, color:C.text2, fontWeight:700, fontSize:15, cursor:"pointer" }}>
            ← Atrás
          </button>
        )}
        <button onClick={goNext} disabled={!canNext()}
          style={{ flex:2, padding:"15px", background:canNext()?C.greenNeon:C.surface2, border:"none", borderRadius:14, color:canNext()?"#000":C.text3, fontWeight:900, fontSize:15, cursor:canNext()?"pointer":"default", transition:"all 0.2s" }}>
          {isLast ? "🚀 Crear mi plan" : "Siguiente →"}
        </button>
      </div>
    </div>
  );
}

// ── AI Coach Panel ─────────────────────────────────────────────
function AICoachPanel({ onClose, apiKey, profile, goals, history, meals, setGoals }) {
  const STORAGE_KEY = "nl-coach-history";
  const initMsg = `¡Hola${profile?.nombre ? ` ${profile.nombre}` : ""}! 👋 Soy tu coach nutricional. Llevas ${meals.reduce((s,m)=>s+m.totalCalorias,0)} de ${goals.calorias} kcal hoy. ¿En qué te ayudo?`;
  const [messages, setMessages] = useState(() => ls.get(STORAGE_KEY) || [{ role:"assistant", text:initMsg }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const CHIPS = ["¿Cómo voy hoy?","¿Qué puedo cenar?","Baja mis calorías a 1800","Dame un snack proteico"];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  useEffect(() => { ls.set(STORAGE_KEY, messages.slice(-30)); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(p => [...p, { role:"user", text:userMsg }]);
    setLoading(true);
    try {
      const ctx = buildCtx(profile, goals, meals, history);
      const histStr = messages.slice(-8).map(m => `${m.role==="user"?"Usuario":"Coach"}: ${m.text}`).join("\n");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:400,
          system:`Eres NutriCoach, coach nutricional personal. Conoces TODO sobre el usuario:\n${ctx}\nResponde en español, directo y motivador, máx 3-4 frases. Si el usuario pide cambiar sus calorías o macros, responde CON los nuevos valores al final así: [ACTUALIZAR:{"calorias":N,"proteinas":N,"carbohidratos":N,"grasas":N}]. Si no hay cambio, no incluyas JSON.`,
          messages:[{ role:"user", content:`${histStr}\nUsuario: ${userMsg}` }]
        })
      });
      const data = await res.json();
      let text = data.content?.find(b=>b.type==="text")?.text || "No pude responder, inténtalo de nuevo.";
      const updateMatch = text.match(/\[ACTUALIZAR:(\{[\s\S]*?\})\]/);
      if (updateMatch) {
        try { const ng = JSON.parse(updateMatch[1]); if(ng.calorias && setGoals){ setGoals(g=>({...g,...ng})); ls.set("nl-goals",{...goals,...ng}); } } catch {}
        text = text.replace(/\[ACTUALIZAR:[\s\S]*?\]/, "✅ ¡Plan actualizado!").trim();
      }
      setMessages(p => [...p, { role:"assistant", text }]);
    } catch {
      setMessages(p => [...p, { role:"assistant", text:"Lo siento, no pude procesar tu mensaje. Inténtalo de nuevo." }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:300, display:"flex", flexDirection:"column", fontFamily:"-apple-system,sans-serif" }}>
      <div style={{ padding:"20px 20px 12px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:C.bg }}>
        <div>
          <div style={{ fontSize:11, color:C.greenNeon, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5 }}>NutriCoach IA</div>
          <div style={{ fontSize:18, fontWeight:900 }}>Tu coach personal</div>
        </div>
        <button onClick={onClose} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:10, color:C.text2, fontSize:18, cursor:"pointer", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:"flex", justifyContent: m.role==="user" ? "flex-end" : "flex-start" }}>
            {m.role==="assistant" && <div style={{ width:32, height:32, borderRadius:10, background:C.greenNeon+"22", border:`1px solid ${C.greenNeon}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0, marginRight:10, alignSelf:"flex-end" }}>🤖</div>}
            <div style={{
              maxWidth:"80%", padding:"12px 14px", borderRadius: m.role==="user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role==="user" ? C.greenNeon : C.surface,
              color: m.role==="user" ? "#000" : C.text,
              border: m.role==="user" ? "none" : `1px solid ${C.border}`,
              fontSize:14, lineHeight:1.5, fontWeight: m.role==="user" ? 600 : 400
            }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:C.greenNeon+"22", border:`1px solid ${C.greenNeon}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🤖</div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"18px 18px 18px 4px", padding:"12px 16px" }}>
              <div style={{ display:"flex", gap:4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:C.text3, animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding:"6px 16px", display:"flex", gap:8, overflowX:"auto" }}>
        {CHIPS.map(chip=>(
          <button key={chip} onClick={()=>{ if(!loading){setMessages(p=>[...p,{role:"user",text:chip}]);setLoading(true);fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:300,system:`NutriCoach. ${buildCtx(profile,goals,meals,history)}. Responde directo y motivador, máx 3 frases.`,messages:[{role:"user",content:chip}]})}).then(r=>r.json()).then(d=>{setMessages(p=>[...p,{role:"assistant",text:d.content?.find(b=>b.type==="text")?.text||"..."}]);}).catch(()=>{}).finally(()=>setLoading(false));} }}
            style={{ padding:"6px 12px", background:C.surface2, border:`1px solid ${C.border}`, borderRadius:100, color:C.text2, fontWeight:600, fontSize:12, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
            {chip}
          </button>
        ))}
      </div>
      <div style={{ padding:"10px 16px 24px", borderTop:`1px solid ${C.border}`, background:C.bg, display:"flex", gap:10 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Pregunta a tu coach..."
          onKeyDown={e=>e.key==="Enter"&&send()}
          style={{ ...S.inp, flex:1 }} />
        <button onClick={send} disabled={loading||!input.trim()}
          style={{ width:44, height:44, borderRadius:12, background:loading||!input.trim()?C.surface2:C.greenNeon, border:"none", cursor:loading||!input.trim()?"default":"pointer", color:loading||!input.trim()?C.text3:"#000", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ── Weekly Plan Panel ──────────────────────────────────────────
function WeeklyPlanPanel({ onClose, apiKey, profile, goals }) {
  const [plan, setPlan] = useState(() => ls.get("nl-weekly-plan") || null);
  const [generating, setGenerating] = useState(false);
  const [dayIdx, setDayIdx] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  const WEEK_DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await callClaude(apiKey,
        `Eres nutricionista experto. Crea un menú semanal completo y variado.
Responde SOLO con JSON en una línea sin backticks.
Formato: {"dias":[{"dia":"Lunes","desayuno":{"nombre":"nombre","calorias":número,"descripcion":"ingredientes breves"},"almuerzo":{"nombre":"nombre","calorias":número,"descripcion":"ingredientes breves"},"comida":{"nombre":"nombre","calorias":número,"descripcion":"ingredientes breves"},"merienda":{"nombre":"nombre","calorias":número,"descripcion":"ingredientes breves"},"cena":{"nombre":"nombre","calorias":número,"descripcion":"ingredientes breves"},"totalCalorias":número},...]} (7 días)`,
        [{ type:"text", text:`Objetivo del usuario: ${profile?.objetivo||"salud general"}. Dieta: ${profile?.dieta||"sin restricciones"}. Restricciones: ${profile?.restricciones||"ninguna"}. Calorías diarias objetivo: ${goals.calorias} kcal. Proteínas: ${goals.proteinas}g, Carbos: ${goals.carbohidratos}g, Grasas: ${goals.grasas}g. Crea un menú variado, equilibrado y apetecible para 7 días.` }], 2000);
      if (result.dias) { ls.set("nl-weekly-plan", result); setPlan(result); }
    } catch {}
    finally { setGenerating(false); }
  };

  const day = plan?.dias?.[dayIdx];
  const MEALS_ORDER = [["desayuno","☀️","Desayuno"],["almuerzo","🌤️","Almuerzo"],["comida","🌞","Comida"],["merienda","🌥️","Merienda"],["cena","🌙","Cena"]];

  return (
    <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:300, overflowY:"auto", fontFamily:"-apple-system,sans-serif" }}>
      <div style={{ maxWidth:430, margin:"0 auto", padding:"24px 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:11, color:C.greenNeon, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>Personalizado por IA</div>
            <div style={{ fontSize:20, fontWeight:900 }}>Menú semanal</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={generate} disabled={generating} style={{ padding:"8px 14px", background:C.greenNeon+"22", border:`1px solid ${C.greenNeon}44`, borderRadius:10, color:C.greenNeon, fontWeight:700, fontSize:12, cursor:generating?"default":"pointer" }}>
              {generating?"⏳":"🔄"} {generating?"Generando...":"Regenerar"}
            </button>
            <button onClick={onClose} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:10, color:C.text2, fontSize:18, cursor:"pointer", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
        </div>

        {!plan ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:56, marginBottom:16 }}>🍽️</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Sin menú generado</div>
            <div style={{ fontSize:13, color:C.text2, marginBottom:24, lineHeight:1.6 }}>La IA creará un menú semanal completamente personalizado a tus objetivos y preferencias.</div>
            <button onClick={generate} disabled={generating} style={{ padding:"15px 32px", background:C.greenNeon, border:"none", borderRadius:14, color:"#000", fontWeight:900, fontSize:15, cursor:"pointer" }}>
              {generating?"⏳ Generando tu menú...":"✨ Generar menú personalizado"}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", gap:6, marginBottom:20, overflowX:"auto", paddingBottom:4 }}>
              {WEEK_DAYS.map((d, i) => (
                <button key={d} onClick={()=>setDayIdx(i)}
                  style={{ padding:"8px 12px", borderRadius:12, border:`1px solid ${dayIdx===i?C.greenNeon:C.border}`, background:dayIdx===i?`${C.greenNeon}22`:C.surface, color:dayIdx===i?C.greenNeon:C.text3, fontWeight:dayIdx===i?800:500, fontSize:12, cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" }}>
                  {d.slice(0,3)}
                </button>
              ))}
            </div>

            {day && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontSize:18, fontWeight:900 }}>{WEEK_DAYS[dayIdx]}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.greenNeon }}>{day.totalCalorias} kcal</div>
                </div>
                {MEALS_ORDER.map(([key, emoji, label]) => {
                  const m = day[key];
                  if (!m) return null;
                  const accent = C.slotColors[label] || C.blue;
                  return (
                    <div key={key} style={{ ...S.card, borderLeft:`3px solid ${accent}`, marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:10, color:accent, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{emoji} {label}</div>
                          <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>{m.nombre}</div>
                          <div style={{ fontSize:12, color:C.text2, lineHeight:1.4 }}>{m.descripcion}</div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                          <div style={{ fontSize:16, fontWeight:900, color:C.text }}>{m.calorias}</div>
                          <div style={{ fontSize:9, color:C.text3 }}>kcal</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ── Build AI Context ──────────────────────────────────────────
const buildCtx = (profile, goals, meals, history) => {
  const t = meals.reduce((a,m)=>({cal:a.cal+m.totalCalorias,p:a.p+(m.totalProteinas||0),c:a.c+(m.totalCarbohidratos||0),g:a.g+(m.totalGrasas||0)}),{cal:0,p:0,c:0,g:0});
  const wk = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return(history[localDateStr(d)]?.meals||[]).reduce((s,m)=>s+m.totalCalorias,0);}).reduce((a,b)=>a+b,0);
  return `PERFIL: ${["nombre","objetivo","dieta","restricciones","actividad","deportes","peso","altura","edad","sueno","estres"].map(k=>profile?.[k]?`${k}=${profile[k]}`:"").filter(Boolean).join(", ")}. TMB=${profile?.tmb||0} TDEE=${profile?.tdee||0}.
OBJETIVOS: ${goals.calorias}kcal P${goals.proteinas}g C${goals.carbohidratos}g G${goals.grasas}g.
HOY: ${Math.round(t.cal)}kcal (${Math.round(t.cal/goals.calorias*100)}%) P${Math.round(t.p)}g C${Math.round(t.c)}g G${Math.round(t.g)}g. Comidas: ${meals.length>0?meals.map(m=>`${m.slot}:${m.descripcion}(${m.totalCalorias}kcal)`).join("; "):"ninguna"}.
SEMANA: ${Math.round(wk)}kcal de ${goals.calorias*7}.`;
};

// ── Toast Notifications ───────────────────────────────────────
function Toast({ msg, type="success", onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone, 2500); return()=>clearTimeout(t); },[]);
  const col = type==="error"?C.red:type==="warning"?C.amber:C.greenNeon;
  return (
    <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:600, animation:"toastIn 0.35s cubic-bezier(.34,1.56,.64,1) forwards", pointerEvents:"none" }}>
      <div style={{ background:C.surface, border:`1px solid ${col}44`, borderRadius:14, padding:"11px 18px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:col, flexShrink:0 }}/>
        <span style={{ fontSize:14, fontWeight:600, color:C.text, whiteSpace:"nowrap" }}>{msg}</span>
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────
function ConfirmDialog({ msg, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:700, display:"flex", alignItems:"flex-end", justifyContent:"center", paddingBottom:24 }}>
      <div style={{ background:C.surface, borderRadius:"20px 20px 0 0", padding:"22px 20px", width:"100%", maxWidth:430, animation:"slideUp 0.3s ease" }}>
        <div style={{ fontSize:15, color:C.text2, textAlign:"center", marginBottom:18, lineHeight:1.5 }}>{msg}</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:"13px", background:C.surface2, border:`1px solid ${C.border}`, borderRadius:14, color:C.text2, fontWeight:700, fontSize:15, cursor:"pointer" }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex:1, padding:"13px", background:C.red, border:"none", borderRadius:14, color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer" }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

function AnimatedNumber({ value, duration = 600, style }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * ease));
      if (t < 1) requestAnimationFrame(step);
      else prevRef.current = to;
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span style={style}>{display}</span>;
}

// ── Premium Macro Card ─────────────────────────────────────────
function PremiumMacroCard({ label, value, goal, color, bgUrl, unit="g" }) {
  const pct = Math.min((value / goal) * 100, 100);
  return (
    <div style={{ position:"relative", borderRadius:16, overflow:"hidden", border:`1px solid ${C.border}`, padding:12, display:"flex", flexDirection:"column", justifyContent:"space-between", height:110, flex:1 }}>
       <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bgUrl})`, backgroundSize:"cover", backgroundPosition:"center" }} />
       <div style={{ position:"absolute", inset:0, background:`linear-gradient(to right, rgba(18,18,20,0.95) 30%, rgba(18,18,20,0.6) 100%)` }} />

       <div style={{ position:"relative", zIndex:10 }}>
          <div style={{ fontSize:10, fontWeight:800, color:color, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:2, marginTop:2 }}>
            <span style={{ fontSize:22, fontWeight:900, color:C.text }}>{Math.round(value)}</span>
            <span style={{ fontSize:12, color:C.text2 }}>{unit}</span>
          </div>
          <div style={{ fontSize:10, color:C.text3, marginTop:2 }}>Objetivo {goal}{unit}</div>
       </div>

       <div style={{ position:"relative", zIndex:10, display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
          <div style={{ flex:1, height:4, background:"rgba(255,255,255,0.1)", borderRadius:2, overflow:"hidden" }}>
             <div style={{ width:`${pct}%`, height:"100%", background:color, boxShadow:`0 0 8px ${color}` }} />
          </div>
          <span style={{ fontSize:10, color:C.text2, fontWeight:600 }}>{Math.round(pct)}%</span>
       </div>
    </div>
  );
}

// ── Timeline Meal Card ────────────────────────────────────────
function MealCard({ meal, onDelete, onUpdate, apiKey, slots, profile, goals, isLast }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const accent = slotColor(meal.slot);
  const timeStr = meal.id ? new Date(meal.id).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) : "";

  const correct = async () => {
    if (!chatMsg.trim()) return;
    setCorrecting(true);
    try {
      const ctx = profile && goals ? buildCtx(profile, goals, [meal], {}) : "";
      const result = await callClaude(apiKey,
        `Nutricionista experto. Corrige la comida según la instrucción del usuario. ${ctx}
REGLAS ESTRICTAS:
1. Ajusta los gramos y macros proporcionalmente al cambio solicitado.
2. La 'descripcion' DEBE SER SOLO EL NOMBRE DEL PLATO, ULTRA CORTO (máximo 4 palabras). NUNCA des explicaciones en la descripción.
3. Los detalles van en la lista de "platos" con sus gramos (ej: "Avena (40g)").
SOLO JSON en una línea sin backticks.
Formato: {"platos":[{"nombre":"ingrediente modificado (Xg)","calorias":N,"proteinas":N,"carbohidratos":N,"grasas":N}],"totalCalorias":N,"totalProteinas":N,"totalCarbohidratos":N,"totalGrasas":N,"descripcion":"plato ultra corto"}`,
        [{ type:"text", text:`Comida actual: ${meal.descripcion}. Ingredientes: ${(meal.platos||[]).map(p=>`${p.nombre}(${p.calorias}kcal)`).join(", ")}. Instrucción del usuario para corregir: ${chatMsg.trim()}` }], 800);
      if (!result.error && result.platos) {
        onUpdate({ ...meal, ...result, totalCalorias: result.totalCalorias||0, totalProteinas: result.totalProteinas||0, totalCarbohidratos: result.totalCarbohidratos||0, totalGrasas: result.totalGrasas||0 });
        setChatOpen(false);
        setChatMsg("");
      }
    } catch {}
    finally { setCorrecting(false); }
  };

  return (
    <div style={{ display:"flex", gap:16, position:"relative", paddingBottom:isLast ? 0 : 20 }}>
       {!isLast && <div style={{ position:"absolute", left:43, top:26, bottom:0, width:1, background:C.border }} />}

       <div style={{ width:36, fontSize:11, color:C.text3, fontWeight:600, paddingTop:8, textAlign:"right" }}>{timeStr}</div>

       <div style={{ position:"relative", zIndex:2, width:10, height:10, borderRadius:"50%", background:accent, border:`2px solid ${C.surface}`, marginTop:10, boxShadow:`0 0 8px ${accent}` }} />

       <div style={{ flex:1, background:"#121214", borderRadius:16, border:`1px solid ${C.border}`, padding:14 }}>
          {meal.thumbnail && <img src={meal.thumbnail} alt="" style={{ width:"100%", maxHeight:140, objectFit:"cover", borderRadius:12, marginBottom:12, display:"block" }} />}

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={() => onUpdate && setSlotOpen(p=>!p)}
                style={{ fontSize:12, color:accent, fontWeight:700, background:"none", border:"none", cursor:onUpdate?"pointer":"default", padding:0 }}>
                {meal.slotEmoji} {meal.slot}
              </button>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {onUpdate && <button onClick={() => { setChatOpen(p=>!p); setChatMsg(""); }} style={{ background:chatOpen?`${C.blue}22`:"none", border:chatOpen?`1px solid ${C.blue}44`:"none", borderRadius:8, padding:"2px 8px", cursor:"pointer", color:chatOpen?C.blue:C.text3, fontSize:12, fontWeight:600 }}>✏️ corregir</button>}
              {onDelete && <button onClick={onDelete} style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, fontSize:18, lineHeight:1 }}>×</button>}
            </div>
          </div>

          {slotOpen && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
              {(slots||[]).map(sl => (
                <button key={sl.id} onClick={() => { onUpdate({ ...meal, slot:sl.label, slotEmoji:sl.emoji }); setSlotOpen(false); }}
                  style={{ padding:"5px 12px", borderRadius:100, border:"none", cursor:"pointer", background: meal.slot===sl.label ? C.text : C.surface2, color: meal.slot===sl.label ? C.bg : C.text2, fontSize:12, fontWeight:700 }}>
                  {sl.emoji} {sl.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ fontSize:15, color:C.text, marginBottom:8, lineHeight:1.4, fontWeight:600 }}>{meal.descripcion}</div>
          {meal.consejoPerfil && <div style={{ fontSize:12, color:C.greenNeon, marginBottom:8, lineHeight:1.4 }}>💡 {meal.consejoPerfil}</div>}

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", gap:6 }}>
              {[["P",meal.totalProteinas||0,C.blue],["C",meal.totalCarbohidratos||0,C.amber],["G",meal.totalGrasas||0,C.pink]].map(([l,v,col]) => (
                <div key={l} style={{ padding:"4px 10px", background:C.surface2, borderRadius:8, textAlign:"center" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:col }}>{Math.round(v)}g</div>
                  <div style={{ fontSize:9, color:C.text3 }}>{l}</div>
                </div>
              ))}
            </div>
            <div><span style={{ fontSize:18, fontWeight:900 }}>{meal.totalCalorias}</span><span style={{ fontSize:11, color:C.text3, marginLeft:3 }}>kcal</span></div>
          </div>

          {meal.platos?.length > 0 && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
              {meal.platos.map((p,i) => (
                <div key={i} style={{ fontSize:12, display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ color:C.text2 }}>{p.nombre}</span><span style={{ color:C.text, fontWeight:700, fontSize:13 }}>{p.calorias} kcal</span>
                </div>
              ))}
            </div>
          )}

          {chatOpen && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
              <div style={{ fontSize:11, color:C.text3, marginBottom:8 }}>Dile a la IA qué corregir — cantidad, ingrediente...</div>
              <textarea
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                placeholder="Ej: eran tostaditas pequeñas de espelta, solo 3"
                style={{ ...S.inp, resize:"none", minHeight:72, lineHeight:1.5, fontSize:13, marginBottom:8 }}
                onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); correct(); } }}
              />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { setChatOpen(false); setChatMsg(""); }}
                  style={{ flex:1, padding:"10px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, color:C.text2, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  Cancelar
                </button>
                <button onClick={correct} disabled={correcting || !chatMsg.trim()}
                  style={{ flex:2, padding:"10px", background: correcting||!chatMsg.trim() ? C.surface2 : C.text, border:"none", borderRadius:10, color: correcting||!chatMsg.trim() ? C.text3 : C.bg, fontWeight:800, fontSize:13, cursor: correcting||!chatMsg.trim() ? "default" : "pointer" }}>
                  {correcting ? "⏳ Corrigiendo..." : "✓ Corregir"}
                </button>
              </div>
            </div>
          )}
       </div>
    </div>
  );
}

function RecGroup({ grupo }) {
  return (
    <div style={{ marginBottom:20 }}>
      <span style={S.label}>{grupo.comida}</span>
      {(grupo.opciones||[]).map((op,i) => (
        <div key={i} style={{ ...S.card, display:"flex", alignItems:"flex-start", gap:14, marginBottom:8 }}>
          <div style={{ fontSize:30, width:40, textAlign:"center", flexShrink:0, marginTop:2 }}>{op.emoji||"🍽️"}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>{op.sugerencia}</div>
            {op.cantidad && <div style={{ fontSize:12, color:C.text3, lineHeight:1.4 }}>{op.cantidad}</div>}
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:18, fontWeight:900, color:C.greenNeon }}>{op.calorias}</div>
            <div style={{ fontSize:10, color:C.text3 }}>kcal</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalView({ history, goals, onSelect, selected }) {
  const [cal, setCal] = useState(new Date());
  const yr = cal.getFullYear(), mo = cal.getMonth();
  const first = new Date(yr, mo, 1).getDay();
  const offset = first === 0 ? 6 : first - 1;
  const days = new Date(yr, mo+1, 0).getDate();
  const todStr = today();
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <button onClick={() => setCal(new Date(yr,mo-1,1))} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, width:36, height:36, cursor:"pointer", color:C.text, fontSize:16 }}>‹</button>
        <span style={{ fontWeight:700, fontSize:15 }}>{MONTHS[mo]} {yr}</span>
        <button onClick={() => setCal(new Date(yr,mo+1,1))} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, width:36, height:36, cursor:"pointer", color:C.text, fontSize:16 }}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:6 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign:"center", fontSize:10, color:C.text3, fontWeight:600 }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
        {Array(offset).fill(null).map((_,i) => <div key={`e${i}`} />)}
        {Array(days).fill(null).map((_,i) => {
          const d = i+1;
          const ds = `${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const dd = history[ds];
          const isT = ds===todStr, isSel = ds===selected;
          const pct = dd ? Math.min(dd.meals.reduce((s,m)=>s+m.totalCalorias,0)/goals.calorias, 1) : 0;
          const barColor = dd ? (pct>0.95?C.greenNeon:pct>0.6?C.amber:pct>0.3?C.orange:C.text3) : null;
          return (
            <button key={ds} onClick={() => dd && onSelect(isSel?null:ds)}
              style={{ borderRadius:10, border:isSel?`2px solid ${C.blue}`:isT?`2px solid ${C.text3}`:`1px solid ${C.border}`, background:isSel?`${C.blue}15`:C.surface, cursor:dd?"pointer":"default", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", padding:"4px 3px 3px", aspectRatio:"1", overflow:"hidden", position:"relative" }}>
              {dd && pct > 0 && (
                <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct*100}%`, maxHeight:"60%", background:`${barColor}33`, borderRadius:"0 0 8px 8px" }} />
              )}
              <span style={{ fontSize:11, fontWeight:isT?900:500, color:isT?C.text:C.text2, position:"relative", zIndex:1 }}>{d}</span>
              {dd && <div style={{ width:4, height:4, borderRadius:"50%", background:barColor, position:"relative", zIndex:1 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Settings({ goals, setGoals, slots, setSlots, profile, onClose, onResetKey, onResetProfile }) {
  const [lg, setLg] = useState({...goals});
  const [lm, setLm] = useState(slots.map(m=>({...m})));
  const [newLbl, setNewLbl] = useState("");
  const [newEmoji, setNewEmoji] = useState("🍽️");
  const [picker, setPicker] = useState(null);

  const save = () => { setGoals(lg); setSlots(lm); onClose(); };
  const add = () => {
    if (!newLbl.trim()) return;
    setLm(p => [...p, { id:Date.now().toString(), label:newLbl.trim(), emoji:newEmoji }]);
    setNewLbl(""); setNewEmoji("🍽️");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:200, overflowY:"auto", padding:"24px 20px" }}>
      <div style={{ maxWidth:430, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
          <div style={{ fontSize:20, fontWeight:900 }}>Personalizar</div>
          <button onClick={onClose} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:10, color:C.text2, fontSize:18, cursor:"pointer", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        {profile && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ fontSize:11, color:C.text3, fontWeight:600, marginBottom:10 }}>TU PERFIL</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {[["TMB",`${profile.tmb||0}kcal`,C.blue],["TDEE",`${profile.tdee||0}kcal`,C.amber],["Peso",`${profile.peso||"–"}kg`,C.greenNeon],["Altura",`${profile.altura||"–"}cm`,C.pink]].map(([k,v,col])=>(
                <div key={k} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:10, color:C.text3 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:col, marginTop:2 }}>{v}</div>
                </div>
              ))}
            </div>
            {profile.consejo && <div style={{ fontSize:12, color:C.text2, lineHeight:1.4, marginTop:10 }}>💡 {profile.consejo}</div>}
          </div>
        )}
        <span style={S.label}>Objetivo diario</span>
        <div style={{ ...S.card, marginBottom:8 }}>
          {[["calorias","Calorías","kcal",C.orange],["proteinas","Proteínas","g",C.blue],["carbohidratos","Carbohidratos","g",C.amber],["grasas","Grasas","g",C.pink]].map(([key,label,unit,color],i,arr) => (
            <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:i<arr.length-1?14:0, marginBottom:i<arr.length-1?14:0, borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none" }}>
              <span style={{ fontSize:14, color:C.text2 }}>{label}</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <input type="number" value={lg[key]} onChange={e => {
                  const val = parseInt(e.target.value)||0;
                  if (key === "calorias") {
                    setLg(p => ({
                      ...p,
                      calorias: val,
                      proteinas: Math.round(val * 0.30 / 4),
                      carbohidratos: Math.round(val * 0.40 / 4),
                      grasas: Math.round(val * 0.30 / 9),
                    }));
                  } else {
                    setLg(p => ({...p, [key]: val}));
                  }
                }}
                  style={{ width:80, background:C.surface2, border:`1px solid ${color}44`, borderRadius:8, padding:"7px 10px", color, fontSize:15, fontWeight:700, outline:"none", textAlign:"right" }} />
                <span style={{ fontSize:12, color:C.text3, width:24 }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <span style={S.label}>Comidas del día</span>
        <div style={{ ...S.card, marginBottom:24 }}>
          {lm.map((m,i) => (
            <div key={m.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, position:"relative" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
                <button onClick={() => { if(i===0)return; const a=[...lm]; [a[i-1],a[i]]=[a[i],a[i-1]]; setLm(a); }}
                  style={{ background:"none", border:"none", cursor:i===0?"default":"pointer", color:i===0?C.text3:C.text2, fontSize:12, padding:"1px 4px" }}>▲</button>
                <button onClick={() => { if(i===lm.length-1)return; const a=[...lm]; [a[i+1],a[i]]=[a[i],a[i+1]]; setLm(a); }}
                  style={{ background:"none", border:"none", cursor:i===lm.length-1?"default":"pointer", color:i===lm.length-1?C.text3:C.text2, fontSize:12, padding:"1px 4px" }}>▼</button>
              </div>
              <button onClick={() => setPicker(picker===i?null:i)} style={{ fontSize:18, background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, width:38, height:38, cursor:"pointer", flexShrink:0 }}>{m.emoji}</button>
              {picker===i && (
                <div style={{ position:"absolute", top:44, left:0, background:C.surface, border:`1px solid ${C.border2}`, borderRadius:12, padding:10, display:"flex", flexWrap:"wrap", gap:4, width:220, zIndex:10, boxShadow:"0 8px 32px #000c" }}>
                  {EMOJIS.map(e => <button key={e} onClick={() => { setLm(p=>p.map((x,j)=>j===i?{...x,emoji:e}:x)); setPicker(null); }} style={{ fontSize:18, background:"none", border:"none", cursor:"pointer", padding:3 }}>{e}</button>)}
                </div>
              )}
              <input value={m.label} onChange={e=>setLm(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))} style={{ ...S.inp, flex:1 }} />
              <button onClick={() => setLm(p=>p.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, fontSize:18 }}>×</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}`, position:"relative" }}>
            <button onClick={() => setPicker(picker==="new"?null:"new")} style={{ fontSize:18, background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, width:38, height:38, cursor:"pointer", flexShrink:0 }}>{newEmoji}</button>
            {picker==="new" && (
              <div style={{ position:"absolute", bottom:44, left:0, background:C.surface, border:`1px solid ${C.border2}`, borderRadius:12, padding:10, display:"flex", flexWrap:"wrap", gap:4, width:220, zIndex:10, boxShadow:"0 8px 32px #000c" }}>
                {EMOJIS.map(e => <button key={e} onClick={() => { setNewEmoji(e); setPicker(null); }} style={{ fontSize:18, background:"none", border:"none", cursor:"pointer", padding:3 }}>{e}</button>)}
              </div>
            )}
            <input value={newLbl} onChange={e=>setNewLbl(e.target.value)} placeholder="Nueva comida..." onKeyDown={e=>e.key==="Enter"&&add()} style={{ ...S.inp, flex:1 }} />
            <button onClick={add} style={{ background:C.text, border:"none", borderRadius:10, padding:"0 16px", color:C.bg, fontWeight:800, cursor:"pointer", fontSize:18, flexShrink:0 }}>+</button>
          </div>
        </div>

        <button onClick={save} style={{ width:"100%", padding:"15px", background:C.text, border:"none", borderRadius:14, color:C.bg, fontWeight:900, fontSize:15, cursor:"pointer", marginBottom:12 }}>
          Guardar cambios
        </button>
        <button onClick={() => { if(confirm("¿Cambiar la clave de API?")) onResetKey(); }}
          style={{ width:"100%", padding:"12px", background:"none", border:`1px solid ${C.border}`, borderRadius:14, color:C.text3, fontWeight:600, fontSize:13, cursor:"pointer", marginBottom:8 }}>
          Cambiar clave de API
        </button>
        <button onClick={() => { if(window.confirm("¿Volver al cuestionario inicial?")) onResetProfile(); }}
          style={{ width:"100%", padding:"12px", background:"none", border:`1px solid ${C.border}`, borderRadius:14, color:C.text3, fontWeight:600, fontSize:13, cursor:"pointer", marginBottom:8 }}>
          Repetir cuestionario inicial
        </button>
      </div>
    </div>
  );
}

// ── Live Barcode Scanner ──────────────────────────────────────
function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("Iniciando cámara...");

  const lookupBarcode = async (barcode) => {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) return null;
      const p = data.product;
      const n = p.nutriments || {};
      return {
        nombre: p.product_name || p.product_name_es || "Producto",
        marca: p.brands || "",
        imagen: p.image_url || null,
        calorias100: Math.round(n["energy-kcal_100g"] || n["energy-kcal"] || 0),
        proteinas100: Math.round((n.proteins_100g || 0) * 10) / 10,
        carbohidratos100: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
        grasas100: Math.round((n.fat_100g || 0) * 10) / 10,
        azucares100: Math.round((n.sugars_100g || 0) * 10) / 10,
        fibra100: Math.round((n.fiber_100g || 0) * 10) / 10,
        barcode,
      };
    } catch { return null; }
  };

  useEffect(() => {
    let active = true;
    let rafId = null;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        await new Promise(res => { video.onloadedmetadata = res; });
        await video.play();
        setScanning(true);
        setStatus("Centra el código en el recuadro");

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const decode = async () => {
          if (!active || video.readyState < 2) { rafId = requestAnimationFrame(decode); return; }
          try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const result = await reader.decodeFromCanvas(canvas);
            if (result && active) {
              active = false;
              stream.getTracks().forEach(t => t.stop());
              const barcode = result.getText();
              setStatus("Buscando producto...");
              const product = await lookupBarcode(barcode);
              onDetected(product, barcode);
            }
          } catch(e) {
            if (active) rafId = requestAnimationFrame(decode);
          }
        };
        rafId = requestAnimationFrame(decode);

      } catch(e) {
        if (active) setError("No se puede acceder a la cámara. Acepta el permiso cuando el navegador lo pida.");
      }
    };

    startCamera();

    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleClose = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#000", zIndex:400, display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"20px 20px 0", display:"flex", justifyContent:"space-between", alignItems:"center", position:"relative", zIndex:10 }}>
        <div style={{ color:"#fff", fontSize:16, fontWeight:700 }}>Escanear código de barras</div>
        <button onClick={handleClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:10, color:"#fff", fontSize:18, cursor:"pointer", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>

      <div style={{ flex:1, position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {error ? (
          <div style={{ textAlign:"center", padding:24 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📷</div>
            <div style={{ color:"#ef4444", fontSize:14, marginBottom:20, lineHeight:1.5 }}>{error}</div>
            <button onClick={handleClose} style={{ padding:"12px 24px", background:"#fff", border:"none", borderRadius:12, fontWeight:800, cursor:"pointer" }}>Cerrar</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", position:"absolute", inset:0 }} />
            <canvas ref={canvasRef} style={{ display:"none" }} />

            <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
              <div style={{
                position:"absolute", top:"50%", left:"50%",
                transform:"translate(-50%,-60%)",
                width:280, height:140,
              }}>
                {[[0,0],[0,1],[1,0],[1,1]].map(([r,c],i) => (
                  <div key={i} style={{
                    position:"absolute",
                    top: r===0?0:"auto", bottom: r===1?0:"auto",
                    left: c===0?0:"auto", right: c===1?0:"auto",
                    width:28, height:28,
                    borderTop: r===0?`3px solid ${C.blue}`:"none",
                    borderBottom: r===1?`3px solid ${C.blue}`:"none",
                    borderLeft: c===0?`3px solid ${C.blue}`:"none",
                    borderRight: c===1?`3px solid ${C.blue}`:"none",
                    borderRadius: i===0?"4px 0 0 0":i===1?"0 4px 0 0":i===2?"0 0 0 4px":"0 0 4px 0",
                  }} />
                ))}
                <div style={{
                  position:"absolute", left:4, right:4, height:2,
                  background:`linear-gradient(90deg, transparent, ${C.blue}, transparent)`,
                  boxShadow:`0 0 8px ${C.blue}`,
                  animation:"scanline 1.8s ease-in-out infinite",
                }} />
                <div style={{ position:"absolute", inset:0, boxShadow:"0 0 0 9999px rgba(0,0,0,0.6)", borderRadius:4 }} />
              </div>
            </div>

            <div style={{ position:"absolute", bottom:50, left:0, right:0, textAlign:"center" }}>
              <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, fontWeight:500 }}>{status}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HealthScorePanel({ onClose, apiKey }) {
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errMsg, setErrMsg] = useState(null);
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const camRef  = useRef();
  const fileRef = useRef();

  const scoreColor = (n) => n>=75?C.greenNeon:n>=50?C.yellow:n>=30?C.orange:C.red;
  const macroColor = (v) => v==="bajo"?C.greenNeon:v==="medio"?C.yellow:C.red;

  const handleBarcodeDetected = (product, rawBarcode) => {
    setShowScanner(false);
    if (!product) {
      setErrMsg(`Código ${rawBarcode} no encontrado en la base de datos. Prueba con otro producto.`);
      setPhase("error");
    } else {
      setBarcodeResult(product);
      setPhase("barcode");
    }
  };

  const analyzeBarcodeHealth = async () => {
    if (!barcodeResult) return;
    setPhase("analyzing");
    try {
      const desc = `Producto: ${barcodeResult.nombre} ${barcodeResult.marca ? `(${barcodeResult.marca})` : ""}. Valores por 100g: ${barcodeResult.calorias100} kcal, ${barcodeResult.proteinas100}g proteínas, ${barcodeResult.carbohidratos100}g carbohidratos, ${barcodeResult.grasas100}g grasas, ${barcodeResult.azucares100}g azúcares, ${barcodeResult.fibra100}g fibra.`;
      const data = await callClaude(apiKey,
        `Eres nutricionista experto. Analiza este producto alimenticio basándote en sus valores nutricionales. Responde SOLO con JSON en una sola línea sin backticks.
Formato: {"nombre":"nombre producto","puntuacion":75,"categoria":"Buena","resumen":"frase corta de por qué esa puntuación","positivos":["p1","p2"],"negativos":["n1","n2"],"macros":{"proteinas":"medio","carbohidratos":"alto","grasas":"bajo","azucares":"bajo","fibra":"medio","sodio":"bajo"},"consejo":"consejo breve"}
Puntuacion entero 1-100. Macros: alto, medio o bajo. Valora especialmente el ratio azúcares/carbohidratos, calidad proteica, grasas saturadas y fibra.`,
        [{ type:"text", text: desc }], 600);
      if (data.error) { setErrMsg(data.error); setPhase("error"); return; }
      data.puntuacion = parseInt(data.puntuacion) || 50;
      setResult(data);
      setPhase("result");
    } catch(e) {
      setErrMsg("Error al analizar. Inténtalo de nuevo.");
      setPhase("error");
    }
  };

  const process = async (file) => {
    if (!file) return;
    const isHeic = file.type==="image/heic"||file.type==="image/heif"||(file.name||"").toLowerCase().endsWith(".heic");
    if (isHeic) { setErrMsg("Formato HEIC no compatible. Ve a Ajustes → Cámara → Formatos → Más compatible."); setPhase("error"); return; }
    try {
      const dataUrl = await new Promise((res,rej) => {
        const reader = new FileReader();
        reader.onerror = rej;
        reader.onload = ev => {
          const img = new Image();
          img.onerror = rej;
          img.onload = () => {
            const MAX=900; let w=img.width,h=img.height;
            if(w>MAX||h>MAX){ if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
            const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
            canvas.getContext("2d").drawImage(img,0,0,w,h);
            res(canvas.toDataURL("image/jpeg",0.80));
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
      setPreview(dataUrl);
      setPhase("analyzing");
      const data = await analyzeHealthScore(apiKey, dataUrl.split(",")[1]);
      if (data.error) { setErrMsg(data.error); setPhase("error"); return; }
      data.puntuacion = parseInt(data.puntuacion)||50;
      setResult(data);
      setPhase("result");
    } catch(e) {
      setErrMsg("Error al analizar. Asegúrate de que hay comida visible.");
      setPhase("error");
    }
  };

  const sc=result?.puntuacion||0, col=scoreColor(sc), circ=2*Math.PI*52;

  return (
    <div style={{ position:"fixed", inset:0, background:"#000000f0", zIndex:300, overflowY:"auto" }}>
      {showScanner && <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div style={{ maxWidth:430, margin:"0 auto", padding:"24px 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:11, color:C.text3, fontWeight:600, letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Análisis nutricional</div>
            <div style={{ fontSize:20, fontWeight:900 }}>Puntuación de salud</div>
          </div>
          <button onClick={onClose} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:10, color:C.text2, fontSize:18, cursor:"pointer", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        {phase==="idle" && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:24, textAlign:"center" }}>
            <input ref={camRef}  type="file" accept="image/*" capture="environment" onChange={e=>process(e.target.files[0])} style={{ display:"none" }} />
            <input ref={fileRef} type="file" accept="image/*" onChange={e=>process(e.target.files[0])} style={{ display:"none" }} />
            <div style={{ fontSize:48, marginBottom:16 }}>🥗</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Analiza cualquier comida</div>
            <div style={{ fontSize:13, color:C.text2, marginBottom:24, lineHeight:1.6 }}>Puntuación del 1 al 100 según ingredientes, macros, azúcares y calidad nutricional.</div>
            <div style={{ display:"flex", gap:10, marginBottom:10 }}>
              <button onClick={() => camRef.current?.click()} style={{ flex:1, padding:"14px 8px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:14, color:C.text, fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:28 }}>📷</span><span>Cámara</span>
              </button>
              <button onClick={() => fileRef.current?.click()} style={{ flex:1, padding:"14px 8px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:14, color:C.text, fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:28 }}>🖼️</span><span>Galería</span>
              </button>
            </div>
            <button onClick={() => setShowScanner(true)}
              style={{ width:"100%", padding:"14px", background:`${C.blue}22`, border:`1px solid ${C.blue}55`, borderRadius:14, color:C.blue, fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>📊</span><span>Escanear código de barras</span>
            </button>
            <div style={{ fontSize:11, color:C.text3, marginTop:10 }}>Apunta la cámara al código y se detecta automáticamente</div>
          </div>
        )}

        {phase==="barcode" && barcodeResult && (
          <div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20, marginBottom:12 }}>
              {barcodeResult.imagen && <img src={barcodeResult.imagen} alt="" style={{ width:80, height:80, objectFit:"contain", borderRadius:10, marginBottom:12, display:"block", margin:"0 auto 12px" }} />}
              <div style={{ fontSize:11, color:C.text3, marginBottom:4 }}>{barcodeResult.marca}</div>
              <div style={{ fontSize:20, fontWeight:900, marginBottom:16 }}>{barcodeResult.nombre}</div>
              <div style={{ fontSize:11, color:C.text3, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Valores por 100g</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  ["🔥 Calorías", barcodeResult.calorias100, "kcal", C.orange],
                  ["💪 Proteínas", barcodeResult.proteinas100, "g", C.blue],
                  ["🌾 Carbohidratos", barcodeResult.carbohidratos100, "g", C.amber],
                  ["🫒 Grasas", barcodeResult.grasas100, "g", C.pink],
                  ["🍬 Azúcares", barcodeResult.azucares100, "g", C.yellow],
                  ["🌿 Fibra", barcodeResult.fibra100, "g", C.greenNeon],
                ].map(([label, val, unit, color]) => (
                  <div key={label} style={{ background:C.surface2, borderRadius:12, padding:"12px 14px" }}>
                    <div style={{ fontSize:11, color:C.text3, marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:18, fontWeight:900, color }}>{val}<span style={{ fontSize:11, color:C.text3, marginLeft:3 }}>{unit}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={analyzeBarcodeHealth}
              style={{ width:"100%", padding:"13px", background:C.text, border:"none", borderRadius:14, color:C.bg, fontWeight:800, fontSize:14, cursor:"pointer", marginBottom:10 }}>
              🥗 Analizar puntuación de salud
            </button>
            <button onClick={() => { setPhase("idle"); setBarcodeResult(null); }}
              style={{ width:"100%", padding:"13px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, color:C.text2, fontWeight:700, fontSize:14, cursor:"pointer" }}>
              Escanear otro producto
            </button>
          </div>
        )}

        {phase==="analyzing" && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, overflow:"hidden" }}>
            {preview && <img src={preview} alt="" style={{ width:"100%", maxHeight:220, objectFit:"cover", display:"block" }} />}
            <div style={{ padding:24, textAlign:"center" }}>
              <div style={{ fontSize:32, animation:"spin 1s linear infinite", display:"inline-block", marginBottom:12 }}>🥗</div>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>Analizando...</div>
              <div style={{ fontSize:13, color:C.text2 }}>Evaluando ingredientes y calidad nutricional</div>
            </div>
          </div>
        )}

        {phase==="error" && (
          <div style={{ background:C.surface, border:`1px solid ${C.red}44`, borderRadius:20, padding:24, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
            <div style={{ fontSize:14, color:C.red, marginBottom:20 }}>{errMsg}</div>
            <button onClick={() => { setPhase("idle"); setErrMsg(null); setPreview(null); }}
              style={{ padding:"12px 24px", background:C.text, border:"none", borderRadius:12, color:C.bg, fontWeight:800, cursor:"pointer" }}>
              Intentar de nuevo
            </button>
          </div>
        )}

        {phase==="result" && result && (
          <div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, overflow:"hidden", marginBottom:12 }}>
              {preview && <img src={preview} alt="" style={{ width:"100%", maxHeight:200, objectFit:"cover", display:"block" }} />}
              <div style={{ padding:20, display:"flex", alignItems:"center", gap:20 }}>
                <div style={{ position:"relative", width:120, height:120, flexShrink:0 }}>
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke={C.surface2} strokeWidth="8"/>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="url(#healthGradient)" strokeWidth="8"
                      strokeDasharray={`${circ}`} strokeDashoffset={`${circ*(1-sc/100)}`}
                      strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition:"stroke-dashoffset 1s ease" }}/>
                    <defs>
                      <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#00ff66" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ fontSize:28, fontWeight:900, color:scoreColor(sc), lineHeight:1 }}>{sc}</div>
                    <div style={{ fontSize:10, color:C.text3, marginTop:2 }}>/100</div>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:C.text3, marginBottom:4 }}>{result.nombre}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:scoreColor(sc), marginBottom:6 }}>{result.categoria||(sc>=75?"Excelente":sc>=50?"Buena":sc>=30?"Regular":"Evitar")}</div>
                  <div style={{ fontSize:13, color:C.text2, lineHeight:1.4 }}>{result.resumen}</div>
                </div>
              </div>
            </div>
            {result.macros && (
              <div style={{ ...S.card, marginBottom:12 }}>
                <span style={S.label}>Composición estimada</span>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {Object.entries(result.macros).map(([key,val]) => (
                    <div key={key} style={{ background:C.surface2, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:macroColor(val), textTransform:"capitalize" }}>{val}</div>
                      <div style={{ fontSize:10, color:C.text3, marginTop:3, textTransform:"capitalize" }}>{key}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div style={{ background:C.surface, border:`1px solid rgba(0,255,102,0.2)`, borderRadius:14, padding:14 }}>
                <div style={{ fontSize:11, color:C.greenNeon, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>✓ Puntos fuertes</div>
                {(result.positivos||[]).map((p,i) => <div key={i} style={{ fontSize:12, color:C.text2, marginBottom:5, lineHeight:1.4 }}>• {p}</div>)}
              </div>
              <div style={{ background:C.surface, border:`1px solid ${C.red}33`, borderRadius:14, padding:14 }}>
                <div style={{ fontSize:11, color:C.red, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>✗ A mejorar</div>
                {(result.negativos||[]).map((n,i) => <div key={i} style={{ fontSize:12, color:C.text2, marginBottom:5, lineHeight:1.4 }}>• {n}</div>)}
              </div>
            </div>
            {result.consejo && (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", marginBottom:16, display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ fontSize:24, flexShrink:0 }}>💡</div>
                <div style={{ fontSize:14, fontWeight:600, lineHeight:1.4 }}>{result.consejo}</div>
              </div>
            )}
            <button onClick={() => { setPhase("idle"); setResult(null); setPreview(null); }}
              style={{ width:"100%", padding:"13px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, color:C.text2, fontWeight:700, fontSize:14, cursor:"pointer" }}>
              Analizar otra comida
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [apiKey,      setApiKey]      = useState(() => ls.get("nl-apikey") || "");
  const [profile,     setProfile]     = useState(() => ls.get("nl-profile") || null);
  const [splash,      setSplash]      = useState(() => !!ls.get("nl-profile"));
  const [showCoach,   setShowCoach]   = useState(false);
  const [showPlan,    setShowPlan]    = useState(false);
  const [meals,       setMeals]       = useState(() => {
    const h = ls.get("nl-history") || {};
    return h[today()]?.meals || [];
  });
  const [goals,       setGoals]       = useState(() => {
    const saved = ls.get("nl-goals");
    if (saved) return saved;
    const prof = ls.get("nl-profile");
    if (prof?.calorias) return { calorias:parseInt(prof.calorias)||2000, proteinas:parseInt(prof.proteinas)||150, carbohidratos:parseInt(prof.carbohidratos)||220, grasas:parseInt(prof.grasas)||65 };
    return DEFAULT_GOALS;
  });
  const [slots,       setSlots]       = useState(() => ls.get("nl-slots") || DEFAULT_MEALS);
  const [selSlot,     setSelSlot]     = useState(DEFAULT_MEALS[2].id);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [toasts,      setToasts]      = useState([]);
  const [confirm,     setConfirm]     = useState(null);
  const [loadingRec,  setLoadingRec]  = useState(false);
  const [recs,        setRecs]        = useState(null);
  const [tab,         setTab]         = useState("hoy");
  const [dragOver,    setDragOver]    = useState(false);
  const [error,       setError]       = useState(null);
  const [textInput,   setTextInput]   = useState("");
  const [inputMode,   setInputMode]   = useState("photo");
  const [showSet,     setShowSet]     = useState(false);
  const [showHealth,  setShowHealth]  = useState(false);
  const [history,     setHistory]     = useState(() => ls.get("nl-history") || {});
  const [selDay,      setSelDay]      = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [listening,   setListening]   = useState(false);
  const [voiceText,   setVoiceText]   = useState("");
  const [voiceError,  setVoiceError]  = useState(null);
  
  const [showInputPanel, setShowInputPanel] = useState(false);
  
  // -- LÓGICA DE CARRUSEL CROSSFADE ANTI-BLACKSCREEN --
  // Estado para saber qué índice de BG_CAROUSEL estamos mostrando actualmente
  const [bgIdx, setBgIdx] = useState(0);

  useEffect(() => {
    // Cambiar la imagen cada 10 segundos
    const timer = setInterval(() => {
      setBgIdx((prev) => (prev + 1) % BG_CAROUSEL.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);
  // ----------------------------------------------------

  const fileRef  = useRef();
  const camRef   = useRef();
  const recogRef = useRef(null);
  const todStr   = today();

  useEffect(() => {
    const nh = { ...ls.get("nl-history") || {}, [todStr]: { meals, date:todStr } };
    ls.set("nl-history", nh);
    setHistory(nh);
  }, [meals]);

  useEffect(() => { ls.set("nl-goals", goals); }, [goals]);
  useEffect(() => { ls.set("nl-slots", slots); }, [slots]);

  const saveApiKey = (key) => { ls.set("nl-apikey", key); setApiKey(key); };
  const resetApiKey = () => { ls.set("nl-apikey", ""); setApiKey(""); };
  const saveProfile = (p) => {
    const safe = {
      calorias: 2000, proteinas: 150, carbohidratos: 220, grasas: 65,
      pasosObjetivo: 8000, caloriasQuemar: 300, ...p,
      calorias:      parseInt(p.calorias)      || 2000,
      proteinas:     parseInt(p.proteinas)     || 150,
      carbohidratos: parseInt(p.carbohidratos) || 220,
      grasas:        parseInt(p.grasas)        || 65,
      pasosObjetivo: parseInt(p.pasosObjetivo) || 8000,
      caloriasQuemar:parseInt(p.caloriasQuemar)|| 300,
    };
    const newGoals = { calorias:safe.calorias, proteinas:safe.proteinas, carbohidratos:safe.carbohidratos, grasas:safe.grasas };
    ls.set("nl-profile", safe);
    ls.set("nl-goals", newGoals);
    setProfile(safe);
    setGoals(newGoals);
    setSplash(false);
  };

  // --- Lógica del FAB Arrastrable ---
  const [fabOffset, setFabOffset] = useState(0);
  const dragInfo = useRef({ isDragging: false, startX: 0, initialOffset: 0, moved: false });

  const onFabDown = (e) => {
    dragInfo.current.isDragging = true;
    dragInfo.current.moved = false;
    dragInfo.current.startX = e.clientX || e.touches?.[0]?.clientX;
    dragInfo.current.initialOffset = fabOffset;
    if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
  };

  const onFabMove = (e) => {
    if (!dragInfo.current.isDragging) return;
    const currentX = e.clientX || e.touches?.[0]?.clientX;
    const diff = currentX - dragInfo.current.startX;
    if (Math.abs(diff) > 5) dragInfo.current.moved = true; 
    
    // Limitar el arrastre a la pantalla (izq: max ancho pantalla, der: 0 que es su pos original)
    const maxLeft = typeof window !== "undefined" ? -window.innerWidth + 80 : -300;
    const newOffset = Math.max(maxLeft, Math.min(0, dragInfo.current.initialOffset + diff));
    setFabOffset(newOffset);
  };

  const onFabUp = (e) => {
    if (dragInfo.current.isDragging) {
      dragInfo.current.isDragging = false;
      if (e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
      
      // Si no se movió apenas, se considera un click
      if (!dragInfo.current.moved) {
        setShowInputPanel(p => !p);
      }
    }
  };
  // ------------------------------------

  if (!apiKey) return <SetupScreen onSave={saveApiKey} />;
  if (!profile) return <OnboardingFlow apiKey={apiKey} onDone={saveProfile} />;

  const totals = meals.reduce((a,m) => ({cal:a.cal+m.totalCalorias,p:a.p+(m.totalProteinas||0),c:a.c+(m.totalCarbohidratos||0),g:a.g+(m.totalGrasas||0)}),{cal:0,p:0,c:0,g:0});
  const pct = Math.min((totals.cal/goals.calorias)*100, 100);
  const remaining = goals.calorias - totals.cal;
  const eatenLabels = new Set(meals.map(m=>m.slot));
  const lastEatenIdx = slots.reduce((li,sl,idx) => eatenLabels.has(sl.label)?idx:li, -1);
  const futureSlots = slots.filter((sl,idx) => !eatenLabels.has(sl.label) && idx > lastEatenIdx);

  const addToast = (msg, type="success") => { const id=Date.now(); setToasts(p=>[...p,{id,msg,type}]); };
  const removeToast = (id) => setToasts(p=>p.filter(t=>t.id!==id));

  const addMeal = useCallback(async (text, base64=null, mediaType=null, thumbnail=null) => {
    setAnalyzing(true);
    try {
      const result = await analyzeFood(apiKey, text, base64, mediaType, profile, goals);
      if (result.error) { addToast(result.error, "error"); return; }
      if (!result.totalCalorias && !result.platos) { addToast("No se pudo identificar la comida.", "error"); return; }
      const slot = slots.find(s=>s.id===selSlot);
      setMeals(p => [...p, { ...result, totalCalorias:result.totalCalorias||0, totalProteinas:result.totalProteinas||0, totalCarbohidratos:result.totalCarbohidratos||0, totalGrasas:result.totalGrasas||0, slot:slot?.label||selSlot, slotEmoji:slot?.emoji||"🍽️", thumbnail, id:Date.now(), consejoPerfil:result.consejoPerfil }]);
      addToast(`+${result.totalCalorias} kcal añadidas`);
      setRecs(null); setTextInput(""); setShowInputPanel(false);
    } catch(e) { addToast("Error al analizar. Comprueba tu conexión.", "error"); }
    finally { setAnalyzing(false); }
  }, [selSlot, slots, apiKey, profile, goals]);

  const processImage = useCallback(async (file) => {
    if (!file) return;
    const isHeic = file.type==="image/heic"||file.type==="image/heif"||(file.name||"").toLowerCase().endsWith(".heic")||(file.name||"").toLowerCase().endsWith(".heif");
    if (isHeic) { setError("Formato HEIC no compatible. Ve a Ajustes → Cámara → Formatos → Más compatible."); return; }
    try {
      const { bigBase64, bigMime, smallThumbnail } = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onerror = rej;
        reader.onload = ev => {
          const img = new Image();
          img.onerror = rej;
          img.onload = () => {
            const BIG = 1024;
            let bw = img.width, bh = img.height;
            if (bw > BIG || bh > BIG) {
              if (bw > bh) { bh = Math.round(bh * BIG / bw); bw = BIG; }
              else { bw = Math.round(bw * BIG / bh); bh = BIG; }
            }
            const bigCanvas = document.createElement("canvas");
            bigCanvas.width = bw; bigCanvas.height = bh;
            bigCanvas.getContext("2d").drawImage(img, 0, 0, bw, bh);
            const bigUrl = bigCanvas.toDataURL("image/jpeg", 0.82);

            const SMALL = 300;
            let sw = img.width, sh = img.height;
            if (sw > SMALL || sh > SMALL) {
              if (sw > sh) { sh = Math.round(sh * SMALL / sw); sw = SMALL; }
              else { sw = Math.round(sw * SMALL / sh); sh = SMALL; }
            }
            const smallCanvas = document.createElement("canvas");
            smallCanvas.width = sw; smallCanvas.height = sh;
            smallCanvas.getContext("2d").drawImage(img, 0, 0, sw, sh);
            const smallUrl = smallCanvas.toDataURL("image/jpeg", 0.6);

            res({ bigBase64: bigUrl.split(",")[1], bigMime: "image/jpeg", smallThumbnail: smallUrl });
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
      setPreview(smallThumbnail);
      await addMeal(null, bigBase64, bigMime, smallThumbnail);
    } catch { setError("No se pudo leer la imagen."); }
    finally { setPreview(null); }
  }, [addMeal]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceError("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari."); return; }
    navigator.mediaDevices?.getUserMedia({ audio:true })
      .then(stream => {
        stream.getTracks().forEach(t=>t.stop());
        const recog = new SR();
        recog.lang="es-ES"; recog.interimResults=true; recog.maxAlternatives=1;
        recog.onstart  = () => { setListening(true); setVoiceError(null); setVoiceText(""); };
        recog.onresult = (e) => setVoiceText(Array.from(e.results).map(r=>r[0].transcript).join(""));
        recog.onerror  = (e) => { setListening(false); setVoiceError(e.error==="not-allowed"?"Permiso denegado. Actívalo en los ajustes del navegador.":"Error de micrófono. Inténtalo de nuevo."); };
        recog.onend    = () => setListening(false);
        recogRef.current = recog;
        recog.start();
      })
      .catch(() => setVoiceError("No se puede acceder al micrófono. Acepta el permiso cuando el navegador lo pida."));
  }, []);

  const stopListening = useCallback(() => { recogRef.current?.stop(); setListening(false); }, []);

  const fetchRec = async () => {
    if (!meals.length||!futureSlots.length) return;
    setLoadingRec(true);
    try {
      const result = await getRecommendations(apiKey, profile, goals, meals, history);
      setRecs(result); setTab("recomendaciones");
    } catch { addToast("Error al obtener recomendaciones.", "error"); }
    finally { setLoadingRec(false); }
  };

  const selDayData   = selDay ? history[selDay] : null;
  const selDayTotals = selDayData ? selDayData.meals.reduce((a,m)=>({cal:a.cal+m.totalCalorias,p:a.p+(m.totalProteinas||0),c:a.c+(m.totalCarbohidratos||0),g:a.g+(m.totalGrasas||0)}),{cal:0,p:0,c:0,g:0}) : null;

  const streak = getStreak(history);

  const weeklyGoal = goals.calorias * 7;
  const getWeekCals = () => {
    let total = 0;
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i); const ds = localDateStr(nd);
      total += (history[ds]?.meals||[]).reduce((s,m)=>s+m.totalCalorias,0);
    }
    return total;
  };
  const weekCals = getWeekCals();
  const weekRemaining = weeklyGoal - weekCals;

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const yesterdayStr = localDateStr(yesterday);
  const yesterdayCals = (history[yesterdayStr]?.meals||[]).reduce((s,m)=>s+m.totalCalorias,0);
  const yesterdayExcess = yesterdayCals - goals.calorias;
  const activityRec = yesterdayCals > 0 ? (
    yesterdayExcess > 300  ? { msg:`Ayer comiste ${Math.round(yesterdayExcess)} kcal de más. Intenta quemar unas ${Math.round(yesterdayExcess)} kcal hoy (~${Math.round(yesterdayExcess/7)} min de cardio).`, color:C.orange, icon:"🏃" } :
    yesterdayExcess < -300 ? { msg:`Ayer estuviste en déficit de ${Math.abs(Math.round(yesterdayExcess))} kcal. Hoy puedes comer un poco más o descansar.`, color:C.greenNeon, icon:"💚" } :
    { msg:`Ayer estuviste en objetivo. ¡Sigue así hoy!`, color:C.blue, icon:"🎯" }
  ) : null;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif", color:C.text, maxWidth:430, margin:"0 auto", paddingBottom:90 }}>
      {/* Overlays */}
      {splash      && <SplashScreen onDone={() => setSplash(false)} />}
      {confirm     && <ConfirmDialog msg={confirm.msg} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)} />}
      {toasts.map(t=><Toast key={t.id} msg={t.msg} type={t.type} onDone={()=>removeToast(t.id)}/>)}
      {showSet     && <Settings goals={goals} setGoals={setGoals} slots={slots} setSlots={sl=>{setSlots(sl);if(!sl.find(s=>s.id===selSlot))setSelSlot(sl[0]?.id);}} profile={profile} onClose={()=>setShowSet(false)} onResetKey={resetApiKey} onResetProfile={()=>{ls.set("nl-profile",null);setProfile(null);setSplash(false);}} />}
      {showHealth  && <HealthScorePanel onClose={()=>setShowHealth(false)} apiKey={apiKey} />}
      {showCoach   && <AICoachPanel onClose={()=>setShowCoach(false)} apiKey={apiKey} profile={profile} goals={goals} history={history} meals={meals} setGoals={setGoals} />}
      {showPlan    && <WeeklyPlanPanel onClose={()=>setShowPlan(false)} apiKey={apiKey} profile={profile} goals={goals} />}

      {/* Futuristic FAB Arrastrable (Añadir comida) */}
      <div 
        onPointerDown={onFabDown}
        onPointerMove={onFabMove}
        onPointerUp={onFabUp}
        onPointerCancel={onFabUp}
        style={{
          position: "fixed", bottom: "max(calc(env(safe-area-inset-bottom, 12px) + 70px), 82px)", right: "20px",
          zIndex: "900", transform: `translateX(${fabOffset}px)`, touchAction: "none", // evita scroll al arrastrar
          display: "flex", alignItems: "center", justifyContent: "center"
        }}
      >
        <button style={{
          width: "60px", height: "60px", borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.4)",
          border: `2px solid ${C.cyan}`,
          boxShadow: `0 0 20px ${C.cyan}`,
          color: C.cyan, fontSize: "30px", fontWeight: "300",
          cursor: dragInfo.current.isDragging ? "grabbing" : "grab", 
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          animation: "fabPulse 3s infinite",
          pointerEvents: "none" // para que los eventos pasen al div de arriba
        }}>
          +
        </button>
      </div>

      {/* HEADER */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:"rgba(10,10,11,0.85)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", paddingTop:"max(env(safe-area-inset-top,20px),20px)", paddingBottom:16, paddingLeft:20, paddingRight:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:C.text, margin:0, lineHeight:1.2, letterSpacing:-0.5 }}>Hola, {profile?.nombre || "Alex"} 👋</h1>
            <p style={{ fontSize:12, color:C.text3, margin:0, marginTop:4 }}>{getDateStr()}</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button style={{ width:40, height:40, borderRadius:"50%", background:C.surface, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", cursor:"pointer" }}>
               <svg style={{ width:20, height:20, color:C.text2 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
               <div style={{ position:"absolute", top:10, right:12, width:6, height:6, background:C.greenNeon, borderRadius:"50%" }} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding:"0 20px 0", position:"relative", zIndex:1 }}>
        
        {/* PREMIUM CALORIE CARD - Carrusel con Crossfade Inteligente */}
        <div style={{ position:"relative", borderRadius:24, overflow:"hidden", border:`1px solid ${C.border}`, padding:20, marginBottom:16, boxShadow:"0 10px 30px rgba(0,0,0,0.5)", backgroundColor:"#1a1c23" }}>
            
            {/* Capas de imágenes superpuestas (Ventana deslizante) */}
            {BG_CAROUSEL.map((url, i) => {
              // Solo montamos las imágenes actuales, anteriores y siguientes en el DOM
              // para no colapsar la conexión con 20 descargas a la vez.
              const isCurrent = i === bgIdx;
              const isNext = i === (bgIdx + 1) % BG_CAROUSEL.length;
              const isPrev = i === (bgIdx - 1 + BG_CAROUSEL.length) % BG_CAROUSEL.length;

              if (!isCurrent && !isNext && !isPrev) return null;

              return (
                <div 
                  key={url}
                  style={{ 
                    position:"absolute", 
                    inset:0, 
                    backgroundImage:`url(${url})`, 
                    backgroundSize:"cover", 
                    backgroundPosition:"center",
                    opacity: isCurrent ? 1 : 0,
                    transition: "opacity 1.5s ease-in-out",
                    zIndex: 0
                  }} 
                />
              );
            })}

            {/* Gradient Overlay for texture (siempre por encima de las fotos) */}
            <div style={{ position:"absolute", inset:0, zIndex:1, background:`linear-gradient(135deg, rgba(18,18,20,0.95) 40%, rgba(18,18,20,0.6) 100%)` }} />

            <div style={{ position:"relative", zIndex:10, display:"flex", justifyContent:"space-between" }}>
                <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color:C.text3, fontWeight:700, letterSpacing:1, marginBottom:4 }}>CONSUMIDAS</div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                        <AnimatedNumber value={Math.round(totals.cal)} style={{ fontSize:48, fontWeight:900, color:C.text, lineHeight:1, letterSpacing:-1 }} />
                        <span style={{ fontSize:14, color:C.text2, fontWeight:600 }}>kcal</span>
                    </div>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", background:"rgba(0,183,255,0.1)", border:"1px solid rgba(0,183,255,0.2)", borderRadius:100, marginTop:12 }}>
                        <span style={{ color:C.cyan, fontSize:12 }}>✓</span>
                        <span style={{ color:C.cyan, fontSize:11, fontWeight:700 }}>{Math.round(pct)}% de tu objetivo</span>
                    </div>

                    <div style={{ display:"flex", gap:24, marginTop:24 }}>
                        <div>
                            <div style={{ fontSize:10, color:C.text3, fontWeight:700, letterSpacing:1, marginBottom:4 }}>RESTANTES</div>
                            <div style={{ fontSize:16, fontWeight:900, color:"#fbbf24" }}>{Math.max(0, remaining)} kcal</div>
                        </div>
                        <div>
                            <div style={{ fontSize:10, color:C.text3, fontWeight:700, letterSpacing:1, marginBottom:4 }}>OBJETIVO</div>
                            <div style={{ fontSize:16, fontWeight:900, color:C.text }}>{goals.calorias} kcal</div>
                        </div>
                    </div>
                </div>

                {/* Futuristic Neo Ring */}
                <div style={{ position:"relative", width:120, height:120, display:"flex", alignItems:"center", justifyItems:"center", flexShrink:0 }}>
                    <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform:"rotate(-90deg)", filter:"drop-shadow(0 0 12px rgba(6, 182, 212, 0.6))" }}>
                        {/* Define Gradient */}
                        <defs>
                          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={C.cyan} /> {/* Cyan */}
                            <stop offset="100%" stopColor="#fbbf24" /> {/* Amber */}
                          </linearGradient>
                        </defs>
                        
                        {/* Base Ring (Gray) */}
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
                        
                        {/* Progress Ring (Gradient) */}
                        <circle cx="60" cy="60" r="50" fill="none" stroke="url(#ringGradient)" strokeWidth="8" strokeLinecap="round"
                          strokeDasharray="314" strokeDashoffset={`${314*(1-pct/100)}`}
                          style={{ transition:"stroke-dashoffset 0.8s ease" }}/>
                          
                        {/* Animated Flow Dots/Lines (Moving) */}
                        <path d="M 60 10 A 50 50 0 0 1 110 60" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="5 300" strokeDashoffset="0" style={{ animation: "ringFlow 1.5s linear infinite", opacity: 0.3 }}/>
                        <path d="M 10 60 A 50 50 0 0 1 60 110" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="8 250" strokeDashoffset="0" style={{ animation: "ringFlow 2s linear infinite", opacity: 0.15, animationDelay: "-0.5s" }}/>
                    </svg>
                </div>
            </div>
        </div>

        {/* PREMIUM MACROS ROW */}
        <div style={{ display:"flex", gap:12, marginBottom:24 }}>
          <PremiumMacroCard label="Proteínas" value={totals.p} goal={goals.proteinas} color={C.blue} bgUrl="https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=400&auto=format&fit=crop" />
          <PremiumMacroCard label="Carbohidratos" value={totals.c} goal={goals.carbohidratos} color={C.amber} bgUrl="https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=400&auto=format&fit=crop" />
          <PremiumMacroCard label="Grasas" value={totals.g} goal={goals.grasas} color={C.purple} bgUrl="https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=400&auto=format&fit=crop" />
        </div>

        {/* PREMIUM ACTION BAR (Sin el botón central) */}
        <div style={{ display:"flex", background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:6, marginBottom:24 }}>
          <button onClick={()=>setShowHealth(true)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0", background:"transparent", border:"none", cursor:"pointer", transition:"opacity 0.2s" }}>
              <svg style={{ width:22, height:22, color:C.greenNeon, marginBottom:6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10v4c0 3.3 2.7 6 6 6h6c3.3 0 6-2.7 6-6v-4M3 10V6c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6v4M12 7v4M8 11h8"></path></svg>
              <span style={{ fontSize:10, color:C.text2, lineHeight:1.2, fontWeight:500 }}>Escanear<br/>alimento</span>
          </button>
          <div style={{ width:1, background:C.border, margin:"8px 0" }} />
          <button onClick={()=>setTab("actividad")} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0", background:"transparent", border:"none", cursor:"pointer", transition:"opacity 0.2s" }}>
              <svg style={{ width:22, height:22, color:C.purple, marginBottom:6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              <span style={{ fontSize:10, color:C.text2, lineHeight:1.2, fontWeight:500 }}>Ver<br/>análisis</span>
          </button>
          <div style={{ width:1, background:C.border, margin:"8px 0" }} />
          <button onClick={()=>setShowSet(true)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0", background:"transparent", border:"none", cursor:"pointer", transition:"opacity 0.2s" }}>
              <svg style={{ width:22, height:22, color:C.greenNeon, marginBottom:6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>
              <span style={{ fontSize:10, color:C.text2, lineHeight:1.2, fontWeight:500 }}>Definir<br/>objetivo</span>
          </button>
        </div>

        {/* HOY */}
        {tab==="hoy" && (
          <>
            {/* INPUT PANEL (Toggled by Añadir comida) */}
            {showInputPanel && (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:16, marginBottom:24, animation:"slideUp 0.3s ease" }}>
                <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:12, marginBottom:8, scrollSnapType:"x mandatory" }}>
                  {slots.map(sl => <button key={sl.id} onClick={()=>setSelSlot(sl.id)} style={{ ...S.pill(selSlot===sl.id), scrollSnapAlign:"start", flexShrink:0 }}>{sl.emoji} {sl.label}</button>)}
                </div>

                <div style={{ display:"flex", background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:4, marginBottom:14, gap:4 }}>
                  {[["photo","📸 Foto"],["text","✏️ Texto"],["voice","🎙️ Voz"]].map(([mode,label]) => (
                    <button key={mode} onClick={()=>setInputMode(mode)} style={{ flex:1, padding:"9px", border:"none", borderRadius:9, background:inputMode===mode?C.text:"transparent", color:inputMode===mode?C.bg:C.text3, fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>{label}</button>
                  ))}
                </div>

                {inputMode==="photo" && (
                  <div style={{ marginBottom:4 }}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={e=>{processImage(e.target.files[0]);e.target.value="";}} style={{ display:"none" }} />
                    <input ref={camRef}  type="file" accept="image/*" capture="environment" onChange={e=>{processImage(e.target.files[0]);e.target.value="";}} style={{ display:"none" }} />
                    {preview ? (
                      <div style={{ position:"relative", borderRadius:16, overflow:"hidden" }}>
                        <img src={preview} alt="" style={{ width:"100%", maxHeight:240, objectFit:"cover", display:"block" }} />
                      <div style={{ position:"absolute", inset:0, background:"#00000088", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                        <div style={{ fontSize:32, animation:"spin 1s linear infinite", display:"inline-block" }}>🔍</div>
                        <div style={{ marginTop:12, color:"#fff", fontWeight:700, fontSize:15 }}>Analizando con IA...</div>
                        <div style={{ marginTop:8, width:160, height:4, borderRadius:2, background:"rgba(255,255,255,0.2)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:"40%", background:C.blue, borderRadius:2, animation:"shimmerBar 1.2s ease-in-out infinite" }} />
                        </div>
                      </div>
                      </div>
                    ) : (
                      <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);processImage(e.dataTransfer.files[0]);}}
                        style={{ border:`1.5px dashed ${dragOver?C.text:C.border2}`, borderRadius:16, padding:"24px 20px", textAlign:"center", background:C.bg, transition:"all 0.2s" }}>
                        <div style={{ fontSize:30, marginBottom:12 }}>🍽️</div>
                        <div style={{ fontSize:13, color:C.text2, fontWeight:600, marginBottom:16 }}>Añade una foto de tu comida</div>
                        <div style={{ display:"flex", gap:10 }}>
                          <button onClick={()=>camRef.current?.click()} style={{ flex:1, padding:"12px 8px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:12, color:C.text, fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:24 }}>📷</span><span>Cámara</span>
                          </button>
                          <button onClick={()=>fileRef.current?.click()} style={{ flex:1, padding:"12px 8px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:12, color:C.text, fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:24 }}>🖼️</span><span>Galería</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {inputMode==="text" && (
                  <div style={{ marginBottom:4 }}>
                    <textarea value={textInput} onChange={e=>setTextInput(e.target.value)}
                      placeholder={"Describe lo que has comido...\nEj: pollo a la plancha con arroz"}
                      style={{ ...S.inp, resize:"vertical", minHeight:100, lineHeight:1.6, fontSize:14 }} />
                    <button onClick={()=>{ if(textInput.trim()) addMeal(textInput.trim()); }} disabled={analyzing||!textInput.trim()}
                      style={{ width:"100%", marginTop:8, padding:"13px", background:analyzing||!textInput.trim()?C.surface2:C.text, border:"none", borderRadius:12, color:analyzing||!textInput.trim()?C.text3:C.bg, fontWeight:800, fontSize:14, cursor:analyzing||!textInput.trim()?"default":"pointer", transition:"all 0.2s" }}>
                      {analyzing?"Calculando...":"Calcular nutrientes"}
                    </button>
                  </div>
                )}

                {inputMode==="voice" && (
                  <div style={{ marginBottom:4 }}>
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:20, textAlign:"center" }}>
                      <button onClick={listening?stopListening:startListening} disabled={analyzing}
                        style={{ width:80, height:80, borderRadius:"50%", border:"none", cursor:analyzing?"default":"pointer", background:listening?C.red:C.text, color:listening?"#fff":C.bg, fontSize:32, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", boxShadow:listening?`0 0 0 8px ${C.red}33,0 0 0 16px ${C.red}11`:"none", transition:"all 0.3s", animation:listening?"pulse 1.5s ease-in-out infinite":"none" }}>
                        {listening?"⏹":"🎙️"}
                      </button>
                      <div style={{ fontSize:14, fontWeight:700, color:listening?C.red:C.text2, marginBottom:8 }}>
                        {analyzing?"Analizando...":listening?"Escuchando... pulsa para parar":"Pulsa para hablar"}
                      </div>
                      
                      {voiceText && (
                        <div style={{ background:C.surface2, borderRadius:12, padding:"12px 14px", margin:"12px 0", textAlign:"left" }}>
                          <div style={{ fontSize:11, color:C.text3, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Has dicho:</div>
                          <div style={{ fontSize:14, color:C.text, lineHeight:1.5 }}>{voiceText}</div>
                        </div>
                      )}
                      {voiceError && <div style={{ fontSize:12, color:C.red, marginBottom:12 }}>⚠️ {voiceError}</div>}
                      {voiceText && !listening && (
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={()=>setVoiceText("")} style={{ flex:1, padding:"11px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:12, color:C.text2, fontWeight:700, fontSize:13, cursor:"pointer" }}>Repetir</button>
                          <button onClick={()=>{ addMeal(voiceText); setVoiceText(""); }} disabled={analyzing}
                            style={{ flex:2, padding:"11px", background:analyzing?C.surface2:C.text, border:"none", borderRadius:12, color:analyzing?C.text3:C.bg, fontWeight:800, fontSize:13, cursor:analyzing?"default":"pointer" }}>
                            {analyzing?"Analizando...":"✓ Analizar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* REGISTRO DE HOY (TIMELINE) */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, marginTop:8 }}>
                <h3 style={{ fontSize:11, fontWeight:800, color:C.text3, letterSpacing:1.5, margin:0 }}>REGISTRO DE HOY</h3>
                <button style={{ background:"none", border:"none", color:C.text3, fontSize:11, display:"flex", alignItems:"center", gap:4, cursor:"pointer" }}>Ver todo <span style={{fontSize:14}}>›</span></button>
            </div>

            {meals.length>0 ? (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:24, padding:"20px", marginBottom:24 }}>
                {meals.map((m, index) => (
                  <MealCard 
                    key={m.id} meal={m} apiKey={apiKey} slots={slots}
                    isLast={index === meals.length - 1}
                    onDelete={()=>setConfirm({msg:`¿Eliminar esta comida?`,onConfirm:()=>{setMeals(p=>p.filter(x=>x.id!==m.id));setRecs(null);addToast("Comida eliminada");setConfirm(null);}})}
                    onUpdate={updated=>setMeals(p=>p.map(x=>x.id===updated.id?updated:x))}
                    profile={profile} goals={goals}
                  />
                ))}

                {/* Timeline Footer Summary */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.surface2, borderRadius:16, padding:16, marginTop:20, border:`1px solid ${C.border}` }}>
                    <div style={{ textAlign:"center", flex:1 }}>
                        <div style={{ fontSize:10, color:C.text3, fontWeight:700, letterSpacing:1, marginBottom:4 }}>TOTAL CONSUMIDO</div>
                        <div style={{ fontSize:18, fontWeight:900, color:C.text }}>{Math.round(totals.cal)} <span style={{ fontSize:12, color:C.text3, fontWeight:500 }}>kcal</span></div>
                    </div>
                    <div style={{ width:40, height:40, borderRadius:"50%", background:`rgba(0,183,255,0.1)`, display:"flex", alignItems:"center", justifyContent:"center", color:C.cyan, fontSize:18, flexShrink:0 }}>🔥</div>
                    <div style={{ textAlign:"center", flex:1 }}>
                        <div style={{ fontSize:10, color:C.text3, fontWeight:700, letterSpacing:1, marginBottom:4 }}>TE FALTAN</div>
                        <div style={{ fontSize:18, fontWeight:900, color:C.cyan }}>{Math.max(0, remaining)} <span style={{ fontSize:12, color:C.cyan, fontWeight:500 }}>kcal</span></div>
                    </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign:"center", padding:"32px 20px", background:C.surface, borderRadius:24, border:`1px solid ${C.border}`, marginBottom:24 }}>
                <div style={{ fontSize:40, marginBottom:8, opacity:0.8 }}>🍽️</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.text2, marginBottom:6 }}>Sin comidas hoy</div>
                <div style={{ fontSize:13, color:C.text3 }}>Usa el botón "+" abajo para empezar</div>
              </div>
            )}

            {/* CONSEJO DEL DÍA BANNER */}
            <div style={{ position:"relative", borderRadius:16, overflow:"hidden", border:`1px solid ${C.border}`, padding:16, marginTop:16, marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ position:"absolute", inset:0, backgroundImage:`url(https://images.unsplash.com/photo-1548839140-29a749e1bc4e?q=80&w=600&auto=format&fit=crop)`, backgroundSize:"cover", backgroundPosition:"center" }} />
                <div style={{ position:"absolute", inset:0, background:`linear-gradient(to right, rgba(18,18,20,0.95) 40%, rgba(18,18,20,0.4) 100%)` }} />
                <div style={{ position:"relative", zIndex:10, maxWidth:"70%" }}>
                    <div style={{ fontSize:10, color:C.cyan, fontWeight:800, letterSpacing:1, marginBottom:4 }}>CONSEJO DEL DÍA</div>
                    <div style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:4, lineHeight:1.2 }}>Hidratación<br/>inteligente</div>
                    <div style={{ fontSize:11, color:C.text2, lineHeight:1.4 }}>Bebe al menos 2L de agua al día para mejorar tu rendimiento y bienestar.</div>
                </div>
                <div style={{ position:"relative", zIndex:10 }}>
                    <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(0,183,255,0.2)", border:"1px solid rgba(0,183,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center", color:C.cyan }}>➔</div>
                </div>
            </div>
          </>
        )}

        {/* ACTIVIDAD */}
        {tab==="actividad" && (
          <div>
            <span style={S.label}>Tu objetivo de actividad hoy</span>

            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20, marginBottom:12, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div style={{ display:"flex", gap:16, marginBottom:16 }}>
                <div style={{ flex:1, background:C.surface2, borderRadius:14, padding:"14px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:28 }}>👣</div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.blue, marginTop:4 }}>{(profile?.pasosObjetivo||8000).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:C.text3, marginTop:2 }}>pasos objetivo</div>
                </div>
                <div style={{ flex:1, background:C.surface2, borderRadius:14, padding:"14px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:28 }}>🔥</div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.orange, marginTop:4 }}>{profile?.caloriasQuemar||300}</div>
                  <div style={{ fontSize:10, color:C.text3, marginTop:2 }}>kcal a quemar</div>
                </div>
              </div>
              {activityRec && (
                <div style={{ background:`${activityRec.color}11`, border:`1px solid ${activityRec.color}33`, borderRadius:12, padding:"10px 14px", display:"flex", gap:10, alignItems:"flex-start" }}>
                  <span style={{ fontSize:18 }}>{activityRec.icon}</span>
                  <div style={{ fontSize:12, color:C.text2, lineHeight:1.5 }}>{activityRec.msg}</div>
                </div>
              )}
            </div>

            <span style={S.label}>¿Cómo quieres movererte hoy?</span>
            {(() => {
              const w = parseFloat(profile?.peso) || 75;
              const target = profile?.caloriasQuemar || 300;
              const calcMins = (kcal, met) => Math.round(kcal / (met * w / 60));
              return [
                { icon:"🏃", name:"Correr", met:9.8, kcal:target, color:C.greenNeon },
                { icon:"🏋️", name:"Gym / fuerza", met:5.0, kcal:target, color:C.blue },
                { icon:"🚶", name:"Caminar", met:3.5, kcal:Math.round(target*0.6), color:C.amber },
                { icon:"🚴", name:"Ciclismo", met:7.5, kcal:target, color:C.pink },
                { icon:"🏊", name:"Natación", met:7.0, kcal:target, color:"#06b6d4" },
                { icon:"🧘", name:"Yoga", met:2.5, kcal:Math.round(target*0.4), color:"#a855f7" },
              ].map((act,i)=>{
                const mins = calcMins(act.kcal, act.met);
                return (
                  <div key={i} style={{ ...S.card, display:"flex", alignItems:"center", gap:14, borderLeft:`3px solid ${act.color}` }}>
                    <div style={{ fontSize:26, width:36, textAlign:"center", flexShrink:0 }}>{act.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:700 }}>{act.name}</div>
                      <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>~{mins} min · {w}kg</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:16, fontWeight:900, color:act.color }}>~{act.kcal}</div>
                      <div style={{ fontSize:9, color:C.text3 }}>kcal</div>
                    </div>
                  </div>
                );
              });
            })()}

            <div style={{ ...S.card, marginTop:8 }}>
              <span style={S.label}>Contexto semanal</span>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:C.blue }}>{weekRemaining>=0?"+":""}{Math.round(weekRemaining)}</div>
                  <div style={{ fontSize:10, color:C.text3 }}>kcal margen semana</div>
                </div>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:C.orange }}>{yesterdayCals>0?Math.abs(Math.round(yesterdayExcess)):"-"}</div>
                  <div style={{ fontSize:10, color:C.text3 }}>{yesterdayExcess>0?"kcal exceso ayer":"kcal déficit ayer"}</div>
                </div>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:C.greenNeon }}>{streak}🔥</div>
                  <div style={{ fontSize:10, color:C.text3 }}>días de racha</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HISTORIAL */}
        {tab==="calendario" && (
          <>
            <CalView history={history} goals={goals} onSelect={setSelDay} selected={selDay} />
            {selDay && selDayData ? (
              <div style={{ marginTop:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <span style={S.label}>{new Date(selDay+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</span>
                  <button onClick={()=>setSelDay(null)} style={{ background:"none", border:"none", color:C.text3, cursor:"pointer", fontSize:18 }}>×</button>
                </div>
                <div style={{ ...S.card, marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:22, fontWeight:900, color:ringColor(selDayTotals.cal/goals.calorias*100) }}>{Math.round(selDayTotals.cal)}</div>
                      <div style={{ fontSize:10, color:C.text3 }}>kcal</div>
                    </div>
                    {[["P",selDayTotals.p,C.blue],["C",selDayTotals.c,C.amber],["G",selDayTotals.g,C.pink]].map(([l,v,col]) => (
                      <div key={l} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:18, fontWeight:800, color:col }}>{Math.round(v)}g</div>
                        <div style={{ fontSize:10, color:C.text3 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:C.surface2, borderRadius:3, height:3, overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(selDayTotals.cal/goals.calorias*100,100)}%`, height:"100%", background:ringColor(selDayTotals.cal/goals.calorias*100), borderRadius:3 }}/>
                  </div>
                </div>
                {/* Standard MealCards for calendar view */}
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:24, padding:"20px", marginBottom:24 }}>
                  {selDayData.meals.map((m,i) => <MealCard key={i} meal={m} apiKey={apiKey} onDelete={null} onUpdate={null} isLast={i === selDayData.meals.length - 1} />)}
                </div>
              </div>
            ) : (!selDay && <div style={{ textAlign:"center", padding:"24px 20px", fontSize:12, color:C.text3 }}>Pulsa un día con punto de color para ver el detalle</div>)}
          </>
        )}

        {/* RECOMENDACIONES / PLAN */}
        {tab==="recomendaciones" && (
          recs ? (
            <>
              {recs.consejo && (
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"18px 20px", marginBottom:20, display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ fontSize:30, flexShrink:0 }}>💡</div>
                  <div style={{ fontSize:15, fontWeight:700, lineHeight:1.4 }}>{recs.consejo}</div>
                </div>
              )}
              {(recs.comidas||[]).map((g,i) => <RecGroup key={i} grupo={g} />)}
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:40 }}>✨</div>
              <div style={{ marginTop:12, fontSize:14, color:C.text3 }}>{meals.length===0?"Registra al menos una comida para obtener recomendaciones":"Pulsa el botón FAB (+) en Hoy para generarlas"}</div>
              {meals.length > 0 && futureSlots.length > 0 && (
                <button onClick={fetchRec} disabled={loadingRec} style={{ width:"100%", padding:"14px", marginTop:24, background:loadingRec?C.surface:C.text, border:"none", borderRadius:14, color:loadingRec?C.text3:C.bg, fontWeight:800, fontSize:14, cursor:loadingRec?"default":"pointer", transition:"all 0.2s" }}>
                  {loadingRec?"Calculando recomendaciones...":"Ver recomendaciones para hoy"}
                </button>
              )}
            </div>
          )
        )}
      </div>

      {/* PREMIUM BOTTOM NAV */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"rgba(10,10,11,0.95)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderTop:`1px solid ${C.border}`, padding:"10px 8px", paddingBottom:"max(env(safe-area-inset-bottom,12px),12px)", display:"flex", justifyContent:"space-between", zIndex:100 }}>
        {/* Hoy */}
        <button onClick={()=>setTab("hoy")} style={{ flex:1, padding:"6px 0", border:"none", borderRadius:12, cursor:"pointer", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.2s" }}>
          <svg style={{ width:24, height:24, color:tab==="hoy"?C.cyan:C.text3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab==="hoy"?"2":"1.5"} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 001 1m-6 0h6"></path></svg>
          <span style={{ fontSize:10, fontWeight: tab==="hoy" ? 700 : 500, color: tab==="hoy" ? C.text : C.text3 }}>Hoy</span>
          {tab==="hoy" && <div style={{ position:"absolute", bottom:0, width:30, height:3, background:C.cyan, borderRadius:"4px 4px 0 0", boxShadow:`0 -2px 8px ${C.cyan}` }} />}
        </button>
        {/* Actividad */}
        <button onClick={()=>setTab("actividad")} style={{ flex:1, padding:"6px 0", border:"none", borderRadius:12, cursor:"pointer", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.2s" }}>
          <svg style={{ width:24, height:24, color:tab==="actividad"?C.text:C.text3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab==="actividad"?"2":"1.5"} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          <span style={{ fontSize:10, fontWeight: tab==="actividad" ? 700 : 500, color: tab==="actividad" ? C.text : C.text3 }}>Actividad</span>
        </button>
        {/* Historial */}
        <button onClick={()=>setTab("calendario")} style={{ flex:1, padding:"6px 0", border:"none", borderRadius:12, cursor:"pointer", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.2s" }}>
          <svg style={{ width:24, height:24, color:tab==="calendario"?C.text:C.text3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab==="calendario"?"2":"1.5"} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span style={{ fontSize:10, fontWeight: tab==="calendario" ? 700 : 500, color: tab==="calendario" ? C.text : C.text3 }}>Historial</span>
        </button>
        {/* Plan / Menús */}
        <button onClick={()=>setShowPlan(true)} style={{ flex:1, padding:"6px 0", border:"none", borderRadius:12, cursor:"pointer", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.2s" }}>
          <svg style={{ width:24, height:24, color:C.text3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          <span style={{ fontSize:10, fontWeight: 500, color: C.text3 }}>Plan</span>
        </button>
        {/* Coach */}
        <button onClick={()=>setShowCoach(true)} style={{ flex:1, padding:"6px 0", border:"none", borderRadius:12, cursor:"pointer", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.2s" }}>
          <svg style={{ width:24, height:24, color:C.text3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span style={{ fontSize:10, fontWeight: 500, color: C.text3 }}>Coach</span>
        </button>
      </div>

      <style>{`
        @keyframes spin      { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        @keyframes pulse     { 0%,100%{box-shadow:0 0 0 8px ${C.red}33,0 0 0 16px ${C.red}11;}50%{box-shadow:0 0 0 12px ${C.red}44,0 0 0 24px ${C.red}11;} }
        @keyframes fabPulse   { 0%, 100% { transform: scale(1); box-shadow: 0 0 20px ${C.cyan}; } 50% { transform: scale(1.08); box-shadow: 0 0 30px ${C.cyan}; } }
        @keyframes ringFlow   { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -350; } }
        @keyframes fadeIn    { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }
        @keyframes shimmerBar{ 0%{transform:translateX(-200%);}100%{transform:translateX(300%);} }
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scanline  { 0%{top:4px} 50%{top:calc(100% - 6px)} 100%{top:4px} }
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#0a0a0b!important;}
        textarea::placeholder{color:#71717a;}
        input::placeholder{color:#71717a;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:#27272a;border-radius:4px;}
        button:active{transform:scale(0.96);transition:transform 0.1s;}
      `}</style>
    </div>
  );
}