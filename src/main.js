import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import {
    computeBoundsTree,
    disposeBoundsTree,
    acceleratedRaycast
} from "three-mesh-bvh";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let scene, camera, renderer, controls;
let worldCollider;

let clock = new THREE.Clock();
let canMove = false;
let move = { forward:false, backward:false, left:false, right:false };

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

const playerHeight = 1.7;
const playerRadius = 0.35;
const speed = 6;

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

        const model = gltf.scene;
        scene.add(model);

        const geometries = [];

        model.updateMatrixWorld(true);

        model.traverse(child => {
            if (child.isMesh) {
                const geo = child.geometry.clone();
                geo.applyMatrix4(child.matrixWorld);
                geometries.push(geo);
            }
        });

        const merged = mergeGeometries(geometries, false);
        merged.computeBoundsTree();

        worldCollider = new THREE.Mesh(merged);
        worldCollider.visible = false;
        scene.add(worldCollider);

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

    if (canMove && worldCollider){

        const player = controls.getObject();

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

        playerDirection.set(0,0,0);

        if (move.forward) playerDirection.add(forward);
        if (move.backward) playerDirection.addScaledVector(forward, -1);
        if (move.left) playerDirection.addScaledVector(right, -1);
        if (move.right) playerDirection.add(right);

        playerDirection.normalize();
        playerVelocity.copy(playerDirection).multiplyScalar(speed);

        player.position.addScaledVector(playerVelocity, delta);

        const capsuleStart = player.position.clone();
        const capsuleEnd = player.position.clone().add(new THREE.Vector3(0, playerHeight, 0));
        const capsule = new THREE.Line3(capsuleStart, capsuleEnd);

        worldCollider.geometry.boundsTree.shapecast({

            intersectsBounds: box => true,

            intersectsTriangle: tri => {

                const triPoint = new THREE.Vector3();
                const capsulePoint = new THREE.Vector3();

                const dist = tri.closestPointToSegment(capsule, triPoint, capsulePoint);

                if (dist < playerRadius){

                    const depth = playerRadius - dist;
                    const direction = capsulePoint.sub(triPoint).normalize();

                    player.position.addScaledVector(direction, depth);
                }
            }
        });
    }

    renderer.render(scene, camera);
}
