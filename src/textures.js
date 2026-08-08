// textures.js — procedurální textury malované do canvasu, žádné externí
// soubory. Materiály jsou sdílené (userData.shared) a přežívají přegenerování;
// disposeTree je nesmí zahodit.
import * as THREE from 'three'

function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 4
  t.userData.shared = true
  return t
}

const noise = (g, s, base, amp, n = 900) => {
  for (let i = 0; i < n; i++) {
    const v = base + (Math.random() - 0.5) * amp
    g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`
    g.globalAlpha = 0.16
    g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 2 + Math.random() * 5)
  }
  g.globalAlpha = 1
}

const T = {}

/** tráva — skvrnitá zelená */
T.grass = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#4d9c45'
  g.fillRect(0, 0, s, s)
  for (let i = 0; i < 1400; i++) {
    const shade = 120 + Math.random() * 60
    g.fillStyle = `rgb(${(shade * 0.45) | 0},${shade | 0},${(shade * 0.42) | 0})`
    g.globalAlpha = 0.25
    g.fillRect(Math.random() * s, Math.random() * s, 2, 4 + Math.random() * 5)
  }
  g.globalAlpha = 1
}, [60, 60])

/** omítka — jemný šum */
T.plaster = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#dcd6cc'
  g.fillRect(0, 0, s, s)
  noise(g, s, 214, 26, 1200)
}, [0.45, 0.45])

/** trapézový plech střechy — pruhy se stínem */
T.roofSheet = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#7d8590'
  g.fillRect(0, 0, s, s)
  const w = 32
  for (let x = 0; x < s; x += w) {
    const grad = g.createLinearGradient(x, 0, x + w, 0)
    grad.addColorStop(0, '#6a7078')
    grad.addColorStop(0.35, '#8b929c')
    grad.addColorStop(0.65, '#8b929c')
    grad.addColorStop(1, '#5f656d')
    g.fillStyle = grad
    g.fillRect(x, 0, w, s)
  }
}, [24, 1])

/** dřevěná podlaha — lamely */
T.wood = () => canvasTex(256, (g, s) => {
  const plank = 42
  for (let y = 0; y < s; y += plank) {
    for (let x = 0; x < s; x += 128) {
      const tone = 165 + Math.random() * 40
      g.fillStyle = `rgb(${tone | 0},${(tone * 0.72) | 0},${(tone * 0.48) | 0})`
      g.fillRect(x, y, 128, plank)
    }
  }
  g.strokeStyle = 'rgba(60,40,20,0.5)'
  for (let y = 0; y < s; y += plank) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke() }
  noise(g, s, 150, 30, 500)
}, [1.4, 1.4])

/** keramická dlažba */
T.tile = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#cfd6da'
  g.fillRect(0, 0, s, s)
  g.strokeStyle = '#9aa4aa'
  g.lineWidth = 3
  const t = 64
  for (let i = 0; i <= s; i += t) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke()
    g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke()
  }
  noise(g, s, 205, 14, 400)
}, [1.6, 1.6])

/** pryžová sportovní podlaha s vločkami */
T.rubber = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#5c6f80'
  g.fillRect(0, 0, s, s)
  for (let i = 0; i < 2400; i++) {
    const c = ['#8fa3b5', '#42525f', '#c5d2dc'][(Math.random() * 3) | 0]
    g.fillStyle = c
    g.globalAlpha = 0.5
    g.fillRect(Math.random() * s, Math.random() * s, 2, 2)
  }
  g.globalAlpha = 1
}, [2.2, 2.2])

/** drátkobeton — matná šeď s pigmentem */
T.concrete = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#b9bcb6'
  g.fillRect(0, 0, s, s)
  noise(g, s, 178, 34, 1600)
  g.strokeStyle = 'rgba(120,120,115,0.35)'
  g.lineWidth = 2
  for (const f of [0.33, 0.66]) {
    g.beginPath(); g.moveTo(f * s, 0); g.lineTo(f * s, s); g.stroke()
  }
}, [0.7, 0.7])

// ---- sdílené materiály ---------------------------------------------------
const cacheTex = new Map()
const baseTex = (name) => {
  if (!cacheTex.has(name)) cacheTex.set(name, T[name]())
  return cacheTex.get(name)
}

const cacheMat = new Map()
/** Sdílený material s texturou — jednou vytvořený, přežívá rebuildy. */
export function sharedMat(name, opts = {}) {
  const key = name + JSON.stringify(opts)
  if (!cacheMat.has(key)) {
    const m = new THREE.MeshStandardMaterial({
      map: baseTex(name), roughness: opts.roughness ?? 0.9,
      metalness: opts.metalness ?? 0, side: opts.side ?? THREE.FrontSide,
    })
    m.userData.shared = true
    cacheMat.set(key, m)
  }
  return cacheMat.get(key)
}

/**
 * Material podlahové plochy s měřítkem vzoru podle rozměru místnosti —
 * textura se klonuje (obrázek zůstává sdílený), materiál je na jedno použití.
 */
export function floorMat(name, w, d, period) {
  const t = baseTex(name).clone()
  t.userData.shared = false
  t.repeat.set(w / period, d / period)
  t.needsUpdate = true
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })
}
