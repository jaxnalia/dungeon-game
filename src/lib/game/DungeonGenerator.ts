import * as THREE from 'three';

interface Room {
    x: number;
    z: number;
    size: number;
    doors: {
        north: boolean;
        south: boolean;
        east: boolean;
        west: boolean;
    };
}

interface Hallway {
    x: number;
    z: number;
    width: number;
    depth: number;
    direction: 'north' | 'south' | 'east' | 'west';
}

export class DungeonGenerator {
    rooms: Room[] = [];
    hallways: Hallway[] = [];
    walls: THREE.Mesh[] = [];
    lights: THREE.PointLight[] = [];
    roomCount: number = 15;
    roomSize: number = 72; // 6x bigger rooms (12 * 6)
    gridSize: number = 30;
    hallwayWidth: number = 9; // 3x wider hallways
    doorWidth: number = 6; // 3x wider doors
    hallwayLength: number = 48; // 8x longer hallways (6 * 8)
    pillarSize: number = 1; // Size of pillars
    textureLoader: THREE.TextureLoader;

    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.generateDungeon();
    }

    generateDungeon() {
        // Clear existing rooms and hallways
        this.rooms = [];
        this.hallways = [];
        this.walls = [];
        this.lights = [];

        // Create central room
        const centralRoom: Room = {
            x: 0,
            z: 0,
            size: this.roomSize,
            doors: { north: false, south: false, east: false, west: false }
        };
        this.rooms.push(centralRoom);

        // Generate additional rooms
        let attempts = 0;
        const maxAttempts = 2000; // Increased attempts for more reliable generation
        const minSpacing = this.roomSize * 0.5; // Minimum spacing between rooms

        while (this.rooms.length < this.roomCount && attempts < maxAttempts) {
            // Try to find a suitable source room
            const sourceRoom = this.findSuitableSourceRoom();
            if (!sourceRoom) {
                attempts++;
                continue;
            }

            // Try to find a valid direction and position for the new room
            const result = this.findValidRoomPosition(sourceRoom, minSpacing);
            if (!result) {
                attempts++;
                continue;
            }

            const { direction, newX, newZ } = result;

            // Create new room with no doors initially
            const newRoom: Room = {
                x: newX,
                z: newZ,
                size: this.roomSize,
                doors: { north: false, south: false, east: false, west: false }
            };
            
            // Add the new room
            this.rooms.push(newRoom);

            // Create initial connection
            this.createConnection(sourceRoom, newRoom, direction);

            // Check for and create additional connections with adjacent rooms
            this.checkAdjacentRooms(newRoom);

            attempts++;
        }

        // Create walls and lights
        this.createWalls();
    }

    findSuitableSourceRoom(): Room | null {
        // Find rooms that can have new connections (less than 4 doors)
        const availableRooms = this.rooms.filter(room => {
            const connectionCount = Object.values(room.doors).filter(Boolean).length;
            return connectionCount < 4; // Allow up to 4 connections
        });

        if (availableRooms.length === 0) return null;

        // Prefer rooms with fewer connections, but also consider distance from center
        return availableRooms.reduce((best, current) => {
            const bestConnections = Object.values(best.doors).filter(Boolean).length;
            const currentConnections = Object.values(current.doors).filter(Boolean).length;
            
            // Calculate distance from center
            const bestDistance = Math.sqrt(best.x * best.x + best.z * best.z);
            const currentDistance = Math.sqrt(current.x * current.x + current.z * current.z);
            
            // Prefer rooms with fewer connections, but also consider distance
            if (currentConnections < bestConnections) {
                return current;
            } else if (currentConnections === bestConnections && currentDistance > bestDistance) {
                return current; // Prefer rooms further from center if same number of connections
            }
            return best;
        });
    }

    findValidRoomPosition(sourceRoom: Room, minSpacing: number): { direction: 'north' | 'south' | 'east' | 'west', newX: number, newZ: number } | null {
        const directions = ['north', 'south', 'east', 'west'] as const;
        const shuffledDirections = [...directions].sort(() => Math.random() - 0.5);

        for (const direction of shuffledDirections) {
            // Skip if this direction already has a door
            if (sourceRoom.doors[direction]) continue;

            let newX = sourceRoom.x;
            let newZ = sourceRoom.z;

            // Calculate position for new room with proper spacing
            switch (direction) {
                case 'north':
                    newZ = sourceRoom.z - this.roomSize - this.hallwayLength;
                    break;
                case 'south':
                    newZ = sourceRoom.z + this.roomSize + this.hallwayLength;
                    break;
                case 'east':
                    newX = sourceRoom.x + this.roomSize + this.hallwayLength;
                    break;
                case 'west':
                    newX = sourceRoom.x - this.roomSize - this.hallwayLength;
                    break;
            }

            // Check if position is valid with minimum spacing
            if (this.isValidRoomPosition(newX, newZ, minSpacing)) {
                return { direction, newX, newZ };
            }
        }

        return null;
    }

    isValidRoomPosition(x: number, z: number, minSpacing: number): boolean {
        for (const room of this.rooms) {
            // Check for minimum spacing with some tolerance
            const xOverlap = Math.abs(x - room.x) < (this.roomSize + minSpacing * 0.8);
            const zOverlap = Math.abs(z - room.z) < (this.roomSize + minSpacing * 0.8);
            
            if (xOverlap && zOverlap) {
                return false;
            }
        }
        return true;
    }

    checkAdjacentRooms(newRoom: Room): void {
        for (const existingRoom of this.rooms) {
            if (existingRoom === newRoom) continue;

            // Check if rooms are adjacent
            const isAdjacent = this.areRoomsAdjacent(newRoom, existingRoom);
            if (isAdjacent) {
                // Determine the direction of adjacency
                const direction = this.getAdjacentDirection(newRoom, existingRoom);
                if (direction) {
                    // Create connection between rooms
                    this.createConnection(newRoom, existingRoom, direction);
                }
            }
        }
    }

    areRoomsAdjacent(room1: Room, room2: Room): boolean {
        // Check if rooms are exactly one room size + hallway length apart
        const xDiff = Math.abs(room1.x - room2.x);
        const zDiff = Math.abs(room1.z - room2.z);
        
        return (
            (xDiff === this.roomSize + this.hallwayLength && zDiff === 0) || // East/West
            (zDiff === this.roomSize + this.hallwayLength && xDiff === 0)    // North/South
        );
    }

    getAdjacentDirection(room1: Room, room2: Room): 'north' | 'south' | 'east' | 'west' | null {
        const xDiff = room1.x - room2.x;
        const zDiff = room1.z - room2.z;

        if (xDiff === this.roomSize + this.hallwayLength) return 'west';
        if (xDiff === -(this.roomSize + this.hallwayLength)) return 'east';
        if (zDiff === this.roomSize + this.hallwayLength) return 'north';
        if (zDiff === -(this.roomSize + this.hallwayLength)) return 'south';
        
        return null;
    }

    createConnection(room1: Room, room2: Room, direction: 'north' | 'south' | 'east' | 'west'): void {
        // Create hallway between rooms
        this.createHallway(room1, direction, room2.x, room2.z);

        // Set doors for both rooms
        switch (direction) {
            case 'north':
                room1.doors.north = true;
                room2.doors.south = true;
                break;
            case 'south':
                room1.doors.south = true;
                room2.doors.north = true;
                break;
            case 'east':
                room1.doors.east = true;
                room2.doors.west = true;
                break;
            case 'west':
                room1.doors.west = true;
                room2.doors.east = true;
                break;
        }
    }

    createHallway(sourceRoom: Room, direction: string, targetX: number, targetZ: number) {
        let hallway: Hallway;

        switch (direction) {
            case 'north':
                hallway = {
                    x: sourceRoom.x + (sourceRoom.size - this.hallwayWidth) / 2,
                    z: sourceRoom.z - this.hallwayLength,
                    width: this.hallwayWidth,
                    depth: this.hallwayLength,
                    direction: 'north'
                };
                break;
            case 'south':
                hallway = {
                    x: sourceRoom.x + (sourceRoom.size - this.hallwayWidth) / 2,
                    z: sourceRoom.z + sourceRoom.size,
                    width: this.hallwayWidth,
                    depth: this.hallwayLength,
                    direction: 'south'
                };
                break;
            case 'east':
                hallway = {
                    x: sourceRoom.x + sourceRoom.size,
                    z: sourceRoom.z + (sourceRoom.size - this.hallwayWidth) / 2,
                    width: this.hallwayLength,
                    depth: this.hallwayWidth,
                    direction: 'east'
                };
                break;
            case 'west':
                hallway = {
                    x: sourceRoom.x - this.hallwayLength,
                    z: sourceRoom.z + (sourceRoom.size - this.hallwayWidth) / 2,
                    width: this.hallwayLength,
                    depth: this.hallwayWidth,
                    direction: 'west'
                };
                break;
            default:
                return;
        }

        this.hallways.push(hallway);
    }

    createWalls() {
        const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x808080 });
        
        // Load stone texture
        const stoneTexture = this.textureLoader.load('/textures/stone.jpg');
        stoneTexture.wrapS = THREE.RepeatWrapping;
        stoneTexture.wrapT = THREE.RepeatWrapping;
        stoneTexture.repeat.set(20, 20); // Repeat texture 20x20 times (5x smaller than before)
        
        // Create floors and walls for rooms
        for (const room of this.rooms) {
            // Create floor
            const floorGeometry = new THREE.PlaneGeometry(room.size, room.size);
            const floorMaterial = new THREE.MeshPhongMaterial({ 
                map: stoneTexture,
                side: THREE.DoubleSide,
                shininess: 0
            });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(room.x + room.size/2, 0, room.z + room.size/2);
            this.walls.push(floor);

            // Add room light
            const roomLight = new THREE.PointLight(0xffffff, 2000.0, room.size * 30.0);
            roomLight.position.set(
                room.x + room.size/2, // Center X
                20, // Increased height for better spread
                room.z + room.size/2  // Center Z
            );
            this.lights.push(roomLight);

            // Create walls with doors and pillars
            // North wall
            if (room.doors.north) {
                // Left segment
                this.createWall(room.x, room.z, (room.size - this.doorWidth) / 2, 1);
                // Right segment
                this.createWall(room.x + (room.size + this.doorWidth) / 2, room.z, (room.size - this.doorWidth) / 2, 1);
                // Add pillars at door corners
                this.createPillar(room.x + (room.size - this.doorWidth) / 2, room.z);
                this.createPillar(room.x + (room.size + this.doorWidth) / 2, room.z);
            } else {
                this.createWall(room.x, room.z, room.size, 1);
            }

            // South wall
            if (room.doors.south) {
                // Left segment
                this.createWall(room.x, room.z + room.size, (room.size - this.doorWidth) / 2, 1);
                // Right segment
                this.createWall(room.x + (room.size + this.doorWidth) / 2, room.z + room.size, (room.size - this.doorWidth) / 2, 1);
                // Add pillars at door corners
                this.createPillar(room.x + (room.size - this.doorWidth) / 2, room.z + room.size);
                this.createPillar(room.x + (room.size + this.doorWidth) / 2, room.z + room.size);
            } else {
                this.createWall(room.x, room.z + room.size, room.size, 1);
            }

            // East wall
            if (room.doors.east) {
                // Top segment
                this.createWall(room.x + room.size, room.z, 1, (room.size - this.doorWidth) / 2);
                // Bottom segment
                this.createWall(room.x + room.size, room.z + (room.size + this.doorWidth) / 2, 1, (room.size - this.doorWidth) / 2);
                // Add pillars at door corners
                this.createPillar(room.x + room.size, room.z + (room.size - this.doorWidth) / 2);
                this.createPillar(room.x + room.size, room.z + (room.size + this.doorWidth) / 2);
            } else {
                this.createWall(room.x + room.size, room.z, 1, room.size);
            }

            // West wall
            if (room.doors.west) {
                // Top segment
                this.createWall(room.x, room.z, 1, (room.size - this.doorWidth) / 2);
                // Bottom segment
                this.createWall(room.x, room.z + (room.size + this.doorWidth) / 2, 1, (room.size - this.doorWidth) / 2);
                // Add pillars at door corners
                this.createPillar(room.x, room.z + (room.size - this.doorWidth) / 2);
                this.createPillar(room.x, room.z + (room.size + this.doorWidth) / 2);
            } else {
                this.createWall(room.x, room.z, 1, room.size);
            }

            // Add corner pillars
            this.createPillar(room.x, room.z);
            this.createPillar(room.x + room.size, room.z);
            this.createPillar(room.x, room.z + room.size);
            this.createPillar(room.x + room.size, room.z + room.size);
        }

        // Create floors and walls for hallways
        for (const hallway of this.hallways) {
            // Create floor with higher texture scale
            const hallwayFloorGeometry = new THREE.PlaneGeometry(hallway.width, hallway.depth);
            const hallwayFloorMaterial = new THREE.MeshPhongMaterial({ 
                map: stoneTexture.clone(),
                side: THREE.DoubleSide,
                shininess: 0
            });
            if (hallwayFloorMaterial.map) {
                // Invert texture scale for east/west hallways
                if (hallway.direction === 'east' || hallway.direction === 'west') {
                    hallwayFloorMaterial.map.repeat.set(20, 5); // Inverted scale for east/west hallways
                } else {
                    hallwayFloorMaterial.map.repeat.set(5, 20); // Original scale for north/south hallways
                }
            }
            const floor = new THREE.Mesh(hallwayFloorGeometry, hallwayFloorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(hallway.x + hallway.width/2, 0, hallway.z + hallway.depth/2);
            this.walls.push(floor);

            // Create walls for hallways
            if (hallway.direction === 'north' || hallway.direction === 'south') {
                // Side walls
                this.createWall(hallway.x, hallway.z, 1, hallway.depth);
                this.createWall(hallway.x + hallway.width - 1, hallway.z, 1, hallway.depth);
                // Add pillars at hallway ends
                this.createPillar(hallway.x, hallway.z);
                this.createPillar(hallway.x + hallway.width - 1, hallway.z);
                this.createPillar(hallway.x, hallway.z + hallway.depth - 1);
                this.createPillar(hallway.x + hallway.width - 1, hallway.z + hallway.depth - 1);
            } else {
                // Side walls
                this.createWall(hallway.x, hallway.z, hallway.width, 1);
                this.createWall(hallway.x, hallway.z + hallway.depth - 1, hallway.width, 1);
                // Add pillars at hallway ends
                this.createPillar(hallway.x, hallway.z);
                this.createPillar(hallway.x + hallway.width - 1, hallway.z);
                this.createPillar(hallway.x, hallway.z + hallway.depth - 1);
                this.createPillar(hallway.x + hallway.width - 1, hallway.z + hallway.depth - 1);
            }
        }
    }

    createWall(x: number, z: number, width: number, depth: number) {
        const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x808080 });
        const wallGeometry = new THREE.BoxGeometry(width, 4, depth);
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(x + width/2, 2, z + depth/2);
        this.walls.push(wall);
    }

    createPillar(x: number, z: number) {
        const pillarMaterial = new THREE.MeshPhongMaterial({ color: 0x808080 });
        const pillarGeometry = new THREE.BoxGeometry(this.pillarSize, 4, this.pillarSize);
        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillar.position.set(x + this.pillarSize/2, 2, z + this.pillarSize/2);
        this.walls.push(pillar);
    }

    getWalls(): THREE.Mesh[] {
        return this.walls;
    }

    getLights(): THREE.PointLight[] {
        return this.lights;
    }
} 