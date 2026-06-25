/* lib.jsx — pure helpers: catalog, search, recommendations (global: BX) */
(function () {
  const D = window.BX_DATA;
  const booksById = Object.fromEntries(D.books.map(b => [b.id, b]));

  /* ---------- Google Books layer ----------
     Live catalog from the public Google Books API (keyless, CORS-enabled).
     Fetched volumes are normalised into the app's book shape and cached so
     detail/author pages can resolve them by id across navigation + reloads. */
  const GB_LS = "bx_gb_cache_v1";
  const gbBooks = {};     // id -> book
  const gbAuthors = {};   // id -> author
  try {
    const saved = JSON.parse(localStorage.getItem(GB_LS) || "{}");
    Object.assign(gbBooks, saved.books || {});
    Object.assign(gbAuthors, saved.authors || {});
  } catch (e) {}
  function persistGB() {
    try { localStorage.setItem(GB_LS, JSON.stringify({ books: gbBooks, authors: gbAuthors })); } catch (e) {}
  }

  const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const GB_HUES = ["#6f5b45","#4f5d63","#7a4a3a","#3f5448","#5a4a63","#6b5a2e","#445a6b","#704550"];
  const gbHue = (str) => { let h=0; for (let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return GB_HUES[h % GB_HUES.length]; };
  const stripHtml = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  function mapVolume(vol) {
    const v = vol.volumeInfo || {};
    const id = "gb:" + vol.id;
    const authorName = (v.authors && v.authors[0]) || "Unknown";
    const authorId = "gba:" + slug(authorName);
    if (!gbAuthors[authorId]) {
      gbAuthors[authorId] = { id: authorId, name: authorName, country: null, born: null,
        bio: `${authorName} — author profile drawn from Google Books. Browse their available titles below.`, external: true };
    }
    const year = v.publishedDate ? parseInt(String(v.publishedDate).slice(0, 4), 10) || null : null;
    let isbn = null;
    (v.industryIdentifiers || []).forEach(x => { if (x.type === "ISBN_13") isbn = x.identifier; else if (!isbn && x.type === "ISBN_10") isbn = x.identifier; });
    const cats = (v.categories || []).slice(0, 3);
    const langMap = { en:"English", es:"Spanish", fr:"French", de:"German", it:"Italian", ru:"Russian", ja:"Japanese", pt:"Portuguese", zh:"Chinese" };
    const cover = (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail) || "").replace(/^http:/, "https:").replace(/&edge=curl/, "");
    const book = {
      id, title: v.title || "Untitled", authorId,
      year: year || "", pages: v.pageCount || null,
      rating: typeof v.averageRating === "number" ? v.averageRating : 0,
      ratingsCount: v.ratingsCount || 0,
      lang: langMap[v.language] || (v.language ? v.language.toUpperCase() : "—"),
      isbn: isbn || "—",
      publisher: v.publisher || "—",
      s: cats.length ? cats : ["General"],
      m: [],
      genres: cats,
      blurb: stripHtml(v.description) || "No description is available for this edition.",
      hue: gbHue(id),
      cover,
      gbooks: v.canonicalVolumeLink || v.infoLink || ("https://books.google.com/books?id=" + vol.id),
      external: true,
    };
    gbBooks[id] = book;
    return book;
  }

  async function gbFetch(url) {
    const res = await fetch(url);
    if (res.status === 429) { const e = new Error("rate-limited"); e.code = 429; throw e; }
    if (!res.ok) throw new Error("http " + res.status);
    return res.json();
  }

  // Live search against Google Books. Returns { books, error } ; never throws.
  async function googleSearch(query, n = 12) {
    const q = (query || "").trim();
    if (!q) return { books: [], error: null };
    try {
      const url = "https://www.googleapis.com/books/v1/volumes?country=US&maxResults=" + n +
        "&orderBy=relevance&q=" + encodeURIComponent(q);
      const j = await gbFetch(url);
      const items = j.items || [];
      const books = items.map(mapVolume).filter(b => b.title);
      persistGB();
      return { books, error: null };
    } catch (e) {
      return { books: [], error: e.code === 429 ? "rate-limited" : "unavailable" };
    }
  }

  async function googleByAuthor(name, n = 12) {
    try {
      const url = "https://www.googleapis.com/books/v1/volumes?country=US&maxResults=" + n +
        "&orderBy=relevance&q=" + encodeURIComponent('inauthor:"' + name + '"');
      const j = await gbFetch(url);
      const books = (j.items || []).map(mapVolume).filter(b => b.title);
      persistGB();
      return { books, error: null };
    } catch (e) {
      return { books: [], error: e.code === 429 ? "rate-limited" : "unavailable" };
    }
  }

  const getBook = (id) => booksById[id] || gbBooks[id];
  const getAuthor = (id) => D.authors[id] || gbAuthors[id];
  const authorOf = (b) => (b && (D.authors[b.authorId] || gbAuthors[b.authorId])) || { name: "Unknown", external: true };
  const allBooks = () => D.books.slice();

  const booksByAuthor = (authorId, excludeId) => {
    const catalog = D.books.filter(b => b.authorId === authorId && b.id !== excludeId);
    if (catalog.length || !String(authorId).startsWith("gba:")) return catalog;
    return Object.values(gbBooks).filter(b => b.authorId === authorId && b.id !== excludeId);
  };

  function relatedBooks(id, n = 4) {
    const explicit = (D.related[id] || []).map(getBook).filter(Boolean);
    if (explicit.length >= n) return explicit.slice(0, n);
    // fall back to subject overlap
    const base = getBook(id);
    const scored = D.books
      .filter(b => b.id !== id && !explicit.find(e => e.id === b.id))
      .map(b => ({ b, score: overlap(b.s, base.s) }))
      .filter(x => x.score > 0)
      .sort((a, z) => z.score - a.score)
      .map(x => x.b);
    return explicit.concat(scored).slice(0, n);
  }

  const overlap = (a, b) => a.filter(x => b.includes(x)).length;

  // ----- local search -----
  function localSearch(query, { inLibraryOnly = false, library = {}, filters = {} } = {}) {
    const q = (query || "").trim().toLowerCase();
    let pool = D.books.slice();
    if (inLibraryOnly) pool = pool.filter(b => library[b.id]);
    if (filters.subject) pool = pool.filter(b => b.s.includes(filters.subject));
    if (filters.mood)    pool = pool.filter(b => b.m.includes(filters.mood));
    if (filters.author)  pool = pool.filter(b => b.authorId === filters.author);
    if (filters.status)  pool = pool.filter(b => library[b.id] && library[b.id].status === filters.status);
    if (filters.century) pool = pool.filter(b => Math.floor(b.year/100)*100 === filters.century);

    if (!q) return pool;
    const STOP = new Set(["the","a","an","of","for","on","in","to","and","or","with","about","best","good","some","that","i","can","my","me","is","are","books","book","read","reading","novel","stories"]);
    let terms = q.split(/[\s,]+/).filter(Boolean);
    const content = terms.filter(t => !STOP.has(t));
    if (content.length) terms = content;
    const scored = pool.map(b => {
      const genres = (b.genres || []).join(" ");
      const themes = (b.themes || []).join(" ");
      const hay = [
        b.title, authorOf(b).name, b.publisher, String(b.year),
        b.s.join(" "), b.m.join(" "), genres, themes, b.blurb
      ].join(" ").toLowerCase();
      let score = 0;
      terms.forEach(t => {
        if (b.title.toLowerCase().includes(t)) score += 6;
        if (authorOf(b).name.toLowerCase().includes(t)) score += 5;
        if (b.s.join(" ").toLowerCase().includes(t)) score += 3;
        if (genres.toLowerCase().includes(t)) score += 3;
        if (themes.toLowerCase().includes(t)) score += 3;
        if (b.m.join(" ").toLowerCase().includes(t)) score += 2;
        if (hay.includes(t)) score += 1;
      });
      // whole-phrase bonus (helps multi-word themes like "magical realism")
      if (q.length > 3 && hay.includes(q)) score += 4;
      return { b, score };
    }).filter(x => x.score > 0).sort((a, z) => z.score - a.score);
    return scored.map(x => x.b);
  }

  // ----- AI natural-language search -----
  // Returns { ids, interpretation, ok } ; falls back to local on any failure.
  async function aiSearch(query, { inLibraryOnly = false, library = {} } = {}) {
    const fallback = () => ({
      ids: localSearch(query, { inLibraryOnly, library }).map(b => b.id),
      interpretation: null, ok: false
    });
    if (!window.claude || !query.trim()) return fallback();
    const catalog = D.books.map(b =>
      `${b.id} | "${b.title}" by ${authorOf(b).name} (${b.year}) | subjects: ${b.s.join(", ")} | moods: ${b.m.join(", ")} | ${b.blurb}`
    ).join("\n");
    const prompt =
`You are the search engine for a personal book library. The user typed a natural-language query.
From ONLY the catalog below, choose the books that best satisfy the query, best match first.

CATALOG:
${catalog}

USER QUERY: "${query}"

Respond with ONLY a JSON object, no prose, of the form:
{"ids": ["id1","id2",...], "interpretation": "one short sentence on how you read the query"}
Include between 1 and 8 ids. Use only ids that appear in the catalog.`;
    try {
      const raw = await window.claude.complete(prompt);
      const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      let ids = (json.ids || []).filter(id => booksById[id]);
      if (inLibraryOnly) ids = ids.filter(id => library[id]);
      if (!ids.length) return fallback();
      return { ids, interpretation: json.interpretation || null, ok: true };
    } catch (e) {
      return fallback();
    }
  }

  // ----- AI book summary -----
  async function aiSummary(book) {
    if (!window.claude) return null;
    const prompt =
`Write a concise, spoiler-free summary of the book "${book.title}" by ${authorOf(book).name} (${book.year}) for a thoughtful general reader.
Exactly three short paragraphs:
1) What the book is about.
2) Its central idea or argument and why it matters.
3) Who would most enjoy it.
Plain text, no headings, no markdown.`;
    try { return (await window.claude.complete(prompt)).trim(); }
    catch (e) { return null; }
  }

  // ----- AI category tags (evocative micro-genres) -----
  // Tries Claude; falls back to the curated per-book seeds in data.jsx.
  async function aiCategories(book) {
    const fallback = (book.genres && book.genres.length) ? book.genres : book.s.slice(0, 3);
    if (!window.claude) return fallback;
    const prompt =
`Generate exactly 3 short, specific genre/category tags for the book "${book.title}" by ${authorOf(book).name} (${book.year}).
Think the evocative micro-genres a thoughtful reader would recognize — e.g. "coming of age", "medical thriller", "magical realism", "slow-burn mystery". 1–3 words each, Title Case, no duplicates of each other.
Respond with ONLY a JSON array of 3 strings, nothing else.`;
    try {
      const raw = await window.claude.complete(prompt);
      const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 4).map(s => String(s).trim()).filter(Boolean);
      return fallback;
    } catch (e) { return fallback; }
  }

  // ----- AI themes (deeper ideas, used to find books across the catalog) -----
  async function aiThemes(book) {
    const fallback = (book.themes && book.themes.length) ? book.themes : [];
    if (!window.claude) return fallback;
    const prompt =
`List 4–5 of the major themes explored in the book "${book.title}" by ${authorOf(book).name} (${book.year}).
Themes are the deeper ideas a reader could trace across other books — e.g. "guilt and redemption", "coming of age", "power and corruption", "memory and loss". 2–4 words each, lowercase unless a proper noun, no duplicates.
Respond with ONLY a JSON array of strings, nothing else.`;
    try {
      const raw = await window.claude.complete(prompt);
      const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 5).map(s => String(s).trim()).filter(Boolean);
      return fallback;
    } catch (e) { return fallback; }
  }

  // ----- recommendations from personal library -----
  // Surfaces unread catalog books ranked by overlap with the subjects/authors
  // the reader already engages with (read + reading + queue).
  function recommendations(library, n = 6, opts = {}) {
    const owned = Object.keys(library);
    const engaged = owned.filter(id => ["finished","reading","queued"].includes(library[id].status));
    if (!engaged.length) {
      // cold start: highest rated
      return D.books.slice().sort((a, z) => z.rating - a.rating).slice(0, n)
        .map(b => ({ b, reason: "Highly rated in the catalog" }));
    }
    const subjW = {}, authW = {};
    engaged.forEach(id => {
      const b = getBook(id); if (!b) return;
      const w = library[id].status === "finished" ? (library[id].userRating || 3) : 2;
      b.s.forEach(s => subjW[s] = (subjW[s] || 0) + w);
      authW[b.authorId] = (authW[b.authorId] || 0) + w;
    });
    const exclude = new Set(owned);
    if (opts.excludeId) exclude.add(opts.excludeId);
    const scored = D.books.filter(b => !exclude.has(b.id)).map(b => {
      let score = 0; let topSubj = null, topW = 0;
      b.s.forEach(s => { const w = subjW[s] || 0; score += w; if (w > topW) { topW = w; topSubj = s; } });
      if (authW[b.authorId]) score += authW[b.authorId] * 2;
      score += b.rating;
      const sameAuthor = authW[b.authorId]
        ? `More from ${authorOf(b).name.split(" ").slice(-1)}, an author you read` : null;
      const reason = sameAuthor || (topSubj ? `Because you read ${topSubj.toLowerCase()}` : "A strong match");
      return { b, score, reason };
    }).sort((a, z) => z.score - a.score);
    return scored.slice(0, n);
  }

  // library stats for pie charts
  function libraryStats(library) {
    const ids = Object.keys(library);
    const byStatus = { queued:0, reading:0, finished:0, abandoned:0 };
    const bySubject = {}, byAuthor = {};
    ids.forEach(id => {
      const b = getBook(id); if (!b) return;
      byStatus[library[id].status] = (byStatus[library[id].status] || 0) + 1;
      b.s.forEach(s => bySubject[s] = (bySubject[s] || 0) + 1);
      const an = authorOf(b).name; byAuthor[an] = (byAuthor[an] || 0) + 1;
    });
    const toArr = (obj) => Object.entries(obj).map(([label, value]) => ({ label, value }))
      .sort((a, z) => z.value - a.value);
    return {
      total: ids.length,
      status: [
        { label:"Finished", value: byStatus.finished||0, key:"finished" },
        { label:"Reading", value: byStatus.reading||0, key:"reading" },
        { label:"Queued", value: byStatus.queued||0, key:"queued" },
        { label:"Abandoned", value: byStatus.abandoned||0, key:"abandoned" },
      ].filter(x => x.value > 0),
      subject: toArr(bySubject),
      author: toArr(byAuthor),
    };
  }

  const STATUS_LABEL = { queued:"Queued", reading:"Reading", finished:"Finished", abandoned:"Abandoned" };
  const STATUS_COLOR = { queued:"var(--slate)", reading:"var(--rust)", finished:"var(--sage)", abandoned:"var(--muted)" };
  const STATUS_ORDER = ["queued","reading","finished","abandoned"];

  window.BX = {
    D, getBook, getAuthor, authorOf, allBooks, booksByAuthor, relatedBooks,
    localSearch, aiSearch, aiSummary, aiCategories, aiThemes, recommendations, libraryStats,
    googleSearch, googleByAuthor,
    STATUS_LABEL, STATUS_COLOR, STATUS_ORDER,
    SUBJECTS: [...new Set(D.books.flatMap(b => b.s))].sort(),
    MOODS: [...new Set(D.books.flatMap(b => b.m))].sort(),
  };
})();
