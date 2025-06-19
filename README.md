<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive VR/XR Collaboration Space</title>
    <style>
        body { 
            margin: 0; 
            overflow: hidden; 
            background-color: #111;
        }
        #css-container, #webgl-canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        #css-container {
            /* This allows mouse events to pass through to the WebGL canvas */
            pointer-events: none;
        }
        #css-container > div > div {
            /* This re-enables mouse events for the iframes themselves */
            pointer-events: auto;
        }
        iframe {
            border: 0px;
        }
    </style>
    <!-- Import Map: Tells the browser where to find the 'three' modules -->
    <script type="importmap">
      {
        "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js",
          "three/examples/jsm/controls/OrbitControls.js": "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/controls/OrbitControls.js",
          "three/examples/jsm/renderers/CSS3DRenderer.js": "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/renderers/CSS3DRenderer.js"
        }
      }
    </script>
</head>
<body>

<canvas id="webgl-canvas"></canvas>
<div id="css-container"></div>

<script type="module">
    // Import necessary Three.js components
    import * as THREE from 'three';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
    import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

    let scene, camera, webglRenderer, cssRenderer, controls;
    let raycaster, mouse;
    
    // Interaction state variables
    let selectedObject = null;
    let isDragging = false;
    let isScaling = false;
    const dragPlane = new THREE.Plane();
    const dragOffset = new THREE.Vector3();
    let initialScale;
    let initialScalePoint = new THREE.Vector3();

    // Store objects that can be interacted with
    const interactiveObjects = [];

    // --- Main Functions ---
    init();
    animate();

    function init() {
        // --- Basic Scene Setup ---
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 2.5, 7);

        // --- WebGL Renderer (for the room and handles) ---
        webglRenderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl-canvas'), antialias: true });
        webglRenderer.setSize(window.innerWidth, window.innerHeight);

        // --- CSS3D Renderer (for the iframes) ---
        cssRenderer = new CSS3DRenderer();
        cssRenderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('css-container').appendChild(cssRenderer.domElement);
        
        // --- Orbit Controls ---
        controls = new OrbitControls(camera, webglRenderer.domElement); // Control based on the WebGL canvas
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1;
        controls.maxDistance = 50;
        controls.target.set(0, 2.5, 0);
        controls.update();

        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0x404040, 3);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(0, 5, 5);
        scene.add(directionalLight);

        // --- Room Geometry ---
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide })
        );
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);
        const grid = new THREE.GridHelper(50, 50, 0x555555, 0x555555);
        grid.position.y = 0.01;
        scene.add(grid);

        // --- Create Panels ---
        createInteractivePanel(-4, 2.5, 0, 'https://threejs.org/');
        createInteractivePanel(0, 2.5, -2, 'https://www.google.com/webhp?igu=1&gws_rd=ssl');
        createInteractivePanel(4, 2.5, 0, 'https://get.webgl.org/');

        // --- Raycasting and Event Listeners ---
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        
        webglRenderer.domElement.addEventListener('pointerdown', onPointerDown);
        webglRenderer.domElement.addEventListener('pointermove', onPointerMove);
        webglRenderer.domElement.addEventListener('pointerup', onPointerUp);
    }

    /**
     * Creates a complete interactive panel with iframe, frame, and handles.
     * @param {number} x - Initial X position.
     * @param {number} y - Initial Y position.
     * @param {number} z - Initial Z position.
     * @param {string} url - The URL for the iframe to load.
     */
    function createInteractivePanel(x, y, z, url) {
        const panelGroup = new THREE.Group();
        panelGroup.position.set(x, y, z);
        scene.add(panelGroup);

        // --- Iframe (CSS3DObject) ---
        const iframe = document.createElement('iframe');
        iframe.style.width = '1024px';
        iframe.style.height = '768px';
        iframe.src = url;
        // **FIX:** Add sandbox attribute to prevent top-level navigation
        // This allows scripts, popups, forms, and same-origin content, but blocks
        // the iframe from changing the main window's URL.
        iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups";
        
        const cssObject = new CSS3DObject(iframe);
        cssObject.scale.set(0.005, 0.005, 0.005);
        panelGroup.add(cssObject);
        panelGroup.userData.iframe = iframe; // Store reference

        // --- Frame and Handles (WebGL) ---
        const width = 1024 * 0.005; // Match iframe scale
        const height = 768 * 0.005;
        
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });
        const frameGeometry = new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.05);
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = -0.03;
        panelGroup.add(frame);

        // Move Handle
        const moveHandleGeometry = new THREE.BoxGeometry(width * 0.8, 0.2, 0.1);
        const moveHandleMaterial = new THREE.MeshStandardMaterial({ color: 0x007bff, emissive: 0x0033ff, roughness: 0.2 });
        const moveHandle = new THREE.Mesh(moveHandleGeometry, moveHandleMaterial);
        moveHandle.position.y = -height / 2 - 0.1;
        moveHandle.name = 'moveHandle';
        moveHandle.userData.panel = panelGroup;
        panelGroup.add(moveHandle);
        interactiveObjects.push(moveHandle);

        // Scale Handle
        const scaleHandleGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const scaleHandleMaterial = new THREE.MeshStandardMaterial({ color: 0x28a745, emissive: 0x11aa33, roughness: 0.2 });
        const scaleHandle = new THREE.Mesh(scaleHandleGeometry, scaleHandleMaterial);
        scaleHandle.position.set(width / 2, -height / 2, 0);
        scaleHandle.name = 'scaleHandle';
        scaleHandle.userData.panel = panelGroup;
        panelGroup.add(scaleHandle);
        interactiveObjects.push(scaleHandle);
    }

    // --- Event Handlers for Interaction ---

    function onPointerDown(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactiveObjects);

        if (intersects.length > 0) {
            controls.enabled = false;
            selectedObject = intersects[0].object;
            const panel = selectedObject.userData.panel;
            
            // Set up a plane to drag along
            const normal = camera.getWorldDirection(new THREE.Vector3());
            dragPlane.setFromNormalAndCoplanarPoint(normal, intersects[0].point);

            if (selectedObject.name === 'moveHandle') {
                isDragging = true;
                // Calculate offset from panel center to intersection point
                dragOffset.copy(intersects[0].point).sub(panel.position);
            } else if (selectedObject.name === 'scaleHandle') {
                isScaling = true;
                initialScale = panel.scale.clone();
                // Store initial intersection point to calculate scale delta
                initialScalePoint.copy(intersects[0].point);
            }
        }
    }

    function onPointerMove(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (isDragging) {
            raycaster.setFromCamera(mouse, camera);
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragPlane, intersection);
            
            const panel = selectedObject.userData.panel;
            panel.position.copy(intersection).sub(dragOffset);

        } else if (isScaling) {
            raycaster.setFromCamera(mouse, camera);
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragPlane, intersection);

            const panel = selectedObject.userData.panel;
            const initialDist = panel.position.distanceTo(initialScalePoint);
            const currentDist = panel.position.distanceTo(intersection);

            if (initialDist > 0) {
                const scaleFactor = currentDist / initialDist;
                panel.scale.copy(initialScale).multiplyScalar(scaleFactor);
                
                // Update iframe pixels to maintain quality
                panel.userData.iframe.style.width = `${1024 * panel.scale.x}px`;
                panel.userData.iframe.style.height = `${768 * panel.scale.y}px`;
            }
        }
    }

    function onPointerUp() {
        controls.enabled = true;
        isDragging = false;
        isScaling = false;
        selectedObject = null;
    }

    // --- Render Loop ---
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        webglRenderer.render(scene, camera);
        cssRenderer.render(scene, camera);
    }
</script>

</body>
</html>
```
Please be aware that some websites, like Google, have strict security policies (`X-Frame-Options`) that may prevent them from loading inside an iframe at all, regardless of the sandbox settings. This is a limitation set by the website owners, not the code itse
