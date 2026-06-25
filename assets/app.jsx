/* app.jsx — shell, routing, state, tweaks, mount */
const { useState: uS5, useEffect: uE5, useMemo: uM5, useCallback } = React;

const TWEAK_DEFAULTS = window.BX_TWEAK_DEFAULTS || /*EDITMODE-BEGIN*/{
  "accent": "#9c5b34",
  "paper": ["#ffffff", "#f3f3f3", "#fafafa", "#ffffff", "#222222"],
  "headingFont": "Cabin Sketch",
  "bodyFont": "Cabin Sketch",
  "coverFont": "Cabin Sketch",
  "oneFont": true,
  "density": "Airy",
  "textScale": 100,
  "radius": 14,
  "coverStyle": "classic"
}/*EDITMODE-END*/;

const TYPE_PRESETS = {
  "Antiquarian": { heading:"EB Garamond",     body:"Karla",      cover:"EB Garamond" },
  "Editorial":   { heading:"Newsreader",      body:"Newsreader", cover:"Newsreader" },
  "Swiss":       { heading:"Helvetica",       body:"Helvetica",  cover:"Helvetica" },
  "Maison":      { heading:"Playfair Display", body:"Jost",       cover:"Playfair Display" },
};

const FONT_STACK = (name, fb) => ({
  "Helvetica": '"Helvetica Neue", Helvetica, Arial, sans-serif',
  "Arial": 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  "Times New Roman": '"Times New Roman", Times, serif',
  "Baskerville": 'Baskerville, "Libre Baskerville", "Times New Roman", serif',
  "Georgia": 'Georgia, "Times New Roman", serif',
}[name]) || `"${name}", ${fb}`;

function applyTweaks(t) {
  const root = document.documentElement.style;
  root.setProperty("--rust", t.accent);
  root.setProperty("--rust-deep", shade(t.accent, -0.16));
  const [p, p2, surf, card, ink] = t.paper;
  root.setProperty("--paper", p); root.setProperty("--paper-2", p2);
  root.setProperty("--surface", surf); root.setProperty("--card", card);
  root.setProperty("--ink", ink);
  // derive coherent neutrals between ink and paper (works for light AND dark palettes)
  root.setProperty("--ink-2", mix(ink, p, 0.26));
  root.setProperty("--muted",  mix(ink, p, 0.50));
  root.setProperty("--faint",  mix(ink, p, 0.66));
  root.setProperty("--line",   mix(ink, p, 0.86));
  root.setProperty("--line-2", mix(ink, p, 0.78));
  const preset = TYPE_PRESETS[t.typePreset];
  let headingF = t.headingFont || (preset && preset.heading) || "EB Garamond";
  let bodyF    = t.bodyFont    || (preset && preset.body)    || "Karla";
  let coverF   = t.coverFont   || (preset && preset.cover)   || headingF;
  if (t.oneFont) { bodyF = headingF; coverF = headingF; }
  if (window.ensureFont) { ensureFont(headingF); ensureFont(bodyF); ensureFont(coverF); }
  root.setProperty("--serif", FONT_STACK(headingF, "Georgia, serif"));
  root.setProperty("--sans", FONT_STACK(bodyF, "-apple-system, sans-serif"));
  root.setProperty("--cover", FONT_STACK(coverF, "Georgia, serif"));
  root.setProperty("--r-lg", t.radius + "px");
  document.documentElement.setAttribute("data-density", (t.density || "Cozy").toLowerCase());
  root.setProperty("--tscale", (t.textScale || 100) / 100);
}
const _h2rgb = (hex) => { const n = parseInt(hex.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; };
const _rgb2h = (a) => "#" + a.map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0")).join("");
function mix(h1, h2, ratio) { // ratio 0 => h1, 1 => h2
  const a = _h2rgb(h1), b = _h2rgb(h2);
  return _rgb2h([0,1,2].map(i => a[i] + (b[i]-a[i])*ratio));
}
function shade(hex, amt) {
  const [r,g,b] = _h2rgb(hex);
  return _rgb2h([r + r*amt, g + g*amt, b + b*amt]);
}

const LS_KEY = "bx_library_v3";

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  uE5(() => applyTweaks(t), [t]);

  const [library, setLibrary] = uS5(() => {
    try { const s = localStorage.getItem(LS_KEY); if (s) return JSON.parse(s); } catch(e){}
    return JSON.parse(JSON.stringify(window.BX_DATA.library));
  });
  uE5(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(library)); } catch(e){} }, [library]);

  const [stack, setStack] = uS5([{ view:"home", params:{} }]);
  const cur = stack[stack.length - 1];

  const nav = useCallback((view, params={}) => { setStack(s => [...s, { view, params }]); window.scrollTo(0,0); }, []);
  const back = useCallback(() => setStack(s => s.length>1 ? s.slice(0,-1) : s), []);
  const openBook = useCallback((id) => nav("book", { id }), [nav]);
  const openAuthor = useCallback((id) => nav("author", { id }), [nav]);

  // library actions
  const setStatus = (id, status) => setLibrary(L => ({ ...L, [id]: { status, userRating:0, notes:"", dateAdded:new Date().toISOString().slice(0,10), ...(L[id]||{}), status } }));
  const removeFromLib = (id) => setLibrary(L => { const n = { ...L }; delete n[id]; return n; });
  const setNote = (id, notes) => setLibrary(L => L[id] ? ({ ...L, [id]: { ...L[id], notes } }) : ({ ...L, [id]: { status:"queue", userRating:0, dateAdded:new Date().toISOString().slice(0,10), notes } }));
  const setUserRating = (id, userRating) => setLibrary(L => L[id] ? ({ ...L, [id]: { ...L[id], userRating } }) : ({ ...L, [id]: { status:"finished", userRating, notes:"", dateAdded:new Date().toISOString().slice(0,10) } }));
  // user-curated related reads (only available on books in the library)
  const addRelated = (id, relId) => setLibrary(L => {
    const e = L[id]; if (!e || relId === id) return L;
    const cur = e.userRelated || [];
    if (cur.includes(relId)) return L;
    return { ...L, [id]: { ...e, userRelated: [...cur, relId] } };
  });
  const removeRelated = (id, relId) => setLibrary(L => {
    const e = L[id]; if (!e) return L;
    return { ...L, [id]: { ...e, userRelated: (e.userRelated || []).filter(x => x !== relId) } };
  });

  const ctx = { library, nav, back, openBook, openAuthor, setStatus, removeFromLib, setNote, setUserRating, addRelated, removeRelated, params: cur.params };

  const Screen = { home: HomeScreen, results: ResultsScreen, book: BookDetail, author: AuthorScreen, library: LibraryScreen }[cur.view] || HomeScreen;

  return (
    <div>
      <Header cur={cur} nav={nav} back={back} canBack={stack.length > 1} library={library} />
      <main className="wrap" style={{ padding:"0 28px 100px", minHeight:"60vh" }}>
        <Screen ctx={ctx} key={cur.view + JSON.stringify(cur.params)} />
      </main>
      <Footer />
      <MobileNav cur={cur} nav={nav} />
      <TweaksUI t={t} setTweak={setTweak} />
    </div>
  );
}

function MobileNav({ cur, nav }) {
  const icons = {
    home: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.8 9.2l-1.6 4.4-4.4 1.6 1.6-4.4z"/></svg>,
    results: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
    library: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h4v14H4zM10 5h4v14h-4z"/><path d="M16.5 5.4l3.5.9-3.3 12.8-3.5-.9"/></svg>,
  };
  const items = [["home","Discover"],["results","Search"],["library","Library"]];
  const tab = (view, label) => {
    const active = cur.view === view;
    return (
      <button key={view} onClick={() => nav(view)} aria-label={label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, background:"none", border:"none", padding:"8px 2px", color: active ? "var(--rust)" : "var(--muted)", cursor:"pointer" }}>
        {icons[view]}
        <span style={{ fontSize:11, fontWeight:active?600:500, fontFamily:"var(--mono)", letterSpacing:".02em" }}>{label}</span>
      </button>
    );
  };
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {items.map(([v,l]) => tab(v,l))}
    </nav>
  );
}

function Header({ cur, nav, back, canBack, library }) {
  const [q, setQ] = uS5("");
  const total = Object.keys(library).length;
  const navItem = (label, view) => (
    <button onClick={() => nav(view)} style={{ background:"none", border:"none", fontSize:14, fontWeight:500, color: cur.view===view?"#fff":"rgba(255,255,255,.72)", padding:"6px 2px", position:"relative" }}>
      {label}
      {cur.view===view && <span style={{ position:"absolute", left:0, right:0, bottom:-2, height:2, background:"#fff", borderRadius:2 }}></span>}
    </button>
  );
  return (
    <header style={{ position:"sticky", top:0, zIndex:30, background:"var(--rust)", color:"#fff", backdropFilter:"blur(10px)", borderBottom:"1px solid var(--rust-deep)" }}>
      <div className="wrap" style={{ display:"flex", alignItems:"center", gap:24, height:62 }}>
        {canBack && (
          <button onClick={back} title="Back" aria-label="Back" className="btn btn-sm btn-ghost" style={{ flex:"none", padding:"6px 10px", marginLeft:-4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}
        <div onClick={() => nav("home")} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", flex:"none" }}>
          <Logo light />
          <span className="header-wordmark" style={{ fontFamily:"var(--serif)", fontSize:19, fontWeight:600, letterSpacing:"-.01em", color:"#fff" }}>BookHunt</span>
        </div>
        <nav style={{ display:"flex", gap:20, flex:"none" }} className="topnav">
          {navItem("Discover","home")}
          {navItem("Search","results")}
          {navItem("Library","library")}
        </nav>
        {cur.view !== "home" && (
          <form onSubmit={(e)=>{e.preventDefault(); if(q.trim()) nav("results",{q});}} style={{ flex:1, maxWidth:380, marginLeft:"auto", display:"flex", alignItems:"center", gap:8, background:"var(--card)", border:"1px solid var(--line-2)", borderRadius:999, padding:"5px 6px 5px 14px" }} className="header-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" style={{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:14, fontFamily:"var(--serif)", color:"var(--ink)" }} />
          </form>
        )}
        <div style={{ marginLeft: cur.view==="home"?"auto":0, display:"flex", alignItems:"center", gap:14, flex:"none" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} title="Eleanor R. — signed in">
            <span style={{ width:30, height:30, borderRadius:99, background:"#fff", color:"var(--rust)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--serif)", fontSize:14, fontWeight:600 }}>E</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function Logo({ light }) {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="4" width="26" height="24" rx="2.5" fill={light ? "#fff" : "var(--rust)"}/>
      <path d="M16 6.5v19" stroke={light ? "var(--rust)" : "var(--card)"} strokeWidth="1.6"/>
      <path d="M7.5 10.5h5M7.5 14h5M19.5 10.5h5M19.5 14h5" stroke={light ? "var(--rust)" : "var(--card)"} strokeWidth="1.4" strokeLinecap="round" opacity=".8"/>
    </svg>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop:"1px solid var(--line)", marginTop:40 }}>
      <div className="wrap" style={{ padding:"26px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <Logo /><span style={{ fontFamily:"var(--serif)", fontSize:15 }}>BookHunt</span>
          <span style={{ fontSize:12.5, color:"var(--muted)", marginLeft:6 }}>a personal reading companion</span>
        </div>
        <div style={{ fontSize:12, color:"var(--faint)", fontFamily:"var(--mono)" }}>Sample catalog · AI search & summaries</div>
      </div>
    </footer>
  );
}

function TweaksUI({ t, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Accent" />
      <TweakColor label="Accent color" value={t.accent}
        options={["#9c5b34","#6f7a55","#5c6b72","#815065","#b08a3e"]}
        onChange={(v) => setTweak("accent", v)} />
      <TweakSection label="Paper" />
      <TweakColor label="Paper tone" value={t.paper}
        options={[
          ["#f4efe4","#ece5d6","#fbf8f1","#fffdf7","#2a2620"],
          ["#f1ece2","#e7e0d2","#f8f4ec","#fcf9f2","#33271c"],
          ["#eef0ee","#e2e6e1","#f6f7f5","#fdfdfb","#23262a"],
          ["#ffffff","#f3f3f3","#fafafa","#ffffff","#222222"],
          ["#1c1a17","#272320","#211e1a","#2a2620","#efe9dc"]
        ]}
        onChange={(v) => setTweak("paper", v)} />
      <TweakSection label="Type" />
      <TweakToggle label="Use one font everywhere" value={t.oneFont}
        onChange={(v) => setTweak("oneFont", v)} />
      <FontPicker label={t.oneFont ? "Font" : "Headings"} value={t.headingFont}
        onChange={(v) => setTweak("headingFont", v)} />
      {!t.oneFont && <FontPicker label="Body" value={t.bodyFont}
        onChange={(v) => setTweak("bodyFont", v)} />}
      {!t.oneFont && <FontPicker label="Book covers" value={t.coverFont}
        onChange={(v) => setTweak("coverFont", v)} />}
      <TweakSection label="Shape" />
      <TweakSlider label="Card radius" value={t.radius} min={2} max={24} unit="px"
        onChange={(v) => setTweak("radius", v)} />
      <TweakSection label="Layout" />
      <TweakRadio label="Density" value={t.density}
        options={["Cozy","Airy"]}
        onChange={(v) => setTweak("density", v)} />
      <TweakSlider label="Text size" value={t.textScale} min={85} max={130} step={5} unit="%"
        onChange={(v) => setTweak("textScale", v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
