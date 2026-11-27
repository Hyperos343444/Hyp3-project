// The places of "ขนมจีนน้ำยา 30 vs 50": a Thai morning market street of shophouses with four noodle stalls (A: plain
// 30-baht stall, B: the "50 years" stall, C: the honest new seller, F: the fake "50 years" stall), and one long
// research room (brain scanner + console, the puzzle desks, the chocolate tasting table). Signs, price tags, the phone,
// the brain and all food are 2D effect cards from cast.ts. Each set is its own group at its own x offset.
import * as THREE from "three";
import { ctex, rep, rng, jit, stoneHD } from "./paint";
import { twoTone, untone } from "./shade";

export type V3 = [number, number, number];

// ---------------- set origins + story anchors ----------------
export const SET = { mkt: 0, lab: 1000 } as const;
export type SetName = keyof typeof SET;
/** stall centres: counter front edge at z = 0, vendor stands behind at z = -0.95 */
export const STALL: Record<"A" | "B" | "C" | "F", V3> = { A: [-1.45, 0, 0], B: [1.45, 0, 0], C: [16, 0, 0], F: [19.2, 0, 0] };
export const BOWL_B: V3 = [STALL.B[0] - 0.25, 0.93, -0.22];
export const BOWL_C: V3 = [STALL.C[0] - 0.3, 0.93, -0.22];
export const POT_C: V3 = [STALL.C[0] + 0.45, 0.9, -0.32];
export const SIGN_C: V3 = [STALL.C[0] - 0.62, 1.12, -0.12];
/** lab: cart top centre (wine bottle insert), scanner bore centre */
export const LABT: V3 = [SET.lab - 1.75, 0.9, 0.55];
export const SCAN: V3 = [SET.lab + 0.6, 1.15, -1.6];

// ---------------- materials ----------------
const mats = new Map<string, THREE.MeshLambertMaterial>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters, liftK = 1) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make()), liftK); mats.set(key, m); }
  return m;
};
const col = (key: string, c: string) => lam("c" + key + c, () => ({ color: c }));
const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const texMat = (key: string, t: THREE.Texture, rx: number, ry: number, liftK = 1) => lam(key, () => ({ map: rep(t, rx, ry) }), liftK);

// ---------------- painted textures ----------------
/** warm grey asphalt with patches and a faded lane edge */
const asphalt = () => ctex("asphalt", 1024, 1024, (g, r) => {
  g.fillStyle = "#7d7a80"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "30,30,40"},${0.05 + r() * 0.06})`; g.fillRect(r() * 1024, r() * 1024, 3 + r() * 5, 3 + r() * 5); }
  for (let i = 0; i < 10; i++) { g.fillStyle = "rgba(40,40,50,0.12)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 80 + r() * 120, 40 + r() * 70, r() * 3, 0, 7); g.fill(); }
});
/** sidewalk: square concrete tiles with dark seams */
const pavers = () => ctex("pavers", 1024, 1024, (g, r) => {
  for (let y = 0; y < 1024; y += 128) for (let x = 0; x < 1024; x += 128) {
    g.fillStyle = jit(r, "#c9b9a4", 0.06, 4, 0.1); g.fillRect(x, y, 128, 128);
    g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x + 4, y + 4, 120, 5);
  }
  g.fillStyle = "rgba(60,45,40,0.6)"; for (let k = 0; k < 1024; k += 128) { g.fillRect(k, 0, 4, 1024); g.fillRect(0, k, 1024, 4); }
});
/** one Thai shophouse bay (4.2 m x 9 m): roller shutter / open shop below, two floors of windows with grilles above */
const shophouse = (key: string, wall: string, trim: string, open: boolean, awn: string) => ctex("shop" + key, 512, 1100, (g, r) => {
  g.fillStyle = wall; g.fillRect(0, 0, 512, 1100);
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${r() > 0.6 ? "255,255,255" : "70,50,40"},0.07)`; g.beginPath(); g.ellipse(r() * 512, r() * 1100, 40 + r() * 70, 30 + r() * 90, 0, 0, 7); g.fill(); }
  // pilasters + floor bands
  g.fillStyle = trim; g.fillRect(0, 0, 26, 1100); g.fillRect(486, 0, 26, 1100);
  for (const y of [380, 700, 1010]) { g.fillStyle = trim; g.fillRect(0, y, 512, 22); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, y + 22, 512, 6); }
  // ground floor (y 0..380 from the bottom => canvas 720..1100)
  if (open) {
    g.fillStyle = "#3a2c2a"; g.fillRect(40, 760, 432, 340);
    g.fillStyle = "#6a5040"; for (let y = 800; y < 1080; y += 70) g.fillRect(50, y, 412, 12); // shelves inside
    for (let y = 800; y < 1080; y += 70) for (let x = 60; x < 450; x += U(r, 22, 40)) { g.fillStyle = jit(r, ["#c84a3a", "#e0b040", "#4a8ac0", "#5aa060", "#e8e0d0"][Math.floor(r() * 5)], 0.1); g.fillRect(x, y - U(r, 20, 45), U(r, 14, 26), U(r, 20, 45)); }
  } else {
    g.fillStyle = "#9aa0a8"; g.fillRect(40, 760, 432, 340);
    for (let y = 764; y < 1100; y += 14) { g.fillStyle = "rgba(40,45,55,0.45)"; g.fillRect(40, y, 432, 3); }
    g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(40, 760, 432, 30);
  }
  // shop awning stub (canvas, flat)
  g.fillStyle = awn; g.fillRect(30, 700, 452, 46);
  for (let x = 30; x < 482; x += 56) { g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(x, 700, 28, 46); }
  // blank shop board (no text)
  g.fillStyle = jit(r, ["#d8463a", "#2f6fb0", "#e8b83a", "#3a8a5a"][Math.floor(r() * 4)], 0.05); g.fillRect(60, 620, 392, 70);
  g.strokeStyle = "rgba(30,20,30,0.8)"; g.lineWidth = 5; g.strokeRect(60, 620, 392, 70);
  // upper floors: 2 x 2 tall windows with white iron grilles + a little balcony on floor 2
  for (const [y0, bal] of [[420, true], [80, false]] as const) {
    for (const x0 of [80, 290]) {
      g.fillStyle = "#e9e2d0"; g.fillRect(x0 - 10, y0 - 10, 162, 250);
      g.fillStyle = r() > 0.4 ? "#3a4c62" : "#6c88a6"; g.fillRect(x0, y0, 142, 230);
      g.fillStyle = "rgba(255,255,255,0.2)"; g.fillRect(x0 + 8, y0 + 8, 40, 214);
      g.strokeStyle = "#f2efe8"; g.lineWidth = 5;
      for (let x = x0 + 18; x < x0 + 142; x += 24) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + 230); g.stroke(); }
      for (const yy of [y0 + 70, y0 + 150]) { g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + 142, yy); g.stroke(); }
      g.strokeStyle = "rgba(30,20,30,0.85)"; g.lineWidth = 5; g.strokeRect(x0 - 10, y0 - 10, 162, 250);
    }
    if (bal) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(40, y0 + 250, 432, 16); g.strokeStyle = "#f2efe8"; g.lineWidth = 6; for (let x = 50; x < 470; x += 22) { g.beginPath(); g.moveTo(x, y0 + 180); g.lineTo(x, y0 + 250); g.stroke(); } g.beginPath(); g.moveTo(40, y0 + 180); g.lineTo(472, y0 + 180); g.stroke(); }
  }
  // an AC box and a tangle of wires
  g.fillStyle = "#e8e6e0"; g.fillRect(370, 340, 90, 56); g.strokeStyle = "#555"; g.lineWidth = 3; g.strokeRect(370, 340, 90, 56);
  for (let i = 0; i < 4; i++) { g.strokeStyle = "rgba(20,20,25,0.75)"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 40 + i * 9); g.quadraticCurveTo(256, 80 + i * 14, 512, 40 + i * 9); g.stroke(); }
});
/** striped stall canopy */
const stripes = (key: string, a: string, b: string) => ctex("stripe" + key, 512, 256, (g) => {
  for (let x = 0; x < 512; x += 64) { g.fillStyle = a; g.fillRect(x, 0, 32, 256); g.fillStyle = b; g.fillRect(x + 32, 0, 32, 256); }
  g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, 220, 512, 36);
});
/** wood counter boards */
const boards = (key: string, c: string) => ctex("boards" + key, 512, 256, (g, r) => {
  for (let y = 0; y < 256; y += 32) { g.fillStyle = jit(r, c, 0.08, 4, 0.1); g.fillRect(0, y, 512, 32); g.fillStyle = "rgba(30,15,10,0.6)"; g.fillRect(0, y + 29, 512, 3); }
});
/** stainless counter skirt */
const steel = () => ctex("steel", 256, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "#b8bec6"); gr.addColorStop(0.5, "#e2e6ea"); gr.addColorStop(1, "#aeb4bc");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = "rgba(60,70,80,0.35)"; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 3, 256);
});
/** lab floor: pale vinyl squares */
const vinyl = () => ctex("vinyl", 512, 512, (g, r) => {
  for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) { g.fillStyle = jit(r, (x + y) % 256 ? "#d8dde2" : "#cdd3da", 0.03, 2, 0.05); g.fillRect(x, y, 128, 128); }
  g.fillStyle = "rgba(80,90,100,0.35)"; for (let k = 0; k < 512; k += 128) { g.fillRect(k, 0, 2, 512); g.fillRect(0, k, 512, 2); }
});
const plaster = (key: string, c: string) => ctex("plaster" + key, 512, 512, (g, r) => {
  g.fillStyle = c; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "70,80,90"},0.05)`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 40 + r() * 80, 30 + r() * 50, r() * 3, 0, 7); g.fill(); }
});
const paneTex = (key: string, c: string) => ctex("pane" + key, 256, 384, (g) => {
  g.fillStyle = "#eef0f2"; g.fillRect(0, 0, 256, 384);
  g.fillStyle = c; g.fillRect(16, 16, 224, 352);
  g.fillStyle = "#eef0f2"; g.fillRect(122, 16, 12, 352); g.fillRect(16, 186, 224, 12);
  g.strokeStyle = "#241726"; g.lineWidth = 6; g.strokeRect(3, 3, 250, 378);
});

// ---------------- geometry helpers ----------------
export const boxGeo = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};
export class Builder {
  constructor(public root: THREE.Group, public ox = 0) {}
  box(m: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cast = true) {
    const me = new THREE.Mesh(boxGeo(x0 + this.ox, y0, z0, x1 + this.ox, y1, z1), m);
    me.castShadow = cast; me.receiveShadow = true; this.root.add(me); return me;
  }
  cyl(m: THREE.Material, x: number, y0: number, z: number, r: number, h: number, seg = 16, r2 = r) {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, seg), m);
    me.position.set(x + this.ox, y0 + h / 2, z); me.castShadow = true; me.receiveShadow = true; this.root.add(me); return me;
  }
  wall(m: THREE.Material, cx: number, cy: number, cz: number, w: number, h: number, yaw: number, cast = false) {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.position.set(cx + this.ox, cy, cz); me.rotation.y = yaw; me.castShadow = cast; me.receiveShadow = true; this.root.add(me); return me;
  }
  floor(m: THREE.Material, x0: number, x1: number, z0: number, z1: number, y = 0, down = false) {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    me.rotation.x = down ? Math.PI / 2 : -Math.PI / 2; me.position.set((x0 + x1) / 2 + this.ox, y, (z0 + z1) / 2);
    me.receiveShadow = true; me.castShadow = false; this.root.add(me); return me;
  }
  pic(map: THREE.Texture, cx: number, cy: number, cz: number, w: number, h: number, yaw: number, gain = 1) {
    const m = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, color: new THREE.Color(gain, gain, gain) });
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.position.set(cx + this.ox, cy, cz); me.rotation.y = yaw; this.root.add(me); return me;
  }
}
const room = (b: Builder, w: number, d: number, h: number, wallM: THREE.Material, floorM: THREE.Material, ceilM: THREE.Material, wains?: THREE.Material) => {
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  b.floor(floorM, x0, x1, z0, z1, 0);
  b.floor(ceilM, x0, x1, z0, z1, h, true);
  b.wall(wallM, 0, h / 2, z0, w, h, 0);
  b.wall(wallM, 0, h / 2, z1, w, h, Math.PI);
  b.wall(wallM, x0, h / 2, 0, d, h, Math.PI / 2);
  b.wall(wallM, x1, h / 2, 0, d, h, -Math.PI / 2);
  if (wains) {
    const t = 0.04, wh = 0.9;
    b.box(wains, x0, 0, z0, x1, wh, z0 + t, false); b.box(wains, x0, 0, z1 - t, x1, wh, z1, false);
    b.box(wains, x0, 0, z0, x0 + t, wh, z1, false); b.box(wains, x1 - t, 0, z0, x1, wh, z1, false);
  }
  return b;
};

// ---------------- the market street ----------------
const tree = (b: Builder, x: number, z: number, h: number, seed: number) => {
  const r = rng(seed);
  b.cyl(col("trunk", "#6a4a34"), x, 0, z, 0.2, h * 0.55, 8, 0.14);
  const leaf = [col("leafA", "#3f8f3f"), col("leafB", "#55a548"), col("leafC", "#2f7a3a")];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(h * U(r, 0.2, 0.28), 1), leaf[i % 3]);
    m.position.set(x + b.ox + U(r, -0.9, 0.9), h * U(r, 0.68, 0.9), z + U(r, -0.6, 0.6));
    m.castShadow = true; m.receiveShadow = true; b.root.add(m);
  }
};

/** a noodle cart under a striped canopy. kind: A plain, B dark heritage, C warm honest, F glossy new */
const stall = (b: Builder, cx: number, kind: "A" | "B" | "C" | "F") => {
  const top = { A: "#b9a07c", B: "#5a3420", C: "#a8784e", F: "#e8e2da" }[kind];
  const front = kind === "A" ? lam("steelSk", () => ({ map: rep(steel(), 2, 1) })) : kind === "F" ? col("fRed", "#d23a3a") : lam("boards" + kind, () => ({ map: rep(boards(kind, kind === "B" ? "#6a3a22" : "#9a6a40"), 1.5, 1) }));
  const [sa, sb] = { A: ["#3a7ac8", "#f4f1ea"], B: ["#8a1f2a", "#e8c46a"], C: ["#2f8a5a", "#f4eedc"], F: ["#ff4a8a", "#ffe24a"] }[kind];
  const canopy = lam("canopy" + kind, () => ({ map: rep(stripes(kind, sa, sb), 2, 1), side: THREE.DoubleSide }));
  // counter
  b.box(front, cx - 0.95, 0.12, -0.62, cx + 0.95, 0.86, 0);
  b.box(col("ctop" + kind, top), cx - 1.0, 0.86, -0.66, cx + 1.0, 0.92, 0.04);
  b.box(col("wheel", "#2a2a30"), cx - 0.85, 0, -0.5, cx - 0.7, 0.18, -0.1);
  b.box(col("wheel", "#2a2a30"), cx + 0.7, 0, -0.5, cx + 0.85, 0.18, -0.1);
  // poles + sloped canopy
  const pole = col("pole", kind === "B" ? "#3a2214" : "#c8ccd2");
  for (const x of [cx - 1.15, cx + 1.15]) for (const z of [-1.35, 0.5]) b.box(pole, x - 0.03, 0, z - 0.03, x + 0.03, z > 0 ? 2.45 : 2.75, z + 0.03);
  const cg = new THREE.PlaneGeometry(2.6, 2.0);
  const cm = new THREE.Mesh(cg, canopy);
  cm.rotation.x = -Math.PI / 2 + 0.16; cm.position.set(cx + b.ox, 2.62, -0.42); cm.castShadow = true; cm.receiveShadow = true; b.root.add(cm);
  // valance flap along the front
  b.box(canopy, cx - 1.3, 2.3, 0.56, cx + 1.3, 2.48, 0.6, false);
  // big aluminium pot (nam ya), a smaller pot, a wicker basket of noodles, a stack of bowls
  const alu = col("alu", "#c4c8ce");
  b.cyl(alu, cx + 0.45, 0.92, -0.32, 0.27, 0.42, 20);
  b.cyl(col("potRim", "#9aa0a8"), cx + 0.45, 1.34, -0.32, 0.29, 0.03, 20);
  b.cyl(col("namya", "#e08a3a"), cx + 0.45, 1.33, -0.32, 0.25, 0.015, 20);
  b.cyl(alu, cx + 0.05, 0.92, -0.42, 0.16, 0.26, 16);
  b.cyl(col("wicker", "#c89a5a"), cx - 0.55, 0.92, -0.38, 0.22, 0.14, 16, 0.26);
  for (let i = 0; i < 5; i++) b.cyl(col("noodle", "#f4f1e6"), cx - 0.55 + Math.cos(i * 1.3) * 0.1, 1.03, -0.38 + Math.sin(i * 1.3) * 0.08, 0.07, 0.06, 10);
  const bowlC = kind === "B" || kind === "C" ? "#9a4a2a" : kind === "F" ? "#ffffff" : "#e8eef2";
  for (let i = 0; i < 4; i++) b.cyl(col("bowl" + kind, bowlC), cx + 0.85, 0.92 + i * 0.05, -0.15, 0.1, 0.05, 14, 0.07);
  // veg tray (bean sprouts, basil, cucumber) as coloured mounds
  b.box(col("tray", "#d8d4c8"), cx - 0.2, 0.92, -0.12, cx + 0.12, 0.95, 0.02);
  for (const [dx, c] of [[-0.15, "#f2edd0"], [-0.05, "#4a9a3a"], [0.05, "#7ac05a"]] as const) b.cyl(col("veg" + c, c), cx + dx, 0.95, -0.05, 0.045, 0.04, 8, 0.02);
  // plastic stools + a folding table in front
  const stoolC = { A: "#3a6ac8", B: "#c83a3a", C: "#e8a03a", F: "#ff4a8a" }[kind];
  const tableTop = col("tbl" + kind, kind === "B" ? "#6a4028" : "#e8e4dc");
  b.box(tableTop, cx - 0.55, 0.7, 1.4, cx + 0.55, 0.74, 2.0);
  for (const x of [cx - 0.5, cx + 0.45]) for (const z of [1.45, 1.9]) b.box(col("tleg", "#8a8e96"), x, 0, z, x + 0.04, 0.7, z + 0.04);
  for (const [x, z] of [[cx - 0.8, 1.7], [cx + 0.8, 1.7], [cx - 0.2, 2.35]] as const) b.cyl(col("stool" + kind, stoolC), x, 0, z, 0.17, 0.45, 12, 0.14);
};

export type MktRefs = { lamps: THREE.Mesh[] };
export const buildMarket = (root: THREE.Group): MktRefs => {
  const b = new Builder(root, SET.mkt);
  b.floor(lam("asphalt", () => ({ map: rep(asphalt(), 40, 2.5) })), -150, 150, 3.0, 12, 0.0);
  b.floor(lam("pavers", () => ({ map: rep(pavers(), 120, 3.2) })), -150, 150, -4.2, 3.0, 0.03);
  b.floor(lam("pavers2", () => ({ map: rep(pavers(), 120, 1.6) })), -150, 150, 12, 16, 0.03);
  b.box(col("curb", "#d8d2c4"), -150, 0, 2.92, 150, 0.12, 3.08, false);
  b.box(col("curbY", "#e8c43a"), -150, 0.121, 2.92, 150, 0.125, 3.08, false);
  // lane line
  for (let x = -150; x < 150; x += 4) b.box(col("lane", "#efece2"), x, 0.005, 7.45, x + 2, 0.012, 7.55, false);
  // shophouse row along z = -4.2 (facing +z), 4.2 m bays, 3 floors; and a lower row across the road
  const walls = ["#e8d6a8", "#d9b2a0", "#b8cfc0", "#e8e0d0", "#c8d4e4", "#e6c69a", "#d4a890", "#c0d8c8"];
  const trims = ["#c8b488", "#b88a78", "#94ae9e", "#c8bcaa", "#a4b4c8", "#c6a67a", "#b0886e", "#9cb8a6"];
  const awns = ["#d8463a", "#2f6fb0", "#3a8a5a", "#e8a03a"];
  let k = 0;
  for (let x = -42; x < 46; x += 4.2) {
    const i = k % walls.length, open = k % 3 !== 1;
    const m = lam("shop" + k, () => ({ map: shophouse(String(k % 8) + (open ? "o" : "c"), walls[i], trims[i], open, awns[k % 4]) }));
    const h = 9 + (k % 3 === 0 ? 0.6 : 0);
    b.box(m, x, 0, -6.4, x + 4.2, h, -4.2);
    // front face carries the painted facade: box UVs stretch the texture on every face; parapet cap
    b.box(col("parapet" + i, trims[i]), x - 0.02, h, -6.45, x + 4.22, h + 0.25, -4.15);
    k++;
  }
  k = 0;
  for (let x = -40; x < 46; x += 4.2) {
    const i = (k + 3) % walls.length;
    const m = lam("shopB" + k, () => ({ map: shophouse("b" + (k % 8), walls[i], trims[i], true, awns[(k + 1) % 4]) }));
    const me = b.box(m, x, 0, 16.5, x + 4.2, 8.4, 18.7);
    me.rotation.y = 0; k++;
  }
  // trees in planters along the kerb, power poles
  for (const [x, s] of [[-8.5, 1], [7.2, 2], [11.8, 3], [24.5, 4], [-16, 5], [32, 6]] as const) { b.box(col("planter", "#a89a88"), x - 0.45, 0, 2.1, x + 0.45, 0.4, 2.85); tree(b, x, 2.45, 6.2, s); }
  const lamps: THREE.Mesh[] = [];
  for (const x of [-14, 5.2, 22, 38]) {
    b.box(col("pole2", "#b8b4ac"), x - 0.12, 0, 2.55, x + 0.12, 8.5, 2.79);
    b.box(col("pole2", "#b8b4ac"), x - 0.8, 7.8, 2.6, x + 0.8, 7.92, 2.72);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: untone("#f4f0e0") }));
    lamp.position.set(x + 0.6, 7.6, 3.1); root.add(lamp); lamps.push(lamp);
  }
  // power lines along the street
  for (const [y, z] of [[7.85, 2.66], [7.4, 2.7], [7.0, 2.62]] as const) b.box(col("wire", "#2a2a30"), -150, y, z - 0.01, 150, y + 0.025, z + 0.01, false);
  // the four stalls + a few extra market umbrellas and crates further along
  stall(b, STALL.A[0], "A"); stall(b, STALL.B[0], "B"); stall(b, STALL.C[0], "C"); stall(b, STALL.F[0], "F");
  for (const [x, c] of [[-7, "#2f6fb0"], [9.5, "#e8a03a"], [-11.5, "#3a8a5a"], [27, "#d8463a"]] as const) {
    b.cyl(col("upole", "#d8d8d8"), x, 0, -1.2, 0.03, 2.3, 6);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.55, 8, 1, true), lam("umb" + c, () => ({ color: c, side: THREE.DoubleSide })));
    um.position.set(x + b.ox, 2.5, -1.2); um.castShadow = true; root.add(um);
    b.box(col("crate", "#3a7ac8"), x - 0.5, 0, -1.0, x + 0.1, 0.35, -0.5); b.box(col("crate2", "#e8c43a"), x + 0.15, 0, -1.1, x + 0.65, 0.35, -0.6);
    b.box(col("fruit" + c, c === "#e8a03a" ? "#f0c040" : "#7ac05a"), x - 0.45, 0.35, -0.95, x + 0.05, 0.42, -0.55, false);
  }
  return { lamps };
};

// ---------------- the research room ----------------
/** ring-shaped scanner: extruded square shell with a round bore, bore axis along x */
const scanner = (root: THREE.Group, c: V3) => {
  const s = new THREE.Shape();
  s.moveTo(-1.15, -1.15); s.lineTo(1.15, -1.15); s.lineTo(1.15, 0.95); s.quadraticCurveTo(1.15, 1.15, 0.95, 1.15); s.lineTo(-0.95, 1.15); s.quadraticCurveTo(-1.15, 1.15, -1.15, 0.95); s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0.05, 0.42, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 32 });
  g.translate(0, 0, -0.65); g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, col("scanW", "#eef1f4")); m.position.set(c[0], c[1], c[2]); m.castShadow = true; m.receiveShadow = true; root.add(m);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 40), col("scanBand", "#4a8ad8")); band.rotation.y = Math.PI / 2;
  band.position.set(c[0] - 0.72, c[1] + 0.05, c[2]); root.add(band);
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 32, 1, true), lam("bore", () => ({ color: "#b8c0cc", side: THREE.BackSide })));
  bore.rotation.z = Math.PI / 2; bore.position.set(c[0], c[1] + 0.05, c[2]); root.add(bore);
};
export const buildLab = (root: THREE.Group) => {
  const LB = SET.lab;
  const r0 = new Builder(root, LB + 4);
  room(r0, 16.5, 8, 3.2, texMat("labWall", plaster("lab", "#dfe8ee"), 4, 1.2), texMat("labFloor", vinyl(), 8, 4), texMat("labCeil", plaster("labc", "#f2f4f6"), 4, 2), col("labWains", "#9fb4c4"));
  const b = new Builder(root, LB);
  // ceiling light panels
  for (let x = -3; x <= 11; x += 3.5) for (const z of [-2, 1.5]) { const p = b.pic(ctex("ceilLight", 8, 8, (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 8, 8); }), x, 3.19, z, 1.2, 0.6, 0, 1.6); p.rotation.x = Math.PI / 2; }
  // scanner + its bed sliding out toward -x
  scanner(root, SCAN);
  const bedW = col("bedW", "#f4f6f8");
  b.box(col("bedBase", "#c8d0da"), -2.6, 0, -1.95, 0.0, 0.62, -1.25);
  b.box(bedW, -2.75, 0.62, -1.9, 0.6, 0.72, -1.3);
  b.box(col("blanket", "#7aa6d8"), -2.55, 0.72, -1.85, -0.3, 0.86, -1.35);
  b.box(col("shoe", "#3a3a44"), -2.72, 0.72, -1.78, -2.6, 0.98, -1.66); b.box(col("shoe", "#3a3a44"), -2.72, 0.72, -1.58, -2.6, 0.98, -1.46);
  // tasting cart with a tube rack
  b.box(col("cartTop", "#c8ccd2"), LABT[0] - LB - 0.4, 0.86, LABT[2] - 0.3, LABT[0] - LB + 0.4, LABT[1], LABT[2] + 0.3);
  for (const [dx, dz] of [[-0.35, -0.25], [0.32, -0.25], [-0.35, 0.22], [0.32, 0.22]]) b.box(col("cartLeg", "#8a929c"), LABT[0] - LB + dx, 0, LABT[2] + dz, LABT[0] - LB + dx + 0.03, 0.86, LABT[2] + dz + 0.03);
  b.box(col("cartShelf", "#c8ccd2"), LABT[0] - LB - 0.38, 0.25, LABT[2] - 0.28, LABT[0] - LB + 0.38, 0.28, LABT[2] + 0.28);
  // control console with a monitor (the brain image is a cast fx)
  b.box(col("desk", "#e4e8ec"), 1.6, 0.72, -0.2, 3.2, 0.78, 0.6);
  for (const x of [1.65, 3.1]) b.box(col("deskLeg", "#8a929c"), x, 0, -0.15, x + 0.05, 0.72, 0.55);
  b.box(col("mon", "#2a2e36"), 1.95, 0.78, 0.05, 2.85, 1.42, 0.12);
  b.box(col("kbd", "#3a3e46"), 2.1, 0.78, 0.25, 2.7, 0.81, 0.42);
  // window wall (left) + a blank whiteboard
  for (const z of [-1.5, 1.5]) b.pic(paneTex("lab", "#cfe6f6"), -3.97, 1.75, z, 1.3, 1.9, Math.PI / 2, 1.25);
  b.box(col("wb", "#fbfbfb"), 4.6, 1.0, -3.98, 7.4, 2.3, -3.94, false);
  b.box(col("wbFrame", "#9aa4ae"), 4.55, 0.95, -3.99, 7.45, 1.0, -3.92, false);
  // puzzle desks (x 5.2 / 6.8) with chairs
  for (const x of [5.15, 6.85]) {
    b.box(col("pdesk", "#d9c4a0"), x - 0.6, 0.72, -1.15, x + 0.6, 0.77, -0.55);
    for (const dx of [-0.55, 0.5]) b.box(col("pleg", "#7a6a5a"), x + dx, 0, -1.1, x + dx + 0.05, 0.72, -0.6);
    b.box(col("chair", "#4a6a8a"), x - 0.25, 0.42, -1.75, x + 0.25, 0.47, -1.3);
    b.box(col("chair", "#4a6a8a"), x - 0.25, 0.47, -1.78, x + 0.25, 1.0, -1.72);
  }
  // chocolate tasting table (x 10) with a cloth
  b.box(col("ttable", "#8a5a3a"), 9.3, 0.74, -1.45, 10.7, 0.8, -0.75);
  b.box(col("tcloth", "#f2ece0"), 9.25, 0.8, -1.5, 10.75, 0.81, -0.7, false);
  for (const x of [9.35, 10.6]) b.box(col("tleg2", "#5a3a26"), x, 0, -1.4, x + 0.05, 0.74, -0.8);
  b.box(col("shelfL", "#c8b49a"), 9.0, 1.5, -3.98, 11.2, 1.55, -3.7, false);
  for (let i = 0; i < 7; i++) b.box(col("jar" + i, ["#c84a3a", "#e8b83a", "#4a8ac0", "#5aa060"][i % 4]), 9.15 + i * 0.3, 1.55, -3.9, 9.3 + i * 0.3, 1.85, -3.78);
  b.pic(paneTex("lab2", "#cfe6f6"), 12.22, 1.75, 0, 1.3, 1.9, -Math.PI / 2, 1.25);
};
