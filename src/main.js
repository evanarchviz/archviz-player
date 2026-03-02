import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { PointerLockControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js";
import { MeshoptDecoder } from "https://unpkg.com/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js";
import { RGBELoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js";

let scene, camera, renderer, controls;
let model;
let clock = new THREE.Clock();
let move = { forward:false, backward:false, left:false, right:false };
let canMove = false;

let isMobile = false;

let yawObject;
let pitchObject;

let rotateScreen;

const playerHeight = 1.7;
const playerRadius = 0.35;
const speed = 4.5;
const stepHeight = 0.2;
let playerBaseY = 0;

const SPAWN = new THREE.Vector3(-8.7799, 6.67481, 12.5123);

init();

function detectMobile() {
    return (
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
    );
}

function checkOrientation() {
    if (!isMobile) return;

    if (window.innerHeight > window.innerWidth) {
        rotateScreen.style.display = "flex";
        canMove = false;
    } else {
        rotateScreen.style.display = "none";
        canMove = true;
    }
}

async function init(){

    isMobile = detectMobile();

    const container = document.getElementById("container");
    const startScreen = document.getElementById("startScreen");
    rotateScreen = document.getElementById("rotateScreen");

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);

    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.physicallyCorrectLights = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        checkOrientation();
    });

    window.addEventListener("orientationchange", checkOrientation);

    // FPS hierarchy
    yawObject = new THREE.Object3D();
    pitchObject = new THREE.Object3D();
    yawObject.add(pitchObject);
    pitchObject.add(camera);
    scene.add(yawObject);

    yawObject.position.copy(SPAWN);

    // HDR
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    new RGBELoader()
        .setPath("./assets/")
        .load("fouriesburg_mountain_midday_2k.hdr", (hdrTexture) => {
            hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
            hdrTexture.center.set(0.5, 0.5);
            hdrTexture.rotation = Math.PI / 2;

            const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
            scene.environment = envMap;
            scene.background = hdrTexture;

            pmremGenerator.dispose();
        });

    await MeshoptDecoder.ready;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load("./assets/scene.glb", (gltf) => {
        model = gltf.scene;

        model.traverse((child) => {
            if (child.isMesh && child.material && child.material.name === "M_Glass_Darker") {
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0xffffff,
                    metalness: 0,
                    roughness: 0.02,
                    transmission: 1.0,
                    thickness: 0.0,
                    ior: 1.45,
                    transparent: true,
                    opacity: 1.0,
                    depthWrite: false,
                    side: THREE.FrontSide,
                    envMapIntensity: 1.0
                });
            }
        });

        scene.add(model);
        playerBaseY = SPAWN.y - playerHeight;
    });

    controls = new PointerLockControls(camera, document.body);

    if (!isMobile) {
        startScreen.addEventListener("click", () => controls.lock());
    } else {
        startScreen.addEventListener("click", async () => {
            startScreen.style.display = "none";

            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }

            if (screen.orientation && screen.orientation.lock) {
                try {
                    await screen.orientation.lock("landscape");
                } catch (e) {}
            }

            setupMobileControls();
            canMove = true;
            checkOrientation();
        });
    }

    controls.addEventListener("lock", () => {
        startScreen.style.display = "none";
        canMove = true;
    });

    controls.addEventListener("unlock", () => {
        if (!isMobile) {
            startScreen.style.display = "flex";
            canMove = false;
        }
    });

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

    checkOrientation();
    animate();
}

function setupMobileControls() {

    const joystick = document.createElement("div");
    joystick.className = "joystick";
    document.body.appendChild(joystick);

    const stick = document.createElement("div");
    stick.className = "stick";
    joystick.appendChild(stick);

    let active = false;
    let centerX, centerY;

    joystick.addEventListener("touchstart", (e) => {
        active = true;
        const rect = joystick.getBoundingClientRect();
        centerX = rect.left + rect.width/2;
        centerY = rect.top + rect.height/2;
    });

    joystick.addEventListener("touchmove", (e) => {
        if (!active) return;
        const touch = e.touches[0];

        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;

        const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 40);
        const angle = Math.atan2(dy, dx);

        stick.style.transform =
            `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;

        move.forward = dy < -10;
        move.backward = dy > 10;
        move.left = dx < -10;
        move.right = dx > 10;
    });

    joystick.addEventListener("touchend", () => {
        active = false;
        stick.style.transform = "translate(0,0)";
        move.forward = move.backward = move.left = move.right = false;
    });

    let lastX = 0, lastY = 0;
    let pitch = 0;

    document.addEventListener("touchstart", (e) => {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    });

    document.addEventListener("touchmove", (e) => {
        const deltaX = e.touches[0].clientX - lastX;
        const deltaY = e.touches[0].clientY - lastY;

        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;

        yawObject.rotation.y -= deltaX * 0.002;

        pitch -= deltaY * 0.002;
        pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
        pitchObject.rotation.x = pitch;
    });
}

function animate(){
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (canMove && model){

        const forward = new THREE.Vector3();
        pitchObject.getWorldDirection(forward);
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

        const proposed = yawObject.position.clone().add(movement);

        if (movement.length() > 0){
            const midHeight = playerBaseY + playerHeight * 0.5;
            const ray = new THREE.Raycaster(
                new THREE.Vector3(yawObject.position.x, midHeight, yawObject.position.z),
                movement.clone().normalize(),
                0,
                playerRadius
            );

            const hits = ray.intersectObject(model, true);
            if (hits.length === 0){
                yawObject.position.copy(proposed);
            }
        }

        const footRay = new THREE.Raycaster(
            new THREE.Vector3(yawObject.position.x, playerBaseY + stepHeight, yawObject.position.z),
            new THREE.Vector3(0,-1,0),
            0,
            stepHeight + 0.5
        );

        const groundHits = footRay.intersectObject(model, true);
        if (groundHits.length > 0){
            playerBaseY = groundHits[0].point.y;
        }

        yawObject.position.y = playerBaseY + playerHeight;
    }

    renderer.render(scene, camera);
}
