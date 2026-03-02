let controls;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let move = { forward: false, backward: false, left: false, right: false };
let clock = new THREE.Clock();
let canMove = false;

function initPlayer() {

    const { scene, camera } = window.app;
    const startScreen = document.getElementById("startScreen");

    camera.position.set(0, 1.7, 5);

    controls = new THREE.PointerLockControls(camera, document.body);

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
        const { camera, renderer } = window.app;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);

    const { renderer, scene, camera } = window.app;

    if (canMove) {
        const delta = clock.getDelta();
        const speed = 6;

        direction.z = Number(move.forward) - Number(move.backward);
        direction.x = Number(move.right) - Number(move.left);
        direction.normalize();

        velocity.x -= velocity.x * 8 * delta;
        velocity.z -= velocity.z * 8 * delta;

        velocity.z -= direction.z * speed * delta;
        velocity.x -= direction.x * speed * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
    }

    renderer.render(scene, camera);
}