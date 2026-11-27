// One three.js scene holding every set; update(id, f, camera) shows the set of shot `id`, poses the camera, the light
// rig (camera-relative key frozen per shot, two-tone uniforms), sky/fog for the street, and the cast + effect cards.
import * as THREE from "three";
import { buildMarket, buildLab, MktRefs, SetName } from "./sets";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, shotById, BEAT, camAt, ShotDef, smooth, clamp01 } from "./story";
import { ctex } from "./paint";

/** per-shot key light: az from the shot's mean view direction (+ = screen right), el; interiors light from their windows */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  1: { az: 115, el: 45 }, 2: { az: 120, el: 42 }, 3: { az: -75, el: 35 }, 4: { az: 115, el: 42 },
  5: { az: 70, el: 35 }, 6: { az: 120, el: 42 }, 7: { az: 80, el: 35 }, 8: { az: 115, el: 45 },
  9: { az: 115, el: 42 }, 10: { az: 145, el: 20 }, 11: { az: 140, el: 18 },
};

export class World {
  root = new THREE.Group();
  private sets: Record<SetName, THREE.Group>;
  private ext: MktRefs;
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunCache = new Map<number, THREE.Vector3>();
  private clouds: THREE.Mesh[] = [];
  private dim: THREE.Mesh;
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4(); private sph = new THREE.Sphere(); private v = new THREE.Vector3();

  constructor() {
    const R = this.root;
    const g = () => { const x = new THREE.Group(); R.add(x); return x; };
    this.sets = { mkt: g(), lab: g() };
    this.ext = buildMarket(this.sets.mkt);
    buildLab(this.sets.lab);
    // sky: 5 stops by elevation, tone-map inverted
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    this.sets.mkt.add(this.sky);
    // soft painted clouds
    const cloudTex = (k: number) => ctex("cloud" + k, 512, 256, (c, r) => {
      c.clearRect(0, 0, 512, 256);
      for (let i = 0; i < 7; i++) { c.fillStyle = "rgba(255,255,255,0.9)"; c.beginPath(); c.ellipse(90 + i * 55 + r() * 20, 150 - Math.sin((i / 6) * Math.PI) * 50, 60 + r() * 30, 48 + r() * 20, 0, 0, 7); c.fill(); }
      c.fillRect(70, 150, 380, 50);
    });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloudTex(i % 3), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1, 1, 1) }));
      const a = -Math.PI / 2 + ((i - 3.5) / 8) * 2.4, d = 520;
      m.position.set(Math.sin(a) * d * 0.9, 110 + (i % 3) * 45, -Math.cos(a) * d * 0.3 - 380);
      m.scale.set(140 + (i % 3) * 40, 60 + (i % 2) * 20, 1); m.layers.set(NOINK);
      this.clouds.push(m); this.sets.mkt.add(m);
    }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 0.5);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    // full-frame darkening card for the chops (implied violence: the room goes dark for a beat; never black)
    this.dim = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: "#0c0818", transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    this.dim.renderOrder = 10; this.dim.layers.set(NOINK); this.dim.frustumCulled = false;
    R.add(this.dim);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    // rotate forward (fx, fz) by az toward screen right (-fz, fx)
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    // az = 0 means backlight: the sun is AHEAD of the camera, so the direction toward the sun is +forward
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  /** dark dip after a chop (0..~0.55 opacity), and the final fade to black */
  private dimAt(id: number, f: number) {
        if (id === 11) return smooth((f - (BEAT.black - 12)) / 12);
    return 0;
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = shotById(id), L = LIGHTS[s.light], K = LOOK[s.light];
    for (const [k, gr] of Object.entries(this.sets)) gr.visible = k === s.set;
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = s.set === "mkt" ? 0.1 : 0.05; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look), dist = cam.position.distanceTo(focus);
    // ---- light rig ----
    const sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const ext = s.set === "mkt";
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 6, 8, 60);
    if (s.light === "golden") Rr = Math.max(Rr, 26);
    this.sun.position.copy(focus).addScaledVector(sunDir, 150); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 10; sc.far = 320; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    // interiors by day: walls facing away from the window still get plenty of soft daylight (no blue cave)
    const inDay = !ext && s.light === "day";
    const lit = inDay ? [1.3, 1.24, 1.12] : L.lit, shd = inDay ? [0.66, 0.6, 0.6] : L.shade;
    TONE.uLitCol.value.set(lit[0], lit[1], lit[2]); TONE.uShadeCol.value.set(shd[0], shd[1], shd[2]);
    TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky + fog (street only) ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    for (const m of this.clouds) { (m.material as THREE.MeshBasicMaterial).color.set(K.cloud.lit); m.lookAt(cam.position.x, m.position.y, cam.position.z); }
    untone(L.fog, this.fog.color); this.fog.near = ext ? L.fogNear : 200; this.fog.far = ext ? L.fogFar : 900;
    scene.fog = this.fog; scene.background = null;
    // ---- golden morning: street lamps still on ----
    for (const lm of this.ext.lamps) (lm.material as THREE.MeshBasicMaterial).color.copy(untone(s.light === "golden" ? "#ffe2a0" : "#d8d4c8")).multiplyScalar(s.light === "golden" ? 2.2 : 1);
    // ---- cast + effects ----
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, f, { pos: cam.position, right, sun: sunDir, light: s.light });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 2.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size;
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z), 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: [Fx, (typeof st.fx)[number]][] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const fxm = this.fx(fi++);
      fxm.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      fxm.mesh.visible = true;
      fxm.mesh.position.set(p.x, p.y, p.z);
      if (p.orient === "flat") fxm.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else if (typeof p.orient === "number") fxm.mesh.rotation.set(0, p.orient, p.rot ?? 0);
      else { fxm.mesh.quaternion.copy(cam.quaternion); fxm.mesh.rotateZ(p.rot ?? 0); }
      fxm.mesh.scale.set(p.w, p.h, 1);
      fused.push([fxm, p]);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const [fxm, p] of fused) fxm.bind(p.mode ?? "hard", p.opacity ?? 1, p.gain ?? 1);
    // ---- the darkening card, right in front of the lens ----
    const dk = this.dimAt(id, f);
    this.dim.visible = dk > 0.001;
    (this.dim.material as THREE.MeshBasicMaterial).opacity = Math.min(1, dk);
    this.dim.position.copy(cam.position).addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), cam.near * 2 + 0.01);
    this.dim.quaternion.copy(cam.quaternion);
    return focus;
  }
}
