import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type NetworkCanvasProps = {
  disabled?: boolean
}

export function NetworkCanvas({ disabled = false }: NetworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (disabled || !containerRef.current) return

    const container = containerRef.current
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.1,
      120
    )
    camera.position.z = 26

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const NODE_COUNT = 72
    const positions = new Float32Array(NODE_COUNT * 3)
    for (let i = 0; i < NODE_COUNT; i++) {
      const phi = Math.acos(-1 + (2 * i) / NODE_COUNT)
      const theta = Math.sqrt(NODE_COUNT * Math.PI) * phi
      const radius = 11 + Math.random() * 2.5
      positions[i * 3] = radius * Math.cos(theta) * Math.sin(phi)
      positions[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi)
      positions[i * 3 + 2] = radius * Math.cos(phi)
    }

    const pointGeometry = new THREE.BufferGeometry()
    pointGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    )

    const points = new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({
        color: 0x4f7bea,
        size: 0.14,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    scene.add(points)

    const linePositions: number[] = []
    const linkThreshold = 4.8
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = positions[i * 3] - positions[j * 3]
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < linkThreshold) {
          linePositions.push(
            positions[i * 3],
            positions[i * 3 + 1],
            positions[i * 3 + 2],
            positions[j * 3],
            positions[j * 3 + 1],
            positions[j * 3 + 2]
          )
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3)
    )
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({
        color: 0x2754c5,
        transparent: true,
        opacity: 0.22,
      })
    )
    scene.add(lines)

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x4f7bea,
        transparent: true,
        opacity: 0.12,
      })
    )
    scene.add(core)

    let frameId = 0
    let pointerX = 0
    let pointerY = 0

    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      points.rotation.y += 0.001
      lines.rotation.y += 0.001
      points.rotation.x += 0.00035
      lines.rotation.x += 0.00035
      core.rotation.y -= 0.0008

      camera.position.x += (pointerX * 1.8 - camera.position.x) * 0.03
      camera.position.y += (-pointerY * 1.4 - camera.position.y) * 0.03
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      pointGeometry.dispose()
      lineGeometry.dispose()
      core.geometry.dispose()
      ;(core.material as THREE.Material).dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [disabled])

  if (disabled) {
    return <div className="xp-hero-fallback" aria-hidden="true" />
  }

  return (
    <div ref={containerRef} className="xp-hero-canvas" aria-hidden="true" />
  )
}
