function loadScene() {

    const loader = new THREE.GLTFLoader();
    loader.load("assets/scene.glb", function (gltf) {
        window.app.scene.add(gltf.scene);
        initPlayer();
        animate();
    });
}