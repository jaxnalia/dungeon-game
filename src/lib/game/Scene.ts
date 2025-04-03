import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { Player } from './Player';
import { UI } from './UI';
import { MultiplayerManager } from './MultiplayerManager';

interface Room {
    x: number;
    y: number;
    z: number;
    size: number;
    height: number;
    walls: {
        north: boolean;
        south: boolean;
        east: boolean;
        west: boolean;
    };
    doors: {
        north: boolean;
        south: boolean;
        east: boolean;
        west: boolean;
    };
}

interface Hallway {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    depth: number;
    direction: 'horizontal' | 'vertical';
    leftWall: boolean;
    rightWall: boolean;
}

interface Wall {
    position: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
}

interface Light {
    position: { x: number; y: number; z: number };
    color: number;
    intensity: number;
}

export class GameScene {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    player: Player | null = null;
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
    lastTime: number = 0;
    cameraRotationSpeed: number = 2.0;
    cameraZoomSpeed: number = 5.0;
    cameraMinVerticalAngle: number = -Math.PI / 3;
    cameraMaxVerticalAngle: number = Math.PI / 3;
    multiplayerManager: MultiplayerManager;
    rooms: Room[] = [];
    private animationFrameId: number | null = null;

    constructor(container: HTMLElement) {
        console.log('GameScene: Initializing...');
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
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
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

        // Add UI
        this.ui = new UI(container);

        // Initialize multiplayer manager
        this.multiplayerManager = new MultiplayerManager(this, this.ui);
        console.log('GameScene: Initialization complete');
    }

    public initializeGame() {
        console.log('GameScene: Starting game initialization...');
        // Add player
        this.player = new Player();
        this.scene.add(this.player.mesh);
        console.log('GameScene: Player created and added to scene');

        // Setup controls
        this.setupControls();
        console.log('GameScene: Controls setup complete');

        // Start animation loop
        this.animate();
        console.log('GameScene: Animation loop started');
    }

    private animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update player with walls for collision detection
        if (this.player) {
            this.player.update(deltaTime, this.walls);
            console.log('Player position:', this.player.mesh.position);
        }

        // Update camera
        this.updateCamera(deltaTime);

        // Handle movement
        this.handleMovement();

        // Render scene
        this.composer.render();
    }

    public cleanup() {
        console.log('GameScene: Cleaning up...');
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
        this.multiplayerManager.cleanup();
        this.ui.cleanup();
    }

    createDungeonFromData(dungeonData: { rooms: Room[], hallways: Hallway[], spawnPoint: { x: number, y: number, z: number } }) {
        console.log('Creating dungeon from data:', dungeonData);
        
        // Clear existing walls
        this.walls.forEach(wall => this.scene.remove(wall));
        this.walls = [];

        // Create wall material
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });

        // Create rooms
        dungeonData.rooms.forEach((room, index) => {
            console.log(`Creating room ${index}:`, {
                position: { x: room.x, y: room.y, z: room.z },
                size: room.size,
                walls: room.walls,
                doors: room.doors
            });
            
            // Create floor with collider
            const floorGeometry = new THREE.BoxGeometry(room.size, 0.2, room.size);
            const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.set(room.x + room.size/2, -0.1, room.z + room.size/2);
            floor.receiveShadow = true;
            
            // Add floor collider
            const floorBox = new THREE.Box3().setFromObject(floor);
            floor.userData.collider = floorBox;
            
            this.walls.push(floor);
            this.scene.add(floor);

            // Function to create a wall segment with proper collider
            const createWallSegment = (width: number, height: number, depth: number, position: THREE.Vector3) => {
                const wallGeometry = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.copy(position);
                wall.castShadow = true;
                wall.receiveShadow = true;
                
                // Add wall collider
                const wallBox = new THREE.Box3().setFromObject(wall);
                wall.userData.collider = wallBox;
                
                this.walls.push(wall);
                this.scene.add(wall);
                return wall;
            };

            const doorWidth = 4;
            const wallHeight = room.height;

            // Create walls with door openings and colliders
            if (room.walls.north) {
                if (room.doors.north) {
                    const wallSegmentWidth = (room.size - doorWidth) / 2;
                    
                    // Left segment
                    createWallSegment(
                        wallSegmentWidth, wallHeight, 0.2,
                        new THREE.Vector3(room.x + wallSegmentWidth/2, wallHeight/2, room.z)
                    );
                    
                    // Right segment
                    createWallSegment(
                        wallSegmentWidth, wallHeight, 0.2,
                        new THREE.Vector3(room.x + room.size - wallSegmentWidth/2, wallHeight/2, room.z)
                    );
                } else {
                    createWallSegment(
                        room.size, wallHeight, 0.2,
                        new THREE.Vector3(room.x + room.size/2, wallHeight/2, room.z)
                    );
                }
            }

            // South wall
            if (room.walls.south) {
                if (room.doors.south) {
                    const wallSegmentWidth = (room.size - doorWidth) / 2;
                    createWallSegment(
                        wallSegmentWidth, wallHeight, 0.2,
                        new THREE.Vector3(room.x + wallSegmentWidth/2, wallHeight/2, room.z + room.size)
                    );
                    createWallSegment(
                        wallSegmentWidth, wallHeight, 0.2,
                        new THREE.Vector3(room.x + room.size - wallSegmentWidth/2, wallHeight/2, room.z + room.size)
                    );
                } else {
                    createWallSegment(
                        room.size, wallHeight, 0.2,
                        new THREE.Vector3(room.x + room.size/2, wallHeight/2, room.z + room.size)
                    );
                }
            }

            // East wall
            if (room.walls.east) {
                if (room.doors.east) {
                    const wallSegmentWidth = (room.size - doorWidth) / 2;
                    createWallSegment(
                        0.2, wallHeight, wallSegmentWidth,
                        new THREE.Vector3(room.x + room.size, wallHeight/2, room.z + wallSegmentWidth/2)
                    );
                    createWallSegment(
                        0.2, wallHeight, wallSegmentWidth,
                        new THREE.Vector3(room.x + room.size, wallHeight/2, room.z + room.size - wallSegmentWidth/2)
                    );
                } else {
                    createWallSegment(
                        0.2, wallHeight, room.size,
                        new THREE.Vector3(room.x + room.size, wallHeight/2, room.z + room.size/2)
                    );
                }
            }

            // West wall
            if (room.walls.west) {
                if (room.doors.west) {
                    const wallSegmentWidth = (room.size - doorWidth) / 2;
                    createWallSegment(
                        0.2, wallHeight, wallSegmentWidth,
                        new THREE.Vector3(room.x, wallHeight/2, room.z + wallSegmentWidth/2)
                    );
                    createWallSegment(
                        0.2, wallHeight, wallSegmentWidth,
                        new THREE.Vector3(room.x, wallHeight/2, room.z + room.size - wallSegmentWidth/2)
                    );
                } else {
                    createWallSegment(
                        0.2, wallHeight, room.size,
                        new THREE.Vector3(room.x, wallHeight/2, room.z + room.size/2)
                    );
                }
            }
        });

        // Create hallways with colliders
        dungeonData.hallways.forEach((hallway, index) => {
            // Create floor with collider
            const floorGeometry = new THREE.BoxGeometry(hallway.width, 0.2, hallway.depth);
            const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.set(hallway.x + hallway.width/2, -0.1, hallway.z + hallway.depth/2);
            floor.receiveShadow = true;
            
            // Add floor collider
            const floorBox = new THREE.Box3().setFromObject(floor);
            floor.userData.collider = floorBox;
            
            this.walls.push(floor);
            this.scene.add(floor);

            if (hallway.direction === 'horizontal') {
                if (hallway.leftWall) {
                    const wall = new THREE.Mesh(
                        new THREE.BoxGeometry(hallway.width, hallway.height, 0.2),
                        wallMaterial
                    );
                    wall.position.set(hallway.x + hallway.width/2, hallway.height/2, hallway.z);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    
                    // Add wall collider
                    const wallBox = new THREE.Box3().setFromObject(wall);
                    wall.userData.collider = wallBox;
                    
                    this.walls.push(wall);
                    this.scene.add(wall);
                }

                if (hallway.rightWall) {
                    const wall = new THREE.Mesh(
                        new THREE.BoxGeometry(hallway.width, hallway.height, 0.2),
                        wallMaterial
                    );
                    wall.position.set(hallway.x + hallway.width/2, hallway.height/2, hallway.z + hallway.depth);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    
                    // Add wall collider
                    const wallBox = new THREE.Box3().setFromObject(wall);
                    wall.userData.collider = wallBox;
                    
                    this.walls.push(wall);
                    this.scene.add(wall);
                }
            } else {
                if (hallway.leftWall) {
                    const wall = new THREE.Mesh(
                        new THREE.BoxGeometry(0.2, hallway.height, hallway.depth),
                        wallMaterial
                    );
                    wall.position.set(hallway.x, hallway.height/2, hallway.z + hallway.depth/2);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    
                    // Add wall collider
                    const wallBox = new THREE.Box3().setFromObject(wall);
                    wall.userData.collider = wallBox;
                    
                    this.walls.push(wall);
            this.scene.add(wall);
                }

                if (hallway.rightWall) {
                    const wall = new THREE.Mesh(
                        new THREE.BoxGeometry(0.2, hallway.height, hallway.depth),
                        wallMaterial
                    );
                    wall.position.set(hallway.x + hallway.width, hallway.height/2, hallway.z + hallway.depth/2);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    
                    // Add wall collider
                    const wallBox = new THREE.Box3().setFromObject(wall);
                    wall.userData.collider = wallBox;
                    
            this.walls.push(wall);
                    this.scene.add(wall);
                }
            }
        });

        // Set player position to spawn point after all walls are created
        if (this.player) {
            // Ensure spawn point is in the center of the first room
            const firstRoom = dungeonData.rooms[0];
            const spawnPoint = {
                x: firstRoom.x + firstRoom.size/2,
                y: 1.5, // Player height
                z: firstRoom.z + firstRoom.size/2
            };
            
            this.player.mesh.position.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
            console.log('Player spawned at:', spawnPoint);
        }

        console.log('Total walls created:', this.walls.length);
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

        // Update server with new position and rotation
        this.multiplayerManager.updatePlayerPosition(
            this.player.mesh.position,
            this.player.mesh.rotation
        );
    }

    public resize(width: number, height: number) {
        console.log('GameScene: Resizing to', width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }
}
