import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

let scene, camera, renderer, controls;
let model;

let velocity = new THREE.Vector3();
let move = { forward:false, backward:false, left:false, right:false };
let clock = new THREE.Clock();
let canMove = false;

// Blender → Three conversion
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

    // Environment for glass
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
        const damping = 8;

        // Apply damping
        velocity.x -= velocity.x * damping * delta;
        velocity.z -= velocity.z * damping * delta;

        // Build movement direction in LOCAL space
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

        if (move.forward) velocity.add(forward.clone().multiplyScalar(speed * delta));
        if (move.backward) velocity.add(forward.clone().multiplyScalar(-speed * delta));
        if (move.left) velocity.add(right.clone().multiplyScalar(-speed * delta));
        if (move.right) velocity.add(right.clone().multiplyScalar(speed * delta));

        const nextPosition = controls.getObject().position.clone().add(velocity);

        // Collision check
        const moveDir = velocity.clone().normalize();
        const raycaster = new THREE.Raycaster(
            controls.getObject().position,
            moveDir,
            0,
            0.6
        );

        const intersects = raycaster.intersectObject(model, true);

        if (intersects.length === 0) {
            controls.getObject().position.copy(nextPosition);
        }

        // Lock height
        controls.getObject().position.y = SPAWN.y;
    }

    renderer.render(scene, camera);
}
