interface Room {
    x: number;
    y: number;
    z: number;
    size: number; // Square rooms have same width and depth
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

export class DungeonGenerator {
    private rooms: Room[] = [];
    private hallways: Hallway[] = [];
    private readonly roomSize = 30; // Fixed room size
    private readonly hallwayWidth = 4; // Increased from 2 to 4
    private readonly hallwayHeight = 3;
    private readonly roomSpacing = 12; // Increased from 10 to 12 to accommodate larger hallways
    private readonly numRooms = 8;
    private readonly doorWidth = 4; // Width of the door opening

    generateDungeon(): { rooms: Room[], hallways: Hallway[], spawnPoint: { x: number, y: number, z: number } } {
        this.rooms = [];
        this.hallways = [];

        // Create first room
        const firstRoom = this.createRoom(0, 0, 0);
        this.rooms.push(firstRoom);

        // Calculate spawn point (center of first room)
        const spawnPoint = {
            x: firstRoom.x + firstRoom.size/2,
            y: 1.5, // Player height
            z: firstRoom.z + firstRoom.size/2
        };

        // Create additional rooms
        let attempts = 0;
        const maxAttempts = 2000;

        while (this.rooms.length < this.numRooms && attempts < maxAttempts) {
            attempts++;
            
            // Select a random existing room as source
            const sourceRoom = this.rooms[Math.floor(Math.random() * this.rooms.length)];
            
            // Try to create a new room in a random direction
            const directions: ('north' | 'south' | 'east' | 'west')[] = ['north', 'south', 'east', 'west'];
            const direction = directions[Math.floor(Math.random() * directions.length)];
            
            const newRoom = this.findValidRoomPosition(sourceRoom, direction);
            if (newRoom) {
                this.rooms.push(newRoom);
            }
        }

        return {
            rooms: this.rooms,
            hallways: this.hallways,
            spawnPoint
        };
    }

    private createRoom(x: number, y: number, z: number): Room {
        return {
            x,
            y,
            z,
            size: this.roomSize,
            height: 3,
            walls: {
                north: true,
                south: true,
                east: true,
                west: true
            },
            doors: {
                north: false,
                south: false,
                east: false,
                west: false
            }
        };
    }

    private getRandomDirection(): 'north' | 'south' | 'east' | 'west' {
        const directions: ('north' | 'south' | 'east' | 'west')[] = ['north', 'south', 'east', 'west'];
        return directions[Math.floor(Math.random() * directions.length)];
    }

    private findSuitableSourceRoom(): Room | null {
        // Find rooms that can have new connections
        const availableRooms = this.rooms.filter(room => {
            const hasAvailableSide = !room.doors.north || !room.doors.south || !room.doors.east || !room.doors.west;
            return hasAvailableSide;
        });

        if (availableRooms.length === 0) return null;

        // Prefer rooms with fewer connections
        return availableRooms.reduce((prev, curr) => {
            const prevConnections = Object.values(prev.doors).filter(Boolean).length;
            const currConnections = Object.values(curr.doors).filter(Boolean).length;
            return currConnections < prevConnections ? curr : prev;
        });
    }

    private findValidRoomPosition(
        sourceRoom: Room, 
        direction: 'north' | 'south' | 'east' | 'west'
    ): Room | null {
        let x = sourceRoom.x;
        let z = sourceRoom.z;

        switch (direction) {
            case 'north':
                z = sourceRoom.z - this.roomSize - this.roomSpacing;
                break;
            case 'south':
                z = sourceRoom.z + this.roomSize + this.roomSpacing;
                break;
            case 'east':
                x = sourceRoom.x + this.roomSize + this.roomSpacing;
                break;
            case 'west':
                x = sourceRoom.x - this.roomSize - this.roomSpacing;
                break;
        }

        const newRoom = this.createRoom(x, 0, z);

        if (this.isValidRoomPosition(newRoom)) {
            // Create connection between rooms
            this.createConnection(sourceRoom, newRoom, direction);
            return newRoom;
        }

        return null;
    }

    private isValidRoomPosition(room: Room): boolean {
        for (const existingRoom of this.rooms) {
            if (this.roomsOverlap(room, existingRoom)) {
                return false;
            }
        }
        return true;
    }

    private roomsOverlap(room1: Room, room2: Room): boolean {
        return (
            room1.x < room2.x + room2.size + this.roomSpacing &&
            room1.x + room1.size + this.roomSpacing > room2.x &&
            room1.z < room2.z + room2.size + this.roomSpacing &&
            room1.z + room1.size + this.roomSpacing > room2.z
        );
    }

    private createConnection(sourceRoom: Room, newRoom: Room, direction: 'north' | 'south' | 'east' | 'west') {
        // Create doors in both rooms
        switch (direction) {
            case 'north':
                sourceRoom.doors.north = true;
                sourceRoom.walls.north = true;
                newRoom.doors.south = true;
                newRoom.walls.south = true;
                break;
            case 'south':
                sourceRoom.doors.south = true;
                sourceRoom.walls.south = true;
                newRoom.doors.north = true;
                newRoom.walls.north = true;
                break;
            case 'east':
                sourceRoom.doors.east = true;
                sourceRoom.walls.east = true;
                newRoom.doors.west = true;
                newRoom.walls.west = true;
                break;
            case 'west':
                sourceRoom.doors.west = true;
                sourceRoom.walls.west = true;
                newRoom.doors.east = true;
                newRoom.walls.east = true;
                break;
        }

        // Create hallway between rooms
        this.createHallway(sourceRoom, newRoom, direction);
    }

    private createHallway(sourceRoom: Room, newRoom: Room, direction: 'north' | 'south' | 'east' | 'west') {
        if (direction === 'east' || direction === 'west') {
            // Horizontal hallway
            const minX = Math.min(sourceRoom.x, newRoom.x);
            const maxX = Math.max(sourceRoom.x, newRoom.x);
            const x = minX + this.roomSize;
            const z = Math.min(sourceRoom.z, newRoom.z) + this.roomSize/2 - this.hallwayWidth/2;
            const width = maxX - minX - this.roomSize;
            const depth = this.hallwayWidth;

            // Create hallway with walls on top and bottom
            this.hallways.push({
                x: x,
                y: 0,
                z: z,
                width: width,
                height: this.hallwayHeight,
                depth: depth,
                direction: 'horizontal',
                leftWall: true,  // This will be the top wall
                rightWall: true  // This will be the bottom wall
            });
        } else {
            // Vertical hallway
            const minZ = Math.min(sourceRoom.z, newRoom.z);
            const maxZ = Math.max(sourceRoom.z, newRoom.z);
            const x = Math.min(sourceRoom.x, newRoom.x) + this.roomSize/2 - this.hallwayWidth/2;
            const z = minZ + this.roomSize;
            const width = this.hallwayWidth;
            const depth = maxZ - minZ - this.roomSize;

            // Create hallway with walls on left and right
            this.hallways.push({
                x: x,
                y: 0,
                z: z,
                width: width,
                height: this.hallwayHeight,
                depth: depth,
                direction: 'vertical',
                leftWall: true,  // This will be the left wall
                rightWall: true  // This will be the right wall
            });
        }
    }
} 