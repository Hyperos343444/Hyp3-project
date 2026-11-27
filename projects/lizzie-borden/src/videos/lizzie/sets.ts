// The places of "The Fall River Axe Mystery": the Borden house on its cobbled street (shots 1, 10, 11), the sitting
// room (3, 6), the pharmacy (4), the guest bedroom (5), the cellar (7), the kitchen (8) and the courtroom (9).
// Every set is its own group at its own x offset; world.ts shows one per shot. All walls are two-tone Lambert with
// hand-painted canvas textures (paint.ts style); room shells never cast shadows (the sun is a camera-relative key).
import * as THREE from "three";
import { ctex, rep, rng, jit, planksHD, stoneHD, cobbleHD, grassHD, roofHD } from "./paint";
import { twoTone, untone } from "./shade";

export type V3 = [number, number, number];
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- set origins ----------------
export const SET = { ext: 0, liv: 1000, bed: 1100, pharm: 1200, cellar: 1300, kitchen: 1400, court: 1500 } as const;
export type SetName = keyof typeof SET;

// ---------------- materials ----------------
const mats = new Map<string, THREE.MeshLambertMaterial>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters, liftK = 1) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make()), liftK); mats.set(key, m); }
  return m;
};
const col = (key: string, c: string) => lam("c" + c, () => ({ color: c }));
const U = (r: () => number, a: number, b: number) => a + (b - a) * r();

// ---------------- painted textures ----------------
/** clapboard siding, grey-green, with darker lap lines and soft weathering */
const siding = () => ctex("siding", 1024, 1024, (g, r) => {
  g.fillStyle = "#8fa38e"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 32) {
    g.fillStyle = jit(r, "#93a892", 0.05, 3, 0.1); g.fillRect(0, y, 1024, 32);
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, y + 2, 1024, 4);
    g.fillStyle = "rgba(30,40,40,0.55)"; g.fillRect(0, y + 29, 1024, 3);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "40,50,50"},0.05)`; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 60 + r() * 120, 30 + r() * 60, 0, 0, 7); g.fill(); }
});
/** a front window with dark green shutters (unlit day glass) */
const windowTex = (key: string, glass: string, lit = false) => ctex("win" + key, 512, 512, (g) => {
  g.clearRect(0, 0, 512, 512);
  // shutters
  for (const x of [8, 384]) {
    g.fillStyle = "#2f4a3a"; g.fillRect(x, 40, 120, 432);
    g.strokeStyle = "#1c2c24"; g.lineWidth = 6; g.strokeRect(x + 3, 43, 114, 426);
    g.fillStyle = "rgba(0,0,0,0.25)"; for (let y = 60; y < 460; y += 22) g.fillRect(x + 14, y, 92, 6);
  }
  // frame + glass
  g.fillStyle = "#efeadc"; g.fillRect(136, 24, 240, 464);
  g.fillStyle = glass; g.fillRect(156, 44, 200, 424);
  if (!lit) { const gr = g.createLinearGradient(156, 44, 356, 468); gr.addColorStop(0, "rgba(255,255,255,0.25)"); gr.addColorStop(0.5, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(156, 44, 200, 424); }
  g.fillStyle = "#efeadc"; g.fillRect(250, 44, 12, 424); g.fillRect(156, 250, 200, 12);
  g.strokeStyle = "#241726"; g.lineWidth = 6; g.strokeRect(136, 24, 240, 464);
});
const doorTex = () => ctex("door", 256, 512, (g) => {
  g.fillStyle = "#4a2e22"; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = "#2a1912"; g.lineWidth = 8;
  for (const [x, y, w, h] of [[30, 30, 86, 200], [140, 30, 86, 200], [30, 270, 86, 210], [140, 270, 86, 210]]) g.strokeRect(x, y, w, h);
  g.fillStyle = "#d8b45a"; g.beginPath(); g.arc(205, 260, 10, 0, 7); g.fill();
});
/** green damask wallpaper (sitting room) */
const wallGreen = () => ctex("wallGreen", 1024, 1024, (g, r) => {
  g.fillStyle = "#7aa452"; g.fillRect(0, 0, 1024, 1024);
  for (let x = 0; x < 1024; x += 128) { g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(x, 0, 64, 1024); }
  for (let y = 0; y < 1024; y += 128) for (let x = 0; x < 1024; x += 128) {
    const cx = x + 64 + ((y / 128) % 2) * 0, cy = y + 64;
    g.fillStyle = "rgba(55,85,35,0.55)";
    g.beginPath(); g.ellipse(cx, cy, 18, 30, 0, 0, 7); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 26, cy + 8, 12, 7, s * 0.6, 0, 7); g.fill(); }
    g.fillStyle = "rgba(230,220,170,0.35)"; g.beginPath(); g.arc(cx, cy - 34, 5, 0, 7); g.fill();
  }
  for (let i = 0; i < 30; i++) { g.fillStyle = "rgba(30,40,30,0.05)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 80, 140, 0, 0, 7); g.fill(); }
});
/** dusty rose floral wallpaper (guest bedroom) */
const wallRose = () => ctex("wallRose", 1024, 1024, (g, r) => {
  g.fillStyle = "#c29a96"; g.fillRect(0, 0, 1024, 1024);
  for (let x = 0; x < 1024; x += 96) { g.fillStyle = "rgba(120,60,70,0.12)"; g.fillRect(x, 0, 6, 1024); }
  for (let i = 0; i < 160; i++) {
    const x = r() * 1024, y = r() * 1024;
    g.fillStyle = "rgba(150,70,85,0.45)"; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
    g.fillStyle = "rgba(90,120,80,0.4)"; g.beginPath(); g.ellipse(x + 12, y + 6, 8, 4, 0.5, 0, 7); g.fill();
  }
});
/** cream plaster (kitchen, cellar ceiling) */
const plaster = (key: string, c: string) => ctex("plaster" + key, 512, 512, (g, r) => {
  g.fillStyle = c; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "90,70,50"},0.06)`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 40 + r() * 80, 30 + r() * 50, r() * 3, 0, 7); g.fill(); }
});
/** dark oak panelling (courtroom, wainscot) */
const panels = (key: string, c: string) => ctex("panel" + key, 1024, 512, (g, r) => {
  g.fillStyle = c; g.fillRect(0, 0, 1024, 512);
  for (let x = 0; x < 1024; x += 256) {
    g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(x + 24, 36, 208, 440);
    g.fillStyle = jit(r, c, 0.06, 3, 0.1); g.fillRect(x + 34, 46, 188, 420);
    g.fillStyle = "rgba(255,230,190,0.12)"; g.fillRect(x + 34, 46, 188, 6);
    g.strokeStyle = "rgba(20,10,5,0.6)"; g.lineWidth = 4; g.strokeRect(x + 24, 36, 208, 440);
  }
});
/** pharmacy shelves full of coloured bottles */
const shelves = () => ctex("shelves", 2048, 1024, (g, r) => {
  g.fillStyle = "#6b4630"; g.fillRect(0, 0, 2048, 1024);
  for (let y = 40; y < 1024; y += 240) {
    g.fillStyle = "#3d2618"; g.fillRect(0, y, 2048, 200);
    let x = 20;
    while (x < 2010) {
      const w = U(r, 34, 70), h = U(r, 90, 170), c = ["#2e7d6b", "#9c3b3b", "#c79a2e", "#3b5ea8", "#e8e2cf", "#6a3d8f", "#4f8a3a"][Math.floor(r() * 7)];
      const by = y + 196;
      g.fillStyle = c; g.beginPath(); g.roundRect(x, by - h, w, h, 8); g.fill();
      g.fillStyle = "#e8d8b0"; g.fillRect(x + 4, by - h * 0.62, w - 8, h * 0.28); // label (blank, no text)
      g.fillStyle = "#2a1a12"; g.fillRect(x + w * 0.3, by - h - 14, w * 0.4, 16);
      g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(x + 6, by - h + 8, 6, h - 16);
      g.strokeStyle = "#241726"; g.lineWidth = 4; g.beginPath(); g.roundRect(x, by - h, w, h, 8); g.stroke();
      x += w + U(r, 6, 18);
    }
    g.fillStyle = "#8a5d3e"; g.fillRect(0, y + 196, 2048, 26);
    g.fillStyle = "#241726"; g.fillRect(0, y + 222, 2048, 4);
  }
});
const fabric = (key: string, c: string, stripe: string) => ctex("fab" + key, 256, 256, (g) => {
  g.fillStyle = c; g.fillRect(0, 0, 256, 256);
  g.fillStyle = stripe; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 10, 256);
});
const quilt = () => ctex("quilt", 512, 512, (g, r) => {
  for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) { g.fillStyle = ["#e8dcc4", "#b85b5b", "#d9c08a", "#7f9cc2"][Math.floor(r() * 4)]; g.fillRect(x, y, 64, 64); }
  g.strokeStyle = "rgba(60,30,30,0.5)"; g.lineWidth = 3; for (let k = 0; k <= 512; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
});

// ---------------- geometry helpers ----------------
/** axis-aligned box from min to max with world-scaled UVs (tile metres per texture repeat, 0 = stretch) */
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
  /** a vertical plane with its own texture repeat, normal = (nx, 0, nz) */
  wall(m: THREE.Material, cx: number, cy: number, cz: number, w: number, h: number, yaw: number, cast = false) {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.position.set(cx + this.ox, cy, cz); me.rotation.y = yaw; me.castShadow = cast; me.receiveShadow = true; this.root.add(me); return me;
  }
  floor(m: THREE.Material, x0: number, x1: number, z0: number, z1: number, y = 0, down = false) {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    me.rotation.x = down ? Math.PI / 2 : -Math.PI / 2; me.position.set((x0 + x1) / 2 + this.ox, y, (z0 + z1) / 2);
    me.receiveShadow = true; me.castShadow = false; this.root.add(me); return me;
  }
  /** unlit picture (windows, glows) */
  pic(map: THREE.Texture, cx: number, cy: number, cz: number, w: number, h: number, yaw: number, gain = 1, alpha = true) {
    const m = new THREE.MeshBasicMaterial({ map, transparent: false, alphaTest: alpha ? 0.5 : 0, color: new THREE.Color(gain, gain, gain), toneMapped: true });
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.position.set(cx + this.ox, cy, cz); me.rotation.y = yaw; this.root.add(me); return me;
  }
}
const texMat = (key: string, t: THREE.Texture, rx: number, ry: number, liftK = 1) => lam(key, () => ({ map: rep(t, rx, ry) }), liftK);

/** an inward-facing room: floor, ceiling, four walls, wainscot band; returns the builder */
const room = (b: Builder, w: number, d: number, h: number, wallM: THREE.Material, floorM: THREE.Material, ceilM: THREE.Material, wains?: THREE.Material) => {
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  b.floor(floorM, x0, x1, z0, z1, 0);
  b.floor(ceilM, x0, x1, z0, z1, h, true);
  b.wall(wallM, 0, h / 2, z0, w, h, 0);              // back wall, faces +z
  b.wall(wallM, 0, h / 2, z1, w, h, Math.PI);        // front wall (behind the camera), faces -z
  b.wall(wallM, x0, h / 2, 0, d, h, Math.PI / 2);    // left wall, faces +x
  b.wall(wallM, x1, h / 2, 0, d, h, -Math.PI / 2);   // right wall, faces -x
  if (wains) {
    const t = 0.04, wh = 0.95;
    b.box(wains, x0, 0, z0, x1, wh, z0 + t, false); b.box(wains, x0, 0, z1 - t, x1, wh, z1, false);
    b.box(wains, x0, 0, z0, x0 + t, wh, z1, false); b.box(wains, x1 - t, 0, z0, x1, wh, z1, false);
  }
  const trim = col("trim", "#3a2418");
  b.box(trim, x0, h - 0.12, z0, x1, h, z0 + 0.06, false);
  return b;
};

// ---------------- the street with the Borden house ----------------
/** a gable-front house: footprint x0..x1 (front face at zf, depth d, facing +z when dir = 1) */
const gableHouse = (b: Builder, cx: number, zf: number, w: number, d: number, wallH: number, roofH: number, dir: 1 | -1, siding: THREE.Material, roofM: THREE.Material, trimC: string, winM: THREE.Material, doorM: THREE.Material, upperWin?: THREE.Material) => {
  const zb = zf - dir * d, x0 = cx - w / 2, x1 = cx + w / 2;
  const [za, zc] = dir > 0 ? [zb, zf] : [zf, zb];
  b.box(siding, x0, 0, za, x1, wallH, zc);
  b.box(col("plinth", "#6d6158"), x0 - 0.08, 0, za - 0.08, x1 + 0.08, 0.6, zc + 0.08);
  // gable: triangular prism
  const shape = new THREE.Shape(); shape.moveTo(x0 - 0.35 + b.ox, 0); shape.lineTo(x1 + 0.35 + b.ox, 0); shape.lineTo(cx + b.ox, roofH); shape.closePath();
  const gab = new THREE.ExtrudeGeometry(shape, { depth: d + 0.7, bevelEnabled: false });
  gab.translate(0, wallH, za - 0.35);
  // the roof faces get the roof material, the gable ends the siding: two meshes (roof slightly bigger)
  const gm = new THREE.Mesh(gab, siding); gm.castShadow = true; gm.receiveShadow = true;
  b.root.add(gm);
  const half = Math.hypot(w / 2 + 0.45, roofH), ang = Math.atan2(roofH, w / 2 + 0.35);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(half, 0.16, d + 0.9), roofM);
    r.position.set(cx + b.ox + s * (w / 4 + 0.15), wallH + roofH / 2 + 0.06, (za + zc) / 2);
    r.rotation.z = -s * ang; r.castShadow = true; r.receiveShadow = true; b.root.add(r);
  }
  const tr = col("trim" + trimC, trimC);
  // corner boards + eave band
  for (const x of [x0, x1 - 0.18]) b.box(tr, x - 0.02, 0.6, zc - (dir > 0 ? 0.02 : -0.02) - 0.1, x + 0.2, wallH, zc + 0.04);
  b.box(tr, x0 - 0.05, wallH - 0.25, (dir > 0 ? zc - 0.05 : zc - 0.05), x1 + 0.05, wallH, zc + 0.06);
  // windows: two per floor on the front, one in the gable
  const face = zc + 0.035 * dir, yaw = dir > 0 ? 0 : Math.PI;
  const win = (x: number, y: number, m: THREE.Material, s = 1) => { const me = new THREE.Mesh(new THREE.PlaneGeometry(1.9 * s, 1.9 * s), m); me.position.set(x + b.ox, y, face); me.rotation.y = yaw; me.receiveShadow = true; b.root.add(me); return me; };
  const wx = w * 0.27;
  win(cx - wx, 1.9, winM); win(cx + wx * 0.55, 1.9, winM, 0.9);
  const up = [win(cx - wx, 4.9, upperWin ?? winM), win(cx + wx, 4.9, winM)];
  win(cx, wallH + roofH * 0.38, winM, 0.7);
  // door with a step and a little porch hood
  const dx = cx + wx * 1.25;
  const dm = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), doorM); dm.position.set(dx + b.ox, 1.7, face + 0.005 * dir); dm.rotation.y = yaw; b.root.add(dm);
  b.box(col("step", "#9a8f82"), dx - 0.75, 0, zc, dx + 0.75, 0.55, zc + dir * 0.7);
  b.box(tr, dx - 0.8, 2.95, Math.min(zc, zc + dir * 0.9), dx + 0.8, 3.08, Math.max(zc, zc + dir * 0.9));
  b.box(col("chim", "#7a4a3a"), cx - 1.6, wallH + roofH * 0.4, za + 1.5, cx - 1.0, wallH + roofH + 1.0, za + 2.1);
  return up;
};

const tree = (b: Builder, x: number, z: number, h: number, seed: number) => {
  const r = rng(seed);
  b.cyl(col("trunk", "#5a3d2b"), x, 0, z, 0.22, h * 0.5, 8, 0.16);
  const leaf = [col("leafA", "#4f8f3f"), col("leafB", "#5fa048"), col("leafC", "#467f38")];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(h * U(r, 0.22, 0.3), 1), leaf[i % 3]);
    m.position.set(x + b.ox + U(r, -0.6, 0.6), h * U(r, 0.62, 0.85), z + U(r, -0.6, 0.6));
    m.castShadow = true; m.receiveShadow = true; b.root.add(m);
  }
};

export type ExtRefs = { upperWin: THREE.Mesh; winGlow: THREE.MeshBasicMaterial; silhouette: THREE.MeshBasicMaterial; lamps: THREE.Mesh[] };

/** shots 1, 10, 11: street along x, Borden house front at z = -2 facing +z; fence at z = 1.2; street z 3.6 .. 11 */
export const buildStreet = (root: THREE.Group): ExtRefs => {
  const b = new Builder(root, SET.ext);
  const grass = lam("grassExt", () => ({ map: rep(grassHD(), 30, 30) }));
  const cob = lam("cobExt", () => ({ map: rep(cobbleHD(), 18, 2.6) }));
  const walk = lam("walk", () => ({ map: rep(stoneHD("walkHD", ["#c9bfae", "#bdb3a2", "#d2c8b8", "#b5ab9a"], "#8d8476"), 30, 0.7) }));
  b.floor(grass, -120, 120, -80, 80, 0);
  b.floor(cob, -120, 120, 3.6, 11, 0.02);
  b.floor(walk, -120, 120, 1.4, 3.6, 0.04);
  b.floor(walk, -120, 120, 11, 13.2, 0.04);
  b.box(col("curb", "#a39a8c"), -120, 0, 3.5, 120, 0.12, 3.7, false);
  b.box(col("curb", "#a39a8c"), -120, 0, 10.9, 120, 0.12, 11.1, false);
  const sid = lam("siding", () => ({ map: rep(siding(), 2, 2.5) }));
  const roofM = lam("roofBorden", () => ({ map: rep(roofHD("#4a4a55", true), 2, 3) }));
  const winDay = new THREE.MeshLambertMaterial({ map: windowTex("day", "#3a5470"), transparent: false, alphaTest: 0.5 }); twoTone(winDay);
  const doorM = twoTone(new THREE.MeshLambertMaterial({ map: doorTex() }));
  // the lit upper window of shot 11: warm glass + a figure that fades in (two unlit layers)
  const glowCv = windowTex("lit", "#ffcf6a", true);
  const winGlow = new THREE.MeshBasicMaterial({ map: glowCv, alphaTest: 0.5, color: new THREE.Color(1, 1, 1) });
  const up = gableHouse(b, 0, -2, 8.4, 12, 7.2, 3.6, 1, sid, roofM, "#e9e4d6", winDay, doorM, winDay);
  const upperWin = up[0];
  // silhouette of someone standing still behind the glass (neutral: nobody in particular)
  const silTex = ctex("windowFigure", 256, 512, (g) => {
    g.clearRect(0, 0, 256, 512);
    g.fillStyle = "#2a1a2e";
    g.beginPath(); g.ellipse(128, 200, 34, 38, 0, 0, 7); g.fill();                       // head
    g.beginPath(); g.moveTo(24, 512); g.lineTo(30, 330); g.quadraticCurveTo(40, 262, 128, 252); g.quadraticCurveTo(216, 262, 226, 330); g.lineTo(232, 512); g.fill(); // shoulders
  });
  const silhouette = new THREE.MeshBasicMaterial({ map: silTex, transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color(1, 1, 1) });
  const sil = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), silhouette);
  sil.position.set(upperWin.position.x, 4.75, -2 + 0.05); sil.renderOrder = 2; root.add(sil);
  // picket fence with an open gate gap at x 0.2 .. 1.4
  const white = col("picket", "#f1ede2");
  for (let x = -11.8; x < 11.8; x += 0.32) { if (x > 0.15 && x < 1.45) continue; b.box(white, x, 0, 1.15, x + 0.12, 1.05, 1.25); }
  for (const y of [0.35, 0.8]) { b.box(white, -11.9, y, 1.08, 0.15, y + 0.08, 1.14); b.box(white, 1.45, y, 1.08, 11.9, y + 0.08, 1.14); }
  for (const x of [0.05, 1.45]) b.box(white, x, 0, 1.1, x + 0.16, 1.25, 1.3);
  // neighbours along both sides of the street (muted, period colours)
  const fronts = [["#b9a37a", "#5b3a2c"], ["#9a6c5c", "#2f3a4a"], ["#c8b89a", "#4a3a2c"], ["#7d8c9c", "#3a2c28"], ["#a88a6a", "#2c3a2f"]];
  let k = 0;
  for (const x of [-26, -14, 14, 26, 38, -38, 50, -50]) {
    const [wc] = fronts[k % 5];
    const m = lam("nb" + k, () => ({ map: rep(siding(), 2, 2.5), color: new THREE.Color(wc).multiplyScalar(1.6) }));
    gableHouse(b, x, -3 - (k % 2), 8, 10, 6.6 + (k % 3) * 0.6, 3.2, 1, m, roofM, "#e9e4d6", winDay, doorM);
    k++;
  }
  k = 0;
  for (const x of [-30, -18, -6, 6, 18, 30, 42, -42, 54]) {
    const [wc] = fronts[(k + 2) % 5];
    const m = lam("nbo" + k, () => ({ map: rep(siding(), 2, 2.5), color: new THREE.Color(wc).multiplyScalar(1.6) }));
    gableHouse(b, x, 16 + (k % 2), 8, 10, 6.6 + ((k + 1) % 3) * 0.6, 3.2, -1, m, roofM, "#e9e4d6", winDay, doorM);
    k++;
  }
  for (const [x, z, h, s] of [[9.5, -6, 8, 2], [-20, 0, 6.5, 3], [20, 0, 7, 4], [-9, 14.5, 6, 5], [11, 14.5, 6.5, 6], [32, 0, 7, 7], [-33, 14.5, 7, 8]] as const) tree(b, x, z, h, s);
  // street lamps
  const lamps: THREE.Mesh[] = [];
  for (const x of [-9, 9, 27, -27]) {
    b.cyl(col("iron", "#2c2c34"), x, 0, 3.3, 0.07, 3.4, 8);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), new THREE.MeshBasicMaterial({ color: untone("#ffe7a8") }));
    glass.position.set(x + SET.ext, 3.6, 3.3); root.add(glass); lamps.push(glass);
  }
  return { upperWin, winGlow, silhouette, lamps };
};

// ---------------- interiors ----------------
/** soft unlit "window" for interiors: a bright pane with frame bars */
const paneTex = (key: string, c: string) => ctex("pane" + key, 256, 384, (g) => {
  g.fillStyle = "#e9e1cf"; g.fillRect(0, 0, 256, 384);
  g.fillStyle = c; g.fillRect(16, 16, 224, 352);
  g.fillStyle = "#e9e1cf"; g.fillRect(122, 16, 12, 352); g.fillRect(16, 186, 224, 12);
  g.strokeStyle = "#241726"; g.lineWidth = 6; g.strokeRect(3, 3, 250, 378);
});

/** shots 3 + 6: sitting room 7 x 6 x 3.2, back wall z = -3; sofa against the back wall, round table with coins */
export const buildLiving = (root: THREE.Group) => {
  const b = new Builder(root, SET.liv);
  room(b, 7, 6, 3.2, texMat("wallGreen", wallGreen(), 2.5, 1.2), texMat("floorLiv", planksHD(), 3, 3), texMat("ceil", plaster("c", "#e8dfcc"), 2, 2), texMat("wainLiv", panels("liv", "#5a3a26"), 3, 0.5));
  b.pic(paneTex("day", "#cfe3f2"), -3.47, 1.85, -0.6, 1.1, 1.65, Math.PI / 2, 1.25);
  // sofa (horsehair, dark red) against the back wall
  const sofa = col("sofa", "#6e2a2e"), wood = col("darkwood", "#4a2c1c");
  b.box(sofa, -1.1, 0.25, -2.95, 1.1, 0.55, -2.25);
  b.box(sofa, -1.1, 0.55, -2.95, 1.1, 1.15, -2.72);
  b.box(sofa, -1.25, 0.25, -2.95, -1.0, 0.85, -2.25); b.box(sofa, 1.0, 0.25, -2.95, 1.25, 0.85, -2.25);
  for (const x of [-1.15, 1.15]) for (const z of [-2.9, -2.3]) b.box(wood, x - 0.05, 0, z - 0.05, x + 0.05, 0.25, z + 0.05);
  // round table with a lace cloth
  b.cyl(wood, 0.6, 0, 0.3, 0.08, 0.72, 10);
  b.cyl(col("lace", "#efe8d8"), 0.6, 0.72, 0.3, 0.55, 0.05, 28);
  // a picture frame, a mantel clock shelf, a lamp
  b.box(col("frame", "#8a6a3a"), 1.6, 1.5, -2.99, 2.6, 2.3, -2.94, false);
  b.box(col("art", "#6f8aa0"), 1.7, 1.6, -2.94, 2.5, 2.2, -2.93, false);
  b.box(wood, 2.6, 0, -2.95, 3.4, 0.95, -2.5);
  b.cyl(col("lampbase", "#8a6a3a"), 3.0, 0.95, -2.7, 0.08, 0.4, 10);
  b.cyl(col("shade", "#e2c48a"), 3.0, 1.35, -2.7, 0.25, 0.3, 14, 0.15);
  // door frame on the right wall
  b.box(col("doorframe", "#3a2418"), 3.44, 0, 0.6, 3.5, 2.3, 1.7, false);
  b.box(col("doorLeaf", "#4a2e22"), 3.42, 0.02, 0.7, 3.46, 2.2, 1.6, false);
};

/** shot 4: pharmacy 7 x 6 x 3.4: bottle shelves on the back wall, counter across the room at z = -1.2 */
export const buildPharmacy = (root: THREE.Group) => {
  const b = new Builder(root, SET.pharm);
  room(b, 7, 6, 3.4, texMat("wallPh", plaster("ph", "#d8cbb0"), 2, 2), texMat("floorPh", planksHD(), 3, 3), texMat("ceil", plaster("c", "#e8dfcc"), 2, 2));
  const sh = lam("shelves", () => ({ map: shelves() }));
  b.wall(sh, 0, 1.75, -2.97, 6.8, 3.0, 0);
  b.wall(sh, -3.47, 1.75, -1.2, 3.4, 3.0, Math.PI / 2);
  const wood = col("counter", "#7a4f32"), top = col("countertop", "#a5764e");
  b.box(wood, -2.8, 0, -1.5, 2.6, 1.0, -0.9);
  b.box(top, -2.9, 1.0, -1.58, 2.7, 1.08, -0.82);
  b.box(col("brass", "#c9a24a"), 1.6, 1.08, -1.4, 2.1, 1.12, -1.0); // scale base
  b.cyl(col("brass", "#c9a24a"), 1.85, 1.12, -1.2, 0.03, 0.5, 8);
  for (const [x, c] of [[-2.2, "#2e7d6b"], [-1.9, "#9c3b3b"], [-1.6, "#c79a2e"]] as const) b.cyl(col("jar" + c, c), x, 1.08, -1.2, 0.1, 0.32, 14);
  b.pic(paneTex("dayPh", "#cfe3f2"), 3.47, 1.9, 0.8, 1.2, 1.8, -Math.PI / 2, 1.25);
};

/** shot 5: guest bedroom 5 x 5 x 3, bed along the right wall, back wall z = -2.5 gets the shadow */
export const buildBedroom = (root: THREE.Group) => {
  const b = new Builder(root, SET.bed);
  room(b, 5, 5, 3.0, texMat("wallRose", wallRose(), 1.8, 1.1), texMat("floorBed", planksHD(), 2.2, 2.2), texMat("ceil", plaster("c", "#e8dfcc"), 2, 2));
  const wood = col("bedwood", "#5a3624");
  // bed: head against the right wall (x = 2.5), long axis along -x
  b.box(wood, 0.4, 0, -1.6, 2.45, 0.45, -0.1);
  b.box(lam("quilt", () => ({ map: rep(quilt(), 2, 1.5) })), 0.45, 0.45, -1.6, 2.4, 0.62, -0.1);
  b.box(col("pillow", "#f1ece0"), 1.85, 0.62, -1.45, 2.35, 0.78, -0.25);
  b.box(wood, 2.35, 0, -1.7, 2.5, 1.5, 0.0);
  b.box(wood, 0.3, 0, -1.7, 0.45, 1.0, 0.0);
  // washstand + pitcher, window pane on the left wall (cold night light)
  b.box(wood, -2.4, 0, -2.4, -1.5, 0.85, -1.9);
  b.cyl(col("pitcher", "#e8e4dc"), -1.95, 0.85, -2.15, 0.12, 0.32, 14, 0.08);
  b.pic(paneTex("night", "#4a5a9a"), -2.47, 1.7, -0.3, 1.0, 1.5, Math.PI / 2, 1.4);
};

/** shot 7: cellar 6 x 6 x 2.5, rough stone, crates; the hatchet head lies on a crate at (0.6, 0.86, -1.2) */
export const CELLAR_AXE: V3 = [SET.cellar + 0.55, 0.857, -1.15];
export const buildCellar = (root: THREE.Group) => {
  const b = new Builder(root, SET.cellar);
  const stoneT = stoneHD("cellarHD", ["#8f8678", "#857c6e", "#998f80", "#7c7366"], "#5e574d");
  room(b, 6, 6, 2.5, texMat("cellarWall", stoneT, 2, 1), texMat("cellarFloor", stoneHD("cellarFl", ["#6e675c", "#655e53", "#776f63", "#5e574d"], "#4a443c"), 3, 3), texMat("cellarCeil", planksHD(), 2, 2));
  // ceiling joists
  const joist = col("joist", "#4a3424");
  for (let x = -2.8; x <= 2.8; x += 0.7) b.box(joist, x, 2.3, -3, x + 0.14, 2.5, 3, false);
  const crate = lam("crate", () => ({ map: rep(planksHD(), 0.4, 0.4) }));
  b.box(crate, 0.0, 0, -1.6, 1.1, 0.85, -0.7);
  b.box(crate, 1.2, 0, -2.6, 2.4, 1.1, -1.6);
  b.box(crate, -2.6, 0, -2.6, -1.4, 0.8, -1.6); b.box(crate, -2.4, 0.8, -2.4, -1.6, 1.4, -1.8);
  b.cyl(col("barrel", "#6a4a30"), -1.0, 0, -2.3, 0.35, 0.9, 16);
  // the hatchet head: an iron head (eye + flared blade) lying flat on the crate, a short broken stub of handle (no blood)
  const iron = col("axeIron", "#454953"), stub = col("axeWood", "#a5825a");
  const hs = new THREE.Shape();
  hs.moveTo(-0.07, -0.032); hs.lineTo(0.03, -0.028); hs.quadraticCurveTo(0.1, -0.05, 0.135, -0.085); hs.quadraticCurveTo(0.16, 0, 0.135, 0.085);
  hs.quadraticCurveTo(0.1, 0.05, 0.03, 0.028); hs.lineTo(-0.07, 0.032); hs.quadraticCurveTo(-0.09, 0, -0.07, -0.032);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
  hg.rotateX(-Math.PI / 2); hg.scale(1.15, 1, 1.15);
  const head = new THREE.Mesh(hg, iron); head.position.set(...CELLAR_AXE); head.rotation.y = 0.5; head.castShadow = true; head.receiveShadow = true; root.add(head);
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.11, 10), stub);
  sm.rotation.z = Math.PI / 2; sm.rotation.y = 0.5; sm.position.set(CELLAR_AXE[0] - 0.13 * Math.cos(0.5), CELLAR_AXE[1] + 0.03, CELLAR_AXE[2] + 0.13 * Math.sin(0.5)); root.add(sm);
  const spl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 5), stub);
  spl.rotation.z = Math.PI / 2; spl.rotation.y = 0.5; spl.position.set(CELLAR_AXE[0] - 0.21 * Math.cos(0.5), CELLAR_AXE[1] + 0.03, CELLAR_AXE[2] + 0.21 * Math.sin(0.5)); root.add(spl);
  // small high window (cold light)
  b.pic(paneTex("cellar", "#55639e"), 0.8, 2.15, -2.97, 0.9, 0.4, 0, 1.3);
};

/** shot 8: kitchen 6 x 5 x 3, cast-iron stove on the back wall at x = 0.6; flue pipe */
export const STOVE: V3 = [SET.kitchen + 0.6, 0.85, -1.85];
export const buildKitchen = (root: THREE.Group) => {
  const b = new Builder(root, SET.kitchen);
  room(b, 6, 5, 3.0, texMat("kitWall", plaster("kit", "#d9c9a6"), 2, 2), texMat("kitFloor", planksHD(), 2.5, 2.5), texMat("ceil", plaster("c", "#e8dfcc"), 2, 2), texMat("wainKit", panels("kit", "#6a4a30"), 3, 0.5));
  const iron = col("stoveIron", "#2e2e36"), steel = col("stoveTrim", "#5c5f6a");
  const [sx, , sz] = STOVE; const lx = sx - SET.kitchen;
  b.box(iron, lx - 0.65, 0.2, sz - 0.4, lx + 0.65, 0.85, sz + 0.4);
  b.box(steel, lx - 0.7, 0.85, sz - 0.45, lx + 0.7, 0.9, sz + 0.45);
  for (const x of [lx - 0.6, lx + 0.55]) for (const z of [sz - 0.35, sz + 0.3]) b.box(iron, x, 0, z, x + 0.06, 0.2, z + 0.06);
  b.cyl(iron, lx - 0.35, 0.9, sz - 0.25, 0.09, 2.1, 12);
  // fire door (open) on the front: a dark mouth with a warm glow inside
  b.box(col("mouth", "#120a08"), lx - 0.28, 0.35, sz + 0.4, lx + 0.28, 0.7, sz + 0.41, false);
  b.box(iron, lx + 0.3, 0.33, sz + 0.41, lx + 0.33, 0.72, sz + 0.7, false);
  // table, shelf with pots, window
  const wood = col("kitwood", "#8a6040");
  b.box(wood, -2.6, 0.78, -0.6, -1.2, 0.84, 0.6); for (const x of [-2.55, -1.3]) for (const z of [-0.55, 0.5]) b.box(wood, x, 0, z, x + 0.06, 0.78, z + 0.06);
  b.box(wood, -2.9, 1.7, -2.49, -1.0, 1.75, -2.2, false);
  for (const [x, c] of [[-2.6, "#8a5a3a"], [-2.1, "#3a3a44"], [-1.5, "#b06a3a"]] as const) b.cyl(col("pot" + c, c), x, 1.75, -2.35, 0.14, 0.22, 12);
  b.pic(paneTex("nightK", "#4a5a9a"), 2.97, 1.7, -0.6, 1.0, 1.4, -Math.PI / 2, 1.4);
};

/** shot 9: courtroom 14 x 12 x 5. Judge's bench at the back (z = -5.2, raised), jury box on the left (x -6 .. -3),
 *  defence table at the front centre where Lizzie sits facing the bench. */
export const JUDGE: V3 = [SET.court + 0, 1.1, -4.6];
export const buildCourt = (root: THREE.Group) => {
  const b = new Builder(root, SET.court);
  room(b, 14, 12, 5.0, texMat("courtWall", plaster("court", "#e6d2aa"), 3, 1.5), texMat("courtFloor", planksHD(), 5, 5), texMat("ceil", plaster("c", "#e8dfcc"), 3, 3), texMat("wainCourt", panels("court", "#4e301e"), 4, 0.4));
  const oak = lam("oak", () => ({ map: rep(panels("bench", "#5a3822"), 2, 1) }));
  const top = col("oakTop", "#6e4628");
  // judge's bench, raised dais
  b.box(top, -3, 0, -6, 3, 0.5, -3.9);
  b.box(oak, -2.4, 0.5, -4.4, 2.4, 1.75, -3.9);
  b.box(top, -2.5, 1.75, -4.5, 2.5, 1.85, -3.8);
  b.box(col("chairBack", "#3a1f1c"), -0.5, 0.5, -5.9, 0.5, 3.0, -5.7);
  // jury box: two tiers along the left wall
  b.box(top, -6.9, 0, -3.5, -3.2, 0.3, 1.5); b.box(top, -6.9, 0.3, -3.5, -5.0, 0.7, 1.5);
  b.box(oak, -3.3, 0, -3.5, -3.1, 1.0, 1.5);
  b.box(oak, -6.9, 0, 1.4, -3.1, 1.0, 1.6);
  // defence table + spectators' rail
  b.box(top, -1.2, 0.75, 1.3, 1.6, 0.82, 2.2); for (const x of [-1.1, 1.45]) for (const z of [1.35, 2.05]) b.box(top, x, 0, z, x + 0.08, 0.75, z + 0.08);
  b.box(oak, -6.9, 0, 3.6, 6.9, 1.0, 3.75);
  // tall windows + a flag-free plain wall (no text, no seal)
  for (const z of [-3, 1]) b.pic(paneTex("dayCourt", "#cfe3f2"), 6.97, 2.6, z, 1.4, 2.8, -Math.PI / 2, 1.25);
  b.box(col("clock", "#6e4628"), -0.45, 3.4, -5.99, 0.45, 4.3, -5.9, false);
  b.cyl(col("clockface", "#efe8d8"), 0, 3.55, -5.88, 0.3, 0.02, 24).rotation.x = Math.PI / 2;
};
