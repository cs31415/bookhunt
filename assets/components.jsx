/* components.jsx — shared UI primitives */
const { useState, useEffect, useRef, useMemo } = React;
const BXa = () => window.BX;

/* ---------- procedural book cover (scalable SVG) ---------- */
function wrapTitle(title, maxChars) {
  const words = title.split(" ");
  const lines = []; let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function Cover({ book, w = 132, onClick, style = {} }) {
  const BX = BXa();
  const author = BX.authorOf(book);
  const lastName = author.name.split(" ").slice(-1)[0];
  const fluid = typeof w !== "number";
  const wrapStyle = fluid
    ? { width: w, aspectRatio: "2 / 3" }
    : { width: w, height: Math.round(w * 1.5) };
  const [imgOk, setImgOk] = useState(true);
  // External (Google Books) volumes ship a real cover image — use it when present.
  if (book.cover && imgOk) {
    return (
      <div className="cover" onClick={onClick}
        style={{ "--cover-bg": book.hue, cursor: onClick ? "pointer" : "default", background: book.hue, overflow:"hidden", ...wrapStyle, ...style }}>
        <img src={book.cover} alt={book.title} loading="lazy" onError={() => setImgOk(false)}
          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      </div>
    );
  }
  const VB = 200, VBH = 300;
  let lines = wrapTitle(book.title, 13);
  const maxLen = Math.max(...lines.map(l => l.length));
  const byLines = lines.length >= 5 ? 20 : lines.length === 4 ? 23 : 26;
  const byWidth = 158 / (0.52 * Math.max(maxLen, 1)); // keep longest line within ~158 user units
  let fs = Math.max(15, Math.min(byLines, byWidth));
  const lh = fs * 1.06;
  const blockH = lines.length * lh;
  let startY = (VBH / 2) - blockH / 2 + fs * 0.78;
  return (
    <div className="cover" onClick={onClick}
      style={{ "--cover-bg": book.hue, cursor: onClick ? "pointer" : "default", ...wrapStyle, ...style }}>
      <svg viewBox={`0 0 ${VB} ${VBH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice"
        style={{ display:"block" }}>
        <rect x="0" y="0" width={VB} height={VBH} fill={book.hue} />
        <text x="20" y="40" fill="rgba(255,255,255,.82)" fontFamily="var(--mono)" fontSize="11"
          letterSpacing="1.4" style={{ textTransform:"uppercase" }}>{lastName.toUpperCase()}</text>
        <line x1="20" y1="50" x2="74" y2="50" stroke="rgba(255,255,255,.55)" strokeWidth="1.3" />
        <text x="20" fill="#fff" fontFamily="var(--cover)" fontSize={fs} fontWeight="600">
          {lines.map((ln, i) => (
            <tspan key={i} x="20" y={startY + i * lh}>{ln}</tspan>
          ))}
        </text>
        <line x1="20" y1={VBH - 38} x2={VB - 20} y2={VBH - 38} stroke="rgba(255,255,255,.4)" strokeWidth="1.1" />
        <text x="20" y={VBH - 22} fill="rgba(255,255,255,.78)" fontFamily="var(--mono)" fontSize="11"
          letterSpacing="1.4">{book.year}</text>
      </svg>
    </div>
  );
}

/* ---------- star rating ---------- */
function Stars({ value = 0, size = 14, interactive = false, onChange }) {
  const [hover, setHover] = useState(0);
  const v = hover || value;
  return (
    <div style={{ display:"inline-flex", gap: 2 }}
      onMouseLeave={() => interactive && setHover(0)}>
      {[1,2,3,4,5].map(i => {
        const fill = v >= i ? 1 : (v >= i - 0.5 ? 0.5 : 0);
        return (
          <span key={i}
            onMouseEnter={() => interactive && setHover(i)}
            onClick={() => interactive && onChange && onChange(i)}
            style={{ cursor: interactive ? "pointer" : "default", lineHeight: 1, position:"relative", width: size, height: size, display:"inline-block" }}>
            <Star filled={false} size={size} />
            <span style={{ position:"absolute", inset:0, overflow:"hidden", width: `${fill*100}%` }}>
              <Star filled={true} size={size} />
            </span>
          </span>
        );
      })}
    </div>
  );
}
function Star({ filled, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "var(--gold)" : "none"} stroke={filled ? "var(--gold)" : "var(--faint)"} strokeWidth="1.6">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 21.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" strokeLinejoin="round"/>
    </svg>
  );
}

/* ---------- status badge ---------- */
function StatusBadge({ status }) {
  const BX = BXa();
  if (!status) return null;
  return (
    <span className="pill" style={{ background:"transparent", borderColor: BX.STATUS_COLOR[status], color: BX.STATUS_COLOR[status], fontSize: 11 }}>
      <span style={{ width:6, height:6, borderRadius:99, background: BX.STATUS_COLOR[status] }}></span>
      {BX.STATUS_LABEL[status]}
    </span>
  );
}

/* ---------- book card (grid) ---------- */
function BookCard({ book, library, onOpen, reason }) {
  const BX = BXa();
  const author = BX.authorOf(book);
  const lib = library[book.id];
  return (
    <div className="bookcard fade-up" onClick={() => onOpen(book.id)}
      style={{ display:"flex", flexDirection:"column", gap: 12, cursor:"pointer" }}>
      <div style={{ position:"relative" }}>
        <Cover book={book} w="100%" style={{ width:"100%", height:"auto", aspectRatio:"1 / 1.5" }} />
        {lib && <div style={{ position:"absolute", top:8, right:8 }}><StatusBadge status={lib.status} /></div>}
      </div>
      <div>
        {reason && <div className="eyebrow" style={{ color:"var(--rust)", marginBottom:5 }}>{reason}</div>}
        <h4 style={{ fontSize: 16.5, marginBottom: 3 }}>{book.title}</h4>
        <div style={{ fontSize: 13, color:"var(--muted)" }}>{author.name}{book.year ? " · " + book.year : ""}</div>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:7 }}>
          {book.rating > 0
            ? <><Stars value={book.rating} size={12} /><span style={{ fontSize: 12, color:"var(--muted)" }}>{book.rating.toFixed(1)}</span></>
            : <span style={{ fontSize: 11, color:"var(--faint)", fontFamily:"var(--mono)", letterSpacing:".04em" }}>{book.external ? "GOOGLE BOOKS" : "Unrated"}</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------- compact book row ---------- */
function BookRow({ book, library, onOpen, reason }) {
  const BX = BXa();
  const author = BX.authorOf(book);
  const lib = library[book.id];
  return (
    <div onClick={() => onOpen(book.id)}
      style={{ display:"flex", gap: 13, cursor:"pointer", alignItems:"flex-start", padding:"4px 0" }}
      className="bookrow">
      <Cover book={book} w={52} />
      <div style={{ minWidth:0, flex:1 }}>
        {reason && <div className="eyebrow" style={{ color:"var(--rust)", marginBottom:3 }}>{reason}</div>}
        <div style={{ fontFamily:"var(--serif)", fontWeight:600, fontSize:15, lineHeight:1.2 }}>{book.title}</div>
        <div style={{ fontSize:12.5, color:"var(--muted)", marginTop:2 }}>{author.name}</div>
        <div style={{ marginTop:6 }}>{lib ? <StatusBadge status={lib.status} /> : (book.rating > 0 ? <Stars value={book.rating} size={11} /> : null)}</div>
      </div>
    </div>
  );
}

/* ---------- classic pie chart (SVG) ---------- */
function PieChart({ data, size = 168, colors, onSlice, onPick, activeLabel }) {
  const palette = colors || ["var(--c1)","var(--c2)","var(--c3)","var(--c4)","var(--c5)","var(--c6)","var(--c7)","var(--c8)"];
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const PAD = 10; // breathing room so hovered slices can pop out without clipping
  const r = size / 2, cx = r + PAD, cy = r + PAD;
  const box = size + PAD * 2;
  let acc = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const frac = d.value / total;
    const a0 = acc, a1 = acc + frac * Math.PI * 2;
    acc = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const path = `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
    const mid = (a0 + a1) / 2;
    return { d, path, color: d.color || palette[i % palette.length], mid, frac };
  });
  return (
    <div style={{ display:"flex", gap: 22, alignItems:"center", flexWrap:"wrap" }}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} style={{ flex:"none", overflow:"visible", filter:"drop-shadow(0 6px 14px rgba(42,38,32,.14))" }}>
        {slices.map((s, i) => {
          const active = activeLabel === s.d.label;
          const dx = active ? Math.cos(s.mid) * 6 : 0, dy = active ? Math.sin(s.mid) * 6 : 0;
          return (
            <path key={i} d={s.path} fill={s.color}
              transform={`translate(${dx} ${dy})`}
              stroke="var(--card)" strokeWidth="2"
              style={{ cursor: (onPick||onSlice) ? "pointer" : "default", transition:"transform .18s ease, opacity .18s", opacity: activeLabel && !active ? 0.55 : 1 }}
              onMouseEnter={() => onSlice && onSlice(s.d.label)}
              onMouseLeave={() => onSlice && onSlice(null)}
              onClick={() => onPick && onPick(s.d)} />
          );
        })}
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap: 7, minWidth: 150 }}>
        {slices.map((s, i) => (
          <div key={i} onMouseEnter={() => onSlice && onSlice(s.d.label)} onMouseLeave={() => onSlice && onSlice(null)}
            onClick={() => onPick && onPick(s.d)}
            style={{ display:"flex", alignItems:"center", gap: 9, fontSize: 13, cursor: (onPick||onSlice) ? "pointer":"default",
              opacity: activeLabel && activeLabel !== s.d.label ? 0.5 : 1, transition:"opacity .15s" }}>
            <span style={{ width:11, height:11, borderRadius:3, background:s.color, flex:"none" }}></span>
            <span style={{ flex:1, color:"var(--ink-2)" }}>{s.d.label}</span>
            <span style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--muted)" }}>{s.d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- section header ---------- */
function SectionHead({ eyebrow, title, action }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, marginBottom:18 }} className="section-head">
      <div style={{ flex:1, minWidth:0 }}>
        {eyebrow && <div className="eyebrow" style={{ marginBottom:6 }}>{eyebrow}</div>}
        <h2 style={{ fontSize: 25 }}>{title}</h2>
      </div>
      {action && <div style={{ flex:"none" }}>{action}</div>}
    </div>
  );
}

Object.assign(window, { Cover, Stars, Star, StatusBadge, BookCard, BookRow, PieChart, SectionHead });
