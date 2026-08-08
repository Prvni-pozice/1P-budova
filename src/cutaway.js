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
        base: w.userData.baseOpacity ?? 1,
        cur: w.userData.baseOpacity ?? 1,
      })
    }
    for (const r of roofGroup.children) {
      this.items.push({ mesh: r, center: null, outward: null, base: 1, cur: 1 })
    }
    this._v = new THREE.Vector3()
  }

  update(camera, dt) {
    const S = this.spec
    const cx = camera.position.x
    const cz = camera.position.z
    const inside =
      cx > -1 && cx < S.stage1 + 1 && cz > -1 && cz < S.depth + 1 && camera.position.y < S.eaves + 2

    const cxm = S.stage1 / 2
    const czm = S.depth / 2
    const d = Math.hypot(cx - cxm, cz - czm)
    let t = smoothstep(NEAR, FAR, d)
    if (this.mode === 'open') t = 0
    else if (this.mode === 'solid') t = 1

    const k = 1 - Math.exp(-dt * 8)

    for (const it of this.items) {
      let target
      if (it.outward === null) {                                  // střecha
        if (this.mode === 'solid') target = 1
        else if (this.mode === 'open') target = 0
        else target = inside ? 1 : t   // shora je vzdálenost malá → střecha zmizí sama
      } else if (inside && this.mode !== 'open') {
        target = it.base
      } else {
        this._v.set(cx - it.center.x, camera.position.y - it.center.y, cz - it.center.z)
        const facing = this._v.dot(it.outward) > 0
        target = facing ? it.base * (0.09 + 0.91 * t) : it.base
      }
      it.cur += (target - it.cur) * k
      const m = it.mesh.material
      m.opacity = it.cur
      m.transparent = it.cur < 0.995
      m.depthWrite = it.cur > 0.9
      it.mesh.visible = it.cur > 0.012
    }
  }
}
