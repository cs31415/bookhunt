/* fontpicker.jsx — searchable font dropdown for the Tweaks panel.
   Filters FONT_CATALOG, lazy-loads each visible row's face for live preview,
   and ensures the chosen family is loaded on pick. Pairs with TweakRow. */

const fpStack = (name) => (window.FONT_STACK ? window.FONT_STACK(name, "Georgia, serif") : `"${name}", Georgia, serif`);

function FontRow({ family, active, onPick }) {
  const ref = React.useRef(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { ensureFont(family); setSeen(true); io.disconnect(); }
      });
    }, { root: el.closest("[data-fontscroll]") || null, rootMargin: "160px" });
    io.observe(el);
    return () => io.disconnect();
  }, [family]);
  return (
    <button ref={ref} type="button" onClick={onPick} title={family}
      style={{ display:"block", width:"100%", textAlign:"left", border:"none",
        background: active ? "rgba(156,91,52,.14)" : "transparent", color:"inherit",
        padding:"8px 12px", cursor:"pointer", fontSize:14, lineHeight:1.2,
        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        fontFamily: seen ? fpStack(family) : "inherit",
        borderLeft: active ? "2px solid var(--rust)" : "2px solid transparent" }}>
      {family}
    </button>
  );
}

function FontPicker({ label, value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  React.useEffect(() => { ensureFont(value); }, [value]);
  const list = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? FONT_CATALOG.filter((f) => f.toLowerCase().includes(s)) : FONT_CATALOG;
  }, [q]);
  return (
    <TweakRow label={label} value={null}>
      <button type="button" className="twk-field" onClick={() => setOpen((o) => !o)}
        style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          textAlign:"left", fontFamily: fpStack(value) }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</span>
        <span style={{ opacity:.45, fontFamily:"system-ui", marginLeft:8 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{ marginTop:6, border:".5px solid rgba(0,0,0,.12)", borderRadius:8,
          background:"rgba(255,255,255,.96)", overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,.12)" }}>
          <input autoFocus className="twk-field" placeholder={`Search ${FONT_CATALOG.length} fonts…`}
            value={q} onChange={(e) => setQ(e.target.value)}
            style={{ border:"none", borderBottom:".5px solid rgba(0,0,0,.1)", borderRadius:0 }} />
          <div data-fontscroll style={{ maxHeight:248, overflowY:"auto" }}>
            {list.map((f) => (
              <FontRow key={f} family={f} active={f === value}
                onPick={() => { ensureFont(f); onChange(f); setOpen(false); setQ(""); }} />
            ))}
            {list.length === 0 && (
              <div style={{ padding:"10px 12px", color:"rgba(41,38,27,.5)", fontSize:13 }}>No matches</div>
            )}
          </div>
        </div>
      )}
    </TweakRow>
  );
}

Object.assign(window, { FontPicker, FontRow });
