import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import lobbyPath from './assets/world.glb'
import pixiePath from './assets/Pixie.glb'
import './Game.css'

function Lobby({ scene }) {
  const gltfScene = useGLTF(lobbyPath)
  const player = useGLTF(pixiePath)
  const { camera } = useThree()
  const defaultPosition = useRef(new THREE.Vector3())
  const defaultQuaternion = useRef(new THREE.Quaternion())

  useEffect(() => {
    const loadedCamera = gltfScene.cameras?.[0]
    if (!loadedCamera) return

    // Three.js cameras are mutable scene objects managed imperatively by R3F.
    // oxlint-disable react/immutability
    camera.position.copy(loadedCamera.position)
    camera.quaternion.copy(loadedCamera.quaternion)
    defaultPosition.current.copy(loadedCamera.position)
    defaultQuaternion.current.copy(loadedCamera.quaternion)

    if (loadedCamera.isPerspectiveCamera && camera.isPerspectiveCamera) {
      camera.fov = loadedCamera.fov
      camera.near = loadedCamera.near
      camera.far = loadedCamera.far
      camera.updateProjectionMatrix()
    }

    camera.updateMatrixWorld()
    // oxlint-enable react/immutability
  }, [camera, gltfScene])

  useFrame(() => {
    if (scene === 'search') {
      camera.position.lerp(
        player.scene.position.clone().add(new THREE.Vector3(0, 4, -10)),
        0.01,
      )
      camera.lookAt(player.scene.position.clone().add(new THREE.Vector3(0, 3, 3)))
    } else {
      camera.position.lerp(defaultPosition.current, 0.01)
      camera.quaternion.slerp(defaultQuaternion.current, 0.01)
    }
  })

  return (
    <>
      <primitive object={player.scene} rotation-y={Math.PI} position={[-2, 0, -10]} />
      <primitive object={gltfScene.scene} />
    </>
  )
}

function Garden() {
  return null
}

function Forest() {
  return null
}

export default function Game() {
  const scene = 'lobby'

  return (
    <main className="game-app">
      <Canvas>
        <Suspense fallback={null}>
          {(scene === 'lobby' || scene === 'search') && <Lobby scene={scene} />}
          {scene === 'garden' && <Garden />}
          {scene === 'forest' && <Forest />}
        </Suspense>
        <ambientLight intensity={1.5} />
      </Canvas>
    </main>
  )
}
