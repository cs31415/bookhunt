/* screens-detail.jsx — BookDetail, AuthorScreen, related-reads curation */
const { useState: uS3, useEffect: uE3, useRef: uR3, useMemo: uM3 } = React;

/* estimate reading time from page count (~1.4 min/page ≈ 275 wpm) */
function readTime(pages) {
  if (!pages) return null;
  const mins = Math.round(pages * 1.4);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = Math.round(mins / 60 * 10) / 10;
  return mins % 60 === 0 ? `${h} hr` : `${(mins / 60).toFixed(1)} hr`;
}

/* deterministic reader reviews from templates */
function readerReviews(book) {
  const names = ["margin_notes","eveningreader","R. Calderón","thelastpage","quietstacks","owl_at_dawn","J. Mehta"];
  const seed = book.id.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const mood = (book.m[0]||"rewarding").toLowerCase();
  const subj = (book.s[0]||"the subject").toLowerCase();
  const pool = [
    { r:5, t:`Stayed with me for weeks. ${mood.charAt(0).toUpperCase()+mood.slice(1)} in the best sense — I underlined half of it.` },
    { r:4, t:`A serious book that respects the reader. Dense in places, but never gratuitously so.` },
    { r:5, t:`The clearest thing I’ve read on ${subj}. I’ve already pressed it on two friends.` },
    { r:4, t:`Slow to start and worth the patience. The last third is where it earns its reputation.` },
    { r:3, t:`Admire it more than I loved it. Brilliant, occasionally cold. Glad I read it once.` },
    { r:5, t:`Reread immediately. Few books reward a second pass this much.` },
  ];
  const pick = [seed % pool.length, (seed+2) % pool.length, (seed+4) % pool.length];
  const uniq = [...new Set(pick)].slice(0,3);
  return uniq.map((i,k) => ({ ...pool[i], name: names[(seed+k)%names.length], when: ["3 weeks ago","2 months ago","last year"][k] }));
}

/* sparkle glyph for AI affordances */
function Spark({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flex:"none" }}>
      <path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z"/>
      <path d="M18.5 14l.7 2.5 2.5.7-2.5.7-.7 2.5-.7-2.5-2.5-.7 2.5-.7z" opacity=".7"/>
    </svg>
  );
}

/* ---------- status / library control ---------- */
function ActionMenu({ book, ctx }) {
  const BX = BXa();
  const { library, setStatus } = ctx;
  const [open, setOpen] = uS3(false);
  const cur = library[book.id]?.status;
  const inLib = !!cur;
  const opts = [["queued","Queued"],["reading","Reading"],["finished","Finished"],["abandoned","Abandoned"]];
  return (
    <div style={{ position:"relative" }}>
      <button className={"btn " + (inLib ? "" : "btn-primary")} onClick={() => setOpen(o => !o)} style={{ width:"100%", justifyContent:"space-between" }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
          {inLib && <span style={{ width:8, height:8, borderRadius:99, background:BX.STATUS_COLOR[cur], display:"inline-block" }}></span>}
          {inLib ? BX.STATUS_LABEL[cur] : "Reading status"}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:"fixed", inset:0, zIndex:40 }}></div>
          <div className="card" style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, zIndex:41, padding:6, boxShadow:"var(--shadow-3)" }}>
            {opts.map(([v,label]) => (
              <button key={v} onClick={() => { setStatus(book.id, v); setOpen(false); }}
                style={{ display:"flex", width:"100%", alignItems:"center", gap:9, padding:"9px 12px", border:"none", background: cur===v?"var(--paper-2)":"transparent", borderRadius:7, fontSize:14, textAlign:"left", color:"var(--ink)" }}>
                <span style={{width:8,height:8,borderRadius:99,background:BX.STATUS_COLOR[v]}}></span>{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- one specification cell ---------- */
function Spec({ label, children }) {
  return (
    <div style={{ minWidth:0 }}>
      <div className="eyebrow" style={{ marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:14.5, color:"var(--ink)", lineHeight:1.45, wordBreak:"break-word" }}>{children}</div>
    </div>
  );
}

/* ---------- related-reads card (library +/- toggle, in/out-of-library distinction) ---------- */
function RelatedCard({ book, library, onOpen, source, onRemove, onAddLib, onRemoveLib }) {
  const BX = BXa();
  const author = BX.authorOf(book);
  const lib = library[book.id];
  const inLib = !!lib;
  const cornerBtn = {
    position:"absolute", width:28, height:28, borderRadius:999,
    display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
    lineHeight:1, zIndex:2, boxShadow:"var(--shadow-1)", padding:0, fontFamily:"var(--sans)",
  };
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:10 }}>
      <div onClick={() => onOpen(book.id)} style={{ position:"relative", cursor:"pointer",
        borderRadius:"3px 5px 5px 3px",
        boxShadow: inLib ? "0 0 0 2px var(--rust), 0 0 0 4px color-mix(in srgb, var(--rust) 22%, transparent)" : "none" }}>
        <Cover book={book} w="100%" style={{ width:"100%", height:"auto", aspectRatio:"1 / 1.5",
          filter: inLib ? "none" : "grayscale(1) contrast(.92)", opacity: inLib ? 1 : 0.45,
          transition:"opacity .16s ease, filter .16s ease" }} />
        {source === "you" && onRemove && (
          <button title="Remove from related" onClick={(e) => { e.stopPropagation(); onRemove(book.id); }}
            style={{ ...cornerBtn, top:8, left:8, border:"none", background:"rgba(42,38,32,.78)", color:"#fff", fontSize:17 }}>×</button>
        )}
        <button title={inLib ? "Remove from library" : "Add to library"}
          onClick={(e) => { e.stopPropagation(); inLib ? onRemoveLib(book.id) : onAddLib(book.id); }}
          style={{ ...cornerBtn, top:8, right:8, fontSize:20, fontWeight:400,
            background: inLib ? "var(--card)" : "var(--rust)",
            color: inLib ? "var(--ink-2)" : "#fff",
            border: inLib ? "1px solid var(--line-2)" : "none" }}>{inLib ? "–" : "+"}</button>
      </div>
      <div>
        <div className="eyebrow" style={{ color: source==="you" ? "var(--rust)" : "var(--muted)", marginBottom:4, display:"flex", alignItems:"center", gap:5 }}>
          {source === "you" ? <><Spark size={10} />Added by you</> : "Suggested"}
        </div>
        <h4 onClick={() => onOpen(book.id)} style={{ fontSize:15, lineHeight:1.2, marginBottom:4, cursor:"pointer", color: inLib ? "var(--ink)" : "var(--muted)" }}>{book.title}</h4>
        <div style={{ fontSize:12.5, color:"var(--muted)", marginBottom:7 }}>{author.name}</div>
        {inLib
          ? <StatusBadge status={lib.status} />
          : <div style={{ display:"flex", alignItems:"center", gap:6, opacity:.8 }}><Stars value={book.rating} size={11} /><span style={{ fontSize:11.5, color:"var(--faint)" }}>{book.rating.toFixed(1)}</span></div>}
      </div>
    </div>
  );
}

/* ---------- picker to add a user-curated related book ---------- */
function RelatedPicker({ book, ctx, onClose }) {
  const BX = BXa();
  const { library, addRelated } = ctx;
  const [q, setQ] = uS3("");
  const userIds = library[book.id]?.userRelated || [];
  const algoIds = BX.relatedBooks(book.id, 6).map(b => b.id);
  const taken = new Set([book.id, ...userIds, ...algoIds]);
  const list = BX.allBooks()
    .filter(b => !taken.has(b.id))
    .filter(b => { const t = q.trim().toLowerCase(); return !t || (b.title + " " + BX.authorOf(b).name).toLowerCase().includes(t); })
    .sort((a,z) => z.rating - a.rating)
    .slice(0, 30);
  return (
    <div className="card fade-up" style={{ padding:14, marginBottom:24, boxShadow:"var(--shadow-2)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:"var(--surface)", border:"1px solid var(--line-2)", borderRadius:999, padding:"6px 14px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Find a book to link as related…"
            style={{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:14, fontFamily:"var(--serif)", color:"var(--ink)" }} />
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>Done</button>
      </div>
      <div style={{ maxHeight:300, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
        {list.length === 0 && <div className="muted" style={{ fontSize:13.5, padding:"14px 6px" }}>No more books to add.</div>}
        {list.map(b => {
          const lib = library[b.id];
          return (
            <button key={b.id} onClick={() => addRelated(book.id, b.id)}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"7px 8px", border:"none", background:"transparent", borderRadius:8, textAlign:"left", cursor:"pointer", width:"100%" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--paper-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Cover book={b} w={34} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"var(--serif)", fontWeight:600, fontSize:14, lineHeight:1.2 }}>{b.title}</div>
                <div style={{ fontSize:12, color:"var(--muted)" }}>{BX.authorOf(b).name} · {b.year}</div>
              </div>
              {lib && <StatusBadge status={lib.status} />}
              <span style={{ fontFamily:"var(--mono)", fontSize:18, color:"var(--rust)", lineHeight:1, padding:"0 4px" }}>+</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- related reads: user-curated + algorithm, library-aware ---------- */
function RelatedReads({ book, ctx }) {
  const BX = BXa();
  const { library, openBook, removeRelated, setStatus, removeFromLib } = ctx;
  const lib = library[book.id];
  const inLib = !!lib;
  const [pick, setPick] = uS3(false);
  const userIds = lib?.userRelated || [];
  const userBooks = userIds.map(BX.getBook).filter(Boolean);
  const algoBooks = BX.relatedBooks(book.id, 6).filter(b => !userIds.includes(b.id)).slice(0, inLib ? 4 : 6);
  // combine, then order: books in your library first, then not — keeping your picks ahead of suggestions within each group
  const combined = [
    ...userBooks.map(b => ({ b, source:"you" })),
    ...algoBooks.map(b => ({ b, source:"auto" })),
  ].sort((x, z) => {
    const xi = library[x.b.id] ? 0 : 1, zi = library[z.b.id] ? 0 : 1;
    if (xi !== zi) return xi - zi;
    return (x.source === "you" ? 0 : 1) - (z.source === "you" ? 0 : 1);
  });
  const onAddLib = (id) => setStatus(id, "queued");
  const onRemoveLib = (id) => removeFromLib(id);

  return (
    <section style={{ marginTop:54, paddingTop:34, borderTop:"1px solid var(--line)" }}>
      <SectionHead title="Related reads" />

      {pick && <RelatedPicker book={book} ctx={ctx} onClose={() => setPick(false)} />}

      {!inLib && (
        <p style={{ fontSize:13.5, color:"var(--muted)", marginBottom:20, marginTop:-4, maxWidth:560 }}>
          Add this book to your library to curate its related reads — your picks live alongside the algorithm’s suggestions.
        </p>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px,1fr))", gap:26 }}>
        {combined.map(({ b, source }) => (
          <RelatedCard key={source+"-"+b.id} book={b} library={library} onOpen={openBook} source={source}
            onRemove={source==="you" ? (id) => removeRelated(book.id, id) : undefined}
            onAddLib={onAddLib} onRemoveLib={onRemoveLib} />
        ))}
      </div>
    </section>
  );
}

function BookDetail({ ctx }) {
  const BX = BXa();
  const { library, params, openBook, openAuthor, setNote, setUserRating, setStatus, removeFromLib } = ctx;
  const book = BX.getBook(params.id);
  const [summary, setSummary] = uS3(null);
  const [sumLoading, setSumLoading] = uS3(true);
  const [cats, setCats] = uS3(null);
  const [catLoading, setCatLoading] = uS3(true);
  const [themes, setThemes] = uS3(null);
  const [themesLoading, setThemesLoading] = uS3(true);
  const [tab, setTab] = uS3("overview");
  const tabsRef = uR3(null);
  const lib = library[book?.id];
  const [note, setNoteLocal] = uS3(lib?.notes || "");

  uE3(() => {
    let alive = true;
    setSumLoading(true); setSummary(null);
    setCatLoading(true); setCats(null);
    setThemesLoading(true); setThemes(null);
    setNoteLocal(library[params.id]?.notes || "");
    setTab("overview");
    window.scrollTo(0,0);
    BX.aiSummary(book).then(s => { if (alive) { setSummary(s); setSumLoading(false); } });
    BX.aiCategories(book).then(c => { if (alive) { setCats(c); setCatLoading(false); } });
    BX.aiThemes(book).then(th => { if (alive) { setThemes(th); setThemesLoading(false); } });
    return () => { alive = false; };
  }, [params.id]);

  if (!book) return <div className="muted">Book not found.</div>;
  const author = BX.authorOf(book);
  const byAuthor = BX.booksByAuthor(book.authorId, book.id);
  const reviews = uM3(() => readerReviews(book), [book.id]);

  // merge AI categories + themes into one deduped, clickable list
  const themesBusy = catLoading || themesLoading;
  const allThemes = uM3(() => {
    const seen = new Set(); const out = [];
    [...(cats || []), ...(themes || [])].forEach(t => {
      const k = String(t).trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); out.push(String(t).trim()); }
    });
    return out;
  }, [cats, themes]);

  const saveNote = (v) => { setNoteLocal(v); setNote(book.id, v); };
  const goNotes = () => { setTab("notes"); requestAnimationFrame(() => { if (tabsRef.current) window.scrollTo({ top: tabsRef.current.offsetTop - 74, behavior:"smooth" }); }); };

  return (
    <div className="fade-up">
      {/* hero */}
      <div style={{ display:"grid", gridTemplateColumns:"144px 1fr", gap:48, marginBottom:38 }} className="detail-hero">
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ position:"relative" }}>
            <Cover book={book} w={144} />
            <button title={lib ? "Remove from library" : "Add to library"}
              onClick={() => lib ? removeFromLib(book.id) : setStatus(book.id, "queued")}
              style={{ position:"absolute", top:10, right:10, width:38, height:38, borderRadius:999, display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", lineHeight:1, padding:0, fontSize:22, fontWeight:400, fontFamily:"var(--sans)", boxShadow:"var(--shadow-1)", zIndex:2,
                background: lib ? "var(--card)" : "var(--rust)",
                color: lib ? "var(--ink-2)" : "#fff",
                border: lib ? "1px solid var(--line-2)" : "none" }}>{lib ? "\u2013" : "+"}</button>
          </div>
          <ActionMenu book={book} ctx={ctx} />
          <a href={book.gbooks} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ width:"100%", justifyContent:"center", fontSize:13 }}>
            View on Google Books
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
          </a>
        </div>

        <div style={{ minWidth:0 }}>
          <h1 style={{ fontSize:"clamp(30px,4vw,46px)", lineHeight:1.04, marginBottom:12 }}>{book.title}</h1>
          <div style={{ fontSize:18, color:"var(--ink-2)", marginBottom:18 }}>
            by <span onClick={() => openAuthor(author.id)} style={{ color:"var(--rust)", cursor:"pointer", textDecoration:"underline", textUnderlineOffset:3 }}>{author.name}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:20, flexWrap:"wrap" }}>
            {book.rating > 0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                <span className="eyebrow">{book.external ? "Google Books" : "Average rating"}</span>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Stars value={book.rating} size={18} /><span style={{ fontSize:15, color:"var(--ink-2)" }}>{book.rating.toFixed(1)}</span>
                  {book.ratingsCount > 0 && <span style={{ fontSize:13, color:"var(--muted)" }}>({book.ratingsCount.toLocaleString()})</span>}
                </div>
              </div>
            ) : null}
            {book.rating > 0 && <span style={{ width:1, alignSelf:"stretch", background:"var(--line)", margin:"2px 0" }}></span>}
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <span className="eyebrow" style={{ color:"var(--rust)" }}>My rating</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Stars value={lib?.userRating || 0} size={18} interactive onChange={(n) => setUserRating(book.id, n)} />
                <span style={{ fontSize:13, color:"var(--muted)" }}>{lib?.userRating ? lib.userRating.toFixed(1) : "Rate it"}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize:14, color:"var(--muted)", marginBottom:20 }}>{[book.year, book.pages ? book.pages + " pages" : null, readTime(book.pages) ? readTime(book.pages) + " read" : null].filter(Boolean).join(" · ")}</div>
          <p style={{ fontSize:17, lineHeight:1.62, color:"var(--ink)", fontFamily:"var(--serif)", maxWidth:580, marginBottom:20 }}>{book.blurb}</p>

          {/* themes — AI-generated (categories + themes merged), clickable to discover more books */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:11, marginBottom:10, flexWrap:"wrap" }}>
              <span className="eyebrow">Themes</span>
            </div>
            {themesBusy ? (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[150,118,168,132].map((w,i) => <div key={i} className="skeleton" style={{ height:34, width:w, borderRadius:999 }}></div>)}
              </div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {allThemes.map(th => (
                  <button key={th} className="pill click" onClick={() => ctx.nav("results", { q: th, theme:true })}
                    style={{ fontSize:13.5, padding:"7px 14px", fontFamily:"var(--serif)", textTransform:"capitalize" }}>
                    {th}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft:2, opacity:.7 }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* moods — how the book feels; click to find books with the same mood */}
          {book.m.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom:9 }}>Mood</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                {book.m.map(m => (
                  <button key={m} className="pill click" onClick={() => ctx.nav("results", { mood: m })}
                    style={{ textTransform:"capitalize" }}>{m}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* specifications */}
      <div className="card" style={{ padding:"24px 26px", marginBottom:8 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px,1fr))", gap:"22px 30px" }}>
          <Spec label="Category">
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:2 }}>
              {book.s.map(s => (
                <button key={s} className="pill click" onClick={() => ctx.nav("results", { subject: s })}>{s}</button>
              ))}
            </div>
          </Spec>
          <Spec label="Publisher">{book.publisher}</Spec>
          <Spec label="Language">{book.lang}</Spec>
          <Spec label="ISBN-13"><span style={{ fontFamily:"var(--mono)", fontSize:13.5 }}>{book.isbn}</span></Spec>
        </div>
      </div>

      {/* tabs */}
      <div ref={tabsRef} style={{ display:"flex", gap:4, borderBottom:"1px solid var(--line)", margin:"32px 0 28px" }}>
        {[["overview","Summary"],["notes","My notes"],["reviews","Reader reviews"]].map(([v,label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ background:"none", border:"none", padding:"10px 16px", fontSize:14.5, fontWeight:500, color: tab===v?"var(--ink)":"var(--muted)", borderBottom: tab===v?"2px solid var(--rust)":"2px solid transparent", marginBottom:-1 }}>
            {label}{v==="notes" && note ? " ·" : ""}
          </button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:44, alignItems:"start" }} className="detail-body">
        <div style={{ minWidth:0 }}>
          {tab === "overview" && (
            <div>
              {sumLoading ? (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:13, width: `${[97,93,99,88,60][i]}%` }}></div>)}
                  <div style={{ display:"flex", alignItems:"center", gap:8, color:"var(--muted)", fontSize:13, marginTop:6 }}><span className="spinner"></span> Writing a summary…</div>
                </div>
              ) : summary ? (
                <div style={{ fontSize:16, lineHeight:1.72, color:"var(--ink)", whiteSpace:"pre-wrap" }}>{summary}</div>
              ) : (
                <p style={{ fontSize:15.5, lineHeight:1.7, color:"var(--ink-2)" }}>{book.blurb} A fuller summary couldn’t be generated just now — try Regenerate.</p>
              )}
            </div>
          )}

          {tab === "notes" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom:6 }}>Your rating</div>
                  <Stars value={lib?.userRating || 0} size={22} interactive onChange={(n) => setUserRating(book.id, n)} />
                </div>
                <span style={{ fontSize:12.5, color:"var(--muted)", fontFamily:"var(--mono)" }}>{note.length} chars · saved</span>
              </div>
              <textarea value={note} onChange={(e) => saveNote(e.target.value)}
                placeholder="Quotes, page references, what it changed your mind about…"
                style={{ width:"100%", minHeight:220, padding:"16px 18px", border:"1px solid var(--line-2)", borderRadius:"var(--r-md)", background:"var(--surface)", fontSize:15.5, lineHeight:1.7, color:"var(--ink)", resize:"vertical", fontFamily:"var(--serif)", outline:"none" }} />
              {!lib && <p style={{ fontSize:13, color:"var(--muted)", marginTop:10 }}>Saving a note adds this book to your library so your notes stay alongside it.</p>}
            </div>
          )}

          {tab === "reviews" && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              {reviews.map((rv,i) => (
                <div key={i} style={{ borderBottom: i<reviews.length-1?"1px solid var(--line)":"none", paddingBottom:18 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <span style={{ width:30, height:30, borderRadius:99, background:"var(--paper-2)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--serif)", fontSize:14, color:"var(--ink-2)" }}>{rv.name[0].toUpperCase()}</span>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:500 }}>{rv.name}</div>
                      <div style={{ fontSize:11.5, color:"var(--muted)" }}>{rv.when}</div>
                    </div>
                    <div style={{ marginLeft:"auto" }}><Stars value={rv.r} size={13} /></div>
                  </div>
                  <p style={{ fontSize:15, lineHeight:1.6, color:"var(--ink)", fontFamily:"var(--serif)" }}>{rv.t}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* sidebar: same author */}
        <aside style={{ display:"flex", flexDirection:"column", gap:30 }}>
          {byAuthor.length > 0 ? (
            <div>
              <div className="eyebrow" style={{ marginBottom:14 }}>More by {author.name.split(" ").slice(-1)}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {byAuthor.map(b => <BookRow key={b.id} book={b} library={library} onOpen={openBook} />)}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding:"18px 20px" }}>
              <div className="eyebrow" style={{ marginBottom:8 }}>About the author</div>
              <div onClick={() => openAuthor(author.id)} style={{ fontFamily:"var(--serif)", fontSize:17, fontWeight:600, color:"var(--rust)", cursor:"pointer", marginBottom:6 }}>{author.name}</div>
              <p style={{ fontSize:13.5, color:"var(--ink-2)", lineHeight:1.55 }}>{author.bio}</p>
            </div>
          )}
        </aside>
      </div>

      {/* related reads — library-aware + user-curated */}
      <RelatedReads book={book} ctx={ctx} />
    </div>
  );
}

function AuthorScreen({ ctx }) {
  const BX = BXa();
  const { params, library, openBook } = ctx;
  const author = BX.getAuthor(params.id);
  const external = author && author.external;
  const [gbBooks, setGbBooks] = uS3(null);
  uE3(() => {
    window.scrollTo(0,0);
    // external (Google Books) authors: fetch their available titles
    if (external) { setGbBooks(null); BX.googleByAuthor(author.name, 18).then(r => setGbBooks(r.books)); }
  }, [params.id]);
  if (!author) return <div className="muted">Author not found.</div>;
  const catalogBooks = BX.booksByAuthor(params.id);
  const books = external ? (gbBooks || catalogBooks) : catalogBooks;
  const metaLine = external
    ? "Author · Google Books"
    : `${author.country} · b. ${author.born < 1000 ? `${author.born} CE` : author.born}`;
  return (
    <div className="fade-up">
      <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:30, marginBottom:46, alignItems:"start" }} className="author-hero">
        <div className="ph" style={{ width:120, height:120, borderRadius:99 }}>author<br/>portrait</div>
        <div>
          <div className="eyebrow" style={{ marginBottom:10 }}>{metaLine}</div>
          <h1 style={{ fontSize:"clamp(30px,4vw,46px)", marginBottom:16 }}>{author.name}</h1>
          <p style={{ fontSize:17, lineHeight:1.65, color:"var(--ink)", fontFamily:"var(--serif)", maxWidth:680 }}>{author.bio}</p>
          <div style={{ fontSize:13.5, color:"var(--muted)", marginTop:16 }}>
            {external && gbBooks === null ? "Finding titles…" : `${books.length} ${books.length===1?"book":"books"}${external ? " on Google Books" : " in the catalog"}`}
          </div>
        </div>
      </div>
      <SectionHead eyebrow="Bibliography" title={`Books by ${author.name}`} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px,1fr))", gap:26 }}>
        {books.map(b => <BookCard key={b.id} book={b} library={library} onOpen={openBook} />)}
      </div>
    </div>
  );
}

Object.assign(window, { BookDetail, AuthorScreen, ActionMenu, RelatedReads, RelatedCard, RelatedPicker, readerReviews });
