import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

let scene, camera, renderer, composer;
let model;
let clock = new THREE.Clock();

let move = { forward:false, backward:false, left:false, right:false };
let canMove = false;
let isMobile = false;

let yawObject;
let pitchObject;

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

async function init(){

    isMobile = detectMobile();

    const container = document.getElementById("container");
    const startScreen = document.getElementById("startScreen");

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,      // improved depth precision
        400
    );

    renderer = new THREE.WebGLRenderer({ antialias:false }); // FXAA replaces MSAA
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // --------- POST PROCESSING ---------
    composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const fxaaPass = new ShaderPass(FXAAShader);

    const pixelRatio = renderer.getPixelRatio();
    fxaaPass.material.uniforms["resolution"].value.x =
        1 / (window.innerWidth * pixelRatio);
    fxaaPass.material.uniforms["resolution"].value.y =
        1 / (window.innerHeight * pixelRatio);

    composer.addPass(fxaaPass);
    // -----------------------------------

    window.addEventListener("resize", () => {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);

        const pixelRatio = renderer.getPixelRatio();
        fxaaPass.material.uniforms["resolution"].value.x =
            1 / (window.innerWidth * pixelRatio);
        fxaaPass.material.uniforms["resolution"].value.y =
            1 / (window.innerHeight * pixelRatio);
    });

    // FPS hierarchy
    yawObject = new THREE.Object3D();
    pitchObject = new THREE.Object3D();

    yawObject.add(pitchObject);
    pitchObject.add(camera);
    scene.add(yawObject);

    yawObject.position.copy(SPAWN);

    // HDR background only (no lighting)
    const rgbeLoader = new RGBELoader();
    rgbeLoader.setPath("./assets/");
    rgbeLoader.load("fouriesburg_mountain_midday_2k.hdr", (hdrTexture) => {
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = hdrTexture;
    });

    await MeshoptDecoder.ready;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load("./assets/scene.glb", (gltf) => {
        model = gltf.scene;
        scene.add(model);
        playerBaseY = SPAWN.y - playerHeight;
    });

    const controls = new PointerLockControls(camera, document.body);

    if (!isMobile) {
        startScreen.addEventListener("click", () => controls.lock());
    } else {
        startScreen.addEventListener("click", async () => {
            startScreen.style.display = "none";
            canMove = true;

            if (document.documentElement.requestFullscreen) {
                try { await document.documentElement.requestFullscreen(); } catch(e){}
            }

            setupMobileControls();
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

    animate();
}

function setupMobileControls() {
    // keep your working dual-touch system here unchanged
}

function animate(){
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (canMove && model){

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

        const proposed = yawObject.position.clone().add(movement);

        if (movement.length() > 0){
            const midHeight = playerBaseY + playerHeight * 0.5;

            const ray = new THREE.Raycaster(
                new THREE.Vector3(
                    yawObject.position.x,
                    midHeight,
                    yawObject.position.z
                ),
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
            new THREE.Vector3(
                yawObject.position.x,
                playerBaseY + stepHeight,
                yawObject.position.z
            ),
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

    composer.render();
}
