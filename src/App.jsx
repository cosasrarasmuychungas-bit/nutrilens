import { useState, useRef, useCallback, useEffect } from "react";

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

const C = {
  bg:"#000000", surface:"#0f0f0f", surface2:"#181818",
  border:"#222222", border2:"#2a2a2a",
  text:"#ffffff", text2:"#999999", text3:"#555555",
  green:"#4A90D9", yellow:"#eab308", orange:"#f97316",
  red:"#ef4444", blue:"#4A90D9", amber:"#f59e0b", pink:"#ec4899",
};

const today = () => new Date().toISOString().split("T")[0];
const ringColor = (pct) => pct < 50 ? C.green : pct < 80 ? C.yellow : pct < 100 ? C.orange : C.red;

const S = {
  pill: (on) => ({ padding:"7px 14px", borderRadius:100, border:"none", cursor:"pointer", background: on ? C.text : C.surface2, color: on ? C.bg : C.text2, fontSize:12, fontWeight:700, transition:"all 0.15s" }),
  card: { background:C.surface, borderRadius:16, padding:"16px", border:`1px solid ${C.border}`, marginBottom:10 },
  label: { fontSize:10, color:C.text3, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, marginBottom:8, display:"block" },
  inp: { background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, padding:"10px 14px", color:C.text, fontSize:14, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
};

// ── localStorage helpers ──────────────────────────────────────
const ls = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      // Quota exceeded — try to free space by stripping old thumbnails
      if (key === "nl-history" && val && typeof val === "object") {
        try {
          const stripped = {};
          const today = new Date().toISOString().split("T")[0];
          for (const [date, day] of Object.entries(val)) {
            if (date === today) {
              stripped[date] = day; // keep today's full data
            } else if (day.meals) {
              // strip thumbnails from older days
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
      model: "claude-sonnet-4-5",
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
async function analyzeFood(apiKey, text, base64, mediaType) {
  const userContent = base64
    ? [{ type:"image", source:{ type:"base64", media_type: mediaType||"image/jpeg", data:base64 } }, { type:"text", text:"Analiza esta comida con mucho detalle." }]
    : [{ type:"text", text:`Analiza esta comida: ${text}` }];
  return callClaude(apiKey,
    `Eres un nutricionista experto con visión avanzada. Analiza la comida con MÁXIMA PRECISIÓN.

REGLAS CRÍTICAS:
- Si es una foto, examina TODOS los detalles visuales: colores, texturas, formas, tamaños
- Identifica ingredientes REALES que ves, no asumas. Si ves jamón rosado, es jamón, no salmón
- Estima las cantidades en gramos de forma REALISTA según el tamaño visual
- Si hay varios ingredientes, listalos TODOS por separado
- Las calorías deben ser precisas según las cantidades estimadas

Responde SOLO con JSON válido en una sola línea, sin backticks.
Formato: {"platos":[{"nombre":"Nombre exacto con cantidad estimada en gramos","calorias":número,"proteinas":número,"carbohidratos":número,"grasas":número}],"totalCalorias":número,"totalProteinas":número,"totalCarbohidratos":número,"totalGrasas":número,"descripcion":"descripción corta y precisa de lo que hay"}
Si no hay comida visible: {"error":"No se detectó comida"}`,
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
    // Skip verification test, just save the key directly
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
          style={{ width:"100%", padding:"15px", background: testing||!key.trim() ? C.surface2 : C.text, border:"none", borderRadius:14, color: testing||!key.trim() ? C.text3 : C.bg, fontWeight:900, fontSize:15, cursor: testing||!key.trim() ? "default" : "pointer" }}>
          {testing ? "Verificando..." : "Empezar →"}
        </button>

        <div style={{ textAlign:"center", marginTop:14, fontSize:11, color:C.text3 }}>
          Tu clave se guarda solo en este dispositivo y nunca se comparte.
        </div>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────
function MacroBar({ label, value, goal, color }) {
  const pct = Math.min((value / goal) * 100, 100);
  return (
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:10, color:C.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
        <span style={{ fontSize:12, color, fontWeight:700 }}>{Math.round(value)}<span style={{ color:C.text3 }}>/{goal}</span></span>
      </div>
      <div style={{ background:C.surface2, borderRadius:3, height:3, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.5s" }} />
      </div>
    </div>
  );
}

function MealCard({ meal, onDelete, onUpdate, apiKey, slots }) {
  const [editing, setEditing] = useState(false);
  const [editPlatos, setEditPlatos] = useState([]);
  const [editSlot, setEditSlot] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [recalcDesc, setRecalcDesc] = useState(false);

  const openEdit = () => {
    setEditPlatos((meal.platos||[]).map(p=>({...p})));
    setEditSlot({ label: meal.slot, emoji: meal.slotEmoji });
    setEditing(true);
  };

  const recalcFromDesc = async () => {
    if (!newDesc.trim()) return;
    setRecalcDesc(true);
    try {
      const result = await analyzeFood(apiKey, newDesc.trim(), null, null);
      if (!result.error && result.platos?.length > 0) {
        onUpdate({
          ...meal,
          platos: result.platos,
          totalCalorias: result.totalCalorias || 0,
          totalProteinas: result.totalProteinas || 0,
          totalCarbohidratos: result.totalCarbohidratos || 0,
          totalGrasas: result.totalGrasas || 0,
          descripcion: newDesc.trim(),
        });
        setEditingDesc(false);
        setNewDesc("");
      }
    } catch {}
    finally { setRecalcDesc(false); }
  };

  const save = (platos = editPlatos) => {
    const totalCalorias      = platos.reduce((s,p) => s+(parseFloat(p.calorias)||0), 0);
    const totalProteinas     = platos.reduce((s,p) => s+(parseFloat(p.proteinas)||0), 0);
    const totalCarbohidratos = platos.reduce((s,p) => s+(parseFloat(p.carbohidratos)||0), 0);
    const totalGrasas        = platos.reduce((s,p) => s+(parseFloat(p.grasas)||0), 0);
    onUpdate({ ...meal, platos, totalCalorias:Math.round(totalCalorias), totalProteinas:Math.round(totalProteinas), totalCarbohidratos:Math.round(totalCarbohidratos), totalGrasas:Math.round(totalGrasas), slot: editSlot?.label || meal.slot, slotEmoji: editSlot?.emoji || meal.slotEmoji });
    setEditing(false);
  };

  const recalculate = async () => {
    setRecalculating(true);
    try {
      const desc = editPlatos.map(p=>p.nombre).filter(Boolean).join(", ");
      const result = await analyzeFood(apiKey, desc, null, null);
      if (!result.error && result.platos?.length > 0) {
        const merged = editPlatos.map((ep,i) => {
          const match = result.platos[i] || result.platos[0];
          return { nombre:ep.nombre, calorias:match.calorias, proteinas:match.proteinas, carbohidratos:match.carbohidratos, grasas:match.grasas };
        });
        save(merged);
      }
    } catch { save(editPlatos); }
    finally { setRecalculating(false); }
  };

  return (
    <div style={S.card}>
      {meal.thumbnail && <img src={meal.thumbnail} alt="" style={{ width:"100%", maxHeight:200, objectFit:"cover", borderRadius:12, marginBottom:12, display:"block" }} />}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <span style={{ fontSize:11, color:C.text3, fontWeight:600 }}>{meal.slotEmoji} {meal.slot}</span>
        <div style={{ display:"flex", gap:8 }}>
          {onUpdate && !editing && <button onClick={openEdit} style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, fontSize:12, fontWeight:600 }}>✏️ editar</button>}
          {onUpdate && editing && <button onClick={() => setEditing(false)} style={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:6, cursor:"pointer", color:C.text2, fontSize:12, fontWeight:600, padding:"2px 8px" }}>cancelar</button>}
          {onDelete && <button onClick={onDelete} style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, fontSize:18, lineHeight:1 }}>×</button>}
        </div>
      </div>
      {editing ? (
        <div>
          <div style={{ fontSize:11, color:C.text3, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>¿A qué comida mover?</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {(slots||[]).map(sl => (
              <button key={sl.id} onClick={() => setEditSlot(sl)}
                style={{ padding:"5px 12px", borderRadius:100, border:"none", cursor:"pointer", background: editSlot?.label===sl.label ? C.text : C.surface2, color: editSlot?.label===sl.label ? C.bg : C.text2, fontSize:12, fontWeight:700 }}>
                {sl.emoji} {sl.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:C.text3, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Edita las cantidades y pulsa Recalcular</div>
          {editPlatos.map((plato,i) => (
            <div key={i} style={{ background:C.surface2, borderRadius:12, padding:12, marginBottom:8 }}>
              <input value={plato.nombre} onChange={e => setEditPlatos(p=>p.map((x,j)=>j===i?{...x,nombre:e.target.value}:x))}
                style={{ ...S.inp, marginBottom:8, fontSize:13, fontWeight:600, background:C.surface }} placeholder="Nombre y cantidad (ej: Pasta 150g)" />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6 }}>
                {[["calorias","kcal",C.orange],["proteinas","P",C.blue],["carbohidratos","C",C.amber],["grasas","G",C.pink]].map(([key,unit,color]) => (
                  <div key={key}>
                    <div style={{ fontSize:9, color:C.text3, marginBottom:3, textAlign:"center" }}>{unit}</div>
                    <input type="number" value={plato[key]||0}
                      onChange={e => setEditPlatos(p=>p.map((x,j)=>j===i?{...x,[key]:e.target.value}:x))}
                      style={{ ...S.inp, color, fontWeight:700, textAlign:"center", padding:"6px 4px", fontSize:13, background:C.surface }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button onClick={recalculate} disabled={recalculating}
              style={{ flex:1, padding:"11px", background:recalculating?C.surface2:C.surface, border:`1px solid ${C.border2}`, borderRadius:10, color:recalculating?C.text3:C.text2, fontWeight:700, fontSize:13, cursor:recalculating?"default":"pointer" }}>
              {recalculating ? "⏳ Calculando..." : "🔄 Recalcular con IA"}
            </button>
            <button onClick={() => save()} style={{ flex:1, padding:"11px", background:C.text, border:"none", borderRadius:10, color:C.bg, fontWeight:800, fontSize:13, cursor:"pointer" }}>
              ✓ Guardar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize:14, color:C.text2, marginBottom:10, lineHeight:1.3 }}>{meal.descripcion}</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", gap:6 }}>
              {[["P",meal.totalProteinas||0,C.blue],["C",meal.totalCarbohidratos||0,C.amber],["G",meal.totalGrasas||0,C.pink]].map(([l,v,col]) => (
                <div key={l} style={{ padding:"4px 10px", background:C.surface2, borderRadius:8, textAlign:"center" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:col }}>{Math.round(v)}g</div>
                  <div style={{ fontSize:9, color:C.text3 }}>{l}</div>
                </div>
              ))}
            </div>
            <div><span style={{ fontSize:20, fontWeight:900 }}>{meal.totalCalorias}</span><span style={{ fontSize:11, color:C.text3, marginLeft:3 }}>kcal</span></div>
          </div>
          {meal.platos?.length > 0 && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
              {meal.platos.map((p,i) => (
                <div key={i} style={{ fontSize:12, display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ color:C.text2 }}>{p.nombre}</span><span style={{ color:C.text3 }}>{p.calorias} kcal</span>
                </div>
              ))}
            </div>
          )}
          {onUpdate && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
              {!editingDesc ? (
                <button onClick={() => { setEditingDesc(true); setNewDesc(meal.descripcion||""); }}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, fontSize:12, fontWeight:600, padding:0 }}>
                  ➕ Añadir ingredientes y recalcular
                </button>
              ) : (
                <div>
                  <div style={{ fontSize:11, color:C.text3, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Describe la comida completa</div>
                  <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)}
                    placeholder="Ej: patatas fritas con salsa brava y alioli"
                    style={{ ...S.inp, resize:"vertical", minHeight:70, lineHeight:1.5, fontSize:13, marginBottom:8 }} />
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => { setEditingDesc(false); setNewDesc(""); }}
                      style={{ flex:1, padding:"9px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, color:C.text2, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                      Cancelar
                    </button>
                    <button onClick={recalcFromDesc} disabled={recalcDesc || !newDesc.trim()}
                      style={{ flex:2, padding:"9px", background:recalcDesc||!newDesc.trim()?C.surface2:C.text, border:"none", borderRadius:10, color:recalcDesc||!newDesc.trim()?C.text3:C.bg, fontWeight:800, fontSize:13, cursor:recalcDesc||!newDesc.trim()?"default":"pointer" }}>
                      {recalcDesc ? "⏳ Calculando..." : "🔄 Recalcular calorías"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
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
            <div style={{ fontSize:18, fontWeight:900, color:C.green }}>{op.calorias}</div>
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:6 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign:"center", fontSize:10, color:C.text3, fontWeight:600 }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
        {Array(offset).fill(null).map((_,i) => <div key={`e${i}`} />)}
        {Array(days).fill(null).map((_,i) => {
          const d = i+1;
          const ds = `${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const dd = history[ds];
          const isT = ds===todStr, isSel = ds===selected;
          const pct = dd ? dd.meals.reduce((s,m)=>s+m.totalCalorias,0)/goals.calorias : 0;
          const dot = dd ? (pct>1?C.red:pct>0.8?C.green:pct>0.4?C.yellow:C.orange) : null;
          return (
            <button key={ds} onClick={() => dd && onSelect(isSel?null:ds)}
              style={{ aspectRatio:"1", borderRadius:10, border:isSel?`2px solid ${C.text}`:isT?`2px solid ${C.text3}`:`1px solid ${C.border}`, background:isSel?C.surface2:C.surface, cursor:dd?"pointer":"default", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, padding:4 }}>
              <span style={{ fontSize:13, fontWeight:isT?900:500, color:isT?C.text:C.text2 }}>{d}</span>
              {dot && <div style={{ width:5, height:5, borderRadius:"50%", background:dot }} />}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:14, justifyContent:"center" }}>
        {[[C.green,"Objetivo"],[C.yellow,"Parcial"],[C.red,"Excedido"]].map(([color,label]) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:color }} />
            <span style={{ fontSize:10, color:C.text3 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings({ goals, setGoals, slots, setSlots, onClose, onResetKey }) {
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

        <span style={S.label}>Objetivos diarios</span>
        <div style={{ ...S.card, marginBottom:8 }}>
          {[["calorias","Calorías","kcal",C.orange],["proteinas","Proteínas","g",C.blue],["carbohidratos","Carbohidratos","g",C.amber],["grasas","Grasas","g",C.pink]].map(([key,label,unit,color],i,arr) => (
            <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:i<arr.length-1?14:0, marginBottom:i<arr.length-1?14:0, borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none" }}>
              <span style={{ fontSize:14, color:C.text2 }}>{label}</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <input type="number" value={lg[key]} onChange={e => {
                  const val = parseInt(e.target.value)||0;
                  if (key === "calorias") {
                    // Auto-recalculate macros: 30% protein, 40% carbs, 30% fat
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
        <div style={{ fontSize:11, color:C.text3, marginBottom:20, paddingLeft:4 }}>
          Al cambiar las calorías los macros se recalculan automáticamente (30% proteínas, 40% carbos, 30% grasas). Puedes ajustarlos manualmente después.
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
          style={{ width:"100%", padding:"12px", background:"none", border:`1px solid ${C.border}`, borderRadius:14, color:C.text3, fontWeight:600, fontSize:13, cursor:"pointer" }}>
          Cambiar clave de API
        </button>
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
  const camRef     = useRef();
  const fileRef    = useRef();
  const barcodeRef = useRef();

  const scoreColor = (n) => n>=75?C.green:n>=50?C.yellow:n>=30?C.orange:C.red;
  const macroColor = (v) => v==="bajo"?C.green:v==="medio"?C.yellow:C.red;

  const scanBarcode = async (file) => {
    if (!file) return;
    setPhase("analyzing");
    setErrMsg(null);
    try {
      // Try BarcodeDetector API first (Chrome/Android)
      let barcode = null;
      if ("BarcodeDetector" in window) {
        const bitmap = await createImageBitmap(file);
        const detector = new window.BarcodeDetector({ formats: ["ean_13","ean_8","upc_a","upc_e","code_128"] });
        const barcodes = await detector.detect(bitmap);
        if (barcodes.length > 0) barcode = barcodes[0].rawValue;
      }
      if (!barcode) {
        // Fallback: read barcode from image via QuaggaJS or ZXing — use canvas approach
        setErrMsg("No se detectó el código de barras. Asegúrate de que está bien enfocado e inténtalo de nuevo.");
        setPhase("error");
        return;
      }
      // Query Open Food Facts API
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        setErrMsg("Producto no encontrado en la base de datos. Prueba a añadirlo manualmente.");
        setPhase("error");
        return;
      }
      const p = data.product;
      const n = p.nutriments || {};
      const per100 = {
        nombre: p.product_name || p.product_name_es || "Producto",
        marca: p.brands || "",
        imagen: p.image_url || null,
        calorias100: Math.round(n["energy-kcal_100g"] || n["energy-kcal"] || 0),
        proteinas100: Math.round((n.proteins_100g || 0) * 10) / 10,
        carbohidratos100: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
        grasas100: Math.round((n.fat_100g || 0) * 10) / 10,
        azucares100: Math.round((n.sugars_100g || 0) * 10) / 10,
        fibra100: Math.round((n.fiber_100g || 0) * 10) / 10,
        sal100: Math.round((n.salt_100g || 0) * 100) / 100,
        barcode,
      };
      setBarcodeResult(per100);
      setPhase("barcode");
    } catch(e) {
      setErrMsg("Error al escanear. Comprueba tu conexión e inténtalo de nuevo.");
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
            <input ref={barcodeRef} type="file" accept="image/*" capture="environment" onChange={e=>scanBarcode(e.target.files[0])} style={{ display:"none" }} />
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
            <button onClick={() => barcodeRef.current?.click()} style={{ width:"100%", padding:"14px 8px", background:C.surface2, border:`1px solid ${C.blue}44`, borderRadius:14, color:C.text, fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              <span style={{ fontSize:24 }}>📦</span><span>Escanear código de barras</span>
            </button>
            <div style={{ fontSize:11, color:C.text3, marginTop:10 }}>Escanea el código de barras de un producto para ver sus valores nutricionales exactos</div>
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
                  ["🌿 Fibra", barcodeResult.fibra100, "g", C.green],
                ].map(([label, val, unit, color]) => (
                  <div key={label} style={{ background:C.surface2, borderRadius:12, padding:"12px 14px" }}>
                    <div style={{ fontSize:11, color:C.text3, marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:18, fontWeight:900, color }}>{val}<span style={{ fontSize:11, color:C.text3, marginLeft:3 }}>{unit}</span></div>
                  </div>
                ))}
              </div>
            </div>
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
                    <circle cx="60" cy="60" r="52" fill="none" stroke={col} strokeWidth="8"
                      strokeDasharray={`${circ}`} strokeDashoffset={`${circ*(1-sc/100)}`}
                      strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition:"stroke-dashoffset 1s ease" }}/>
                  </svg>
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ fontSize:28, fontWeight:900, color:col, lineHeight:1 }}>{sc}</div>
                    <div style={{ fontSize:10, color:C.text3, marginTop:2 }}>/100</div>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:C.text3, marginBottom:4 }}>{result.nombre}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:col, marginBottom:6 }}>{result.categoria||(sc>=75?"Excelente":sc>=50?"Buena":sc>=30?"Regular":"Evitar")}</div>
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
              <div style={{ background:C.surface, border:`1px solid ${C.green}33`, borderRadius:14, padding:14 }}>
                <div style={{ fontSize:11, color:C.green, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>✓ Puntos fuertes</div>
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
  const [meals,       setMeals]       = useState(() => {
    const h = ls.get("nl-history") || {};
    return h[today()]?.meals || [];
  });
  const [goals,       setGoals]       = useState(() => ls.get("nl-goals") || DEFAULT_GOALS);
  const [slots,       setSlots]       = useState(() => ls.get("nl-slots") || DEFAULT_MEALS);
  const [selSlot,     setSelSlot]     = useState(DEFAULT_MEALS[2].id);
  const [analyzing,   setAnalyzing]   = useState(false);
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
  const fileRef  = useRef();
  const camRef   = useRef();
  const recogRef = useRef(null);
  const todStr   = today();

  // Save meals to history on every change
  useEffect(() => {
    const nh = { ...ls.get("nl-history") || {}, [todStr]: { meals, date:todStr } };
    ls.set("nl-history", nh);
    setHistory(nh);
  }, [meals]);

  useEffect(() => { ls.set("nl-goals", goals); }, [goals]);
  useEffect(() => { ls.set("nl-slots", slots); }, [slots]);

  const saveApiKey = (key) => { ls.set("nl-apikey", key); setApiKey(key); };
  const resetApiKey = () => { ls.set("nl-apikey", ""); setApiKey(""); };

  // Show setup screen if no API key
  if (!apiKey) return <SetupScreen onSave={saveApiKey} />;

  // Derived
  const totals = meals.reduce((a,m) => ({cal:a.cal+m.totalCalorias,p:a.p+(m.totalProteinas||0),c:a.c+(m.totalCarbohidratos||0),g:a.g+(m.totalGrasas||0)}),{cal:0,p:0,c:0,g:0});
  const pct = Math.min((totals.cal/goals.calorias)*100, 100);
  const remaining = goals.calorias - totals.cal;
  const rc = ringColor(pct);
  const eatenLabels = new Set(meals.map(m=>m.slot));
  const lastEatenIdx = slots.reduce((li,sl,idx) => eatenLabels.has(sl.label)?idx:li, -1);
  const futureSlots = slots.filter((sl,idx) => !eatenLabels.has(sl.label) && idx > lastEatenIdx);

  const addMeal = useCallback(async (text, base64=null, mediaType=null, thumbnail=null) => {
    setAnalyzing(true); setError(null);
    try {
      const result = await analyzeFood(apiKey, text, base64, mediaType);
      if (result.error) { setError(result.error); return; }
      if (!result.totalCalorias && !result.platos) { setError("No se pudo identificar la comida."); return; }
      const slot = slots.find(s=>s.id===selSlot);
      setMeals(p => [...p, { ...result, totalCalorias:result.totalCalorias||0, totalProteinas:result.totalProteinas||0, totalCarbohidratos:result.totalCarbohidratos||0, totalGrasas:result.totalGrasas||0, slot:slot?.label||selSlot, slotEmoji:slot?.emoji||"🍽️", thumbnail, id:Date.now() }]);
      setRecs(null); setTextInput("");
    } catch(e) { setError("Error al analizar. Comprueba tu conexión e inténtalo de nuevo."); }
    finally { setAnalyzing(false); }
  }, [selSlot, slots, apiKey]);

  const processImage = useCallback(async (file) => {
    if (!file) return;
    const isHeic = file.type==="image/heic"||file.type==="image/heif"||(file.name||"").toLowerCase().endsWith(".heic")||(file.name||"").toLowerCase().endsWith(".heif");
    if (isHeic) { setError("Formato HEIC no compatible. Ve a Ajustes → Cámara → Formatos → Más compatible."); return; }
    try {
      // Compress image in two versions: one for AI analysis (1024px), one thumbnail for storage (300px)
      const { bigBase64, bigMime, smallThumbnail } = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onerror = rej;
        reader.onload = ev => {
          const img = new Image();
          img.onerror = rej;
          img.onload = () => {
            // Big version for AI (max 1024px)
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

            // Small thumbnail for storage (max 300px at 0.6 quality)
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
    setLoadingRec(true); setError(null);
    try {
      const result = await getRecommendations(apiKey, meals, futureSlots.map(s=>s.label), totals, goals);
      setRecs(result); setTab("recomendaciones");
    } catch { setError("Error al obtener recomendaciones."); }
    finally { setLoadingRec(false); }
  };

  const selDayData   = selDay ? history[selDay] : null;
  const selDayTotals = selDayData ? selDayData.meals.reduce((a,m)=>({cal:a.cal+m.totalCalorias,p:a.p+(m.totalProteinas||0),c:a.c+(m.totalCarbohidratos||0),g:a.g+(m.totalGrasas||0)}),{cal:0,p:0,c:0,g:0}) : null;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif", color:C.text, maxWidth:430, margin:"0 auto", paddingBottom:80 }}>
      {showSet    && <Settings goals={goals} setGoals={setGoals} slots={slots} setSlots={sl=>{setSlots(sl);if(!sl.find(s=>s.id===selSlot))setSelSlot(sl[0]?.id);}} onClose={()=>setShowSet(false)} onResetKey={resetApiKey} />}
      {showHealth && <HealthScorePanel onClose={()=>setShowHealth(false)} apiKey={apiKey} />}

      {/* HEADER */}
      <div style={{ padding:"32px 20px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:11, color:C.text3, fontWeight:600, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>NutriLens IA</div>
            <div style={{ fontSize:28, fontWeight:900, letterSpacing:-1, lineHeight:1 }}>Tu día</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setShowHealth(true)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, width:44, height:44, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>🥗</button>
            <button onClick={()=>setShowSet(true)}    style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, width:44, height:44, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙️</button>
          </div>
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20, marginBottom:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:20 }}>
            <div style={{ position:"relative", width:88, height:88, flexShrink:0 }}>
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r="38" fill="none" stroke={C.surface2} strokeWidth="7"/>
                <circle cx="44" cy="44" r="38" fill="none" stroke={rc} strokeWidth="7"
                  strokeDasharray={`${2*Math.PI*38}`} strokeDashoffset={`${2*Math.PI*38*(1-pct/100)}`}
                  strokeLinecap="round" transform="rotate(-90 44 44)" style={{ transition:"stroke-dashoffset 0.6s ease, stroke 0.4s" }}/>
              </svg>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ fontSize:18, fontWeight:900, color:rc }}>{Math.round(pct)}%</div>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div><div style={{ fontSize:26, fontWeight:900, lineHeight:1 }}>{Math.round(totals.cal)}</div><div style={{ fontSize:11, color:C.text3, marginTop:2 }}>consumidas</div></div>
                <div style={{ textAlign:"right" }}><div style={{ fontSize:26, fontWeight:900, color:remaining>=0?C.green:C.red, lineHeight:1 }}>{Math.abs(Math.round(remaining))}</div><div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{remaining>=0?"restantes":"excedidas"}</div></div>
              </div>
              <div style={{ background:C.surface2, borderRadius:4, height:3, overflow:"hidden" }}>
                <div style={{ width:`${pct}%`, height:"100%", background:rc, borderRadius:4, transition:"width 0.5s ease, background 0.4s" }}/>
              </div>
              <div style={{ fontSize:10, color:C.text3, marginTop:5, textAlign:"center" }}>objetivo {goals.calorias} kcal</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:16, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
            <MacroBar label="Prot."  value={totals.p} goal={goals.proteinas}     color={C.blue}  />
            <MacroBar label="Carbos" value={totals.c} goal={goals.carbohidratos} color={C.amber} />
            <MacroBar label="Grasas" value={totals.g} goal={goals.grasas}        color={C.pink}  />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:"flex", padding:"16px 20px 0", gap:4 }}>
        {[["hoy","Hoy"],["calendario","📅 Historial"],["recomendaciones",`✨${recs?" ·":""}`]].map(([id,label]) => (
          <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"10px 6px", background:tab===id?C.surface:"transparent", border:`1px solid ${tab===id?C.border:"transparent"}`, borderRadius:12, color:tab===id?C.text:C.text3, fontWeight:700, fontSize:12, cursor:"pointer", transition:"all 0.2s" }}>{label}</button>
        ))}
      </div>

      <div style={{ padding:"16px 20px" }}>

        {/* HOY */}
        {tab==="hoy" && (
          <>
            <span style={S.label}>¿Para qué comida?</span>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
              {slots.map(sl => <button key={sl.id} onClick={()=>setSelSlot(sl.id)} style={S.pill(selSlot===sl.id)}>{sl.emoji} {sl.label}</button>)}
            </div>

            <div style={{ display:"flex", background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:4, marginBottom:14, gap:4 }}>
              {[["photo","📸"],["text","✏️"],["voice","🎙️"]].map(([mode,label]) => (
                <button key={mode} onClick={()=>setInputMode(mode)} style={{ flex:1, padding:"9px", border:"none", borderRadius:9, background:inputMode===mode?C.text:"transparent", color:inputMode===mode?C.bg:C.text3, fontWeight:700, fontSize:15, cursor:"pointer", transition:"all 0.2s" }}>{label}</button>
              ))}
            </div>

            {inputMode==="photo" && (
              <div style={{ marginBottom:14 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={e=>{processImage(e.target.files[0]);e.target.value="";}} style={{ display:"none" }} />
                <input ref={camRef}  type="file" accept="image/*" capture="environment" onChange={e=>{processImage(e.target.files[0]);e.target.value="";}} style={{ display:"none" }} />
                {preview ? (
                  <div style={{ position:"relative", borderRadius:16, overflow:"hidden" }}>
                    <img src={preview} alt="" style={{ width:"100%", maxHeight:240, objectFit:"cover", display:"block" }} />
                    <div style={{ position:"absolute", inset:0, background:"#00000088", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ fontSize:32, animation:"spin 1s linear infinite", display:"inline-block" }}>🔍</div>
                      <div style={{ marginTop:12, color:"#fff", fontWeight:700, fontSize:15 }}>Analizando con IA...</div>
                    </div>
                  </div>
                ) : (
                  <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);processImage(e.dataTransfer.files[0]);}}
                    style={{ border:`1.5px dashed ${dragOver?C.text:C.border2}`, borderRadius:16, padding:"24px 20px", textAlign:"center", background:C.surface, transition:"all 0.2s" }}>
                    <div style={{ fontSize:30, marginBottom:12 }}>🍽️</div>
                    <div style={{ fontSize:13, color:C.text2, fontWeight:600, marginBottom:16 }}>¿Cómo quieres añadir la foto?</div>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={()=>camRef.current?.click()} style={{ flex:1, padding:"12px 8px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:12, color:C.text, fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:24 }}>📷</span><span>Cámara</span>
                      </button>
                      <button onClick={()=>fileRef.current?.click()} style={{ flex:1, padding:"12px 8px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:12, color:C.text, fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:24 }}>🖼️</span><span>Galería</span>
                      </button>
                    </div>
                    <div style={{ fontSize:11, color:C.text3, marginTop:10 }}>O arrastra una imagen aquí</div>
                  </div>
                )}
              </div>
            )}

            {inputMode==="text" && (
              <div style={{ marginBottom:14 }}>
                <textarea value={textInput} onChange={e=>setTextInput(e.target.value)}
                  placeholder={"Describe lo que has comido...\nEj: pollo a la plancha con arroz y ensalada"}
                  style={{ ...S.inp, resize:"vertical", minHeight:100, lineHeight:1.6, fontSize:14 }} />
                <button onClick={()=>{ if(textInput.trim()) addMeal(textInput.trim()); }} disabled={analyzing||!textInput.trim()}
                  style={{ width:"100%", marginTop:8, padding:"13px", background:analyzing||!textInput.trim()?C.surface2:C.text, border:"none", borderRadius:12, color:analyzing||!textInput.trim()?C.text3:C.bg, fontWeight:800, fontSize:14, cursor:analyzing||!textInput.trim()?"default":"pointer", transition:"all 0.2s" }}>
                  {analyzing?"Calculando...":"Calcular calorías y macros"}
                </button>
              </div>
            )}

            {inputMode==="voice" && (
              <div style={{ marginBottom:14 }}>
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:20, textAlign:"center" }}>
                  <button onClick={listening?stopListening:startListening} disabled={analyzing}
                    style={{ width:80, height:80, borderRadius:"50%", border:"none", cursor:analyzing?"default":"pointer", background:listening?C.red:C.text, color:listening?"#fff":C.bg, fontSize:32, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", boxShadow:listening?`0 0 0 8px ${C.red}33,0 0 0 16px ${C.red}11`:"none", transition:"all 0.3s", animation:listening?"pulse 1.5s ease-in-out infinite":"none" }}>
                    {listening?"⏹":"🎙️"}
                  </button>
                  <div style={{ fontSize:14, fontWeight:700, color:listening?C.red:C.text2, marginBottom:8 }}>
                    {analyzing?"Analizando...":listening?"Escuchando... pulsa para parar":"Pulsa para hablar"}
                  </div>
                  {!listening && !voiceText && <div style={{ fontSize:12, color:C.text3 }}>Di qué has comido, por ejemplo: "un plato de pasta con tomate"</div>}
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

            {error && (
              <div style={{ background:"#ef444411", border:`1px solid ${C.red}44`, borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:13, color:C.red, display:"flex", justifyContent:"space-between", gap:8 }}>
                <span>⚠️ {error}</span>
                <button onClick={()=>setError(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, fontSize:16, flexShrink:0 }}>×</button>
              </div>
            )}

            {meals.length>0 ? (
              <>
                <span style={{ ...S.label, marginTop:8 }}>Registrado hoy</span>
                {meals.map(m => (
                  <MealCard key={m.id} meal={m} apiKey={apiKey} slots={slots}
                    onDelete={()=>{ setMeals(p=>p.filter(x=>x.id!==m.id)); setRecs(null); }}
                    onUpdate={updated=>setMeals(p=>p.map(x=>x.id===updated.id?updated:x))}
                  />
                ))}
                {futureSlots.length>0 && (
                  <button onClick={fetchRec} disabled={loadingRec} style={{ width:"100%", padding:"14px", marginTop:4, background:loadingRec?C.surface:C.text, border:"none", borderRadius:14, color:loadingRec?C.text3:C.bg, fontWeight:800, fontSize:14, cursor:loadingRec?"default":"pointer", transition:"all 0.2s" }}>
                    {loadingRec?"Calculando recomendaciones...":"✨ Ver recomendaciones para hoy"}
                  </button>
                )}
              </>
            ) : (
              <div style={{ textAlign:"center", padding:"40px 20px" }}>
                <img src="/icon-512.png" alt="NutriLens" style={{ width:72, height:72, borderRadius:16, objectFit:"cover" }} />
                <div style={{ marginTop:12, fontSize:14, color:C.text3 }}>Registra tu primera comida del día</div>
              </div>
            )}
          </>
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
                {selDayData.meals.map((m,i) => <MealCard key={i} meal={m} apiKey={apiKey} onDelete={null} onUpdate={null} />)}
              </div>
            ) : (!selDay && <div style={{ textAlign:"center", padding:"24px 20px", fontSize:12, color:C.text3 }}>Pulsa un día con punto de color para ver el detalle</div>)}
          </>
        )}

        {/* RECOMENDACIONES */}
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
              <div style={{ marginTop:12, fontSize:14, color:C.text3 }}>{meals.length===0?"Registra al menos una comida para obtener recomendaciones":"Pulsa el botón en la pestaña Hoy para generarlas"}</div>
            </div>
          )
        )}
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 8px ${C.red}33,0 0 0 16px ${C.red}11;}50%{box-shadow:0 0 0 12px ${C.red}44,0 0 0 24px ${C.red}11;} }
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#000000!important;}
        textarea::placeholder{color:#444;}
        input::placeholder{color:#444;}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:4px;}
      `}</style>
    </div>
  );
}
