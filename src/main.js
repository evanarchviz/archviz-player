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
const speed = 5;
const stepHeight = 0.4;

const velocity = new THREE.Vector3();

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
        window.innerWidth/window.innerHeight,
        0.1,
        5000
    );

    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    new RGBELoader().load(
        "https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr",
        tex => {
            tex.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = tex;
        }
    );

    await MeshoptDecoder.ready;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load("./assets/scene.glb", gltf => {
        model = gltf.scene;
        scene.add(model);
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

    document.addEventListener("keydown", e => {
        if (e.code === "KeyW") move.forward = true;
        if (e.code === "KeyS") move.backward = true;
        if (e.code === "KeyA") move.left = true;
        if (e.code === "KeyD") move.right = true;
    });

    document.addEventListener("keyup", e => {
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

        // Direction vectors
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

        velocity.set(0,0,0);

        if (move.forward) velocity.add(forward);
        if (move.backward) velocity.addScaledVector(forward,-1);
        if (move.left) velocity.addScaledVector(right,-1);
        if (move.right) velocity.add(right);

        velocity.normalize();
        velocity.multiplyScalar(speed * delta);

        const nextPosition = player.position.clone().add(velocity);

        // Horizontal collision ray
        if (velocity.length() > 0.0001){

            const ray = new THREE.Raycaster(
                player.position.clone().add(new THREE.Vector3(0, playerHeight * 0.5, 0)),
                velocity.clone().normalize(),
                0,
                playerRadius
            );

            const hits = ray.intersectObject(model, true);

            if (hits.length === 0){
                player.position.copy(nextPosition);
            }
        }

        // Ground ray for stairs + floor
        const downRay = new THREE.Raycaster(
            player.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
            new THREE.Vector3(0,-1,0),
            0,
            playerHeight + stepHeight
        );

        const groundHits = downRay.intersectObject(model, true);

        if (groundHits.length > 0){
            player.position.y = groundHits[0].point.y;
        }
    }

    renderer.render(scene, camera);
}
