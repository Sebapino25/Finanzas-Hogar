"use strict";
const e = React.createElement;
const { useState, useEffect, useMemo, useCallback } = React;

// ============ CONFIGURACIÓN DE SUPABASE ============
const SUPABASE_URL = "https://nmswdazeduccvhttxamq.supabase.co";
const SUPABASE_KEY = "sb_publishable_ayGIQ71y7deNFRsf9V_r4A_DazpWCZd";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function kvGet(key) {
  const { data, error } = await supabaseClient.from("kv_store").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}
async function kvSet(key, value) {
  const { error } = await supabaseClient.from("kv_store").upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
  return true;
}
// =====================================================

const fmt = (n) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));
const uid = () => Math.random().toString(36).slice(2, 9);

const currentMonthLabel = () => {
  const s = new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const DEFAULT_ASSETS = [
  { id: "racional", name: "Racional (inversiones)", amount: "20450522", group: "reserva" },
  { id: "deposito", name: "Depósito a plazo (propio)", amount: "7000000", group: "reserva" },
  { id: "security", name: "Banco Security (cta. corriente)", amount: "2252679", group: "operativa" },
  { id: "bci", name: "BCI (neto proyectos)", amount: "-404722", group: "operativa" },
];

const THEMES = {
  forest: { card: "bg-gradient-to-br from-emerald-700 to-emerald-950 text-emerald-50", title: "text-emerald-200", subtitle: "text-emerald-300/70" },
  navy: { card: "bg-gradient-to-br from-sky-800 to-slate-950 text-sky-50", title: "text-sky-200", subtitle: "text-sky-300/70" },
  terracota: { card: "bg-gradient-to-br from-orange-600 to-red-800 text-orange-50", title: "text-orange-100", subtitle: "text-orange-100/70" },
  rose: { card: "bg-gradient-to-br from-rose-100 to-orange-100 text-stone-800 border border-rose-200", title: "text-rose-600", subtitle: "text-stone-500" },
  light: { card: "bg-white text-stone-800 border border-stone-200", title: "text-stone-500", subtitle: "text-stone-400" },
};

function SectionCard({ theme = "light", title, subtitle, children }) {
  const t = THEMES[theme];
  return e("div", { className: `rounded-3xl p-5 mb-4 ${t.card}` },
    e("h2", { className: `display-font text-2xl leading-tight uppercase tracking-tight mb-1 ${t.title}` }, title),
    subtitle ? e("p", { className: `text-xs mb-3 ${t.subtitle}` }, subtitle) : null,
    children
  );
}

function Sparkline({ data, dataKey, color }) {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => Number(d[dataKey]) || 0);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 300, h = 100, pad = 8;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  return e("div", null,
    e("svg", { viewBox: `0 0 ${w} ${h}`, className: "w-full h-24" },
      e("polyline", { points: pts.map((p) => p.join(",")).join(" "), fill: "none", stroke: color, strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round" }),
      pts.map((p, i) => e("circle", { key: i, cx: p[0], cy: p[1], r: "3", fill: color }))
    ),
    e("div", { className: "flex justify-between text-[10px] text-stone-400 mt-1" },
      data.map((d, i) => e("span", { key: i }, d.label))
    )
  );
}

function RunwayGauge({ months }) {
  const capped = Math.max(0, Math.min(months, 36));
  const pct = (capped / 36) * 100;
  let color = "#FDE047";
  if (months < 6) color = "#FCA5A5";
  else if (months < 12) color = "#FDBA74";
  return e("div", null,
    e("div", { className: "flex items-end gap-2 mb-2" },
      e("span", { className: "display-font text-5xl", style: { color } }, months > 0 ? months.toFixed(1) : "—"),
      e("span", { className: "text-sm mb-1 opacity-80" }, "meses de autonomía")
    ),
    e("div", { className: "h-2.5 w-full bg-black/20 rounded-full overflow-hidden" },
      e("div", { className: "h-full rounded-full transition-all duration-500", style: { width: `${pct}%`, backgroundColor: color } })
    ),
    e("div", { className: "flex justify-between text-[10px] opacity-60 mt-1" },
      e("span", null, "0"), e("span", null, "12"), e("span", null, "24"), e("span", null, "36+")
    )
  );
}

function AmountInput({ value, onChange, className }) {
  return e("input", {
    type: "text", inputMode: "numeric", className, value,
    onChange: (ev) => {
      let v = ev.target.value.replace(/[^0-9-]/g, "");
      v = v.replace(/(?!^)-/g, "");
      onChange(v);
    },
  });
}

const rowInputCls = (onColor) => onColor
  ? "w-28 bg-white/15 rounded-lg px-2 py-1 text-sm text-right text-white placeholder-white/40 outline-none focus:ring-1 focus:ring-white/60"
  : "w-28 bg-stone-100 rounded-lg px-2 py-1 text-sm text-right text-stone-800 outline-none focus:ring-1 focus:ring-orange-400";
const rowNameCls = (onColor) => `flex-1 bg-transparent text-sm outline-none min-w-0 ${onColor ? "text-white placeholder-white/40" : "text-stone-700"}`;

function AssetRow({ item, onChange, onDelete, showGroupToggle, onColor }) {
  return e("div", { className: `py-2 border-b last:border-0 ${onColor ? "border-white/15" : "border-stone-100"}` },
    e("div", { className: "flex items-center gap-2" },
      e("input", { className: rowNameCls(onColor), value: item.name, onChange: (ev) => onChange({ ...item, name: ev.target.value }) }),
      e(AmountInput, { value: item.amount, onChange: (v) => onChange({ ...item, amount: v }), className: rowInputCls(onColor) }),
      e("button", { onClick: () => onDelete(item.id), className: `text-sm px-1 shrink-0 ${onColor ? "text-white/50 hover:text-white" : "text-stone-400 hover:text-red-500"}` }, "×")
    ),
    showGroupToggle ? e("button", {
      onClick: () => onChange({ ...item, group: item.group === "reserva" ? "operativa" : "reserva" }),
      className: "mt-1 text-[10px] px-2 py-0.5 rounded-full border border-white/30 bg-white/10",
    }, `${item.group === "reserva" ? "Reserva" : "Operativa"} · cambiar`) : null
  );
}

function MovementRow({ item, onChange, onDelete }) {
  const isIngreso = item.type === "ingreso";
  return e("div", { className: "flex items-center gap-2 py-2 border-b border-stone-100 last:border-0" },
    e("div", { className: "flex rounded-lg overflow-hidden border border-stone-200 shrink-0 text-[11px]" },
      e("button", { onClick: () => onChange({ ...item, type: "gasto" }), className: `px-2 py-1 ${!isIngreso ? "bg-red-100 text-red-700" : "bg-transparent text-stone-400"}` }, "Gasto"),
      e("button", { onClick: () => onChange({ ...item, type: "ingreso" }), className: `px-2 py-1 ${isIngreso ? "bg-emerald-100 text-emerald-700" : "bg-transparent text-stone-400"}` }, "Ingreso")
    ),
    e("input", { className: rowNameCls(false), value: item.name, onChange: (ev) => onChange({ ...item, name: ev.target.value }), placeholder: "Descripción" }),
    e(AmountInput, {
      value: item.amount, onChange: (v) => onChange({ ...item, amount: v }),
      className: `w-24 bg-stone-100 rounded-lg px-2 py-1 text-sm text-right outline-none focus:ring-1 focus:ring-orange-400 ${isIngreso ? "text-emerald-700" : "text-red-700"}`,
    }),
    e("button", { onClick: () => onDelete(item.id), className: "text-stone-400 hover:text-red-500 text-sm px-1 shrink-0" }, "×")
  );
}

function SharedExpenseRow({ item, onChange, onDelete }) {
  const paidBySeba = item.paidBy === "seba";
  return e("div", { className: "flex items-center gap-2 py-2 border-b border-rose-200 last:border-0" },
    e("div", { className: "flex rounded-lg overflow-hidden border border-rose-300 shrink-0 text-[11px]" },
      e("button", { onClick: () => onChange({ ...item, paidBy: "seba" }), className: `px-2 py-1 ${paidBySeba ? "bg-sky-500 text-white" : "bg-transparent text-stone-400"}` }, "Seba"),
      e("button", { onClick: () => onChange({ ...item, paidBy: "carla" }), className: `px-2 py-1 ${!paidBySeba ? "bg-pink-500 text-white" : "bg-transparent text-stone-400"}` }, "Carla")
    ),
    e("input", { className: rowNameCls(false), value: item.name, onChange: (ev) => onChange({ ...item, name: ev.target.value }), placeholder: "Descripción" }),
    e(AmountInput, { value: item.amount, onChange: (v) => onChange({ ...item, amount: v }), className: rowInputCls(false) }),
    e("button", { onClick: () => onDelete(item.id), className: "text-stone-400 hover:text-red-500 text-sm px-1 shrink-0" }, "×")
  );
}

function PillButton({ children, onClick, variant = "primary" }) {
  const variants = {
    primary: "bg-orange-500 hover:bg-orange-600 text-white",
    dark: "bg-stone-800 hover:bg-stone-700 text-white",
    ghost: "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50",
    success: "bg-emerald-500 text-white",
  };
  return e("button", { onClick, className: `w-full rounded-full py-3 text-sm font-semibold transition-colors ${variants[variant]}` }, children);
}

function FinanzasSeba() {
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [movements, setMovements] = useState([]);
  const [history, setHistory] = useState([]);
  const [sharedExpenses, setSharedExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [monthLabel, setMonthLabel] = useState(currentMonthLabel());
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [sharedSaved, setSharedSaved] = useState(false);
  const [sharedSaveStatus, setSharedSaveStatus] = useState("");
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [viewAs, setViewAs] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const personal = await kvGet("personal");
        if (personal) {
          if (personal.assets) setAssets(personal.assets);
          if (personal.movements) setMovements(personal.movements);
          if (personal.monthLabel) setMonthLabel(personal.monthLabel);
        }
      } catch (e) { console.error(e); }
      try {
        const h = await kvGet("history");
        if (h) setHistory(h);
      } catch (e) { console.error(e); }
      try {
        const shared = await kvGet("shared");
        if (shared) {
          if (shared.sharedExpenses) setSharedExpenses(shared.sharedExpenses);
          if (shared.settlements) setSettlements(shared.settlements);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const totalAssets = useMemo(() => assets.reduce((s, a) => s + num(a.amount), 0), [assets]);
  const reserveTotal = useMemo(() => assets.filter((a) => a.group === "reserva").reduce((s, a) => s + num(a.amount), 0), [assets]);
  const operativeTotal = useMemo(() => assets.filter((a) => a.group !== "reserva").reduce((s, a) => s + num(a.amount), 0), [assets]);
  const racionalAmount = useMemo(() => num((assets.find((a) => a.id === "racional") || {}).amount), [assets]);
  const totalIngresos = useMemo(() => movements.filter((m) => m.type === "ingreso").reduce((s, m) => s + num(m.amount), 0), [movements]);
  const totalGastos = useMemo(() => movements.filter((m) => m.type === "gasto").reduce((s, m) => s + num(m.amount), 0), [movements]);
  const neto = totalIngresos - totalGastos;
  const runwayMonths = totalGastos > 0 ? reserveTotal / totalGastos : 0;

  const sharedBalance = useMemo(() => {
    const fromExpenses = sharedExpenses.reduce((s, e2) => s + (e2.paidBy === "seba" ? num(e2.amount) / 2 : -num(e2.amount) / 2), 0);
    const fromSettlements = settlements.reduce((s, st) => s + (st.direction === "carla_to_seba" ? -num(st.amount) : num(st.amount)), 0);
    return fromExpenses + fromSettlements;
  }, [sharedExpenses, settlements]);

  const persist = useCallback(async (key, value, retry = true) => {
    try { await kvSet(key, value); return true; }
    catch (err) {
      if (retry) { await new Promise((r) => setTimeout(r, 800)); return persist(key, value, false); }
      return false;
    }
  }, []);

  const savePersonal = async () => {
    setStatus("Guardando...");
    const ok = await persist("personal", { assets, movements, monthLabel });
    setStatus(ok ? "✓ Guardado con éxito" : "✕ Error al guardar, intenta de nuevo");
    setTimeout(() => setStatus(""), 3000);
  };

  const updateAsset = (u) => setAssets(assets.map((a) => (a.id === u.id ? u : a)));
  const deleteAsset = (id) => setAssets(assets.filter((a) => a.id !== id));
  const addAsset = (group) => setAssets([...assets, { id: uid(), name: "Nuevo activo", amount: "", group }]);

  const updateMovement = (u) => setMovements(movements.map((m) => (m.id === u.id ? u : m)));
  const deleteMovement = (id) => setMovements(movements.filter((m) => m.id !== id));
  const addMovement = (type) => setMovements([...movements, { id: uid(), type, name: "", amount: "" }]);

  const updateSharedExpense = (u) => setSharedExpenses(sharedExpenses.map((x) => (x.id === u.id ? u : x)));
  const deleteSharedExpense = (id) => setSharedExpenses(sharedExpenses.filter((x) => x.id !== id));
  const addSharedExpense = () => setSharedExpenses([...sharedExpenses, { id: uid(), name: "", amount: "", paidBy: "seba" }]);

  const addSettlement = (direction) => {
    const amountStr = String(Math.round(Math.abs(sharedBalance)));
    setSettlements([...settlements, { id: uid(), direction, amount: amountStr }]);
  };
  const deleteSettlement = (id) => setSettlements(settlements.filter((s) => s.id !== id));

  const saveSharedModule = async () => {
    setSharedSaveStatus("Guardando...");
    const ok = await persist("shared", { sharedExpenses, settlements });
    setSharedSaved(ok);
    setSharedSaveStatus(ok ? "✓ Guardado con éxito" : "✕ Error al guardar, intenta de nuevo");
    setTimeout(() => { setSharedSaved(false); setSharedSaveStatus(""); }, 3000);
  };

  const reopenMonth = async (h) => {
    const newMovements = h.movements || [];
    setMovements(newMovements);
    setMonthLabel(h.label);
    const next = history.filter((x) => x.label !== h.label);
    setHistory(next);
    setExpandedMonth(null);
    await persist("history", next);
    await persist("personal", { assets, movements: newMovements, monthLabel: h.label });
  };

  const renameHistoryMonth = async (oldLabel, newLabel) => {
    const next = history.map((h) => (h.label === oldLabel ? { ...h, label: newLabel } : h));
    setHistory(next);
    await persist("history", next);
    if (expandedMonth === oldLabel) setExpandedMonth(newLabel);
  };

  const closeMonth = async () => {
    const entry = {
      date: new Date().toISOString().slice(0, 10), label: monthLabel,
      patrimonio: totalAssets, reserva: reserveTotal, operativa: operativeTotal, racional: racionalAmount,
      ingresos: totalIngresos, gastos: totalGastos, neto,
      runway: totalGastos > 0 ? Number((reserveTotal / totalGastos).toFixed(1)) : null,
      movements: movements,
    };
    const nextHistory = [...history.filter((h) => h.label !== entry.label), entry].sort((a, b) => a.date.localeCompare(b.date));
    setHistory(nextHistory);
    setMovements([]);
    const nextLabel = currentMonthLabel();
    setMonthLabel(nextLabel);
    await persist("history", nextHistory);
    await persist("personal", { assets, movements: [], monthLabel: nextLabel });
  };

  if (loading) {
    return e("div", { className: "min-h-screen bg-stone-100 flex items-center justify-center text-stone-400 text-sm" }, "Cargando...");
  }

  if (!viewAs) {
    return e("div", { className: "min-h-screen bg-stone-900 flex flex-col items-center justify-center text-white px-6" },
      e("h1", { className: "display-font text-2xl uppercase mb-1 text-center" }, "Finanzas del hogar"),
      e("p", { className: "text-xs text-stone-400 mb-6" }, "¿Quién eres?"),
      e("div", { className: "flex gap-3 w-full max-w-xs" },
        e("button", { onClick: () => setViewAs("seba"), className: "flex-1 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-full py-4" }, "Seba"),
        e("button", { onClick: () => setViewAs("carla"), className: "flex-1 bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold rounded-full py-4" }, "Carla")
      ),
      e("p", { className: "text-[10px] text-stone-500 mt-6 text-center max-w-xs leading-relaxed" }, "Seba ve la gestión personal completa. Carla ve solo el módulo de gastos compartidos.")
    );
  }

  const sebaSections = viewAs === "seba" ? [
    e(SectionCard, { key: "reserva", theme: "forest", title: "Reserva", subtitle: "Racional + depósito · define tu autonomía, se actualiza pocas veces al mes" },
      e("div", { className: "display-font text-3xl mb-3" }, `$${fmt(reserveTotal)}`),
      assets.filter((a) => a.group === "reserva").map((a) => e(AssetRow, { key: a.id, item: a, onChange: updateAsset, onDelete: deleteAsset, showGroupToggle: true, onColor: true })),
      e("button", { onClick: () => addAsset("reserva"), className: "text-xs mt-2 underline opacity-80" }, "+ agregar a Reserva")
    ),
    e(SectionCard, { key: "operativas", theme: "navy", title: "Cuentas operativas", subtitle: "Liquidez del día a día · actualiza el saldo cada vez que revises el banco" },
      e("div", { className: "display-font text-3xl mb-3" }, `$${fmt(operativeTotal)}`),
      assets.filter((a) => a.group !== "reserva").map((a) => e(AssetRow, { key: a.id, item: a, onChange: updateAsset, onDelete: deleteAsset, showGroupToggle: true, onColor: true })),
      e("button", { onClick: () => addAsset("operativa"), className: "text-xs mt-2 underline opacity-80" }, "+ agregar a Operativas")
    ),
    e(SectionCard, { key: "autonomia", theme: "terracota", title: "Autonomía", subtitle: "Reserva ÷ gastos reales de este mes" },
      e(RunwayGauge, { months: runwayMonths })
    ),
    e(SectionCard, { key: "movimientos", theme: "light", title: `Movimientos de ${monthLabel}`, subtitle: "Registra lo que realmente entró o salió" },
      movements.length === 0 ? e("p", { className: "text-xs text-stone-400 italic mb-2" }, "Sin movimientos todavía este mes.") : null,
      movements.map((m) => e(MovementRow, { key: m.id, item: m, onChange: updateMovement, onDelete: deleteMovement })),
      e("div", { className: "flex gap-3 mt-2" },
        e("button", { onClick: () => addMovement("gasto"), className: "text-xs text-red-600 font-medium" }, "+ gasto"),
        e("button", { onClick: () => addMovement("ingreso"), className: "text-xs text-emerald-600 font-medium" }, "+ ingreso")
      ),
      e("div", { className: "mt-3 pt-3 border-t border-stone-100 space-y-1 text-sm" },
        e("div", { className: "flex justify-between text-stone-500" }, e("span", null, "Ingresos"), e("span", { className: "text-emerald-600 font-medium" }, `$${fmt(totalIngresos)}`)),
        e("div", { className: "flex justify-between text-stone-500" }, e("span", null, "Gastos"), e("span", { className: "text-red-600 font-medium" }, `$${fmt(totalGastos)}`)),
        e("div", { className: "flex justify-between font-semibold pt-1 text-stone-800" }, e("span", null, "Neto del mes"), e("span", null, `$${fmt(neto)}`))
      )
    ),
    e("div", { key: "save-personal", className: "mb-3" }, e(PillButton, { onClick: savePersonal }, status || "Guardar cambios")),
    e("div", { key: "close-month", className: "mb-4" }, e(PillButton, { onClick: closeMonth, variant: "dark" }, "Cerrar mes")),
  ] : [];

  const displayBalance = viewAs === "seba" ? sharedBalance : -sharedBalance;
  const other = viewAs === "seba" ? "Carla" : "Seba";

  const sharedCard = e(SectionCard, {
    key: "compartido", theme: "rose",
    title: viewAs === "seba" ? "Compartido con Carla" : "Compartido con Seba",
    subtitle: viewAs === "seba" ? "Registra el gasto y quién lo pagó, el saldo se calcula solo" : "Registra lo que pagaste y el saldo con Seba se calcula solo",
  },
    e("div", { className: "mb-3" },
      displayBalance === 0 ? e("div", { className: "text-lg opacity-80" }, "Están a la par") : null,
      displayBalance > 0 ? e("div", { className: "display-font text-2xl" }, `${other} te debe $${fmt(displayBalance)}`) : null,
      displayBalance < 0 ? e("div", { className: "display-font text-2xl" }, `Le debes a ${other} $${fmt(Math.abs(displayBalance))}`) : null
    ),
    sharedExpenses.length === 0 ? e("p", { className: "text-xs opacity-70 italic mb-2" }, "Sin gastos compartidos registrados todavía.") : null,
    sharedExpenses.map((x) => e(SharedExpenseRow, { key: x.id, item: x, onChange: updateSharedExpense, onDelete: deleteSharedExpense })),
    e("button", { onClick: addSharedExpense, className: "text-xs mt-2 underline opacity-90" }, "+ agregar gasto compartido"),
    settlements.length > 0 ? e("div", { className: "mt-3 pt-3 border-t border-rose-200" },
      e("p", { className: "text-[11px] opacity-70 mb-1" }, "Pagos registrados"),
      settlements.map((st) => e("div", { key: st.id, className: "flex justify-between text-xs py-1" },
        e("span", { className: "opacity-80" }, st.direction === "carla_to_seba" ? "Carla → Seba" : "Seba → Carla"),
        e("div", { className: "flex items-center gap-2" },
          e("span", null, `$${fmt(num(st.amount))}`),
          e("button", { onClick: () => deleteSettlement(st.id), className: "opacity-60 hover:opacity-100" }, "×")
        )
      ))
    ) : null,
    sharedBalance !== 0 ? e("div", { className: "mt-3" },
      e(PillButton, { onClick: () => addSettlement(sharedBalance > 0 ? "carla_to_seba" : "seba_to_carla"), variant: "ghost" },
        `Registrar que ${sharedBalance > 0 ? "Carla me transfirió" : "le transferí a Carla"} $${fmt(Math.abs(sharedBalance))}`)
    ) : null,
    e("div", { className: "mt-3" }, e(PillButton, { onClick: saveSharedModule, variant: sharedSaved ? "success" : "primary" }, sharedSaveStatus || "Guardar cambios")),
    e("p", { className: "text-[10px] opacity-60 mt-3 leading-relaxed" }, "Este saldo es independiente de los gastos fijos de Seba — no se resta de ningún patrimonio, solo lleva la cuenta entre ustedes dos.")
  );

  const historyCard = (viewAs === "seba" && history.length > 0) ? e(SectionCard, { key: "meses", theme: "light", title: "Meses cerrados", subtitle: "Toca un mes para ver el detalle" },
    [...history].reverse().map((h) => {
      const isOpen = expandedMonth === h.label;
      return e("div", { key: h.label, className: "border-b border-stone-100 last:border-0" },
        e("button", { onClick: () => setExpandedMonth(isOpen ? null : h.label), className: "w-full flex items-center justify-between py-2 text-sm text-left" },
          e("span", { className: "text-stone-700 flex items-center gap-1" }, e("span", { className: "text-stone-400 text-xs" }, isOpen ? "▾" : "▸"), h.label),
          e("div", { className: "text-right text-xs" },
            e("div", { className: h.neto >= 0 ? "text-emerald-600" : "text-red-600" }, `neto $${fmt(h.neto)}`),
            e("div", { className: "text-stone-400" }, `patrimonio $${fmt(h.patrimonio)}${h.runway ? ` · ${h.runway}m` : ""}`)
          )
        ),
        isOpen ? e("div", { className: "pb-3 pl-4" },
          e("label", { className: "flex items-center gap-2 text-[11px] text-stone-400 mb-2" }, "renombrar mes",
            e("input", {
              className: "bg-stone-100 rounded px-2 py-1 text-xs text-stone-700 outline-none focus:ring-1 focus:ring-orange-400",
              defaultValue: h.label,
              onBlur: (ev) => { if (ev.target.value && ev.target.value !== h.label) renameHistoryMonth(h.label, ev.target.value); },
            })
          ),
          (!h.movements || h.movements.length === 0) ? e("p", { className: "text-xs text-stone-400 italic" }, "Sin detalle de movimientos guardado para este mes.") : null,
          (h.movements || []).map((m) => e("div", { key: m.id, className: "flex justify-between text-xs py-1" },
            e("span", { className: "text-stone-500" }, m.name || "(sin descripción)"),
            e("span", { className: m.type === "ingreso" ? "text-emerald-600" : "text-red-600" }, `${m.type === "ingreso" ? "+" : "−"}$${fmt(num(m.amount))}`)
          )),
          e("button", { onClick: () => reopenMonth(h), className: "text-xs text-orange-600 mt-2 font-medium" }, "↺ reabrir este mes para editar")
        ) : null
      );
    })
  ) : null;

  const chartCard = (viewAs === "seba" && history.length > 1) ? e(SectionCard, { key: "grafico", theme: "light", title: "Evolución de autonomía", subtitle: "Meses cerrados" },
    e(Sparkline, { data: history, dataKey: "runway", color: "#f97316" })
  ) : null;

  return e("div", { className: "min-h-screen bg-stone-100 px-4 py-6 max-w-md mx-auto" },
    e("div", { className: "flex items-start justify-between mb-1 gap-2" },
      e("h1", { className: "display-font text-2xl leading-tight uppercase text-stone-800" }, viewAs === "seba" ? "Finanzas del hogar" : "Gastos compartidos"),
      e("button", { onClick: () => setViewAs(null), className: "text-[10px] text-stone-400 underline shrink-0 mt-2" }, "cambiar usuario")
    ),
    viewAs === "seba" ? e("input", { className: "bg-transparent text-xs text-stone-500 outline-none w-full mb-1", value: monthLabel, onChange: (ev) => setMonthLabel(ev.target.value) }) : null,
    e("div", { className: "h-4 mb-2" }, status ? e("span", { className: "text-[11px] text-emerald-600 font-medium" }, status) : null),
    sebaSections,
    sharedCard,
    historyCard,
    chartCard,
    e("p", { className: "text-[10px] text-stone-400 text-center mt-6 leading-relaxed" },
      viewAs === "seba" ? "Datos guardados en la base de datos del hogar. El módulo compartido es lo único visible para Carla." : "Solo ves el módulo de gastos compartidos."
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(e(FinanzasSeba));
