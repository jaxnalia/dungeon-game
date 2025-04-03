import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { Player } from './Player';
import { UI } from './UI';
import { DungeonGenerator } from './DungeonGenerator';
import { io, Socket } from 'socket.io-client';

export class GameScene {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    player: Player;
    otherPlayers: Map<string, THREE.Mesh> = new Map();
    walls: THREE.Mesh[] = [];
    ui: UI;
    keys: { [key: string]: boolean } = {};
    mouseDown: boolean = false;
    isMenuOpen: boolean = false;
    isInventoryOpen: boolean = false;
    cameraVerticalAngle: number = 0;
    cameraHorizontalAngle: number = 0;
    cameraDistance: number = 5;
    minCameraDistance: number = 2;
    maxCameraDistance: number = 10;
    trackingPoint: THREE.Vector3;
    dungeonGenerator: DungeonGenerator;
    lastTime: number = 0;
    cameraRotationSpeed: number = 2.0;
    cameraZoomSpeed: number = 5.0;
    cameraMinVerticalAngle: number = -Math.PI / 3;
    cameraMaxVerticalAngle: number = Math.PI / 3;
    socket: Socket;

    constructor(container: HTMLElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 4);
        this.camera.lookAt(0, 0, 0);

        this.trackingPoint = new THREE.Vector3(0, 1, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Initialize camera tracking points
        this.trackingPoint = new THREE.Vector3();

        // Setup post-processing
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Add SSAO
        const ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
        ssaoPass.kernelRadius = 16;
        ssaoPass.maxDistance = 50;
        ssaoPass.minDistance = 0.1;
        this.composer.addPass(ssaoPass);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        // Add main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 2);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -20;
        mainLight.shadow.camera.right = 20;
        mainLight.shadow.camera.top = 20;
        mainLight.shadow.camera.bottom = -20;
        mainLight.shadow.bias = -0.0001;
        this.scene.add(mainLight);

        // Secondary directional light (fill light)
        const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        // Add a third light for additional fill
        const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
        backLight.position.set(0, 5, -10);
        this.scene.add(backLight);

        // Generate dungeon
        this.dungeonGenerator = new DungeonGenerator();
        this.walls = this.dungeonGenerator.getWalls();
        this.walls.forEach(wall => this.scene.add(wall));

        // Add room lights
        const roomLights = this.dungeonGenerator.getLights();
        roomLights.forEach(light => this.scene.add(light));

        // Add player in the center of the first room
        this.player = new Player();
        if (this.dungeonGenerator.rooms.length > 0) {
            const firstRoom = this.dungeonGenerator.rooms[0];
            this.player.mesh.position.set(
                firstRoom.x + firstRoom.size/2,
                2,
                firstRoom.z + firstRoom.size/2
            );
            this.player.mesh.rotation.y = 0;
        }
        this.scene.add(this.player.mesh);

        // Add UI
        this.ui = new UI(container);

        // Connect to server
        this.socket = io();
        
        // Handle server messages
        this.socket.on('gameState', (data) => {
            // Update other players
            this.updateOtherPlayers(data.players);
        });

        this.socket.on('playerDisconnected', (playerId) => {
            this.removePlayer(playerId);
        });

        // Setup controls
        this.setupControls();

        // Start animation loop
        this.animate();
    }

    setupControls() {
        // Mouse movement for camera rotation
        document.addEventListener('mousemove', (event) => {
            if (this.mouseDown && !this.isMenuOpen && !this.isInventoryOpen) {
                // Only rotate camera horizontally when right-clicking
                if (event.button === 2) {
                    // Update camera rotation with higher sensitivity
                    this.cameraHorizontalAngle -= event.movementX * 0.02;
                } else {
                    // Regular camera rotation without affecting player
                    this.cameraHorizontalAngle -= event.movementX * 0.01;
                    this.cameraVerticalAngle = Math.max(
                        this.cameraMinVerticalAngle,
                        Math.min(
                            this.cameraMaxVerticalAngle,
                            this.cameraVerticalAngle - event.movementY * 0.01
                        )
                    );
                }
            }
        });

        // Mouse button for camera rotation
        document.addEventListener('mousedown', (event) => {
            if (event.button === 2) { // Right click
                this.mouseDown = true;
                // Hide cursor while right-clicking
                document.body.style.cursor = 'none';
            }
        });

        document.addEventListener('mouseup', (event) => {
            if (event.button === 2) { // Right click
                this.mouseDown = false;
                // Restore cursor when right-click is released
                document.body.style.cursor = 'default';
            }
        });

        // Prevent context menu on right click
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });

        // Mouse wheel for camera zoom
        document.addEventListener('wheel', (event) => {
            if (!this.isMenuOpen && !this.isInventoryOpen) {
                this.cameraDistance = Math.max(
                    this.minCameraDistance,
                    Math.min(
                        this.maxCameraDistance,
                        this.cameraDistance - event.deltaY * 0.01
                    )
                );
            }
        });

        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.key.toLowerCase()] = true;
            
            if (event.key === 'Escape') {
                this.isMenuOpen = !this.isMenuOpen;
                this.ui.toggleMenu(this.isMenuOpen);
            }
            
            if (event.key.toLowerCase() === 'b') {
                this.isInventoryOpen = !this.isInventoryOpen;
                this.ui.toggleInventory(this.isInventoryOpen);
            }

            // Jump when space is pressed
            if (event.key === ' ') {
                this.player.jump();
            }
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.key.toLowerCase()] = false;
        });
    }

    updateCamera(deltaTime: number) {
        // Calculate ideal camera position
        const idealOffset = new THREE.Vector3(
            -Math.sin(this.cameraHorizontalAngle) * this.cameraDistance * Math.cos(this.cameraVerticalAngle),
            this.cameraDistance * Math.sin(this.cameraVerticalAngle),
            -Math.cos(this.cameraHorizontalAngle) * this.cameraDistance * Math.cos(this.cameraVerticalAngle)
        );

        // Create ray from player to ideal camera position
        const rayOrigin = this.player.mesh.position.clone();
        const rayDirection = idealOffset.clone().normalize();
        const ray = new THREE.Ray(rayOrigin, rayDirection);

        // Check for collisions with walls
        let minDistance = this.cameraDistance;
        for (const wall of this.walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            const intersection = ray.intersectBox(wallBox, new THREE.Vector3());
            if (intersection) {
                const distance = rayOrigin.distanceTo(intersection);
                minDistance = Math.min(minDistance, distance - 0.5); // Keep some distance from walls
            }
        }

        // Calculate final camera position
        const finalOffset = idealOffset.clone().normalize().multiplyScalar(minDistance);
        const targetPosition = this.player.mesh.position.clone().add(finalOffset);

        // Set camera position directly without smoothing
        this.camera.position.copy(targetPosition);
        
        // Make camera look at player
        this.camera.lookAt(this.player.mesh.position);

        // Update player rotation to match camera when right-clicking
        if (this.mouseDown) {
            this.player.mesh.rotation.y = this.cameraHorizontalAngle;
        }
    }

    handleMovement() {
        if (this.isMenuOpen || this.isInventoryOpen) return;

        const moveDirection = new THREE.Vector3();
        const angle = this.player.mesh.rotation.y;

        // Calculate movement based on player's rotation
        if (this.keys['w']) {
            moveDirection.x += Math.sin(angle);
            moveDirection.z += Math.cos(angle);
        }
        if (this.keys['s']) {
            moveDirection.x -= Math.sin(angle);
            moveDirection.z -= Math.cos(angle);
        }

        // Handle turning with A and D when not right-clicking
        if (!this.mouseDown) {
            const turnSpeed = 0.02;
            if (this.keys['a']) {
                this.cameraHorizontalAngle += turnSpeed;
                this.player.mesh.rotation.y = this.cameraHorizontalAngle;
            }
            if (this.keys['d']) {
                this.cameraHorizontalAngle -= turnSpeed;
                this.player.mesh.rotation.y = this.cameraHorizontalAngle;
            }
        } else {
            // Regular strafing when right-clicking
            if (this.keys['a']) {
                moveDirection.x += Math.cos(angle);
                moveDirection.z -= Math.sin(angle);
            }
            if (this.keys['d']) {
                moveDirection.x -= Math.cos(angle);
                moveDirection.z += Math.sin(angle);
            }
        }

        // Normalize movement vector if moving in multiple directions
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
        }

        // Use the player's move method for consistent movement and collision detection
        this.player.move(moveDirection);
    }

    updateOtherPlayers(players: any[]) {
        // Remove players that are no longer in the game
        for (const [id, mesh] of this.otherPlayers) {
            if (!players.find(p => p.id === id)) {
                this.removePlayer(id);
            }
        }

        // Update or create player meshes
        for (const playerData of players) {
            if (playerData.id === this.socket.id) continue; // Skip local player

            let playerMesh = this.otherPlayers.get(playerData.id);
            if (!playerMesh) {
                // Create new player mesh
                playerMesh = new THREE.Mesh(
                    new THREE.CapsuleGeometry(0.5, 1, 4, 8),
                    new THREE.MeshStandardMaterial({ color: 0xff0000 })
                );
                playerMesh.castShadow = true;
                playerMesh.receiveShadow = true;
                this.scene.add(playerMesh);
                this.otherPlayers.set(playerData.id, playerMesh);
            }

            // Update player position and rotation
            playerMesh.position.set(
                playerData.position.x,
                playerData.position.y,
                playerData.position.z
            );
            playerMesh.rotation.y = playerData.rotation.y;
        }
    }

    removePlayer(playerId: string) {
        const playerMesh = this.otherPlayers.get(playerId);
        if (playerMesh) {
            this.scene.remove(playerMesh);
            this.otherPlayers.delete(playerId);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update local player
        this.player.update(deltaTime, this.walls);

        // Send player update to server
        this.socket.emit('playerUpdate', {
            position: this.player.mesh.position,
            rotation: this.player.mesh.rotation
        });

        // Update camera position based on player position
        this.updateCamera(deltaTime);

        // Handle player movement
        this.handleMovement();

        // Render scene
        this.composer.render();
    }

    resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.ui.resize(width, height);
    }
}
