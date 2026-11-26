// The cast of "ขนมจีนน้ำยา 30 vs 50" as lit flat cards in the 3D sets, plus the 2D effect cards (stall signs and
// price tags, the recipe video on a phone, bowls, wine bottle, the brain image, cans, puzzles, chocolates, the
// hourglass, steam, fish, balloons, the crack). Canvas pool / Actor / Fx follow the skill's cast.ts (one canvas per
// distinct drawing, yaw-only billboards with cardShade lighting, effects unlit, everything on the NOINK layer).
// Only numerals appear on signs and tags (no words, no captions).
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxStars, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, SKINS, mix } from "./toon";
import { FPS, SHOTS, BEAT, V3, clamp01, smooth, easeOut, EATER } from "./story";
import { SET, STALL, BOWL_B, BOWL_C, POT_C, SIGN_C, LABT } from "./sets";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        g.filter = "none";
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) this.mat.map = t; }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; add: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.add = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind(mode: FxMode, opacity: number, gain: number) {
    const t = this.r?.tex;
    if (!t) return;
    if (mode === "blob") {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else {
      const m = mode === "soft" ? this.soft : mode === "add" ? this.add : this.mat;
      m.map = t; m.opacity = opacity; m.color.setScalar(gain); this.mesh.material = m;
      this.mesh.renderOrder = mode === "hard" ? 0 : 3;
    }
  }
}

// ---------------- placements ----------------
export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; mirror?: boolean; size: [number, number, number] };
export type FxMode = "hard" | "soft" | "add" | "blob";
/** orient: "cam" = faces the camera; "flat" = lies on the floor/table; number = vertical plane with that yaw (walls) */
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; orient?: "cam" | "flat" | number; rot?: number; mode?: FxMode; opacity?: number; gain?: number };
export type Stage = { places: Place[]; fx: FxPlace[] };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3; light: "day" | "golden" | "night" };

const q = (v: number, n = 120) => Math.round(v * n) / n;
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
const tier = (d: number): [number, number, number] =>
  d < 2.6 ? [1500, 2500, 2.5] : d < 5 ? [1080, 1800, 1.8] : d < 12 ? [600, 1000, 1.0] : [300, 500, 0.5];
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = cam.sun.dot(cam.right) * (mirror ? -1 : 1), sy = -cam.sun.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** blinks every 0.5-2.3 s (4 f half/shut/shut/half), deterministic per character */
const LID = [0.5, 1, 1, 0.5];
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const lidAt = (f: number, i: number) => {
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};

/** a hair bun behind the crown for the women (drawn before the body so the head covers its lower half) */
const bun = (p: Pen, o: Outfit, sit: boolean, back: number) => {
  if (o.hat !== "hair" || !o.dress) return;
  const stout = o.build === "stout", HH = 222, torsoBot = sit ? 975 - 0.2 * HH : 975 - (stout ? 1.32 : 1.4) * HH;
  const crown = torsoBot - (stout ? 1.15 : 1.1) * HH - 2 * 111;
  p.ol = 11;
  p.ell(300 + back * 70, crown + 22 + (back ? 30 : 0), 52, 44, o.hair!);
  p.ol = 12;
};
type Pose = { side?: false; fo: FrontOpts; mirror?: boolean } | { side: true; so: SideOpts; faceLeft?: boolean };
/** one character card */
const person = (cam: CamInfo, i: number, o: Outfit, at: V3, pose: Pose, f: number, scale = 1): Place => {
  const d = cam.pos.distanceTo(new THREE.Vector3(at[0], at[1] + 1.3, at[2])) / scale;
  const [w, h, k] = tier(d);
  const lid = lidAt(f, i);
  // side view: the drawing faces screen-right; mirror it when the character should face screen-left
  const mirror = pose.side ? !!pose.faceLeft : !!pose.mirror;
  const light = light2D(cam, mirror), seed = (i % 7) + 1;
  if (pose.side) {
    const so: SideOpts = { blink: lid, ...pose.so, light, seed };
    return { key: `S|${i}|${fkey(o)}|${fkey(so)}`, x: at[0], y: at[1], z: at[2], scale, mirror, size: [w, h, k], draw: (p) => { bun(p, o, false, -1); bodySide(p, o, so); } };
  }
  const fo: FrontOpts = { mode: "stand", blink: lid, ...pose.fo, light, seed };
  return { key: `F|${i}|${fkey(o)}|${fkey(fo)}`, x: at[0], y: at[1], z: at[2], scale, mirror, size: [w, h, k], draw: (p) => { bun(p, o, fo.mode === "sit", 0); bodyFront(p, o, fo); } };
};
/** tight contact shadow under the feet */
const contact = (out: Stage, x: number, y: number, z: number, light: string, sc = 1) => {
  const c = light === "night" ? "#4a4870" : light === "golden" ? "#5a4a78" : "#4f5070";
  out.fx.push({ key: `blob|contact|${c}`, cw: 128, ch: 128, draw: (p) => fxContact(p, c), x, y: y + 0.012, z, w: 0.6 * sc, h: 0.42 * sc, orient: "flat", mode: "blob" });
};

// ---------------- the cast ----------------
const VA: Outfit = { jacket: "#9aa0a8", pants: "#3b4a6a", boots: "#2a2a30", hat: "hair", hair: "#1e1a1a", skin: SKINS[1] };
const VB: Outfit = { jacket: "#2f3f7a", pants: "#26304f", boots: "#2a1e1a", hat: "cap", cap: "#b8323a", skin: SKINS[1] };
const VC: Outfit = { jacket: "#2f8a5a", pants: "#2a3a30", boots: "#3a2a20", hat: "hair", hair: "#2a1a14", dress: "#2f8a5a", skin: SKINS[2] };
const VF: Outfit = { jacket: "#ff5a9a", pants: "#2a2a40", boots: "#f4f1ea", hat: "cap", cap: "#ffd23a", skin: SKINS[1] };
const SCI: Outfit = { jacket: "#f4f4f0", pants: "#3a4a5a", boots: "#2a2a30", hat: "hair", hair: "#2a2020", skin: SKINS[2] };
const STU1: Outfit = { jacket: "#e8a03a", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#1e1a1a", skin: SKINS[1] };
const STU2: Outfit = { jacket: "#4a8ac0", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#3a2418", dress: "#4a8ac0", skin: SKINS[2] };
const TASTER: Outfit = { jacket: "#c25a7a", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#2a1a14", dress: "#c25a7a", skin: SKINS[1] };
const EATERO: Outfit = { jacket: "#e8c43a", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#1e1414", dress: "#e8c43a", skin: SKINS[2] };
const FOLK = (v: number): Outfit => {
  const tops = ["#3f6fb5", "#d8463a", "#5d9a4a", "#b5653f", "#2f7a8a", "#7b5ac9", "#e8a03a", "#f2f0ea"];
  const o: Outfit = { jacket: tops[v % 8], pants: ["#3b3f52", "#2a3050", "#5a4a3a"][v % 3], boots: "#3a2a20", hat: "hair", hair: ["#1e1a1a", "#2a1a14", "#3a2418", "#8a8a8a"][v % 4], skin: SKINS[v % 3 === 2 ? 3 : v % 3] };
  return v % 2 ? { ...o, dress: tops[(v + 3) % 8] } : o;
};

// ---------------- effect drawings ----------------
const rad = (d: number) => (d * Math.PI) / 180;
/** bold numerals with an ink outline (the only lettering in the film) */
const num = (p: Pen, s: string, x: number, y: number, size: number, fill: string, ink = INK, lw = 14) => {
  const g = p.g;
  g.save(); g.font = `900 ${size}px "DejaVu Sans", "Liberation Sans", Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = lw; g.strokeStyle = ink; g.strokeText(s, x, y); g.fillStyle = fill; g.fillText(s, x, y);
  g.restore();
};
const rr = (p: Pen, x0: number, y0: number, x1: number, y1: number, r: number, fill: string, ol?: number) => {
  const pts: [number, number][] = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    for (let i = 0; i <= 6; i++) pts.push([cx + r * Math.cos(rad(a + 15 * i)), cy + r * Math.sin(rad(a + 15 * i))]);
  p.poly(pts, fill, ol);
};
/** a bowl of khanom jeen nam ya in 3/4 view on a 400 x 300 canvas: clay (or melamine) bowl, curry, noodle nests */
const fxBowl = (p: Pen, clay: boolean, leaf: boolean) => {
  p.ol = 8;
  if (leaf) { p.ell(200, 210, 190, 70, "#4a9a3a"); p.stroke([[30, 210], [370, 210]], 5, "#2f7a2a"); for (let x = 60; x < 360; x += 40) p.stroke([[x, 210], [x + 22, 175]], 3, "#2f7a2a"); }
  const body = clay ? "#a8542e" : "#f2f4f6", rim = clay ? "#c86a3a" : "#ffffff";
  p.poly([[50, 120], [350, 120], [330, 190], [270, 240], [130, 240], [70, 190]], body);
  if (clay) for (let x = 90; x < 320; x += 38) p.stroke([[x, 150], [x + 6, 220]], 4, "rgba(80,30,10,0.35)");
  p.ell(200, 120, 152, 46, rim);
  p.ell(200, 122, 136, 38, "#e8902e", 0);
  p.ell(200, 118, 120, 30, "#f0a83a", 0);
  for (const [x, y] of [[150, 112], [205, 104], [255, 116]]) { p.ell(x, y, 34, 16, "#f6f2e4", 5); p.arc(x, y, 18, 8, 200, 520, 3, "#d8d2c0"); }
  for (const [x, y] of [[120, 128], [285, 126], [230, 132]]) p.dot(x, y, 6, "#d83a2a");
  p.stroke([[175, 132], [190, 122]], 6, "#4a9a3a"); p.stroke([[265, 104], [278, 96]], 6, "#4a9a3a");
};
/** smartphone playing the same recipe video (red play badge + a bowl thumbnail), 300 x 520 */
const fxPhone = (p: Pen) => {
  p.ol = 10;
  rr(p, 20, 10, 280, 510, 36, "#24242c");
  rr(p, 38, 50, 262, 470, 12, "#f4f1ea", 0);
  p.g.save(); p.g.scale(0.5, 0.5); p.g.translate(100, 330); fxBowl(p, false, false); p.g.restore();
  rr(p, 95, 300, 205, 372, 22, "#e8322e", 8);
  p.poly([[138, 316], [138, 356], [172, 336]], "#ffffff", 0);
  rr(p, 60, 400, 240, 412, 6, "#c8c4bc", 0); rr(p, 60, 400, 150, 412, 6, "#e8322e", 0);
  p.dot(150, 30, 7, "#4a4a55");
};
/** stall header boards, 700 x 260 */
const fxSignA = (p: Pen) => {
  p.ol = 9;
  p.poly([[20, 30], [680, 20], [672, 240], [28, 236]], "#f4f2ea");
  num(p, "30", 360, 136, 190, "#e2322e", "#7a1414", 10);
  p.g.save(); p.g.translate(40, 70); p.g.scale(0.42, 0.42); fxBowl(p, false, false); p.g.restore();
  p.g.save(); p.g.translate(510, 70); p.g.scale(0.42, 0.42); fxBowl(p, false, false); p.g.restore();
};
const fxSignB = (p: Pen, shine = 0) => {
  p.ol = 10;
  rr(p, 10, 10, 690, 250, 26, "#2a120c");
  rr(p, 30, 30, 670, 230, 18, "#3a1a10", 0);
  p.g.strokeStyle = "#e8c46a"; p.g.lineWidth = 8; p.g.strokeRect(44, 44, 612, 172);
  for (const [x, y] of [[44, 44], [656, 44], [44, 216], [656, 216]]) p.dot(x, y, 12, "#e8c46a");
  num(p, "50", 350, 134, 170, "#f2d070", "#5a3a10", 10);
  for (const x of [140, 560]) { p.ell(x, 140, 56, 22, "#e8c46a", 5); p.poly([[x - 56, 140], [x + 56, 140], [x + 34, 180], [x - 34, 180]], "#c8a04a", 5); }
  if (shine > 0) { const g = p.g, x = 40 + 620 * shine; const gr = g.createLinearGradient(x - 60, 0, x + 60, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,250,220,0.75)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(30, 30, 640, 200); }
};
/** the honest seller's story board: her portrait, the fish, the simmering pot, the clock (no words) */
const fxSignC = (p: Pen) => {
  p.ol = 9;
  rr(p, 10, 10, 690, 250, 22, "#f4ead2");
  p.g.strokeStyle = "#2f8a5a"; p.g.lineWidth = 10; p.g.strokeRect(30, 30, 640, 200);
  // portrait
  p.ell(130, 130, 78, 78, "#bfe0c8", 7); p.ell(130, 128, 44, 48, "#ecd0b6", 6); p.ell(130, 92, 46, 24, "#2a1a14", 0);
  p.dot(116, 126, 6); p.dot(144, 126, 6); p.arc(130, 140, 16, 12, 20, 160, 5);
  // fish
  p.poly([[250, 130], [300, 98], [380, 104], [420, 130], [380, 156], [300, 162]], "#8ab0c8"); p.poly([[420, 130], [460, 100], [460, 160]], "#8ab0c8"); p.dot(305, 124, 7);
  // pot + steam
  p.poly([[490, 120], [600, 120], [590, 200], [500, 200]], "#c4c8ce"); p.ell(545, 120, 58, 14, "#e08a3a", 6);
  for (const x of [520, 548, 576]) p.stroke([[x, 100], [x - 10, 80], [x + 4, 62], [x - 6, 44]], 6, "#9aa4b0");
  // little clock
  p.ell(640, 70, 28, 28, "#ffffff", 5); p.stroke([[640, 70], [640, 52]], 5); p.stroke([[640, 70], [654, 76]], 5);
};
/** the fake heritage board: same idea as B but glossy new, a price-tag sticker still on it */
const fxSignF = (p: Pen) => {
  fxSignB(p, 0);
  p.poly([[560, 18], [660, 18], [660, 60], [560, 60]], "#ffffff", 5);
  p.stroke([[575, 39], [645, 39]], 6, "#d8322e");
  for (const [x, y] of [[90, 60], [620, 200], [330, 210]]) { p.poly([[x, y - 18], [x + 6, y - 6], [x + 18, y], [x + 6, y + 6], [x, y + 18], [x - 6, y + 6], [x - 18, y], [x - 6, y - 6]], "#ffffff", 0); }
};
/** small standing price sign, 300 x 260 */
const fxPriceC = (p: Pen) => {
  p.ol = 8;
  p.poly([[60, 240], [150, 200], [240, 240]], "#8a5a3a");
  rr(p, 20, 20, 280, 210, 18, "#fbf6e8");
  p.g.strokeStyle = "#2f8a5a"; p.g.lineWidth = 8; p.g.strokeRect(36, 36, 228, 158);
  num(p, "45", 150, 118, 120, "#2f8a5a", "#163a26", 8);
};
/** paper tag on a string, 360 x 220: text like "$90", "$10", "-50%" */
const fxTag = (p: Pen, s: string, fill: string, ink: string) => {
  p.ol = 7;
  p.poly([[70, 20], [340, 20], [340, 200], [70, 200], [14, 110]], fill);
  p.ell(58, 110, 14, 14, "#ffffff", 5);
  num(p, s, 210, 112, s.length > 3 ? 96 : 118, "#ffffff", ink, 12);
};
/** wine bottle, 200 x 600 */
const fxBottle = (p: Pen) => {
  p.ol = 8;
  p.poly([[78, 20], [122, 20], [122, 170], [168, 240], [168, 580], [32, 580], [32, 240], [78, 170]], "#3a1a2a");
  p.poly([[72, 10], [128, 10], [128, 70], [72, 70]], "#8a1f2a");
  rr(p, 44, 330, 156, 470, 8, "#f2ead6", 6);
  p.ell(100, 400, 30, 30, "#8a1f2a", 5);
  p.stroke([[50, 260], [50, 560]], 10, "rgba(255,255,255,0.25)");
};
/** wine glass, 200 x 340 */
const fxGlass = (p: Pen) => {
  p.ol = 7;
  p.poly([[40, 20], [160, 20], [150, 120], [110, 170], [90, 170], [50, 120]], "rgba(230,240,250,0.9)");
  p.poly([[48, 80], [152, 80], [148, 118], [110, 162], [90, 162], [52, 118]], "#8a1f2a", 0);
  p.stroke([[100, 170], [100, 300]], 9); p.ell(100, 310, 52, 14, "rgba(230,240,250,0.9)");
};
/** the brain on the scan display: pink lobes; orange "pleasure" region glowing by k (0..1), 400 x 320 */
const fxBrain = (p: Pen, k: number) => {
  p.ol = 9;
  p.ell(200, 160, 170, 128, "#f2a6b4");
  for (const [x, y, rx, ry, a] of [[120, 120, 60, 34, -20], [230, 92, 70, 30, 10], [300, 160, 50, 40, 60], [160, 200, 70, 30, 5], [240, 220, 50, 22, -10]] as const) p.arc(x, y, rx, ry, 200 + a, 340 + a, 6, "#b85a72");
  p.stroke([[200, 40], [205, 120], [196, 200], [200, 280]], 6, "#b85a72");
  const g = p.g, gr = g.createRadialGradient(150, 230, 0, 150, 230, 40 + 60 * k);
  gr.addColorStop(0, `rgba(255,${180 + 60 * k},60,${0.35 + 0.65 * k})`); gr.addColorStop(1, "rgba(255,140,40,0)");
  g.fillStyle = gr; g.beginPath(); g.ellipse(200, 160, 168, 126, 0, 0, 7); g.fill();
  p.ell(150, 230, 26 + 14 * k, 20 + 10 * k, mix("#f2a6b4", "#ffb030", 0.3 + 0.7 * k), 6);
};
const fxMonitor = (p: Pen, k: number) => { rr(p, 0, 0, 512, 360, 14, "#0e1830", 0); p.g.save(); p.g.translate(56, 20); fxBrain(p, k); p.g.restore(); };
/** energy drink can, 200 x 340 */
const fxCan = (p: Pen) => {
  p.ol = 8;
  rr(p, 30, 30, 170, 320, 22, "#2a64c8");
  p.ell(100, 34, 70, 14, "#c8ccd2");
  p.poly([[112, 90], [70, 190], [100, 190], [84, 270], [136, 160], [104, 160], [126, 90]], "#ffd23a", 6);
  p.stroke([[44, 60], [44, 300]], 10, "rgba(255,255,255,0.3)");
};
/** puzzle sheet seen from above (grid; solved = filled), 300 x 360 */
const fxPuzzle = (p: Pen, solved: number) => {
  p.ol = 6;
  p.poly([[20, 20], [280, 20], [280, 340], [20, 340]], "#fbfbf6");
  for (let i = 0; i <= 6; i++) { p.stroke([[50 + i * 33, 60], [50 + i * 33, 300]], 3, "#7a7a8a"); p.stroke([[50, 60 + i * 40], [248, 60 + i * 40]], 3, "#7a7a8a"); }
  const n = Math.round(solved * 30);
  for (let c = 0; c < n; c++) { const i = c % 6, j = Math.floor(c / 6); p.dot(66 + i * 33, 80 + j * 40, 9, "#2a4ab8"); }
};
const fxQmark = (p: Pen) => { p.ol = 8; num(p, "?", 100, 110, 180, "#ffffff", INK, 14); };
const fxBulb = (p: Pen) => {
  p.ol = 8;
  p.ell(110, 90, 70, 70, "#fff27a"); p.poly([[80, 150], [140, 150], [134, 190], [86, 190]], "#c8ccd2");
  p.stroke([[95, 165], [125, 165]], 5); p.stroke([[100, 100], [110, 125], [120, 100]], 5, "#c89a2a");
};
/** chocolate bars on 360 x 220: new = purple foil; old = sepia paper, ribbon + wax seal */
const fxChoc = (p: Pen, old: boolean, bitten = false) => {
  p.ol = 7;
  if (old) {
    p.poly([[20, 30], [340, 30], [340, 190], [20, 190]], "#d8c49a");
    for (let i = 0; i < 18; i++) p.dot(40 + ((i * 53) % 290), 50 + ((i * 37) % 130), 5, "rgba(120,90,50,0.25)");
    p.poly([[20, 95], [340, 95], [340, 125], [20, 125]], "#8a1f2a", 5);
    p.ell(250, 110, 32, 32, "#b8323a", 6); p.dot(250, 110, 12, "#7a1a20");
    p.g.strokeStyle = "#6a4a2a"; p.g.lineWidth = 4; p.g.strokeRect(36, 44, 288, 132);
  } else {
    p.poly([[20, 30], [340, 30], [340, 190], [20, 190]], "#7a4ad8");
    p.poly([[20, 95], [340, 95], [340, 125], [20, 125]], "#c8c4f0", 5);
    p.stroke([[40, 50], [140, 50]], 8, "rgba(255,255,255,0.4)");
  }
  if (bitten) { p.poly([[24, 30], [100, 30], [100, 190], [24, 190]], "#5a3020", 6); for (let y = 40; y < 190; y += 50) p.stroke([[24, y], [100, y]], 4, "#3a1a10"); }
};
/** hourglass, 200 x 300, sand fraction s (0 top full .. 1 bottom full) */
const fxHourglass = (p: Pen, s: number) => {
  p.ol = 8;
  p.poly([[30, 20], [170, 20], [170, 40], [30, 40]], "#8a5a3a"); p.poly([[30, 260], [170, 260], [170, 280], [30, 280]], "#8a5a3a");
  p.poly([[45, 40], [155, 40], [108, 150], [155, 260], [45, 260], [92, 150]], "rgba(220,235,250,0.85)");
  p.poly([[45 + 40 * s, 40 + 90 * s], [155 - 40 * s, 40 + 90 * s], [108, 150], [92, 150]], "#e8b84a", 0);
  p.poly([[60 + 30 * (1 - s), 260 - 100 * s], [140 - 30 * (1 - s), 260 - 100 * s], [155, 260], [45, 260]], "#e8b84a", 0);
};
/** clock face with a fast sweeping hand, 240 x 240 */
const fxClock = (p: Pen, a: number) => {
  p.ol = 8;
  p.ell(120, 120, 100, 100, "#ffffff");
  for (let i = 0; i < 12; i++) p.stroke([[120 + 82 * Math.cos(rad(i * 30)), 120 + 82 * Math.sin(rad(i * 30))], [120 + 92 * Math.cos(rad(i * 30)), 120 + 92 * Math.sin(rad(i * 30))]], 5);
  p.stroke([[120, 120], [120 + 70 * Math.cos(a), 120 + 70 * Math.sin(a)]], 8);
  p.stroke([[120, 120], [120 + 46 * Math.cos(a / 12 - 1), 120 + 46 * Math.sin(a / 12 - 1)]], 10);
  p.dot(120, 120, 10);
};
const fxSteam = (p: Pen, t: number) => {
  for (let i = 0; i < 3; i++) {
    const u = (t * 0.7 + i / 3) % 1, x = 70 + i * 60, a = Math.sin(u * Math.PI);
    p.stroke([[x, 380 - 300 * u], [x - 20, 330 - 300 * u], [x + 12, 280 - 300 * u]], 16 * (1 - u * 0.5), `rgba(255,255,255,${(0.75 * a).toFixed(2)})`);
  }
};
const fxFish = (p: Pen) => {
  p.ol = 8;
  p.poly([[30, 110], [110, 50], [250, 56], [310, 110], [250, 164], [110, 170]], "#9abed4");
  p.poly([[310, 110], [370, 60], [370, 160]], "#7aa0b8"); p.dot(100, 100, 10); p.arc(150, 110, 30, 40, -60, 60, 5, "#5a7a90");
  p.stroke([[200, 70], [230, 110], [200, 150]], 5, "#5a7a90");
};
const fxBalloons = (p: Pen, t: number) => {
  p.ol = 7;
  const cs = ["#ff4a8a", "#ffd23a", "#4ac8ff", "#7ad04a"];
  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 70 + 10 * Math.sin(t * 2 + i), y = 90 + (i % 2) * 40;
    p.stroke([[x, y + 60], [150 + i * 10, 480]], 3, "#8a8a8a"); p.ell(x, y, 46, 58, cs[i]); p.stroke([[x - 18, y - 30], [x - 24, y - 10]], 6, "rgba(255,255,255,0.6)");
  }
};
const fxBunting = (p: Pen) => {
  p.ol = 6; p.stroke([[10, 30], [350, 60], [690, 30]], 5);
  const cs = ["#ff4a8a", "#ffd23a", "#4ac8ff", "#7ad04a", "#ff8a3a"];
  for (let i = 0; i < 9; i++) { const x = 40 + i * 76, y = 30 + 30 * Math.sin((i / 8) * Math.PI); p.poly([[x - 26, y], [x + 26, y], [x, y + 60]], cs[i % 5]); }
};
const fxGlow = (p: Pen, c: string) => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, c); gr.addColorStop(0.35, mix(c, "#000000", 0.55)); gr.addColorStop(1, "#000000");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};
const fxCrack = (p: Pen, t: number) => {
  fxBurst(p, t, "#fff6c8", 12, 30, 240);
  p.ol = 0;
  for (let i = 0; i < 6; i++) {
    const a = rad(i * 60 + 20), r1 = 90 + 150 * easeOut(t);
    p.stroke([[250, 250], [250 + Math.cos(a) * r1 * 0.5 + 14, 250 + Math.sin(a) * r1 * 0.5 - 10], [250 + Math.cos(a) * r1, 250 + Math.sin(a) * r1]], 8 * (1 - t) + 2, "#ffffff");
  }
};
/** a jagged crack line across a sign (drawn over the board), 700 x 260 */
const fxSignCrack = (p: Pen) => { p.ol = 0; p.stroke([[330, 0], [360, 70], [320, 120], [380, 180], [350, 260]], 14, INK); p.stroke([[330, 0], [360, 70], [320, 120], [380, 180], [350, 260]], 5, "#f4f0e0"); };

// ---------------- staging per shot ----------------
const L = (f: number, f0: number, f1: number) => clamp01((f - f0) / (f1 - f0));
const lead = 2;
/** pop-in scale with a little overshoot */
const pop = (f: number, f0: number, n = 8) => { const u = L(f, f0, f0 + n); return u <= 0 ? 0 : easeOut(u) * (1 + 0.15 * Math.sin(Math.min(1, u * 1.3) * Math.PI)); };
const STALL_V = (s: V3): V3 => [s[0], 0, -0.95];
/** queue spots to the right of stall B along the sidewalk (facing left, toward the stall) */
const QSPOT = (i: number): V3 => [STALL.B[0] + 0.35 + 0.62 * i, 0.03, 0.9 + 0.12 * i];

export const stage = (id: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] }, t = f / FPS;
  const P = (i: number, o: Outfit, at: V3, pose: Pose, sc = 1, blob = true) => {
    out.places.push(person(cam, i, o, at, pose, f, sc));
    if (blob) contact(out, at[0], Math.max(0, at[1] - 0.04) + (at[1] > 0.3 ? 0.04 : 0), at[2], cam.light, sc);
  };
  const FX = (x: FxPlace) => out.fx.push(x);
  const A = STALL.A, B = STALL.B, C = STALL.C, F = STALL.F, LB = SET.lab;
  const signs = (withF: boolean) => {
    FX({ key: "signA", cw: 700, ch: 260, draw: fxSignA, x: A[0], y: 2.28, z: 0.63, w: 1.3, h: 0.48, orient: 0 });
    FX({ key: "signB", cw: 700, ch: 260, draw: (p) => fxSignB(p, 0), x: B[0], y: 2.28, z: 0.63, w: 1.4, h: 0.52, orient: 0 });
    if (withF) FX({ key: "signF", cw: 700, ch: 260, draw: fxSignF, x: F[0], y: 2.28, z: 0.63, w: 1.4, h: 0.52, orient: 0 });
  };
  const bowlAt = (key: string, x: number, y: number, z: number, w: number, clay: boolean, leaf: boolean, orient: FxPlace["orient"] = "cam") =>
    FX({ key: `bowl|${key}|${clay}|${leaf}`, cw: 400, ch: 300, draw: (p) => fxBowl(p, clay, leaf), x, y, z, w, h: w * 0.75, orient });
  /** a vendor ladling: small idle bob */
  const vendor = (i: number, o: Outfit, s: V3, expr: Expr, extra: Partial<FrontOpts> = {}, mirror = false) =>
    P(i, o, STALL_V(s), { fo: { expr, ...extra }, mirror }, 1, false);
  const queue = (n: number, base = 50, k0 = 0) => { for (let k = k0; k < n; k++) P(base + k, FOLK(k), QSPOT(k), { side: true, so: { mode: "stand", expr: k % 3 === 1 ? "smile" : "neutral" }, faceLeft: true }); };
  switch (id) {
    case 1: {
      signs(false);
      const look = f >= BEAT.youtube - 6 && f < BEAT.p30 - 10;
      vendor(1, VA, A, look ? "grin" : "neutral", { look: look ? 0.8 : 0, facing: look ? 1 : 0 });
      vendor(2, VB, B, look ? "grin" : "neutral", { look: look ? -0.8 : 0, facing: look ? -1 : 0 }, false);
      // the same recipe video between both stalls
      const ph = pop(f, BEAT.youtube - lead), out1 = 1 - L(f, BEAT.p30 - 16, BEAT.p30 - 6);
      if (ph > 0 && out1 > 0) FX({ key: "phone", cw: 300, ch: 520, draw: fxPhone, x: 0, y: 2.05, z: 0.4, w: 0.55 * ph * out1, h: 0.95 * ph * out1 });
      // stall A: one lone diner; stall B: a queue that appears on "50"
      P(10, FOLK(5), [A[0] - 0.8, 0.38, 1.7], { fo: { mode: "sit", expr: "neutral", look: 0.4 } }, 1, false);
      bowlAt("A1", A[0] - 0.62, 0.8, 1.72, 0.22, false, false, "flat");
      const nq = f < BEAT.p50 - lead ? 2 : 2 + Math.min(4, Math.floor((f - BEAT.p50 + lead) / 4) + 1);
      queue(nq);
      for (let k = 0; k < 3; k++) P(60 + k, FOLK(k + 3), [B[0] - 0.75 + k * 0.75, 0.38, k === 1 ? 2.35 : 1.7], { fo: { mode: "sit", expr: "smile_closed", look: 0.3 } }, 1, false);
      break;
    }
    case 2: {
      signs(false);
      const sh = L(f, BEAT.old - lead, BEAT.old + 14);
      if (sh > 0 && sh < 1) FX({ key: `signBs|${Math.round(sh * 14)}`, cw: 700, ch: 260, draw: (p) => fxSignB(p, Math.round(sh * 14) / 14), x: B[0], y: 2.28, z: 0.635, w: 1.4, h: 0.52, orient: 0 });
      if (sh > 0.2 && sh < 1) FX({ key: `glint|${Math.round(sh * 10)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, Math.round(sh * 10) / 10, "#fff2b0", 6, 20, 200), x: B[0] + 0.45, y: 2.42, z: 0.7, w: 0.35, h: 0.35, mode: "add", gain: 1.6 });
      vendor(2, VB, B, f >= BEAT.old - lead ? "smile" : "neutral", { prop: f >= BEAT.bowl - 10 ? "reach" : null });
      queue(4, 50, 1);
      // clay bowl on banana leaf (insert after "ชาม"), steam
      bowlAt("B", BOWL_B[0], BOWL_B[1] + 0.07, BOWL_B[2] + 0.02, 0.36, true, true);
      FX({ key: `steam|${Math.round(t * 10)}`, cw: 220, ch: 400, draw: (p) => fxSteam(p, Math.round(t * 10) / 10), x: BOWL_B[0], y: BOWL_B[1] + 0.35, z: BOWL_B[2], w: 0.18, h: 0.32, mode: "soft", opacity: 0.8 });
      break;
    }
    case 3: {
      // the subject lies in the scanner (only the feet show), the researcher offers a glass; the monitor shows the brain
      const sci: V3 = [LB - 1.45, 0, -0.35];
      const glassOn = f < BEAT.wine2;
      P(3, SCI, sci, { fo: { expr: "neutral", prop: glassOn ? "reach" : null, look: 0.6, facing: 1 } });
      if (glassOn) FX({ key: "glass", cw: 200, ch: 340, draw: fxGlass, x: sci[0] + 0.5, y: 1.12, z: sci[2] + 0.05, w: 0.12, h: 0.2 });
      const k0 = f < BEAT.wine1 ? 0.15 : f < BEAT.d90 ? 0.4 : f < BEAT.d10 - lead ? 1 : 0.25;
      FX({ key: `mon|${k0}`, cw: 512, ch: 360, draw: (p) => fxMonitor(p, k0), x: LB + 2.4, y: 1.1, z: 0.125, w: 0.82, h: 0.58, orient: 0 });
      // the insert: bottle on the cart, swinging price tag, the brain readout
      FX({ key: "bottle", cw: 200, ch: 600, draw: fxBottle, x: LABT[0] - 0.05, y: LABT[1] + 0.21, z: LABT[2], w: 0.14, h: 0.42 });
      if (f >= BEAT.wine2 - 2) {
        const is90 = f < BEAT.d10 - lead;
        const tp = is90 ? pop(f, BEAT.d90 - lead - 6) : pop(f, BEAT.d10 - lead);
        const sw = 0.12 * Math.sin(t * 5) * Math.exp(-(((f - (is90 ? BEAT.d90 : BEAT.d10)) / 30) ** 2));
        if (tp > 0) FX({ key: `tag|${is90}`, cw: 360, ch: 220, draw: (p) => fxTag(p, is90 ? "$90" : "$10", is90 ? "#c8962a" : "#7a8a9a", is90 ? "#5a3a10" : "#2a3440"), x: LABT[0] + 0.12, y: LABT[1] + 0.3, z: LABT[2] + 0.06, w: 0.24 * tp, h: 0.15 * tp, rot: -0.15 + sw });
        const k = f < BEAT.d90 - lead ? 0.3 : f < BEAT.d10 - lead ? 0.3 + 0.7 * smooth(L(f, BEAT.d90 - lead, BEAT.tasty)) : 1 - 0.8 * smooth(L(f, BEAT.d10 - lead, BEAT.d10 + 12));
        const kq = Math.round(k * 12) / 12;
        FX({ key: `brain|${kq}`, cw: 400, ch: 320, draw: (p) => fxBrain(p, kq), x: LABT[0] + 0.62, y: LABT[1] + 0.55, z: LABT[2] - 0.05, w: 0.46, h: 0.37 });
        FX({ key: "glowBrain", cw: 256, ch: 256, draw: (p) => fxGlow(p, "#ffb040"), x: LABT[0] + 0.55, y: LABT[1] + 0.5, z: LABT[2] - 0.02, w: 0.6 + 0.5 * k, h: 0.6 + 0.5 * k, mode: "add", gain: 0.25 + 0.9 * k });
      }
      break;
    }
    case 4: case 9: {
      signs(false);
      vendor(2, VB, B, "smile");
      queue(4);
      const eating = id === 9;
      const ex: Expr = !eating ? (f >= BEAT.mustBeTasty - lead ? "smile" : "neutral") : f >= BEAT.mouth - lead ? "relief" : "smile_closed";
      P(5, EATERO, EATER, { fo: { expr: ex, prop: "icecream", look: eating ? 0 : 0.5, headTilt: eating ? 4 : -3 } });
      bowlAt("eat", EATER[0] + 0.13, 0.99, EATER[2] + 0.08, 0.3, true, false);
      if (eating) {
        // a spoonful rising to the mouth, sparkle at the mouth, then the head lights up
        const u = smooth(L(f, BEAT.mouth - 18, BEAT.mouth - lead));
        FX({ key: "spoon", cw: 220, ch: 120, draw: (p) => { p.ol = 6; p.ell(60, 60, 50, 30, "#e8eaee"); p.ell(60, 56, 34, 16, "#f0a83a", 0); p.stroke([[110, 60], [210, 50]], 12, "#c8ccd2"); }, x: EATER[0] + 0.12 - 0.04 * u, y: 1.02 + 0.3 * u, z: EATER[2] + 0.12, w: 0.16, h: 0.09, rot: 0.3 * u });
        const sp = L(f, BEAT.mouth - lead, BEAT.mouth + 12);
        if (sp > 0 && sp < 1) FX({ key: `spark|${Math.round(sp * 10)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, Math.round(sp * 10) / 10, "#fff2b0", 8, 20, 200), x: EATER[0] + 0.02, y: 1.33, z: EATER[2] + 0.15, w: 0.3, h: 0.3, mode: "add", gain: 1.4 });
      }
      // the brain above her head: lights up on "สมอง" (shot 4) / "ในหัว" (shot 9), stars on "ต้องอร่อย"
      const on = !eating ? smooth(L(f, BEAT.brain - lead - 4, BEAT.brain + 8)) : smooth(L(f, BEAT.head - lead - 4, BEAT.head + 8));
      if (on > 0) {
        const k = Math.round((!eating ? 0.35 + 0.65 * smooth(L(f, BEAT.mustBeTasty - lead, BEAT.mustBeTasty + 10)) : 1) * 10) / 10;
        FX({ key: `brainH|${k}`, cw: 400, ch: 320, draw: (p) => fxBrain(p, k), x: EATER[0] + 0.02, y: 2.05, z: EATER[2] + 0.05, w: 0.42 * on, h: 0.34 * on });
        FX({ key: "glowBrainH", cw: 256, ch: 256, draw: (p) => fxGlow(p, "#ffb040"), x: EATER[0], y: 2.02, z: EATER[2] + 0.08, w: 0.9 * on, h: 0.9 * on, mode: "add", gain: 0.3 + 0.7 * k });
        if (k > 0.6) FX({ key: `stars|${Math.round(t * 12) % 12}`, cw: 420, ch: 210, draw: (p) => fxStars(p, (Math.round(t * 12) % 12) / 12), x: EATER[0], y: 2.32, z: EATER[2] + 0.1, w: 0.5, h: 0.25 });
      }
      break;
    }
    case 5: {
      const s1: V3 = [LB + 5.15, 0.38, -1.5], s2: V3 = [LB + 6.85, 0.38, -1.5];
      const res = f >= BEAT.fewer - lead;
      P(6, STU1, s1, { fo: { mode: "sit", expr: res ? "dazed" : "neutral", look: 0.2 } }, 1, false);
      P(7, STU2, s2, { fo: { mode: "sit", expr: f >= BEAT.fullPrice - lead ? "grin" : "neutral", look: -0.2 } }, 1, false);
      for (const [x, k] of [[s1[0], 0], [s2[0], 1]] as const) {
        FX({ key: "can", cw: 200, ch: 340, draw: fxCan, x: x + 0.38, y: 0.77 + 0.13, z: -0.75, w: 0.13, h: 0.22 });
        const solved = k === 0 ? 0.25 * smooth(L(f, 900, BEAT.fewer)) : 0.2 + 0.8 * smooth(L(f, 900, BEAT.fullPrice + 10));
        const sq = Math.round(solved * 30) / 30;
        FX({ key: `puz|${sq}`, cw: 300, ch: 360, draw: (p) => fxPuzzle(p, sq), x: x - 0.12, y: 0.775, z: -0.82, w: 0.3, h: 0.36, orient: "flat" });
      }
      // red discount tag on the first can on "ราคาลด"
      const dp = pop(f, BEAT.discount - lead);
      if (dp > 0) FX({ key: "tagDisc", cw: 360, ch: 220, draw: (p) => fxTag(p, "-50%", "#d8322e", "#5a1010"), x: s1[0] + 0.5, y: 1.06, z: -0.7, w: 0.26 * dp, h: 0.16 * dp, rot: 0.25 });
      if (res) {
        const q = pop(f, BEAT.fewer - lead);
        FX({ key: "qmark", cw: 200, ch: 220, draw: fxQmark, x: s1[0] + 0.25, y: 1.75 + 0.03 * Math.sin(t * 6), z: s1[2], w: 0.2 * q, h: 0.22 * q, rot: 0.2 });
      }
      if (f >= BEAT.fullPrice - lead) {
        const q = pop(f, BEAT.fullPrice - lead);
        FX({ key: "bulb", cw: 220, ch: 200, draw: fxBulb, x: s2[0] + 0.05, y: 1.8, z: s2[2], w: 0.24 * q, h: 0.22 * q });
        FX({ key: "glowBulb", cw: 256, ch: 256, draw: (p) => fxGlow(p, "#fff27a"), x: s2[0] + 0.05, y: 1.82, z: s2[2] + 0.02, w: 0.7 * q, h: 0.7 * q, mode: "add", gain: 0.6 });
      }
      break;
    }
    case 6: {
      signs(false);
      const sh = L(f, BEAT.years - lead, BEAT.years + 16);
      if (sh > 0 && sh < 1) FX({ key: `signBs|${Math.round(sh * 14)}`, cw: 700, ch: 260, draw: (p) => fxSignB(p, Math.round(sh * 14) / 14), x: B[0], y: 2.28, z: 0.635, w: 1.4, h: 0.52, orient: 0 });
      vendor(2, VB, B, "smile");
      break;
    }
    case 7: {
      const tw: V3 = [LB + 10.0, 0, -1.75];
      const bit = f >= BEAT.better - lead;
      P(8, TASTER, tw, { fo: { expr: f >= BEAT.better - lead ? "relief" : f >= BEAT.choc - lead ? "smile" : "neutral", prop: bit ? "icecream" : null, look: bit ? 0 : 0.4 } });
      FX({ key: "chocN", cw: 360, ch: 220, draw: (p) => fxChoc(p, false), x: LB + 9.62, y: 0.82, z: -1.08, w: 0.36, h: 0.22, orient: "flat", rot: 0.1 });
      if (!bit) FX({ key: "chocO", cw: 360, ch: 220, draw: (p) => fxChoc(p, true), x: LB + 10.38, y: 0.82, z: -1.08, w: 0.36, h: 0.22, orient: "flat", rot: -0.08 });
      else FX({ key: "chocOb", cw: 360, ch: 220, draw: (p) => fxChoc(p, true, true), x: tw[0] + 0.12, y: 1.0, z: tw[2] + 0.1, w: 0.26, h: 0.16 });
      // "on the market longer": the hourglass pops over the old bar, sand running
      const hp = pop(f, BEAT.study2010 - lead);
      if (hp > 0) {
        const s = Math.round(clamp01((f - BEAT.study2010) / 120) * 10) / 10;
        FX({ key: `hg|${s}`, cw: 200, ch: 300, draw: (p) => fxHourglass(p, s), x: LB + 10.42, y: 0.81 + 0.13 * hp, z: -0.95, w: 0.17 * hp, h: 0.26 * hp });
      }
      const sp = L(f, BEAT.better - lead, BEAT.better + 14);
      if (sp > 0 && sp < 1) FX({ key: `spark|${Math.round(sp * 10)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, Math.round(sp * 10) / 10, "#ffe0f0", 8, 20, 220), x: tw[0], y: 1.55, z: tw[2] + 0.2, w: 0.5, h: 0.5, mode: "add", gain: 1.3 });
      if (f >= BEAT.longer - lead) {
        const k = pop(f, BEAT.longer - lead);
        FX({ key: `stars|${Math.round(t * 12) % 12}`, cw: 420, ch: 210, draw: (p) => fxStars(p, (Math.round(t * 12) % 12) / 12), x: tw[0], y: 1.95, z: tw[2] + 0.1, w: 0.5 * k, h: 0.25 * k });
      }
      break;
    }
    case 8: {
      signs(false);
      vendor(1, VA, A, f >= BEAT.good ? "nervous" : "neutral");
      vendor(2, VB, B, "grin");
      // the queue grows: walkers arrive from the right and join at the beats
      const joins = [BEAT.proof - 6, BEAT.joinQ - 10, BEAT.joinQ + 8, BEAT.good - 4, BEAT.longerQ - 2];
      queue(4);
      joins.forEach((j, k) => {
        const spot = QSPOT(4 + k), walk = 45, u = clamp01((f - (j - walk)) / walk);
        const x = spot[0] + 5.5 * (1 - u);
        const moving = u < 1;
        P(70 + k, FOLK(k + 2), [x, 0.03, spot[2] + 0.25 * (1 - u)], moving ? { side: true, so: { mode: "march", expr: "neutral", phase: (t * 1.6 + k * 0.3) % 1, stride: 0.55, stomp: 0.3 }, faceLeft: true } : { side: true, so: { mode: "stand", expr: "smile" }, faceLeft: true });
      });
      // the lone diner at A gets up on "ต้องดี" and walks to the queue
      const lu = clamp01((f - BEAT.good + 6) / 40);
      if (lu <= 0) P(10, FOLK(5), [A[0] - 0.8, 0.38, 1.7], { fo: { mode: "sit", expr: "neutral", look: 0.4 } }, 1, false);
      else P(10, FOLK(5), [A[0] - 0.8 + 3.8 * lu, 0.03, 1.7 + 0.4 * lu], { side: true, so: { mode: lu < 1 ? "march" : "stand", expr: "neutral", phase: (t * 1.6) % 1, stride: 0.55, stomp: 0.3 } });
      bowlAt("A1", A[0] - 0.62, 0.8, 1.72, 0.22, false, false, "flat");
      for (let k = 0; k < 3; k++) P(60 + k, FOLK(k + 3), [B[0] - 0.75 + k * 0.75, 0.38, k === 1 ? 2.35 : 1.7], { fo: { mode: "sit", expr: "smile_closed", look: 0.3 } }, 1, false);
      break;
    }
    case 10: {
      // the honest seller at her own stall in the golden morning
      const hang = smooth(L(f, BEAT.story - lead - 10, BEAT.story + 8));
      const ex: Expr = f >= BEAT.who - lead ? "grin" : f >= BEAT.seller - lead ? "smile" : "neutral";
      vendor(3, VC, C, ex, f >= BEAT.who - lead && f < BEAT.putBowl - 4 ? { wave: Math.sin(t * 10) } : { prop: f >= BEAT.story - 14 && f < BEAT.story + 10 ? "point" : null, look: f < BEAT.story ? 0 : 0.3 });
      // her recipe: the same video
      const ph = pop(f, BEAT.recipe - lead), po = 1 - L(f, BEAT.story - 14, BEAT.story - 4);
      if (ph > 0 && po > 0) FX({ key: "phone", cw: 300, ch: 520, draw: fxPhone, x: C[0] - 0.75, y: 1.75, z: 0.1, w: 0.36 * ph * po, h: 0.62 * ph * po });
      // her story sign rises to the canopy
      if (hang > 0) FX({ key: "signC", cw: 700, ch: 260, draw: fxSignC, x: C[0], y: 1.2 + 1.08 * hang, z: 0.63, w: 1.4, h: 0.52, orient: 0 });
      // pot: steam + a clock spinning on "เคี่ยวกี่ชั่วโมง"
      FX({ key: `steamP|${Math.round(t * 10)}`, cw: 220, ch: 400, draw: (p) => fxSteam(p, Math.round(t * 10) / 10), x: POT_C[0], y: POT_C[1] + 0.68, z: POT_C[2], w: 0.36, h: 0.62, mode: "soft", opacity: 0.85 });
      const cp = pop(f, BEAT.simmer - lead);
      if (cp > 0 && f < BEAT.who) { const a = Math.round(((f - BEAT.simmer) / 2) % 24) * (Math.PI / 12) - Math.PI / 2; FX({ key: `clock|${a.toFixed(2)}`, cw: 240, ch: 240, draw: (p) => fxClock(p, a), x: POT_C[0] - 0.2, y: POT_C[1] + 0.82, z: POT_C[2] + 0.12, w: 0.24 * cp, h: 0.24 * cp }); }
      const fp = pop(f, BEAT.fish - lead);
      if (fp > 0 && f < BEAT.who) FX({ key: "fish", cw: 380, ch: 220, draw: fxFish, x: POT_C[0] + 0.2, y: POT_C[1] + 0.78, z: POT_C[2] + 0.15, w: 0.3 * fp, h: 0.18 * fp, rot: -0.15 });
      // the bowl is set down on "ใส่ชาม"
      if (f >= BEAT.putBowl - 8) {
        const u = smooth(L(f, BEAT.putBowl - 8, BEAT.putBowl + 2));
        bowlAt("C", BOWL_C[0], BOWL_C[1] + 0.07 + 0.25 * (1 - u), BOWL_C[2] + 0.02, 0.34, true, true);
        if (u >= 1) FX({ key: `steam|${Math.round(t * 10)}`, cw: 220, ch: 400, draw: (p) => fxSteam(p, Math.round(t * 10) / 10), x: BOWL_C[0], y: BOWL_C[1] + 0.35, z: BOWL_C[2], w: 0.18, h: 0.32, mode: "soft", opacity: 0.8 });
      }
      const pp = pop(f, BEAT.price - lead);
      if (pp > 0) FX({ key: "priceC", cw: 300, ch: 260, draw: fxPriceC, x: SIGN_C[0], y: SIGN_C[1] - 0.12 + 0.12 * pp, z: SIGN_C[2] + 0.1, w: 0.3 * pp, h: 0.26 * pp, orient: 0 });
      if (f >= BEAT.putBowl - 4) P(11, FOLK(1), [C[0] + 0.75, 0.03, 1.0], { side: true, so: { mode: "stand", expr: "smile" }, faceLeft: true });
      break;
    }
    case 11: {
      FX({ key: "signC", cw: 700, ch: 260, draw: fxSignC, x: C[0], y: 2.28, z: 0.63, w: 1.4, h: 0.52, orient: 0 });
      FX({ key: "priceC", cw: 300, ch: 260, draw: fxPriceC, x: SIGN_C[0], y: SIGN_C[1], z: SIGN_C[2] + 0.1, w: 0.3, h: 0.26, orient: 0 });
      vendor(3, VC, C, "smile");
      vendor(4, VF, F, f >= BEAT.liar - lead ? "shock" : f >= BEAT.never - lead ? "nervous" : "smirk");
      // fake board: hangs from the start; cracks and drops on "คนโกหก"
      const fall = smooth(L(f, BEAT.liar - lead + 2, BEAT.liar + 14));
      FX({ key: "signF", cw: 700, ch: 260, draw: fxSignF, x: F[0] + 0.12 * fall, y: 2.28 - 0.9 * fall * fall, z: 0.63, w: 1.4, h: 0.52, orient: 0, rot: -0.5 * fall });
      if (f >= BEAT.liar - lead) FX({ key: "signFc", cw: 700, ch: 260, draw: fxSignCrack, x: F[0] + 0.12 * fall, y: 2.28 - 0.9 * fall * fall, z: 0.635, w: 1.4, h: 0.52, orient: 0, rot: -0.5 * fall });
      const cu = L(f, BEAT.liar - lead, BEAT.liar + 10);
      if (cu > 0 && cu < 1) FX({ key: `crack|${Math.round(cu * 10)}`, cw: 500, ch: 500, draw: (p) => fxCrack(p, Math.round(cu * 10) / 10), x: F[0], y: 2.2, z: 0.75, w: 1.3, h: 1.3, mode: "add", gain: 1.5 });
      // "opened yesterday": balloons + bunting reveal the brand-new stall
      const bp = pop(f, BEAT.yesterday - lead, 10);
      if (bp > 0) {
        FX({ key: `balloons|${Math.round(t * 6)}`, cw: 380, ch: 500, draw: (p) => fxBalloons(p, Math.round(t * 6) / 6), x: F[0] + 1.25, y: 1.6 + 0.4 * bp, z: 0.7, w: 0.7 * bp, h: 0.92 * bp });
        FX({ key: "bunting", cw: 700, ch: 120, draw: fxBunting, x: F[0], y: 2.62, z: 0.66, w: 2.4 * bp, h: 0.4 * bp, orient: 0 });
      }
      // customers: at the start three at the fake stall; on "เพราะลูกค้า..." they turn away and walk to the honest stall
      const spotsF: V3[] = [[F[0] - 0.55, 0.03, 0.95], [F[0] + 0.15, 0.03, 1.1], [F[0] + 0.8, 0.03, 1.0]];
      const spotsC: V3[] = [[C[0] + 0.45, 0.03, 0.95], [C[0] + 1.1, 0.03, 1.1], [C[0] + 1.75, 0.03, 1.0]];
      spotsF.forEach((s0, k) => {
        const go = BEAT.because + k * 8, u = clamp01((f - go) / 55);
        if (f < go) P(80 + k, FOLK(k + 4), s0, { fo: { expr: "neutral", look: -0.3 } });
        else { const e = spotsC[k]; P(80 + k, FOLK(k + 4), [s0[0] + (e[0] - s0[0]) * u, 0.03, s0[2] + (e[2] - s0[2]) * u], { side: true, so: { mode: u < 1 ? "march" : "stand", expr: u < 1 ? "stern" : "smile", phase: (t * 1.6 + k * 0.3) % 1, stride: 0.55, stomp: 0.3 }, faceLeft: true }); }
      });
      P(11, FOLK(1), [C[0] - 0.55, 0.03, 1.05], { side: true, so: { mode: "stand", expr: "smile" }, faceLeft: true });
      break;
    }
    default: break;
  }
  return out;
};

export const SHOT_LIGHT = (id: number) => SHOTS[id - 1].light;
