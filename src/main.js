import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

let scene, camera, renderer, controls;
let model;

let clock = new THREE.Clock();
let move = { forward:false, backward:false, left:false, right:false };
let canMove = false;

let touchLook = { active:false, lastX:0, lastY:0 };
let joystick = { active:false, startX:0, startY:0, dx:0, dy:0 };

const playerHeight = 1.7;
const speed = 4;
const stepHeight = 0.2;
let playerBaseY = 0;

const SPAWN = new THREE.Vector3(-8.77, 6.67, 12.51);

init();

async function init(){

    const startScreen = document.getElementById("startScreen");
    const controlsText = document.getElementById("controlsText");

    if (isMobile) {
        controlsText.innerText =
            "Left side = Move • Right side = Look";
    } else {
        controlsText.innerText =
            "WASD to move • Mouse to look • ESC to unlock";
    }

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth/window.innerHeight,
        0.1,
        5000
    );

    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
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

    await MeshoptDecoder.ready;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load("./assets/scene.glb", (gltf) => {

        model = gltf.scene;

        model.traverse((child) => {
            if (child.isMesh && child.material?.name === "M_Glass_Darker") {
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0xffffff,
                    metalness: 0,
                    roughness: 0.02,
                    transmission: 1,
                    thickness: 0,
                    ior: 1.45,
                    transparent: true,
                    depthWrite: false,
                    side: THREE.FrontSide
                });
            }
        });

        scene.add(model);

        playerBaseY = SPAWN.y - playerHeight;
        camera.position.copy(SPAWN);
    });

    if (!isMobile) {

        controls = new PointerLockControls(camera, document.body);
        scene.add(controls.getObject());

        startScreen.addEventListener("click", () => controls.lock());

        controls.addEventListener("lock", () => {
            startScreen.style.display = "none";
            canMove = true;
        });

        controls.addEventListener("unlock", () => {
            startScreen.style.display = "flex";
            canMove = false;
        });

        document.addEventListener("keydown", e=>{
            if(e.code==="KeyW") move.forward=true;
            if(e.code==="KeyS") move.backward=true;
            if(e.code==="KeyA") move.left=true;
            if(e.code==="KeyD") move.right=true;
        });

        document.addEventListener("keyup", e=>{
            if(e.code==="KeyW") move.forward=false;
            if(e.code==="KeyS") move.backward=false;
            if(e.code==="KeyA") move.left=false;
            if(e.code==="KeyD") move.right=false;
        });

    } else {

        startScreen.addEventListener("click", () => {
            startScreen.style.display = "none";
            canMove = true;
        });

        setupMobileControls();
    }

    animate();
}

function setupMobileControls(){

    renderer.domElement.addEventListener("touchstart", e=>{
        if(e.touches[0].clientX < window.innerWidth/2){
            joystick.active=true;
            joystick.startX=e.touches[0].clientX;
            joystick.startY=e.touches[0].clientY;
        } else {
            touchLook.active=true;
            touchLook.lastX=e.touches[0].clientX;
            touchLook.lastY=e.touches[0].clientY;
        }
    });

    renderer.domElement.addEventListener("touchmove", e=>{
        if(joystick.active){
            joystick.dx = e.touches[0].clientX - joystick.startX;
            joystick.dy = e.touches[0].clientY - joystick.startY;
        }

        if(touchLook.active){
            const dx = e.touches[0].clientX - touchLook.lastX;
            const dy = e.touches[0].clientY - touchLook.lastY;

            camera.rotation.y -= dx * 0.003;
            camera.rotation.x -= dy * 0.003;
            camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));

            touchLook.lastX = e.touches[0].clientX;
            touchLook.lastY = e.touches[0].clientY;
        }
    });

    renderer.domElement.addEventListener("touchend", ()=>{
        joystick.active=false;
        touchLook.active=false;
        joystick.dx=0;
        joystick.dy=0;
    });
}

function animate(){
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if(canMove && model){

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y=0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

        const movement = new THREE.Vector3();

        if(!isMobile){
            if(move.forward) movement.add(forward);
            if(move.backward) movement.addScaledVector(forward,-1);
            if(move.left) movement.addScaledVector(right,-1);
            if(move.right) movement.add(right);
        } else {
            movement.addScaledVector(forward, -joystick.dy*0.01);
            movement.addScaledVector(right, joystick.dx*0.01);
        }

        if(movement.length()>0){
            movement.normalize();
            movement.multiplyScalar(speed*delta);
        }

        camera.position.add(movement);

        const footRay = new THREE.Raycaster(
            new THREE.Vector3(camera.position.x, playerBaseY+stepHeight, camera.position.z),
            new THREE.Vector3(0,-1,0),
            0,
            stepHeight+0.5
        );

        const hits = footRay.intersectObject(model,true);
        if(hits.length>0){
            playerBaseY = hits[0].point.y;
        }

        camera.position.y = playerBaseY + playerHeight;
    }

    renderer.render(scene,camera);
}
