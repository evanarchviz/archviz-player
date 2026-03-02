import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js";
import { PointerLockControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js";

const isMobile = /Mobi|Android/i.test(navigator.userAgent);

let scene, camera, renderer, controls;
let model;
let canMove = false;

init();

function init() {

    const startScreen = document.getElementById("startScreen");
    const controlsText = document.getElementById("controlsText");

    controlsText.innerText = isMobile
        ? "Tap to Start • Drag to Look"
        : "Click to Start • WASD to Move";

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        5000
    );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);

    // HDR
    const pmrem = new THREE.PMREMGenerator(renderer);

    new RGBELoader()
        .setPath("./assets/")
        .load("fouriesburg_mountain_midday_2k.hdr", (hdr) => {

            hdr.mapping = THREE.EquirectangularReflectionMapping;
            hdr.center.set(0.5, 0.5);
            hdr.rotation = Math.PI / 2;

            scene.environment = pmrem.fromEquirectangular(hdr).texture;
            scene.background = hdr;

            pmrem.dispose();
        });

    // GLB (NO Meshopt)
    const loader = new GLTFLoader();

    loader.load(
        "./assets/scene.glb",
        (gltf) => {

            model = gltf.scene;

            model.traverse((child) => {
                if (child.isMesh && child.material?.name === "M_Glass_Darker") {
                    child.material = new THREE.MeshPhysicalMaterial({
                        color: 0xffffff,
                        transmission: 1,
                        thickness: 0,
                        transparent: true,
                        depthWrite: false
                    });
                }
            });

            scene.add(model);

            console.log("GLB Loaded");

            startScreen.addEventListener("click", () => {

                startScreen.style.display = "none";

                if (!isMobile) {
                    controls = new PointerLockControls(camera, document.body);
                    controls.lock();
                    scene.add(controls.getObject());
                }

                canMove = true;
            });
        },
        undefined,
        (error) => {
            console.error("GLB Load Error:", error);
        }
    );

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
