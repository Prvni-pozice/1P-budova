// character.js — panáček pro GTA režim: kamera za zády, WASD, sprint, skok.
// Nízkopolygonový, v barvách 1P (oranžové tričko), s brýlemi.
import * as THREE from 'three'

const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
const box = (w, h, d, m, x, y, z) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  b.position.set(x, y, z)
  b.castShadow = true
  return b
}

export function makeCharacter() {
  const g = new THREE.Group()
  const dark = mat(0x2f3439)
  const shirt = mat(0xe8834b)
  const skin = mat(0xd9a877)

  g.add(box(0.34, 0.52, 0.20, shirt, 0, 1.06, 0))                 // trup
  const head = new THREE.Group()
  head.position.y = 1.42
  head.add(box(0.24, 0.26, 0.24, skin, 0, 0.13, 0))
  head.add(box(0.26, 0.05, 0.05, mat(0x22262b), 0, 0.15, 0.12))   // brýle
  head.add(box(0.26, 0.07, 0.26, mat(0x6b5a3e), 0, 0.28, 0))      // vlasy
  g.add(head)

  // končetiny s pivotem v kyčli/rameni, ať se dají houpat
  const limb = (w, h, d, m, px, py) => {
    const p = new THREE.Group()
    p.position.set(px, py, 0)
    p.add(box(w, h, d, m, 0, -h / 2, 0))
    g.add(p)
    return p
  }
  const legL = limb(0.15, 0.80, 0.18, dark, -0.10, 0.80)
  const legR = limb(0.15, 0.80, 0.18, dark, 0.10, 0.80)
  const armL = limb(0.11, 0.55, 0.13, shirt, -0.24, 1.28)
  const armR = limb(0.11, 0.55, 0.13, shirt, 0.24, 1.28)

  let phase = 0
  return {
    group: g,
    update(dt, moving, speed) {
      if (moving) {
        phase += dt * speed * 2.4
        const a = Math.sin(phase) * 0.75
        legL.rotation.x = a
        legR.rotation.x = -a
        armL.rotation.x = -a * 0.8
        armR.rotation.x = a * 0.8
      } else {
        const k = Math.min(1, dt * 10)
        for (const p of [legL, legR, armL, armR]) p.rotation.x *= 1 - k
      }
    },
  }
}
