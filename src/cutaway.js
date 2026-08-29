// cutaway.js — obálka se otevírá sama podle kamery.
//
// Daleko    → všechno neprůhledné, vidíš hmotu, průčelí a okna.
// Blízko    → střecha zmizí a stěny, kterými se díváš dovnitř, zprůhlední.
// Uvnitř    → stěny i strop plné, jsi v místnosti a chceš ji vidět.
// Shora     → střecha pryč, koukáš do dispozice.
import * as THREE from 'three'

const NEAR = 24   // pod touhle vzdáleností je model plně otevřený
const FAR = 58    // nad touhle je celistvý

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

export class Cutaway {
  constructor(walls, roofGroup, spec) {
    this.spec = spec
    this.mode = 'auto'
    this.items = []
    const box = new THREE.Box3()
    for (const w of walls) {
      box.setFromObject(w)
      this.items.push({
        mesh: w,
        center: box.getCenter(new THREE.Vector3()),
        outward: w.userData.outward,
        binary: !!w.userData.binary,
        base: w.userData.baseOpacity ?? 1,
        cur: w.userData.baseOpacity ?? 1,
      })
    }
    for (const r of roofGroup.children) {
      this.items.push({ mesh: r, center: null, outward: null, binary: false, base: 1, cur: 1 })
    }
    this._v = new THREE.Vector3()
  }

  update(camera, dt) {
    const S = this.spec
    const cx = camera.position.x
    const cz = camera.position.z
    // noInside: u vesničky (varianta D) „uvnitř budovy“ neexistuje — kamera
    // na pozemku nemá zavírat všechny buňky
    const inside = !S.noInside
      && cx > -1 && cx < S.stage1 + 1 && cz > -1 && cz < S.depth + 1 && camera.position.y < S.eaves + 2

    const cxm = S.stage1 / 2
    const czm = S.depth / 2
    const d = Math.hypot(cx - cxm, cz - czm)
    let t = smoothstep(NEAR, FAR, d)
    if (this.mode === 'open') t = 0
    else if (this.mode === 'solid') t = 1

    // Když se díváš shora dolů, střecha nemá co clonit — jinak vznikne pás
    // vzdáleností, kde nad půdorysem visí poloprůhledná plocha.
    const elev = (Math.atan2(camera.position.y - S.eaves * 0.5, Math.max(d, 0.001)) * 180) / Math.PI
    const looksDown = smoothstep(35, 62, elev)
    const roofT = this.mode === 'solid' ? 1 : t * (1 - looksDown)

    const k = 1 - Math.exp(-dt * 8)

    for (const it of this.items) {
      let target
      if (it.outward === null) {                                  // střecha
        if (this.mode === 'solid') target = 1
        else if (this.mode === 'open') target = 0
        else target = inside ? 1 : roofT
      } else if (inside && this.mode !== 'open') {
        target = it.base
      } else {
        this._v.set(cx - it.center.x, camera.position.y - it.center.y, cz - it.center.z)
        const facing = this._v.dot(it.outward) > 0
        target = facing ? it.base * (0.09 + 0.91 * t) : it.base
      }
      it.cur += (target - it.cur) * k
      if (Math.abs(target - it.cur) < 0.004) it.cur = target   // ať nezůstane viset mezi
      const m = it.mesh.material
      if (it.binary) {
        // fotovoltaika se nestmívá, jen se zapíná — poloprůhledný černý panel
        // by dělal závoj přes celý půdorys
        m.opacity = it.base
        m.transparent = false
        m.depthWrite = true
        it.mesh.visible = it.cur > 0.5
      } else {
        m.opacity = it.cur
        m.transparent = it.cur < 0.995
        m.depthWrite = it.cur > 0.9
        it.mesh.visible = it.cur > 0.012
      }
    }
  }
}
