/* fontlist.jsx — large Google Fonts catalog + on-demand loader.
   GOOGLE_FONTS: ~250 families grouped loosely; FontPicker filters this.
   ensureFont(family): injects a Google Fonts <link> the first time a family
   is needed (selection or preview), with a graceful fallback request for
   single-weight display faces that 400 on a multi-weight request. */

const SYSTEM_FONTS = new Set(["Helvetica","Arial","Times New Roman","Baskerville","Georgia"]);

const GOOGLE_FONTS = [
  // — Sans —
  "Inter","Roboto","Open Sans","Lato","Montserrat","Poppins","Source Sans 3","Raleway",
  "Nunito","Nunito Sans","Work Sans","Rubik","Mukta","Noto Sans","PT Sans","Karla","Hind",
  "Manrope","DM Sans","Mulish","Heebo","Barlow","Barlow Condensed","Oswald","Josefin Sans",
  "Quicksand","Cabin","Titillium Web","Archivo","Archivo Narrow","Libre Franklin","Public Sans",
  "IBM Plex Sans","Fira Sans","Assistant","Kanit","Exo 2","Jost","Hanken Grotesk","Figtree",
  "Plus Jakarta Sans","Sora","Space Grotesk","Outfit","Lexend","Onest","Schibsted Grotesk",
  "Albert Sans","Geologica","Bricolage Grotesque","Red Hat Display","Red Hat Text","Be Vietnam Pro",
  "Epilogue","Urbanist","Inter Tight","Instrument Sans","Anek Latin","Gabarito","Wix Madefor Text",
  "Familjen Grotesk","Darker Grotesque","Overpass","Saira","Saira Condensed","Cabin Condensed",
  "Dosis","Comfortaa","Maven Pro","Questrial","Varela Round","Signika","Signika Negative",
  "M PLUS Rounded 1c","Baloo 2","Fredoka","Chivo","Asap","Sarabun","Prompt","Mada","Catamaran",
  "Khand","Teko","Rajdhani","Yantramanav","Spline Sans","Sequel","Tomorrow","Commissioner",
  "Readex Pro","Sen","Senna","Antonio","League Spartan","Syne","Unbounded",
  // — Serif —
  "Playfair Display","Merriweather","Lora","PT Serif","Noto Serif","Source Serif 4","Spectral",
  "EB Garamond","Cormorant","Cormorant Garamond","Crimson Text","Crimson Pro","Libre Baskerville",
  "Bitter","Domine","Frank Ruhl Libre","Cardo","Old Standard TT","Newsreader","Vollkorn","Alegreya",
  "Zilla Slab","Arvo","Rokkitt","Slabo 27px","Roboto Slab","Bree Serif","Josefin Slab","Aleo",
  "Faustina","Fraunces","Petrona","Gelasio","Tinos","Neuton","Sorts Mill Goudy","Marcellus",
  "Marcellus SC","Cinzel","Cinzel Decorative","Prata","DM Serif Display","DM Serif Text",
  "Abril Fatface","Bodoni Moda","Italiana","Forum","Gilda Display","Eczar","Brygada 1918",
  "Literata","Lustria","Martel","Ibarra Real Nova","IM Fell English","IM Fell DW Pica",
  "IM Fell French Canon","Yrsa","Andada Pro","Piazzolla","STIX Two Text","Besley","Hahmlet",
  "Young Serif","Instrument Serif","Gloock","Playfair","Noto Serif Display","Sahitya","Lora",
  // — Slab / mono —
  "Roboto Mono","Source Code Pro","IBM Plex Mono","Space Mono","Inconsolata","JetBrains Mono",
  "Fira Code","Ubuntu Mono","PT Mono","Cousine","Cutive Mono","Courier Prime","Anonymous Pro",
  "Overpass Mono","Spline Sans Mono","DM Mono","Martian Mono","Red Hat Mono","Fragment Mono",
  // — Display / decorative —
  "Special Elite","Rye","Lobster","Lobster Two","Pacifico","Dancing Script","Caveat",
  // — Typewriter / distressed (Special Elite family) —
  "Cutive Mono","Courier Prime","Cousine","Anonymous Pro","JetBrains Mono","Nanum Gothic Coding",
  "Sometype Mono","Syne Mono","Xanh Mono","Major Mono Display","Nova Mono","VT323","Share Tech Mono",
  "Redacted Script","Trade Winds","Smokum","Ewert","Fontdiner Swanky","Cabin Sketch","Kingthings",
  "Shadows Into Light","Indie Flower","Permanent Marker","Satisfy","Sacramento","Great Vibes",
  "Kalam","Patrick Hand","Architects Daughter","Amatic SC","Bebas Neue","Anton","Alfa Slab One",
  "Righteous","Fjalla One","Passion One","Bungee","Monoton","Bangers","Staatliches","Russo One",
  "Concert One","Paytone One","Titan One","Lilita One","Luckiest Guy","Chewy","Pangolin",
  "Gloria Hallelujah","Homemade Apple","Rock Salt","Covered By Your Grace","Reenie Beanie","Cookie",
  "Allura","Tangerine","Marck Script","Yellowtail","Courgette","Ultra","Bigshot One","Cinzel",
  // — System (rendered with web-safe stacks, no network) —
  "Helvetica","Arial","Times New Roman","Baskerville","Georgia",
];
// de-dupe while preserving order
const FONT_CATALOG = [...new Set(GOOGLE_FONTS)];

const _loaded = new Set();
function ensureFont(family) {
  if (!family || SYSTEM_FONTS.has(family) || _loaded.has(family)) return;
  _loaded.add(family);
  const slug = family.replace(/\s+/g, "+");
  const id = "gf-" + family.replace(/\s+/g, "-");
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${slug}:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap`;
  // single-weight display faces 400 on the multi-axis request — retry bare.
  link.onerror = () => {
    const fb = document.createElement("link");
    fb.rel = "stylesheet";
    fb.href = `https://fonts.googleapis.com/css2?family=${slug}&display=swap`;
    document.head.appendChild(fb);
  };
  document.head.appendChild(link);
}

Object.assign(window, { FONT_CATALOG, ensureFont, SYSTEM_FONTS });
