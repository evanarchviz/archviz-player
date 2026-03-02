import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

let scene, camera, renderer, controls;
let model;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let move = { forward:false, backward:false, left:false, right:false };
let clock = new THREE.Clock();
let canMove = false;

// Blender spawn converted to Three.js
// Blender:
// X = -8.7799
// Y = -12.5123
// Z = 6.67481
//
// Three:
// X = Blender X
// Y = Blender Z
// Z = -Blender Y

const SPAWN = new THREE.Vector3(
    -8.7799,
    6.67481,
    12.5123
);

init();

async function init(){

    const container = document.getElementById("container");
    const startScreen = document.getElementById("startScreen");

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        5000
    );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // HDRI for glass reflections
    new RGBELoader()
        .load("https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr", function(texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = texture;
        });

    await MeshoptDecoder.ready;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load("./assets/scene.glb", function(gltf){

        model = gltf.scene;
        scene.add(model);

        camera.position.copy(SPAWN);
    });

    controls = new PointerLockControls(camera, document.body);

    startScreen.addEventListener("click", () => {
        controls.lock();
    });

    controls.addEventListener("lock", () => {
        startScreen.style.display = "none";
        canMove = true;
    });

    controls.addEventListener("unlock", () => {
        startScreen.style.display = "flex";
        canMove = false;
    });

    scene.add(controls.getObject());

    document.addEventListener("keydown", (e) => {
        if (e.code === "KeyW") move.forward = true;
        if (e.code === "KeyS") move.backward = true;
        if (e.code === "KeyA") move.left = true;
        if (e.code === "KeyD") move.right = true;
    });

    document.addEventListener("keyup", (e) => {
        if (e.code === "KeyW") move.forward = false;
        if (e.code === "KeyS") move.backward = false;
        if (e.code === "KeyA") move.left = false;
        if (e.code === "KeyD") move.right = false;
    });

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function animate(){
    requestAnimationFrame(animate);

    if (canMove && model) {

        const delta = clock.getDelta();
        const speed = 14;
        const damping = 6;

        direction.z = Number(move.forward) - Number(move.backward);
        direction.x = Number(move.right) - Number(move.left);
        direction.normalize();

        velocity.x -= velocity.x * damping * delta;
        velocity.z -= velocity.z * damping * delta;

        velocity.z -= direction.z * speed * delta;
        velocity.x -= direction.x * speed * delta;

        const moveVector = new THREE.Vector3(
            -velocity.x * delta,
            0,
            -velocity.z * delta
        );

        const player = controls.getObject();

        // Wall collision raycast
        const raycaster = new THREE.Raycaster(
            player.position,
            moveVector.clone().normalize(),
            0,
            0.6
        );

        const intersects = raycaster.intersectObject(model, true);

        if (intersects.length === 0) {
            player.position.add(moveVector);
        }

        // Lock height to upper floor eye level
        player.position.y = SPAWN.y;
    }

    renderer.render(scene, camera);
}
