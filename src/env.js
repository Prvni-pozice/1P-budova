// env.js — atmosféra převzatá z flightsim/carmiami: oranžovo-růžový západ
// slunce. Oproti letecké verzi je scéna malá (~200 m), takže tady stíny
// zapnuté jsou — na budově dělají čitelnost hmoty.
import * as THREE from 'three'

// x+ = západ, z+ = jih → zapadající slunce nad jihozápadem, nízko.
// Osvětluje jižní průčelí, kde jsou vstupy.
export const SUN_DIR = new THREE.Vector3(0.62, 0.30, 0.32).normalize()

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SKY_FRAG = /* glsl */`
  varying vec3 vDir;
  uniform vec3 uSunDir;
  void main() {
    vec3 dir = normalize(vDir);
    float t = clamp(dir.y, 0.0, 1.0);
    vec3 horizon = vec3(1.00, 0.62, 0.42);
    vec3 mid     = vec3(0.89, 0.41, 0.56);
    vec3 zenith  = vec3(0.21, 0.19, 0.43);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.45, t));
    col = mix(col, zenith, smoothstep(0.35, 1.0, t));
    float d = max(dot(dir, uSunDir), 0.0);
    col += smoothstep(0.9985, 0.9995, d) * vec3(1.0, 0.9, 0.72) * 1.3;
    col += pow(d, 22.0) * vec3(1.0, 0.55, 0.30) * 0.55;
    gl_FragColor = vec4(col, 1.0);
  }
`

export class Env {
  constructor(scene, radius = 400) {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uSunDir: { value: SUN_DIR.clone() } },
      side: THREE.BackSide,
      depthWrite: false,
    })
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 18), this.skyMat)
    this.dome.frustumCulled = false
    scene.add(this.dome)

    scene.add(new THREE.HemisphereLight(0xffc4a8, 0x4a4550, 1.1))

    this.sun = new THREE.DirectionalLight(0xffc890, 2.6)
    this.sun.position.copy(SUN_DIR).multiplyScalar(120)
    this.sun.castShadow = true
    const c = this.sun.shadow.camera
    c.left = -55; c.right = 55; c.top = 45; c.bottom = -45; c.near = 1; c.far = 260
    this.sun.shadow.bias = -0.0008
    this.sun.shadow.normalBias = 0.03
    scene.add(this.sun)
    scene.add(this.sun.target)

    // pár mraků nad obzorem — jen kulisa, nekloní se do scény
    this.clouds = []
    for (let i = 0; i < 14; i++) {
      const w = 90 + Math.random() * 140
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, w * 0.42),
        new THREE.MeshBasicMaterial({ map: this._cloudTexture(), transparent: true, depthWrite: false, opacity: 0.75, color: 0xffd9c4, fog: false }),
      )
      const ang = Math.random() * Math.PI * 2
      const dist = 200 + Math.random() * 120
      m.position.set(Math.cos(ang) * dist, 60 + Math.random() * 70, Math.sin(ang) * dist)
      scene.add(m)
      this.clouds.push(m)
    }
  }

  _cloudTexture() {
    const c = document.createElement('canvas')
    c.width = 320; c.height = 160
    const g = c.getContext('2d')
    const n = 7 + ((Math.random() * 5) | 0)
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const px = 160 + (t - 0.5) * 220
      const py = 106 - Math.sin(t * Math.PI) * 36 - Math.random() * 16
      const r = 30 + Math.random() * 28
      const grad = g.createRadialGradient(px, py + r * 0.3, r * 0.2, px, py, r)
      grad.addColorStop(0, 'rgba(255,244,235,0.95)')
      grad.addColorStop(0.6, 'rgba(255,228,210,0.85)')
      grad.addColorStop(1, 'rgba(255,214,190,0)')
      g.fillStyle = grad
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  applyEnvMap(renderer, scene) {
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envScene = new THREE.Scene()
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.skyMat))
    scene.environment = pmrem.fromScene(envScene, 0.05).texture
    scene.environmentIntensity = 0.45
    pmrem.dispose()
  }

  /** Slunce sleduje střed budovy, ať stínová kamera pokrývá model. */
  focus(center) {
    this.sun.position.copy(SUN_DIR).multiplyScalar(120).add(center)
    this.sun.target.position.copy(center)
    this.sun.target.updateMatrixWorld()
  }

  update(camera) {
    this.dome.position.copy(camera.position)
    for (const c of this.clouds) c.lookAt(camera.position)
  }
}
