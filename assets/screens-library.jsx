/* screens-library.jsx — LibraryScreen + photo-import modal */
const { useState: uS4, useEffect: uE4, useRef: uR4, useMemo: uM4 } = React;

function ScanModal({ ctx, onClose }) {
  const BX = BXa();
  const { library, setStatus } = ctx;
  const [img, setImg] = uS4(null);
  const [phase, setPhase] = uS4("upload"); // upload | scanning | results
  const [detected, setDetected] = uS4([]);
  const [chosen, setChosen] = uS4({}); // id -> status
  const fileRef = uR4(null);

  const candidates = uM4(() => BX.allBooks().filter(b => !library[b.id]), [library]);

  const onFile = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImg(url); setPhase("scanning");
    // simulate spine detection
    const picks = candidates.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(6, candidates.length));
    setTimeout(() => {
      setDetected(picks);
      setChosen(Object.fromEntries(picks.map(b => [b.id, "queued"])));
      setPhase("results");
    }, 2200);
  };

  const addAll = () => {
    Object.entries(chosen).forEach(([id, st]) => { if (st) setStatus(id, st); });
    onClose();
  };
  const toggle = (id) => setChosen(c => ({ ...c, [id]: c[id] ? null : "queued" }));
  const cycle = (id) => setChosen(c => {
    const order = ["queued","reading","finished"]; const cur = c[id];
    const next = order[(order.indexOf(cur)+1) % order.length];
    return { ...c, [id]: next };
  });

  return ReactDOM.createPortal((
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:24, background:"rgba(42,38,32,.4)", backdropFilter:"blur(3px)" }} onClick={onClose}>
      <div className="card fade-up" onClick={e=>e.stopPropagation()} style={{ width:"min(720px, 100%)", maxHeight:"88vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-3)", padding:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--line)" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:5 }}>Add from a photo</div>
            <h3 style={{ fontSize:21 }}>Scan a shelf into your library</h3>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} style={{ fontSize:20, padding:"2px 10px" }}>×</button>
        </div>

        <div style={{ padding:24, overflowY:"auto" }}>
          {phase === "upload" && (
            <div>
              <div onClick={() => fileRef.current.click()}
                style={{ cursor:"pointer", border:"2px dashed var(--line-2)", borderRadius:"var(--r-lg)", padding:"46px 24px", textAlign:"center", background:"var(--surface)" }}>
                <div style={{ fontSize:34, marginBottom:10 }}>📷</div>
                <div style={{ fontFamily:"var(--serif)", fontSize:18, marginBottom:6 }}>Drop a photo of your bookshelf</div>
                <p style={{ fontSize:13.5, color:"var(--muted)" }}>We’ll read the spines and match them to the catalog. Click to choose a photo.</p>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files[0])} />
              </div>
              <p style={{ fontSize:12, color:"var(--faint)", marginTop:12, fontFamily:"var(--mono)" }}>Demo: spine detection is simulated and matched against the sample catalog.</p>
            </div>
          )}

          {phase === "scanning" && (
            <div style={{ position:"relative", borderRadius:"var(--r-lg)", overflow:"hidden", background:"#000" }}>
              <img src={img} alt="" style={{ width:"100%", maxHeight:380, objectFit:"cover", display:"block", opacity:.8 }} />
              <div style={{ position:"absolute", left:0, right:0, height:3, background:"var(--rust)", boxShadow:"0 0 18px 4px var(--rust)", animation:"scanline 2s linear infinite" }}></div>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"flex-end", justifyContent:"center", paddingBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(20,17,15,.7)", color:"#fff", padding:"9px 16px", borderRadius:999, fontSize:13.5 }}>
                  <span className="spinner" style={{ borderTopColor:"#fff" }}></span> Reading spines…
                </div>
              </div>
            </div>
          )}

          {phase === "results" && (
            <div>
              <p style={{ fontSize:14, color:"var(--ink-2)", marginBottom:18 }}>
                Found <strong>{detected.length}</strong> {detected.length===1?"book":"books"}. Tap a status to change it, or untick to skip.
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {detected.map(b => {
                  const st = chosen[b.id];
                  return (
                    <div key={b.id} style={{ display:"flex", gap:13, alignItems:"center", padding:"8px 10px", borderRadius:"var(--r-md)", background: st?"var(--surface)":"transparent", border:"1px solid var(--line)", opacity: st?1:.55 }}>
                      <Cover book={b} w={40} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"var(--serif)", fontWeight:600, fontSize:15 }}>{b.title}</div>
                        <div style={{ fontSize:12.5, color:"var(--muted)" }}>{BX.authorOf(b).name}</div>
                      </div>
                      {st && <button className="pill click" onClick={() => cycle(b.id)} style={{ borderColor: BX.STATUS_COLOR[st], color: BX.STATUS_COLOR[st] }}>
                        <span style={{width:6,height:6,borderRadius:99,background:BX.STATUS_COLOR[st]}}></span>{BX.STATUS_LABEL[st]}</button>}
                      <button className="btn btn-sm btn-ghost" onClick={() => toggle(b.id)} style={{ width:30, padding:"4px 0", justifyContent:"center" }}>{st ? "✓" : "+"}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {phase === "results" && (
          <div style={{ padding:"16px 24px", borderTop:"1px solid var(--line)", display:"flex", justifyContent:"flex-end", gap:10 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={addAll}>Add {Object.values(chosen).filter(Boolean).length} to library</button>
          </div>
        )}
      </div>
    </div>
  ), document.body);
}

function LibraryScreen({ ctx }) {
  const BX = BXa();
  const { library, params, openBook, nav } = ctx;
  const [scan, setScan] = uS4(!!params.scan);
  const [chartActive, setChartActive] = uS4(null);
  const [filter, setFilter] = uS4(params.status ? { type:"status", value:params.status, label:BX.STATUS_LABEL[params.status] } : null); // { type:'status'|'subject'|'author', value, label }
  const stats = uM4(() => BX.libraryStats(library), [library]);
  const PAGE_SIZE = 60;
  const [page, setPage] = uS4(1);
  uE4(() => { setPage(1); }, [filter]);

  const ids = Object.keys(library);
  let shelf = ids.map(BX.getBook).filter(Boolean);
  if (filter) {
    if (filter.type === "status") shelf = shelf.filter(b => library[b.id].status === filter.value);
    else if (filter.type === "subject") shelf = shelf.filter(b => b.s.includes(filter.value));
    else if (filter.type === "author") shelf = shelf.filter(b => BX.authorOf(b).name === filter.value);
  }
  shelf = shelf.sort((a,z) => (library[z.id].dateAdded||"").localeCompare(library[a.id].dateAdded||""));

  // pagination — keep DOM light no matter how big the library gets
  const totalPages = Math.max(1, Math.ceil(shelf.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  uE4(() => { if (page !== pageSafe) setPage(pageSafe); }, [pageSafe]);
  const pageItems = shelf.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const goPage = (n) => { setPage(n); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const pageList = () => {
    const out = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) out.push(i); return out; }
    out.push(1);
    if (pageSafe > 3) out.push("…");
    for (let i = Math.max(2, pageSafe - 1); i <= Math.min(totalPages - 1, pageSafe + 1); i++) out.push(i);
    if (pageSafe < totalPages - 2) out.push("…");
    out.push(totalPages);
    return out;
  };

  const ChartCard = ({ title, data, colors, type }) => {
    const pick = (d) => {
      const v = d.key || d.label;
      setFilter(f => (f && f.type === type && f.value === v) ? null : { type, value: v, label: d.label });
    };
    const sel = filter && filter.type === type ? filter.label : null;
    return (
      <div className="card" style={{ padding:"22px 24px" }}>
        <div className="eyebrow" style={{ marginBottom:16 }}>{title}</div>
        {data.length ? <PieChart data={data} size={150} colors={colors} onSlice={setChartActive} onPick={pick} activeLabel={chartActive || sel} />
          : <div className="muted" style={{ fontSize:14 }}>No data yet.</div>}
      </div>
    );
  };

  return (
    <div className="fade-up">
      {scan && <ScanModal ctx={ctx} onClose={() => setScan(false)} />}

      {stats.total === 0 ? (
        <div style={{ textAlign:"center", maxWidth:520, margin:"40px auto", padding:"60px 28px" }}>
          <div style={{ width:72, height:72, borderRadius:"50%", background:"var(--surface)", border:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 22px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" strokeWidth="1.6"><path d="M4 5v14M4 6.5h11a2 2 0 012 2V19M9 5v14"/></svg>
          </div>
          <div className="eyebrow" style={{ marginBottom:10 }}>Your library</div>
          <h1 style={{ fontSize:"clamp(26px,4vw,34px)", marginBottom:12 }}>Your shelves are empty</h1>
          <p style={{ color:"var(--ink-2)", fontSize:15.5, lineHeight:1.65, marginBottom:26 }}>
            Find a book and add it to start building your library. Once you do, you’ll see it
            here broken down by status, subject, and author — or add a whole shelf from a single photo.
          </p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <button className="btn btn-primary" onClick={() => nav("home")}>Discover books</button>
            <button className="btn" onClick={() => setScan(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.2"/><path d="M8 6l1.5-2.2h5L16 6"/></svg>
              Add from a photo
            </button>
          </div>
        </div>
      ) : (
      <React.Fragment>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, marginBottom:30, flexWrap:"wrap" }}>
        <div style={{ flex:"1 1 auto", minWidth:0 }}>
          <div className="eyebrow" style={{ marginBottom:8 }}>Your library</div>
          <h1 style={{ fontSize:"clamp(28px,4vw,40px)" }}>{stats.total} books</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setScan(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.2"/><path d="M8 6l1.5-2.2h5L16 6"/></svg>
          Add from a photo
        </button>
      </div>

      {/* charts */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px,1fr))", gap:20, marginBottom:40 }}>
        <ChartCard title="By status" type="status" data={stats.status.map(s => ({ ...s, color: BX.STATUS_COLOR[s.key] }))} />
        <ChartCard title="By subject" type="subject" data={stats.subject.slice(0,7)} />
        <ChartCard title="By author" type="author" data={stats.author.slice(0,7)} />
      </div>

      {/* shelf */}
      <div style={{ display:"flex", gap:8, marginBottom:22, flexWrap:"wrap", alignItems:"center" }}>
        <button className={"pill click" + (!filter?" active":"")} onClick={() => setFilter(null)}>All ({stats.total})</button>
        {[["finished","Finished"],["reading","Reading"],["queued","Queued"],["abandoned","Abandoned"]].map(([v,label]) => {
          const n = ids.filter(id => library[id].status === v).length;
          if (!n) return null;
          const on = filter && filter.type==="status" && filter.value===v;
          return <button key={v} className={"pill click" + (on?" active":"")} onClick={() => setFilter(on ? null : { type:"status", value:v, label })}>{label} ({n})</button>;
        })}
        {filter && filter.type !== "status" && (
          <button className="pill click active" onClick={() => setFilter(null)} style={{ display:"inline-flex", alignItems:"center", gap:7, textTransform:"capitalize" }}>
            {filter.type}: {filter.label}
            <span style={{ fontSize:15, lineHeight:1, opacity:.7 }}>×</span>
          </button>
        )}
      </div>

      {shelf.length ? (
        <React.Fragment>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(102px,1fr))", gap:26 }}>
          {pageItems.map(b => <BookCard key={b.id} book={b} library={library} onOpen={openBook} />)}
        </div>
        {totalPages > 1 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:40, flexWrap:"wrap" }}>
            <button className="btn btn-sm" disabled={pageSafe === 1} onClick={() => goPage(pageSafe - 1)}
              style={{ opacity: pageSafe === 1 ? .4 : 1, cursor: pageSafe === 1 ? "default" : "pointer" }}>‹ Prev</button>
            {pageList().map((p, i) => p === "…"
              ? <span key={"e"+i} style={{ color:"var(--faint)", padding:"0 4px", fontSize:14 }}>…</span>
              : <button key={p} className={"pill click" + (p === pageSafe ? " active" : "")} onClick={() => goPage(p)}
                  style={{ minWidth:34, justifyContent:"center" }}>{p}</button>)}
            <button className="btn btn-sm" disabled={pageSafe === totalPages} onClick={() => goPage(pageSafe + 1)}
              style={{ opacity: pageSafe === totalPages ? .4 : 1, cursor: pageSafe === totalPages ? "default" : "pointer" }}>Next ›</button>
          </div>
        )}
        </React.Fragment>
      ) : (
        <div style={{ textAlign:"center", padding:"50px", color:"var(--muted)" }}>Nothing here yet.</div>
      )}
      </React.Fragment>
      )}
    </div>
  );
}

Object.assign(window, { LibraryScreen, ScanModal });
