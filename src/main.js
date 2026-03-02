import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

let scene, camera, renderer, controls;
let model;

let clock = new THREE.Clock();
let move = { forward:false, backward:false, left:false, right:false };
let canMove = false;

const playerHeight = 1.7;
const playerRadius = 0.35;
const speed = 4.5;
const stepHeight = 0.2;

let playerBaseY = 0;

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

    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.physicallyCorrectLights = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // ---------- HDR ----------
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    new RGBELoader()
        .setPath("./assets/")
        .load("fouriesburg_mountain_midday_2k.hdr", (hdrTexture) => {

            hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

            // Rotate HDR 90°
            hdrTexture.center.set(0.5, 0.5);
            hdrTexture.rotation = Math.PI / 2;

            const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

            scene.environment = envMap;
            scene.background = hdrTexture;

            pmremGenerator.dispose();
        });

    // -------------------------

    await MeshoptDecoder.ready;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load("./assets/scene.glb", (gltf) => {

        model = gltf.scene;

        model.traverse((child) => {

            if (child.isMesh && child.material && child.material.name === "M_Glass_Darker") {

                // Thin surface glass (real-time correct)
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0xffffff,
                    metalness: 0,
                    roughness: 0.02,
                    transmission: 1.0,
                    thickness: 0.0,         // CRITICAL
                    ior: 1.45,
                    transparent: true,
                    opacity: 1.0,
                    depthWrite: false,      // CRITICAL
                    side: THREE.FrontSide,  // prevent double accumulation
                    envMapIntensity: 1.0
                });
            }
        });

        scene.add(model);

        playerBaseY = SPAWN.y - playerHeight;
        camera.position.copy(SPAWN);
    });

    controls = new PointerLockControls(camera, document.body);

    startScreen.addEventListener("click", () => controls.lock());

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

    animate();
}

function animate(){

    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (canMove && model){

        const player = controls.getObject();

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

        const movement = new THREE.Vector3();

        if (move.forward) movement.add(forward);
        if (move.backward) movement.addScaledVector(forward, -1);
        if (move.left) movement.addScaledVector(right, -1);
        if (move.right) movement.add(right);

        if (movement.length() > 0){
            movement.normalize();
            movement.multiplyScalar(speed * delta);
        }

        const proposed = player.position.clone().add(movement);

        if (movement.length() > 0){

            const midHeight = playerBaseY + playerHeight * 0.5;

            const ray = new THREE.Raycaster(
                new THREE.Vector3(player.position.x, midHeight, player.position.z),
                movement.clone().normalize(),
                0,
                playerRadius
            );

            const hits = ray.intersectObject(model, true);

            if (hits.length === 0){
                player.position.copy(proposed);
            }
        }

        const footRay = new THREE.Raycaster(
            new THREE.Vector3(player.position.x, playerBaseY + stepHeight, player.position.z),
            new THREE.Vector3(0,-1,0),
            0,
            stepHeight + 0.5
        );

        const groundHits = footRay.intersectObject(model, true);

        if (groundHits.length > 0){
            playerBaseY = groundHits[0].point.y;
        }

        player.position.y = playerBaseY + playerHeight;
    }

    renderer.render(scene, camera);
}
