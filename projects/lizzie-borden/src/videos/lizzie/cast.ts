// The cast of "The Fall River Axe Mystery" as lit flat cards in the 3D sets, plus the 2D effect cards (the axe
// shadow on the wall, the skull bottle, the deed, coins, lantern glow, flames, sleep z's, music notes, the gavel burst).
// Canvas pool / Actor / Fx follow the skill's cast.ts (one canvas per distinct drawing, yaw-only billboards with
// cardShade lighting, effects unlit, everything on the NOINK layer so the world ink never outlines a quad).
// Nothing gory is ever drawn: violence exists only as a wall shadow, a camera kick and a darkening of the room.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxNote, fxBurst, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, KID, SKINS, mix } from "./toon";
import { FPS, SHOTS, BEAT, LIZZIE_GATE, SOFA_ANDREW, WALK_Z, walkX, V3, clamp01, smooth, easeOut } from "./story";
import { SET, CELLAR_AXE, STOVE, JUDGE } from "./sets";
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

// ---------------- the cast ----------------
const LIZZIE: Outfit = { jacket: "#2f4f9a", pants: "#26304f", boots: "#2a1e1a", hat: "hair", hair: "#8e3f22", dress: "#2f4f9a", skin: "#ffe2c8" };
const ANDREW: Outfit = { jacket: "#1f1f26", pants: "#24242c", boots: "#1a1416", hat: "hair", hair: "#ecebe6", moustache: "#f2f1ec", build: "stout", skin: "#f5d6bd" };
const ABBY: Outfit = { jacket: "#6e4a8e", pants: "#3a2c48", boots: "#2a1e1a", hat: "hair", hair: "#7a6a5e", dress: "#6e4a8e", build: "stout", skin: "#f7dcc6" };
const RELATIVE: Outfit = { jacket: "#8a5a3a", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#4a3426", dress: "#9a6a4a", skin: SKINS[1] };
const PHARMACIST: Outfit = { jacket: "#efece2", pants: "#3b3f52", boots: "#2a1e1a", hat: "hair", hair: "#3a2a20", moustache: "#3a2a20", skin: SKINS[2] };
const POLICE: Outfit = { jacket: "#1f2c5a", pants: "#1a2244", boots: "#141018", hat: "cap", cap: "#1a2244", buttons: "#e0c25a", moustache: "#5a3a26", skin: SKINS[0] };
const JUDGEO: Outfit = { jacket: "#141418", pants: "#141418", boots: "#141418", hat: "hair", hair: "#e8e6e0", build: "stout", skin: "#f5d6bd" };
const JUROR = (v: number): Outfit => ({ jacket: ["#3a3a46", "#4a3a2c", "#2f3f4f", "#5a4632"][v % 4], pants: "#2a2a30", boots: "#1e1a18", hat: "hair",
  hair: ["#4a3426", "#2a201a", "#7a6a5e", "#c8c4ba"][(v * 3) % 4], moustache: v % 3 === 0 ? "#3a2a20" : undefined, skin: SKINS[v % 4] });
const FOLK = (v: number): Outfit => {
  const coats = ["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9"];
  const o: Outfit = { jacket: coats[v % 6], pants: "#3b3f52", boots: "#4a3426", skin: SKINS[v % 4] };
  return v % 2 ? { ...o, hat: "bonnet", dress: ["#d9a441", "#c25a7a", "#5a8fc2"][v % 3] } : { ...o, hat: "tophat" };
};
const KIDS = [KID, { ...KID, jacket: "#3fa36b", cap: "#2f5fa8" }, { ...KID, jacket: "#d94a6a", hat: "hair", hair: "#c8862a", dress: "#d94a6a" }] as Outfit[];

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

// ---------------- effect drawings ----------------
const rad = (d: number) => (d * Math.PI) / 180;
/** the shadow of someone raising a hatchet, on a 600 x 1000 canvas (white = no change, multiply). chop: 0 raised .. 1 down */
const fxAxeShadow = (p: Pen, chop: number, col = "#241a3c") => {
  const g = p.g;
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 600, 1000);
  g.save(); g.filter = "blur(10px)"; g.fillStyle = col; g.strokeStyle = col; g.lineCap = "round"; g.lineJoin = "round";
  // body: head, shoulders, a long coat to the floor
  g.beginPath(); g.ellipse(300, 330, 62, 70, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(200, 1000); g.lineTo(215, 470); g.quadraticCurveTo(300, 400, 385, 470); g.lineTo(400, 1000); g.closePath(); g.fill();
  // both arms and the hatchet: swing about the shoulders from overhead (-160 deg) to forward-down (-20 deg)
  const a = rad(-165 + 140 * easeOut(chop)), sx = 300, sy = 450;
  const hx = sx + Math.cos(a) * 250, hy = sy + Math.sin(a) * 250;
  g.lineWidth = 46; g.beginPath(); g.moveTo(sx - 40, sy); g.lineTo(hx, hy); g.moveTo(sx + 40, sy); g.lineTo(hx, hy); g.stroke();
  const hx2 = sx + Math.cos(a) * 420, hy2 = sy + Math.sin(a) * 420;
  g.lineWidth = 22; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx2, hy2); g.stroke();
  // blade: a wedge perpendicular to the handle at its end
  const nx = -Math.sin(a), ny = Math.cos(a), bx = hx2, by = hy2;
  g.beginPath(); g.moveTo(bx - nx * 20, by - ny * 20); g.lineTo(bx + nx * 95 + Math.cos(a) * 40, by + ny * 95 + Math.sin(a) * 40);
  g.lineTo(bx + nx * 95 - Math.cos(a) * 45, by + ny * 95 - Math.sin(a) * 45); g.closePath(); g.fill();
  g.restore();
};
/** green poison bottle with a skull and crossbones (icon only), 300 x 500 */
const fxSkullBottle = (p: Pen) => {
  p.ol = 9;
  p.poly([[110, 40], [190, 40], [190, 120], [250, 190], [250, 470], [50, 470], [50, 190], [110, 120]], "#3f8f4a");
  p.poly([[100, 10], [200, 10], [200, 50], [100, 50]], "#6a4a30");
  p.poly([[70, 230], [230, 230], [230, 420], [70, 420]], "#efe6c8", 7);
  p.ell(150, 300, 46, 42, "#ffffff", 6);
  p.dot(132, 296, 11); p.dot(168, 296, 11); p.poly([[150, 312], [143, 326], [157, 326]], INK, 0);
  p.poly([[128, 336], [172, 336], [172, 352], [128, 352]], "#ffffff", 5);
  p.stroke([[95, 365], [205, 405]], 14); p.stroke([[205, 365], [95, 405]], 14);
  p.stroke([[95, 365], [205, 405]], 7, "#ffffff"); p.stroke([[205, 365], [95, 405]], 7, "#ffffff");
  p.stroke([[78, 210], [78, 440]], 10, "rgba(255,255,255,0.35)");
};
/** rolled deed with a red wax seal, 400 x 240 (scribbles, no letters) */
const fxDeed = (p: Pen) => {
  p.ol = 7;
  p.poly([[40, 40], [360, 40], [360, 200], [40, 200]], "#f3e8c8");
  for (let y = 70; y < 170; y += 22) p.stroke([[70, y], [330 - (y % 44), y]], 5, "#9a8a6a");
  p.ell(36, 120, 22, 84, "#e6d7b0"); p.ell(364, 120, 22, 84, "#e6d7b0");
  p.ell(300, 175, 26, 26, "#b8323a", 6); p.dot(300, 175, 10, "#8a2028");
};
const fxCoins = (p: Pen) => {
  p.ol = 6;
  for (const [x, y] of [[80, 120], [150, 100], [220, 130], [130, 170], [200, 190]]) { p.ell(x, y, 44, 44, "#e0b84a"); p.ell(x, y, 30, 30, null, 4); p.dot(x - 12, y - 14, 7, "#fff2b0"); }
};
/** coin glint star for the clink */
const fxGlint = (p: Pen, t: number) => fxBurst(p, t, "#fff2b0", 4, 20, 200);
const fxLantern = (p: Pen) => {
  p.ol = 8;
  p.arc(150, 70, 40, 40, 180, 360, 10);
  p.poly([[95, 80], [205, 80], [190, 110], [110, 110]], "#2c2c34");
  p.poly([[105, 110], [195, 110], [205, 300], [95, 300]], "#ffd37a");
  p.ell(150, 220, 26, 50, "#fff4c0", 0);
  p.stroke([[150, 110], [150, 300]], 8); p.stroke([[105, 110], [95, 300]], 8); p.stroke([[195, 110], [205, 300]], 8);
  p.poly([[85, 300], [215, 300], [215, 330], [85, 330]], "#2c2c34");
};
const fxGlow = (p: Pen, c: string) => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, c); gr.addColorStop(0.35, mix(c, "#000000", 0.55)); gr.addColorStop(1, "#000000");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};
/** flames on a 400 x 600 canvas: three tongues, t = animation time (s), k = height 0..1 */
const fxFlame = (p: Pen, t: number, k: number) => {
  p.ol = 7;
  const tongue = (cx: number, w: number, h: number, ph: number, c: string) => {
    const sw = 18 * Math.sin(t * 9 + ph), top = 590 - h * k;
    p.poly([[cx - w, 590], [cx - w * 0.9, 590 - h * k * 0.4], [cx + sw * 0.5 - w * 0.3, 590 - h * k * 0.75], [cx + sw, top], [cx + sw * 0.4 + w * 0.35, 590 - h * k * 0.7], [cx + w * 0.95, 590 - h * k * 0.35], [cx + w, 590]], c);
  };
  tongue(130, 80, 330, 0, "#f06a24"); tongue(270, 85, 380, 1.7, "#f06a24"); tongue(200, 110, 520, 3.1, "#f39a2c");
  p.ol = 0;
  tongue(200, 62, 330, 3.1, "#ffd860"); tongue(140, 40, 180, 0.4, "#ffd860"); tongue(265, 44, 220, 2.2, "#ffd860");
};
/** Lizzie's blue dress held up / hanging, 300 x 500 */
const fxDress = (p: Pen, burnt = 0) => {
  p.ol = 7;
  p.poly([[110, 20], [190, 20], [205, 120], [270, 480], [30, 480], [95, 120]], "#2f4f9a");
  p.poly([[110, 20], [190, 20], [196, 70], [104, 70]], "#3a5fae", 0);
  p.stroke([[100, 130], [200, 130]], 6, "#203a78");
  for (const x of [120, 150, 180]) p.stroke([[x, 160], [x + (x - 150) * 0.9, 470]], 4, "#26407e");
  if (burnt > 0) p.poly([[30, 480], [270, 480], [262, 480 - 120 * burnt], [200, 470 - 90 * burnt], [150, 480 - 140 * burnt], [90, 465 - 80 * burnt], [38, 480 - 110 * burnt]], "#2a1e2a", 0);
};
/** a sleepy "z" mark (an ink zig-zag shape, 200 x 200) */
const fxZ = (p: Pen) => { p.ol = 8; p.poly([[30, 30], [170, 30], [170, 62], [82, 140], [170, 140], [170, 172], [30, 172], [30, 140], [118, 62], [30, 62]], "#e8ecff"); };
/** light cracks for the gavel (rays + jagged lines), 500 x 500 */
const fxCrack = (p: Pen, t: number) => {
  fxBurst(p, t, "#fff6c8", 12, 30, 240);
  p.ol = 0;
  for (let i = 0; i < 6; i++) {
    const a = rad(i * 60 + 20), r1 = 90 + 150 * easeOut(t);
    p.stroke([[250, 250], [250 + Math.cos(a) * r1 * 0.5 + 14, 250 + Math.sin(a) * r1 * 0.5 - 10], [250 + Math.cos(a) * r1, 250 + Math.sin(a) * r1]], 8 * (1 - t) + 2, "#ffffff");
  }
};

// ---------------- staging per shot ----------------
const L = (f: number, f0: number, f1: number) => clamp01((f - f0) / (f1 - f0));
const lead = 2; // reactions land 2 f before their word

export const stage = (id: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] }, t = f / FPS;
  const P = (i: number, o: Outfit, at: V3, pose: Pose, sc = 1, blob = true) => {
    out.places.push(person(cam, i, o, at, pose, f, sc));
    if (blob) contact(out, at[0], Math.max(0, at[1] - 0.04) + (at[1] > 0.3 ? 0.04 : 0), at[2], cam.light, sc);
  };
  const LV = SET.liv, BD = SET.bed, PH = SET.pharm, CL = SET.cellar, KT = SET.kitchen, CT = SET.court;
  switch (id) {
    case 1: P(1, LIZZIE, LIZZIE_GATE, { fo: { expr: "neutral" } }); break;
    case 2: P(1, LIZZIE, LIZZIE_GATE, { fo: { expr: f >= BEAT.notGuilty1 - lead ? "smirk" : "neutral", look: f >= BEAT.notGuilty1 - lead ? 0.6 : 0 } }); break;
    case 3: {
      const given = f >= BEAT.gives + 14;
      const AX = LV - 0.75, BX = LV + 0.95;
      P(2, ANDREW, [AX, 0, -0.6], { fo: { expr: "stern", prop: given ? null : "reach", facing: 1 } });
      P(3, ABBY, [BX, 0, -0.85], { fo: { expr: given ? "smile_closed" : "smile", prop: given ? "reach" : null, facing: 1 }, mirror: true });
      P(4, RELATIVE, [LV + 1.65, 0, -1.25], { fo: { expr: "grin", facing: -1 } });
      const angry = f >= BEAT.angry - lead;
      P(1, LIZZIE, [LV + 2.45, 0, 0.55], { fo: { expr: angry ? "stern" : "neutral", look: -0.8, headTilt: angry ? -4 : 0, facing: -1 } });
      // the deed: from Andrew's hand to Abby's on "ยกบ้าน"
      const u = smooth(L(f, BEAT.gives - 2, BEAT.gives + 14));
      const h0 = AX + 0.51, h1 = BX - 0.51;
      out.fx.push({ key: "deed", cw: 400, ch: 240, draw: fxDeed, x: h0 + (h1 - h0) * u, y: 1.06 + 0.08 * Math.sin(u * Math.PI), z: -0.58 - 0.25 * u, w: 0.34, h: 0.2, rot: -0.12 + 0.24 * u });
      // coins on the table + a glint on "ขี้เหนียว"
      out.fx.push({ key: "coins", cw: 300, ch: 300, draw: fxCoins, x: LV + 0.5, y: 0.785, z: 0.25, w: 0.34, h: 0.34, orient: "flat" });
      const gl = L(f, BEAT.stingy - lead, BEAT.stingy + 10);
      if (gl > 0 && gl < 1) out.fx.push({ key: `glint|${q(gl, 20)}`, cw: 500, ch: 500, draw: (p) => fxGlint(p, q(gl, 20)), x: LV + 0.55, y: 0.86, z: 0.3, w: 0.35, h: 0.35, mode: "add", gain: 1.6 });
      break;
    }
    case 4: {
      const shock = f >= BEAT.cyanide - lead;
      P(1, LIZZIE, [PH - 0.75, 0, -0.3], { side: true, so: { mode: "stand", expr: "neutral" } });
      P(5, PHARMACIST, [PH + 0.6, 0, -2.1], { fo: { expr: shock ? "shock" : "neutral", look: -0.6, facing: -1, headTilt: shock ? 5 : 0 } }, 1, false);
      // the skull bottle pops up onto the counter
      const u = L(f, BEAT.cyanide - lead, BEAT.cyanide + 8);
      if (u > 0) {
        const pop = easeOut(u), over = 1 + 0.18 * Math.sin(Math.min(1, u * 1.4) * Math.PI);
        out.fx.push({ key: "skull", cw: 300, ch: 500, draw: fxSkullBottle, x: PH + 0.12, y: 1.08 + 0.17 * pop * over, z: -1.12, w: 0.2 * pop * over, h: 0.34 * pop * over });
        if (u < 1) out.fx.push({ key: `pop|${q(u, 10)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 10), "#d8ffd0", 8, 30, 220), x: PH + 0.12, y: 1.26, z: -1.1, w: 0.55, h: 0.55, mode: "add", gain: 1.4 });
      }
      break;
    }
    case 5: {
      // Abby makes the bed, unaware; the shadow rises on the wall behind her (no figure is ever seen)
      P(3, ABBY, [BD + 0.05, 0, -0.75], { side: true, so: { mode: "stand", expr: "neutral" } });
      const grow = smooth(L(f, 495, BEAT.chop1 - 8)), chop = L(f, BEAT.chop1 - 5, BEAT.chop1 - lead + 1);
      const sh = 1.3 + 1.6 * grow;
      out.fx.push({ key: `axeShadow|${q(chop, 12)}`, cw: 300, ch: 500, draw: (p) => { p.g.scale(0.5, 0.5); fxAxeShadow(p, q(chop, 12)); }, x: BD - 0.1 + 0.25 * grow, y: 0.05 + sh * 0.5, z: -2.48, w: sh * 0.6, h: sh, orient: 0, mode: "blob" });
      break;
    }
    case 6: {
      const after = f >= BEAT.chop2 - lead + 1;
      P(2, ANDREW, SOFA_ANDREW, { fo: { expr: "neutral", mode: "sit", blink: 1, headTilt: 9 } }, 1, false);
      // sleep z's drift up until the chop
      if (!after) for (let k = 0; k < 3; k++) {
        const u = ((t * 0.45 + k / 3) % 1);
        out.fx.push({ key: "z", cw: 200, ch: 200, draw: fxZ, x: SOFA_ANDREW[0] + 0.25 + 0.35 * u, y: 1.55 + 0.7 * u, z: SOFA_ANDREW[2] + 0.05, w: 0.1 + 0.12 * u, h: 0.1 + 0.12 * u, rot: 0.3 * Math.sin(u * 6), mode: "soft", opacity: Math.sin(u * Math.PI) });
      }
      const grow = smooth(L(f, 580, BEAT.turn)), chop = L(f, BEAT.chop2 - 5, BEAT.chop2 - lead + 1);
      const sh = 1.7 + 0.9 * grow;
      out.fx.push({ key: `axeShadow|${q(chop, 12)}`, cw: 300, ch: 500, draw: (p) => { p.g.scale(0.5, 0.5); fxAxeShadow(p, q(chop, 12)); }, x: LV + 0.55 - 0.2 * grow, y: 0.05 + sh * 0.5 + 0.3, z: -2.97, w: sh * 0.6, h: sh, orient: 0, mode: "blob" });
      break;
    }
    case 7: {
      P(6, POLICE, [CL - 0.6, 0, -0.55], { fo: { expr: f >= BEAT.axe - lead ? "stern" : "neutral", prop: f >= BEAT.axe - 8 ? "point" : null, look: 0.7, facing: 1 } });
      // lantern in the left hand (+ warm glow)
      const lx = CL - 0.6 - 0.25, ly = 0.68;
      out.fx.push({ key: "lantern", cw: 300, ch: 360, draw: fxLantern, x: lx, y: ly, z: -0.5, w: 0.2, h: 0.24 });
      const fl = 1 + 0.06 * Math.sin(t * 13) + 0.04 * Math.sin(t * 29);
      out.fx.push({ key: "glowL", cw: 256, ch: 256, draw: (p) => fxGlow(p, "#ffb85a"), x: lx, y: ly, z: -0.45, w: 2.0 * fl, h: 2.0 * fl, mode: "add", gain: 0.55 });
      out.fx.push({ key: "glowL", cw: 256, ch: 256, draw: (p) => fxGlow(p, "#ffb85a"), x: CELLAR_AXE[0], y: CELLAR_AXE[1] + 0.05, z: CELLAR_AXE[2] + 0.1, w: 1.1 * fl, h: 1.1 * fl, mode: "add", gain: 0.35 });
      const cl = L(f, BEAT.axe - lead, BEAT.axe + 8);
      if (cl > 0 && cl < 1) out.fx.push({ key: `clank|${q(cl, 10)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(cl, 10), "#e8eef8", 6, 20, 200), x: CELLAR_AXE[0], y: CELLAR_AXE[1] + 0.12, z: CELLAR_AXE[2] + 0.05, w: 0.4, h: 0.4, mode: "add", gain: 1.3 });
      break;
    }
    case 8: {
      P(1, LIZZIE, [KT - 0.6, 0, -1.0], { side: true, so: { mode: "stand", expr: "neutral" } });
      const mouth: V3 = [STOVE[0], 0.53, STOVE[2] + 0.42];
      // the dress: held in front of her, then pushed into the fire door; its hem hangs out and the flames climb it
      const u = smooth(L(f, BEAT.burn - 14, BEAT.burn + 2));
      const burn = L(f, BEAT.burn, BEAT.paint + 10);
      const d0: V3 = [KT - 0.6 + 0.42, 1.0, -0.95], d1: V3 = [mouth[0] - 0.02, mouth[1] - 0.02, mouth[2] + 0.09];
      const dp = d0.map((v, i) => v + (d1[i] - v) * u) as V3;
      const sz = 1 - 0.3 * u;
      out.fx.push({ key: `dress|${q(burn, 10)}`, cw: 300, ch: 500, draw: (p) => fxDress(p, q(burn, 10)), x: dp[0], y: dp[1], z: dp[2], w: 0.3 * sz, h: 0.5 * sz });
      const fl = 1 + 0.08 * Math.sin(t * 11) + 0.05 * Math.sin(t * 23);
      out.fx.push({ key: "glowF", cw: 256, ch: 256, draw: (p) => fxGlow(p, "#ff8a3a"), x: mouth[0], y: mouth[1], z: mouth[2] + 0.06, w: (1.0 + 1.2 * burn) * fl, h: (1.0 + 1.2 * burn) * fl, mode: "add", gain: 0.7 });
      const fk = f < BEAT.burn - lead ? 0.25 : 0.25 + 0.75 * smooth(L(f, BEAT.burn - lead, BEAT.burn + 30));
      // before "เผา": a small fire inside the door; after: flames from the hem upward, in front of the dress
      const fh = 0.18 + 0.2 * fk, base = u < 1 ? mouth[1] - 0.12 : dp[1] - 0.5 * 0.5 * sz;
      out.fx.push({ key: `flame|${Math.round(t * 15)}|${q(fk, 10)}`, cw: 400, ch: 600, draw: (p) => fxFlame(p, Math.round(t * 15) / 15, q(fk, 10)), x: mouth[0] - 0.03, y: base + fh / 2 - 0.02, z: (u < 1 ? mouth[2] + 0.02 : dp[2] + 0.015), w: 0.24, h: fh });
      break;
    }
    case 9: {
      // jurors in two tiers along the left wall, Lizzie at the defence table, the judge on the bench
      for (let k = 0; k < 12; k++) {
        const back = k >= 6, j = k % 6;
        P(20 + k, JUROR(k), [CT + (back ? -5.95 : -4.25), back ? 0.36 : -0.04, -2.9 + j * 0.78], { fo: { mode: "sit", expr: k % 4 === 1 ? "nervous" : "neutral", look: 0.6, facing: 1 } }, 1, false);
      }
      P(1, LIZZIE, [CT + 0.95, 0.02, 2.7], { fo: { mode: "sit", expr: "neutral", look: -0.4, facing: -1 } }, 1, false);
      // gavel: rests at .25, lifts to 0 over 6 f, strikes (1) on each hit, lifts again between the two hits
      const g1 = BEAT.notGuilty2 - lead, g2 = g1 + 10;
      const strike = f < g1 - 6 ? 0.25 : f < g1 ? 0.25 * (1 - L(f, g1 - 6, g1 - 1)) : f < g1 + 3 ? 1 : f < g2 ? 1 - L(f, g1 + 3, g2 - 1) : f < g2 + 4 ? 1 : 0.7;
      P(7, JUDGEO, [JUDGE[0], 1.28, JUDGE[2] - 0.05], { fo: { mode: "stand", expr: f >= g1 ? "stern" : "neutral", prop: ["hammer", strike], facing: 0 } }, 1, false);
      for (const g of [g1, g2]) {
        const u = L(f, g, g + 9);
        if (u > 0 && u < 1) out.fx.push({ key: `crack|${q(u, 10)}`, cw: 500, ch: 500, draw: (p) => fxCrack(p, q(u, 10)), x: JUDGE[0] + 0.55, y: 1.95, z: JUDGE[2] + 0.5, w: 1.3, h: 1.3, mode: "add", gain: 1.5 });
      }
      break;
    }
    case 10: {
      const lx = walkX(f), sp = 0.72, ph = ((t - 1029 / FPS) * sp) / (2 * 0.6);
      P(1, LIZZIE, [lx, 0.04, WALK_Z], { side: true, so: { mode: "march", expr: "neutral", phase: ph % 1, stride: 0.6, stomp: 0.4 } });
      // townsfolk along her way turn their backs one by one ("คนทั้งเมืองเมินเธอ")
      const folk: [number, number][] = [[-6.2, 1.9], [-4.6, 3.1], [-2.9, 1.85], [-1.5, 3.05], [0.2, 1.95], [1.6, 3.0]];
      folk.forEach(([x, z], k) => {
        const turn = f >= BEAT.shun - 10 + k * 8;
        const at: V3 = [SET.ext + x, 0.04, z];
        P(30 + k, FOLK(k), at, turn ? { side: true, so: { mode: "stand", expr: "stern" }, faceLeft: false } : { fo: { expr: "neutral", look: -0.7 } });
      });
      // kids follow her, singing, notes floating up
      if (f >= BEAT.rumour - 18) for (let k = 0; k < 3; k++) {
        const kx = lx - 2.0 - k * 0.85, kz = WALK_Z + (k % 2 ? 0.45 : -0.1);
        P(40 + k, KIDS[k], [kx, 0.04, kz], { side: true, so: { mode: "march", expr: "whistle", phase: (ph * 1.3 + k * 0.3) % 1, stride: 0.5 } }, 0.9);
        for (let n = 0; n < 2; n++) {
          const u = (t * 0.6 + k * 0.33 + n * 0.5) % 1;
          out.fx.push({ key: `note${(k + n) % 2}`, cw: 220, ch: 240, draw: (p) => fxNote(p, (k + n) % 2, "#2a2444"), x: kx + 0.15 + 0.25 * u, y: 1.45 + 0.6 * u, z: kz, w: 0.18, h: 0.2, rot: 0.3 * Math.sin(u * 5 + k), mode: "soft", opacity: Math.sin(u * Math.PI) });
        }
      }
      break;
    }
    default: break;
  }
  return out;
};

export const SHOT_LIGHT = (id: number) => SHOTS[id - 1].light;
