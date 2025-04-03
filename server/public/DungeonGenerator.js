"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DungeonGenerator = void 0;
class DungeonGenerator {
    constructor() {
        this.rooms = [];
        this.hallways = [];
        this.roomSize = 30; // Fixed room size
        this.hallwayWidth = 4; // Increased from 2 to 4
        this.hallwayHeight = 3;
        this.roomSpacing = 12; // Increased from 10 to 12 to accommodate larger hallways
        this.numRooms = 8;
        this.doorWidth = 4; // Width of the door opening
    }
    generateDungeon() {
        this.rooms = [];
        this.hallways = [];
        // Create first room
        const firstRoom = this.createRoom(0, 0, 0);
        this.rooms.push(firstRoom);
        // Calculate spawn point (center of first room)
        const spawnPoint = {
            x: firstRoom.x + firstRoom.size / 2,
            y: 1.5, // Player height
            z: firstRoom.z + firstRoom.size / 2
        };
        // Create additional rooms
        let attempts = 0;
        const maxAttempts = 2000;
        while (this.rooms.length < this.numRooms && attempts < maxAttempts) {
            attempts++;
            // Select a random existing room as source
            const sourceRoom = this.rooms[Math.floor(Math.random() * this.rooms.length)];
            // Try to create a new room in a random direction
            const directions = ['north', 'south', 'east', 'west'];
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
    createRoom(x, y, z) {
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
    getRandomDirection() {
        const directions = ['north', 'south', 'east', 'west'];
        return directions[Math.floor(Math.random() * directions.length)];
    }
    findSuitableSourceRoom() {
        // Find rooms that can have new connections
        const availableRooms = this.rooms.filter(room => {
            const hasAvailableSide = !room.doors.north || !room.doors.south || !room.doors.east || !room.doors.west;
            return hasAvailableSide;
        });
        if (availableRooms.length === 0)
            return null;
        // Prefer rooms with fewer connections
        return availableRooms.reduce((prev, curr) => {
            const prevConnections = Object.values(prev.doors).filter(Boolean).length;
            const currConnections = Object.values(curr.doors).filter(Boolean).length;
            return currConnections < prevConnections ? curr : prev;
        });
    }
    findValidRoomPosition(sourceRoom, direction) {
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
    isValidRoomPosition(room) {
        for (const existingRoom of this.rooms) {
            if (this.roomsOverlap(room, existingRoom)) {
                return false;
            }
        }
        return true;
    }
    roomsOverlap(room1, room2) {
        return (room1.x < room2.x + room2.size + this.roomSpacing &&
            room1.x + room1.size + this.roomSpacing > room2.x &&
            room1.z < room2.z + room2.size + this.roomSpacing &&
            room1.z + room1.size + this.roomSpacing > room2.z);
    }
    createConnection(sourceRoom, newRoom, direction) {
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
    createHallway(sourceRoom, newRoom, direction) {
        if (direction === 'east' || direction === 'west') {
            // Horizontal hallway
            const minX = Math.min(sourceRoom.x, newRoom.x);
            const maxX = Math.max(sourceRoom.x, newRoom.x);
            const x = minX + this.roomSize;
            const z = Math.min(sourceRoom.z, newRoom.z) + this.roomSize / 2 - this.hallwayWidth / 2;
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
                leftWall: true, // This will be the top wall
                rightWall: true // This will be the bottom wall
            });
        }
        else {
            // Vertical hallway
            const minZ = Math.min(sourceRoom.z, newRoom.z);
            const maxZ = Math.max(sourceRoom.z, newRoom.z);
            const x = Math.min(sourceRoom.x, newRoom.x) + this.roomSize / 2 - this.hallwayWidth / 2;
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
                leftWall: true, // This will be the left wall
                rightWall: true // This will be the right wall
            });
        }
    }
}
exports.DungeonGenerator = DungeonGenerator;
