import { Suspense, useEffect, useState, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import pixiePath from './assets/Pixie.glb'
import skyboxPath from './assets/skybox.glb'
import lobbyPath from './assets/world.glb'
import { cameraPosition } from 'three/tsl'
import * as THREE from 'three'
import './App.css'

function Model({ path, ...props }) {
  const gltf = useGLTF(path)
  return <primitive {...props} object={gltf.scene} />
}

function ClickArea({ position, widthPercent, heightPercent, onClick }) {
  const { camera, size } = useThree()

  const distance = camera.position.distanceTo(
    new THREE.Vector3(...position)
  )

  const vFov = THREE.MathUtils.degToRad(camera.fov)

  const height =
    2 * Math.tan(vFov / 2) * distance

  const width =
    height * camera.aspect

  return (
    <mesh
      position={position}
      onClick={onClick}
    >
      <planeGeometry
        args={[
          width * widthPercent,
          height * heightPercent
        ]}
      />

      <meshBasicMaterial
        transparent
        opacity={0}
      />
    </mesh>
  )
}

function Lobby({ scene, setScene })
{
  let GLTFScene = useGLTF(lobbyPath)
  const { camera } = useThree();

  let Player = useGLTF(pixiePath)
  Player.scene.rotation.y = Math.PI;
  Player.scene.position.set(-2,0,-10)

  const cameraDefaultPosition = useRef(new THREE.Vector3());
  const cameraDefaultQuaternion = useRef(new THREE.Quaternion());

  useEffect(() => { 

    if (GLTFScene.cameras && GLTFScene.cameras.length > 0) {
      const loadedCamera = GLTFScene.cameras[0];
      camera.position.copy(loadedCamera.position)
      console.log(loadedCamera.position)
      camera.quaternion.copy(loadedCamera.quaternion)

      cameraDefaultPosition.current.copy(loadedCamera.position);
      cameraDefaultQuaternion.current.copy(loadedCamera.quaternion);

      if (loadedCamera.isPerspectiveCamera && camera.isPerspectiveCamera) {
        camera.fov = loadedCamera.fov
        camera.near = loadedCamera.near
        camera.far = loadedCamera.far
        camera.updateProjectionMatrix()
      }

      camera.updateMatrixWorld()
      console.log("Swapped to Lobby")

      
    }
  }, [GLTFScene, camera]);

  useFrame(() => {
    console.log(scene)
    if (scene === "search")
    {
      camera.position.lerp(Player.scene.position.clone().add(new THREE.Vector3(0, 4, -10)), 0.03);
      camera.lookAt(Player.scene.position.clone().add(new THREE.Vector3(0,3,3)));
    }
    else
    {
      camera.position.lerp(cameraDefaultPosition.current, 0.01);
      camera.quaternion.slerp(cameraDefaultQuaternion.current, 0.01);
    }
  }) 

  return <>
    <primitive object={Player.scene} />
    <primitive object={GLTFScene.scene} />;
  </>
}

function Garden({ setScene })
{
  /*
  //TODO
  let GLTFScene = useGLTF(scenePath)
  const { camera } = useThree();

  useEffect(() => { 

    if (GLTFScene.cameras && GLTFScene.cameras.length > 0) {
      const loadedCamera = GLTFScene.cameras[0];
      camera.position.copy(loadedCamera.position)
      camera.quaternion.copy(loadedCamera.quaternion)

      if (loadedCamera.isPerspectiveCamera && camera.isPerspectiveCamera) {
        camera.fov = loadedCamera.fov
        camera.near = loadedCamera.near
        camera.far = loadedCamera.far
        camera.updateProjectionMatrix()
      }

      camera.updateMatrixWorld()
      console.log("Swapping to Garden")
    }
  }, [GLTFScene, camera]);

  useFrame((state) => {
    let time = state.clock.getElapsedTime()
    let deltaTime = time -= state.clock.oldTime;
  }) 

  return <>
    <ClickArea
          position={[0, 1, -2]}
          size={[2, 2]}
          onClick={() => setScene("search")}
        />
    <primitive object={GLTFScene.scene} />;
  </>
  */
}

function Forest({ setScene })
{
  //TODO
  /*
  let GLTFScene = useGLTF(scenePath)
  const { camera } = useThree();

  useEffect(() => { 

    if (GLTFScene.cameras && GLTFScene.cameras.length > 0) {
      const loadedCamera = GLTFScene.cameras[0];
      camera.position.copy(loadedCamera.position)
      camera.quaternion.copy(loadedCamera.quaternion)

      if (loadedCamera.isPerspectiveCamera && camera.isPerspectiveCamera) {
        camera.fov = loadedCamera.fov
        camera.near = loadedCamera.near
        camera.far = loadedCamera.far
        camera.updateProjectionMatrix()
      }

      camera.updateMatrixWorld()
      console.log("Swapped to Forest")
    }
  }, [GLTFScene, camera]);

  useFrame((state) => {
    let time = state.clock.getElapsedTime()
    let deltaTime = time -= state.clock.oldTime;
  }) 

  return <primitive object={GLTFScene.scene} />;
  */
}

export default function App() {

  const [scene, setScene] = useState("lobby");

  return (

    <div
      style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
      }}>

    <Canvas
        style={{
          width: "100%",
          height: "100%",
        }}
      >

      { (scene === "lobby" || scene === "search") && (
        <Lobby scene={scene} setScene={setScene} />
      )}

      {scene === "garden" && (
        <Garden setScene={setScene} />
      )}

      { (scene === "forest") && (
        <Forest setScene={setScene} />
      )}
      <ambientLight intensity={2}></ambientLight>
    </Canvas>

    {scene === "lobby" && (
        <>
          <button style={{top:"83%", left:"20%"}} className='overlayButton' onClick={() => setScene("garden")}>
            Garden
          </button>
          <button style={{top:"37%", left:"55%"}} className='overlayButton' onClick={() => setScene("search")}>
            Forest
          </button>
        </>
      )}

    

    </div>
  )
}