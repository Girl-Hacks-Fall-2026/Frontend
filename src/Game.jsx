import { Suspense, useEffect, useState, useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import pixiePath from './assets/Pixie.glb'
import lobbyPath from './assets/world.glb'
import treePath from './assets/Tree.glb'
import flowerPath from './assets/Flower.glb'
import dummyImage from './dummy.png'
import { cameraPosition } from 'three/tsl'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { supabase } from './lib/supabase'
import './App.css'

const foliagePaths = [treePath, flowerPath]

// Forest layout (posts are measured in screen pixels, foliage follows them)
const POST_WIDTH = 320
const POST_HEIGHT = 420
const POST_GAP = 56
const POST_SPACING = POST_WIDTH + POST_GAP

const FOLIAGE_SPACING_PX = 140   // roughly one piece of foliage per this many scrolled pixels
const FOLIAGE_MARGIN_PX = 3000   // extra foliage before the first and after the last post
const HOP_HEIGHT = 0.6
const HOP_PER_PIXEL = Math.PI / 120 // one hop every ~120px scrolled

const FOREST_CAMERA_POSITION = [0, 2.5, 18]
const FOREST_CAMERA_TARGET = [0, 5, -8]

const DEFAULT_POSTS = [
  { id: 1, user: "mossy_fern", image: dummyImage, text: "Found a clearing full of fireflies behind the old oak." },
  { id: 2, user: "acorn_pip", image: dummyImage, text: "Anyone else hear the stream getting louder after the rain?" },
  { id: 3, user: "bramble", image: dummyImage, text: "Mushroom ring by the south path. Do not step in it." },
  { id: 4, user: "willow_wisp", image: dummyImage, text: "Trading three pinecones for one shiny beetle shell." },
  { id: 5, user: "thistledown", image: dummyImage, text: "The fox is back on the ridge. Stay on the lit trail tonight." },
  { id: 6, user: "hollow_log", image: dummyImage, text: "Moved my nest two branches up. Great view of the sunrise." }
]

function mapDbPost(row) {
  return {
    id: row.post_id,
    user: row.creator_id ? row.creator_id.slice(0, 16) : 'forest_friend',
    image: row.image_url || dummyImage,
    text: row.text || '',
  }
}

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

function Forest({ scrollTarget, postsRef, setScene, posts })
{
  const { camera, size } = useThree();

  const Player = useGLTF(pixiePath)
  const TreeModel = useGLTF(treePath)
  const FlowerModel = useGLTF(flowerPath)
  const foliageModels = useMemo(() => [TreeModel, FlowerModel], [TreeModel, FlowerModel])

  const [foliage, setFoliage] = useState(() => spawnFoliage(foliageModels, (posts.length - 1) * POST_SPACING))

  useEffect(() => {
    setFoliage(spawnFoliage(foliageModels, (posts.length - 1) * POST_SPACING))
  }, [posts.length, foliageModels])

  const scrollCurrent = useRef(0);
  const hopPhase = useRef(0);
  const facing = useRef(Math.PI / 2);

  useEffect(() => { 

    Player.scene.rotation.y = Math.PI / 2;
    Player.scene.position.set(0, -1.8, -10)
    Player.scene.scale.setScalar(1.5)

    camera.position.set(...FOREST_CAMERA_POSITION)
    camera.fov = 45
    camera.near = 0.1
    camera.far = 2000
    camera.updateProjectionMatrix()
    camera.lookAt(...FOREST_CAMERA_TARGET)

    camera.updateMatrixWorld()
    console.log("Swapped to Forest")

  }, [Player, camera]);

  useFrame(() => {

    // Ease towards where the wheel wants to be
    const previous = scrollCurrent.current
    scrollCurrent.current += (scrollTarget.current - previous) * 0.1
    const velocity = scrollCurrent.current - previous

    // Posts are screen overlays, so slide them with the same scroll value
    if (postsRef.current)
    {
      postsRef.current.style.transform = `translateX(${-scrollCurrent.current}px)`
    }

    // World units per screen pixel at the player's depth (same maths as ClickArea)
    const distance = camera.position.distanceTo(Player.scene.position)
    const vFov = THREE.MathUtils.degToRad(camera.fov)
    const worldPerPixel = (2 * Math.tan(vFov / 2) * distance) / size.height

    // Foliage runs left at the same speed as the posts, perspective makes the far ones look slower
    foliage.forEach((item) => {
      item.object.position.set((item.pxX - scrollCurrent.current) * worldPerPixel, 0, item.z)
    })

    // Player hops while the world is moving and turns to face the scroll direction
    const moving = Math.abs(velocity) > 0.05
    if (moving)
    {
      hopPhase.current += Math.abs(velocity) * HOP_PER_PIXEL
      facing.current = velocity > 0 ? Math.PI / 2 : -Math.PI / 2
    }

    const hopY = moving ? Math.abs(Math.sin(hopPhase.current)) * HOP_HEIGHT : 0
    Player.scene.position.y = THREE.MathUtils.lerp(Player.scene.position.y, hopY, 0.3)
    Player.scene.rotation.y = THREE.MathUtils.lerp(Player.scene.rotation.y, facing.current, 0.1)
  }) 

  return <>
    <primitive object={Player.scene} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -15]}>
      <planeGeometry args={[200, 60]} />
      <meshStandardMaterial color="#2f5d3a" />
    </mesh>
    {foliage.map((item, i) => (
      <primitive key={i} object={item.object} />
    ))}
  </>
}

function spawnFoliage(models, totalPx)
{
  const count = Math.ceil((totalPx + FOLIAGE_MARGIN_PX * 2) / FOLIAGE_SPACING_PX)
  const foliage = []

  for (let i = 0; i < count; i++)
  {
    const model = models[Math.floor(Math.random() * models.length)]
    const object = clone(model.scene)
    object.scale.setScalar(0.8 + Math.random() * 0.8)
    object.rotation.y = Math.random() * Math.PI * 2

    foliage.push({
      object,
      // position along the scroll track, in the same pixels as the posts
      pxX: -FOLIAGE_MARGIN_PX + Math.random() * (totalPx + FOLIAGE_MARGIN_PX * 2),
      // depth behind the player, farther trees appear to move slower on their own
      z: -(2 + Math.random() * 26)
    })
  }

  return foliage
}

export default function App() {

  const [scene, setScene] = useState("forest");
  const [posts, setPosts] = useState(DEFAULT_POSTS);

  const scrollTarget = useRef(0);
  const postsRef = useRef(null);

  useEffect(() => {
    if (!supabase) return undefined

    let mounted = true

    async function loadPosts() {
      const { data, error } = await supabase
        .from('Post')
        .select('post_id, creator_id, text, image_url, forest_id, date_created')
        .order('date_created', { ascending: false })

      if (!mounted) return

      if (error) {
        console.error('Unable to load posts from Post table:', error)
        setPosts(DEFAULT_POSTS)
        return
      }

      if (!data || data.length === 0) {
        try {
          let { data: forestData, error: forestError } = await supabase
            .from('Forest')
            .select('forest_id')
            .limit(1)

          if (forestError) throw forestError

          let forestId = forestData?.[0]?.forest_id

          if (forestId == null) {
            const { data: insertedForest, error: createForestError } = await supabase
              .from('Forest')
              .insert({
                forest_name: 'Starter Forest',
                description: 'Seeded community forest',
                date_created: new Date().toISOString(),
              })
              .select('forest_id')
              .maybeSingle()

            if (createForestError) throw createForestError
            forestId = insertedForest?.forest_id
          }

          if (forestId == null) {
            throw new Error('No forest record available for seeded posts.')
          }

          const now = new Date().toISOString()
          const seedRows = DEFAULT_POSTS.map((post) => ({
            forest_id: forestId,
            text: post.text,
            image_url: null,
            date_created: now,
            creator_id: null,
          }))

          const { error: insertError } = await supabase
            .from('Post')
            .insert(seedRows)

          if (insertError) throw insertError

          const { data: seededPosts, error: seededError } = await supabase
            .from('Post')
            .select('post_id, creator_id, text, image_url, forest_id, date_created')
            .order('date_created', { ascending: false })

          if (seededError) throw seededError
          setPosts((seededPosts || []).map(mapDbPost))
          return
        } catch (seedError) {
          console.error('Unable to seed Post table from fallback posts:', seedError)
          setPosts(DEFAULT_POSTS)
          return
        }
      }

      setPosts(data.map(mapDbPost))
    }

    loadPosts()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (scene !== "forest") return

    scrollTarget.current = 0
    const maxScroll = (posts.length - 1) * POST_SPACING

    const onWheel = (e) => {
      scrollTarget.current = THREE.MathUtils.clamp(
        scrollTarget.current + e.deltaY + e.deltaX,
        0,
        maxScroll
      )
    }

    window.addEventListener("wheel", onWheel, { passive: true })
    return () => window.removeEventListener("wheel", onWheel)
  }, [scene, posts.length]);

  return (
    <main className="game-app">

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
        <Forest scrollTarget={scrollTarget} postsRef={postsRef} setScene={setScene} posts={posts} />
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

    {scene === "forest" && (
        <>
          <button style={{top:"4%", left:"3%"}} className='overlayButton' onClick={() => setScene("lobby")}>
            Back
          </button>

          <div
            ref={postsRef}
            style={{
              position: "absolute",
              top: "4%",
              left: 0,
              display: "flex",
              gap: POST_GAP,
              paddingLeft: `calc(50vw - ${POST_WIDTH / 2}px)`,
              pointerEvents: "none",
              willChange: "transform",
            }}>
            {posts.map((post) => (
              <div
                key={post.id}
                className='overlayPost'
                style={{
                  width: POST_WIDTH,
                  height: POST_HEIGHT,
                  flexShrink: 0,
                  boxSizing: "border-box",
                  borderRadius: 14,
                  border: "2px solid #7a5a32",
                  background: "rgba(24, 44, 32, 0.75)",
                  color: "#e4efd9",
                  backdropFilter: "blur(6px)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}>
                <div style={{ height: "58%", background: "#1d2d22", overflow: "hidden" }}>
                  <img
                    src={post.image}
                    alt={post.user}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
                  <strong style={{ display: "block", marginBottom: 8 }}>{post.user}</strong>
                  <p style={{ margin: 0, lineHeight: 1.45 }}>{post.text}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

    </main>
  )
}
