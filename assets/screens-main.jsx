/* screens-main.jsx — SearchBar, HomeScreen, ResultsScreen */
const { useState: uS2, useEffect: uE2, useRef: uR2, useMemo: uM2 } = React;

const EXAMPLES = [
  "books for an intelligent layman on evolution",
  "bleak but beautiful literary fiction",
  "mind-expanding science I can finish in a weekend",
  "where should I start with Dostoevsky",
  "history that reads like a thriller",
];

function SearchBar({ value, onChange, onSubmit, autoFocus, big, placeholder }) {
  const ref = uR2(null);
  uE2(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}
      style={{ display:"flex", alignItems:"center", gap: 10, width:"100%",
        background:"var(--card)", border:"1px solid var(--line-2)", borderRadius: 999,
        padding: big ? "6px 6px 6px 22px" : "4px 4px 4px 16px", boxShadow:"var(--shadow-1)" }}>
      <svg width={big?20:17} height={big?20:17} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{flex:"none"}}>
        <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
      </svg>
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search by idea, title, author, mood…"}
        style={{ flex:1, border:"none", outline:"none", background:"transparent", color:"var(--ink)",
          fontSize: big ? 18 : 15, padding: big ? "8px 0" : "6px 0", fontFamily:"var(--serif)" }} />
      <button type="submit" className="btn btn-primary" style={{ padding: big ? "11px 22px" : "8px 16px" }}>Search</button>
    </form>
  );
}

function HomeScreen({ ctx }) {
  const BX = BXa();
  const { library, nav, openBook } = ctx;
  const [q, setQ] = uS2("");
  const [chartActive, setChartActive] = uS2(null);
  const recs = uM2(() => BX.recommendations(library, 4), [library]);
  const reading = Object.keys(library).filter(id => library[id].status === "reading").map(BX.getBook).filter(Boolean);
  const stats = uM2(() => BX.libraryStats(library), [library]);
  const submit = (val) => { if (val.trim()) nav("results", { q: val }); };

  return (
    <div className="fade-up">
      {/* hero */}
      <div style={{ textAlign:"center", padding:"54px 0 30px", maxWidth: 760, margin:"0 auto" }}>
        <div style={{ maxWidth: 620, margin:"0 auto" }}>
          <SearchBar value={q} onChange={setQ} onSubmit={submit} big autoFocus />
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginTop:18 }}>
          {EXAMPLES.slice(0,4).map(ex => (
            <button key={ex} className="pill click" onClick={() => { setQ(ex); submit(ex); }}>{ex}</button>
          ))}
        </div>
      </div>

      {/* continue reading */}
      {reading.length > 0 && (
        <section style={{ margin:"40px 0" }}>
          <SectionHead title="Currently reading" />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap: 18 }}>
            {reading.map(b => (
              <div key={b.id} className="card" style={{ display:"flex", gap:16, padding:16, cursor:"pointer" }} onClick={() => openBook(b.id)}>
                <Cover book={b} w={78} />
                <div style={{ flex:1, minWidth:0 }}>
                  <h4 style={{ fontSize:17 }}>{b.title}</h4>
                  <div style={{ fontSize:13, color:"var(--muted)", margin:"3px 0 10px" }}>{BX.authorOf(b).name}</div>
                  {library[b.id].notes && <p style={{ fontSize:13, color:"var(--ink-2)", fontStyle:"italic", lineHeight:1.5 }}>“{library[b.id].notes}”</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* recommendations */}
      <section style={{ margin:"44px 0" }}>
        <SectionHead title="Recommended for you"
          action={<button className="btn btn-sm" onClick={() => nav("results", { q:"", recs:true })}>See more</button>} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px,1fr))", gap: 20 }}>
          {recs.map(({ b, reason }) => (
            <BookCard key={b.id} book={b} library={library} onOpen={openBook} reason={reason} />
          ))}
        </div>
      </section>

      {/* library snapshot */}
      <section className="card" style={{ margin:"44px 0", padding:"28px 30px", display:"flex", gap:40, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ flex:"1 1 260px" }}>
          <div className="eyebrow" style={{ marginBottom:8 }}>Your library</div>
          <h2 style={{ fontSize:26, marginBottom:10 }}>{stats.total > 0 ? `${stats.total} books, and counting` : "Start your library"}</h2>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button className="btn btn-primary" onClick={() => nav("library")}>{stats.total > 0 ? "Open library" : "Add your first book"}</button>
          </div>
        </div>
        <div style={{ flex:"0 0 auto" }}>
          {stats.status.length > 0
            ? <PieChart data={stats.status.map(s => ({ ...s, color: BX.STATUS_COLOR[s.key] }))} size={172}
                onSlice={setChartActive} activeLabel={chartActive} onPick={(d) => nav("library", { status: d.key })} />
            : <div style={{ width:172, height:172, borderRadius:"50%", border:"2px dashed var(--line-2)", display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
                <span style={{ fontSize:13, color:"var(--muted)", maxWidth:120, lineHeight:1.4 }}>Your reading breakdown appears here</span>
              </div>}
        </div>
      </section>
    </div>
  );
}

function ResultsScreen({ ctx }) {
  const BX = BXa();
  const { library, nav, openBook, params } = ctx;
  const [q, setQ] = uS2(params.q || "");
  const [submitted, setSubmitted] = uS2(params.q || "");
  const [loading, setLoading] = uS2(false);
  const [results, setResults] = uS2(null);
  const [interp, setInterp] = uS2(null);
  const [usedAI, setUsedAI] = uS2(false);
  const [inLib, setInLib] = uS2(false);
  const [filters, setFilters] = uS2(params.mood ? { mood: params.mood } : {});
  const [sort, setSort] = uS2("relevance");
  const [gb, setGb] = uS2({ books: null, loading: false, error: null });
  const [page, setPage] = uS2(1);
  const recsMode = params.recs;

  const run = async (query) => {
    setSubmitted(query); setLoading(true); setInterp(null);
    if (!query.trim()) { // pure filter browse
      setResults(BX.localSearch("", { inLibraryOnly: inLib, library, filters }));
      setLoading(false); setUsedAI(false); setGb({ books: null, loading: false, error: null }); return;
    }
    // live Google Books search runs in parallel with the catalog/AI search
    setGb({ books: null, loading: true, error: null });
    BX.googleSearch(query, 16).then(g => setGb({ books: g.books, loading: false, error: g.error }));
    const res = await BX.aiSearch(query, { inLibraryOnly: inLib, library });
    setUsedAI(res.ok); setInterp(res.interpretation);
    setResults(res.ids.map(BX.getBook).filter(Boolean));
    setLoading(false);
  };

  uE2(() => {
    if (recsMode) { setResults(BX.recommendations(library, 12).map(r => r.b)); return; }
    run(params.q || "");
  }, []);

  // re-filter locally when filters/inLib change (without re-hitting AI)
  uE2(() => {
    if (recsMode || results === null) return;
    // apply post-filters to current result set
  }, [filters, inLib]);

  const applyFilters = (list) => {
    let r = list.slice();
    if (inLib) r = r.filter(b => library[b.id]);
    if (filters.subject) r = r.filter(b => b.s.includes(filters.subject));
    if (filters.mood) r = r.filter(b => b.m.includes(filters.mood));
    if (filters.status) r = r.filter(b => library[b.id] && library[b.id].status === filters.status);
    if (filters.century) r = r.filter(b => Math.floor(b.year/100)*100 === filters.century);
    if (sort === "rating") r = r.sort((a,z) => z.rating - a.rating);
    if (sort === "year-new") r = r.sort((a,z) => z.year - a.year);
    if (sort === "year-old") r = r.sort((a,z) => a.year - z.year);
    if (sort === "title") r = r.sort((a,z) => a.title.localeCompare(z.title));
    return r;
  };

  const shown = results ? applyFilters(results) : [];
  // pagination for catalog results
  const PAGE_SIZE = 60;
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  uE2(() => { setPage(1); }, [submitted, filters, inLib, sort, recsMode]);
  uE2(() => { if (page !== pageSafe) setPage(pageSafe); }, [pageSafe]);
  const shownPage = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
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
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const catTitles = new Set(shown.map(b => norm(b.title)));
  const gbShown = (gb.books || []).filter(b => !catTitles.has(norm(b.title)));
  const filtersActive = Object.values(filters).some(Boolean) || inLib;
  const showGoogle = !!submitted && !recsMode && !filtersActive;
  const toggleFilter = (k, v) => setFilters(f => ({ ...f, [k]: f[k] === v ? undefined : v }));
  const centuries = [...new Set(BX.allBooks().map(b => Math.floor(b.year/100)*100))].sort((a,z)=>z-a);

  const FilterGroup = ({ title, items, k }) => (
    <div style={{ marginBottom: 22 }}>
      <div className="eyebrow" style={{ marginBottom:10 }}>{title}</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
        {items.map(it => (
          <button key={it.v} className={"pill click" + (filters[k] === it.v ? " active":"")}
            onClick={() => toggleFilter(k, it.v)}>{it.label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fade-up">
      <div style={{ maxWidth: 640, margin:"8px 0 26px" }}>
        <SearchBar value={q} onChange={setQ} onSubmit={run} big placeholder="Refine your search…" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"232px 1fr", gap: 38, alignItems:"start" }} className="results-grid">
        {/* filter rail */}
        <aside style={{ position:"sticky", top: 88, maxHeight:"calc(100vh - 108px)", overflowY:"auto", paddingRight:8, marginRight:-8 }}>
          <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22, cursor:"pointer", fontSize:14 }}>
            <span onClick={() => setInLib(v => !v)} style={{ width:38, height:22, borderRadius:99, background: inLib?"var(--rust)":"var(--line-2)", position:"relative", transition:".15s", flex:"none" }}>
              <span style={{ position:"absolute", top:2, left: inLib?18:2, width:18, height:18, borderRadius:99, background:"#fff", transition:".15s", boxShadow:"var(--shadow-1)" }}></span>
            </span>
            <span>In my library only</span>
          </label>
          <FilterGroup title="Category" k="subject" items={BX.SUBJECTS.map(s => ({ v:s, label:s }))} />
          <FilterGroup title="Mood" k="mood" items={BX.MOODS.map(s => ({ v:s, label:s }))} />
          <FilterGroup title="Status" k="status" items={[["finished","Finished"],["reading","Reading"],["queued","Queued"],["abandoned","Abandoned"]].map(([v,label])=>({v,label}))} />
          <FilterGroup title="Century" k="century" items={centuries.map(c => ({ v:c, label: c < 1000 ? `${c}s CE` : `${c}s` }))} />
          {(Object.values(filters).some(Boolean) || inLib) &&
            <button className="btn btn-sm btn-ghost" onClick={() => { setFilters({}); setInLib(false); }}>Clear filters</button>}
        </aside>

        {/* results */}
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, marginBottom: 20, flexWrap:"wrap" }}>
            <div>
              <h2 style={{ fontSize: 23 }}>
                {recsMode ? "Recommended for you"
                  : submitted ? (params.theme
                      ? <span>Books on the theme of <span style={{color:"var(--rust)", textTransform:"capitalize"}}>“{submitted}”</span></span>
                      : <span>Results for <span style={{color:"var(--rust)"}}>“{submitted}”</span></span>)
                  : params.mood
                      ? <span>Books that feel <span style={{color:"var(--rust)", textTransform:"capitalize"}}>{params.mood}</span></span>
                      : "Browse your library"}
              </h2>
              {!loading && results && <div style={{ fontSize:13, color:"var(--muted)", marginTop:4 }}>{shown.length} {shown.length===1?"book":"books"}</div>}
            </div>
            <select value={sort} onChange={(e)=>setSort(e.target.value)} className="btn btn-sm" style={{ appearance:"none", paddingRight:14 }}>
              <option value="relevance">Sort: Relevance</option>
              <option value="rating">Sort: Highest rated</option>
              <option value="year-new">Sort: Newest</option>
              <option value="year-old">Sort: Oldest</option>
              <option value="title">Sort: Title A–Z</option>
            </select>
          </div>


          {loading ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px,1fr))", gap:26 }}>
              {[0,1,2,3,4,5].map(i => (
                <div key={i} style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div className="skeleton" style={{ width:"100%", aspectRatio:"1 / 1.5", borderRadius:5 }}></div>
                  <div className="skeleton" style={{ height:14, width:"85%" }}></div>
                  <div className="skeleton" style={{ height:11, width:"55%" }}></div>
                </div>
              ))}
            </div>
          ) : (shown.length === 0 && !showGoogle) ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"var(--muted)" }}>
              <div style={{ fontFamily:"var(--serif)", fontSize:20, color:"var(--ink-2)", marginBottom:8 }}>No books match.</div>
              <p style={{ fontSize:14 }}>Try a broader query or clear some filters.</p>
            </div>
          ) : (
            <div>
              {shown.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px,1fr))", gap:26 }}>
                  {shownPage.map(b => <BookCard key={b.id} book={b} library={library} onOpen={openBook}
                    reason={recsMode ? BX.recommendations(library,99).find(r=>r.b.id===b.id)?.reason : null} />)}
                </div>
              )}

              {totalPages > 1 && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:34, flexWrap:"wrap" }}>
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

              {showGoogle && (
                <section style={{ marginTop: shown.length > 0 ? 44 : 0 }}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:18, paddingBottom:12, borderBottom:"1px solid var(--line)" }}>
                    <h3 style={{ fontSize:18 }}>{shown.length > 0 ? "More from Google Books" : "From Google Books"}</h3>
                    {!gb.loading && gbShown.length > 0 && <span style={{ fontSize:12.5, color:"var(--muted)" }}>{gbShown.length} {gbShown.length===1?"result":"results"} across the wider catalog</span>}
                  </div>

                  {gb.loading ? (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px,1fr))", gap:26 }}>
                      {[0,1,2,3,4].map(i => (
                        <div key={i} style={{ display:"flex", flexDirection:"column", gap:10 }}>
                          <div className="skeleton" style={{ width:"100%", aspectRatio:"1 / 1.5", borderRadius:5 }}></div>
                          <div className="skeleton" style={{ height:14, width:"85%" }}></div>
                          <div className="skeleton" style={{ height:11, width:"55%" }}></div>
                        </div>
                      ))}
                    </div>
                  ) : gb.error === "rate-limited" ? (
                    <div style={{ background:"var(--surface)", border:"1px solid var(--line)", borderRadius:"var(--r-md)", padding:"18px 20px", color:"var(--ink-2)", fontSize:14, lineHeight:1.55 }}>
                      Search results currently unavailable. Wait a few seconds and search again.
                    </div>
                  ) : gb.error ? (
                    <div style={{ color:"var(--muted)", fontSize:14 }}>Couldn’t reach Google Books right now.</div>
                  ) : gbShown.length > 0 ? (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px,1fr))", gap:26 }}>
                      {gbShown.map(b => <BookCard key={b.id} book={b} library={library} onOpen={openBook} />)}
                    </div>
                  ) : (
                    <div style={{ color:"var(--muted)", fontSize:14 }}>No further results found.</div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SearchBar, HomeScreen, ResultsScreen });
