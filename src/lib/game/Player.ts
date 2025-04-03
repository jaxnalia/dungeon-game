import * as THREE from 'three';

export class Player {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    isGrounded: boolean;
    wasGrounded: boolean;
    coyoteTime: number;
    coyoteTimer: number;
    jumpBufferTime: number;
    jumpBufferTimer: number;
    jumpForce: number;
    gravity: number;
    moveSpeed: number;
    airControl: number;
    collisionRadius: number;
    lastUpdateTime: number;
    groundCheckDistance: number;
    groundCheckOffset: number;
    maxFallSpeed: number;
    acceleration: number;
    deceleration: number;
    airAcceleration: number;
    airDeceleration: number;
    wallSlideSpeed: number;
    wallJumpForce: number;
    wallJumpDirection: number;
    wallSlideTimer: number;
    wallSlideCooldown: number;
    wallSlideActive: boolean;
    wallNormal: THREE.Vector3;
    wallContactPoint: THREE.Vector3;
    speed: number;
    coyoteTimeCounter: number;
    jumpBufferCounter: number;
    
    constructor() {
        this.mesh = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.5, 1, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.y = 1.5; // Adjust for capsule height

        // Movement properties
        this.speed = 500;
        this.jumpForce = 8;
        this.gravity = 5;
        this.velocity = new THREE.Vector3();
        this.isGrounded = false;
        this.wasGrounded = false;
        this.coyoteTime = 0.15; // Time window for jumping after leaving ground
        this.jumpBufferTime = 0.1; // Time window for buffering jump input
        this.airControl = 0.3; // Reduced air control for less sliding
        this.collisionRadius = 0.5;
        this.lastUpdateTime = performance.now();
        this.groundCheckDistance = 0.1;
        this.groundCheckOffset = 0.1;
        this.maxFallSpeed = 20;
        this.acceleration = 30; // Increased acceleration for more responsive movement
        this.deceleration = 25; // Increased deceleration for less sliding
        this.airAcceleration = 10; // Reduced air acceleration
        this.airDeceleration = 8; // Reduced air deceleration
        this.moveSpeed = 100; // Initialize moveSpeed

        // Wall sliding properties
        this.wallSlideSpeed = 1;
        this.wallJumpForce = 10;
        this.wallJumpDirection = 0;
        this.wallSlideTimer = 0;
        this.wallSlideCooldown = 0.5;
        this.wallSlideActive = false;
        this.wallNormal = new THREE.Vector3();
        this.wallContactPoint = new THREE.Vector3();

        // Initialize timers
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.coyoteTimeCounter = 0;
        this.jumpBufferCounter = 0;
    }

    update(deltaTime: number, walls: THREE.Mesh[]) {
        const currentTime = performance.now();
        const dt = Math.min((currentTime - this.lastUpdateTime) / 1000, 0.016);
        this.lastUpdateTime = currentTime;

        // Update timers
        this.updateTimers(dt);

        // Store original position
        const originalPosition = this.mesh.position.clone();

        // Apply gravity if not grounded
        if (!this.isGrounded) {
            this.velocity.y -= this.gravity * dt;
            this.velocity.y = Math.max(this.velocity.y, -this.maxFallSpeed);
        }

        // Update position based on velocity
        const movement = this.velocity.clone().multiplyScalar(dt);
        
        // Split movement into components and check collisions separately
        const horizontalMovement = new THREE.Vector3(movement.x, 0, movement.z);
        const verticalMovement = new THREE.Vector3(0, movement.y, 0);

        // Apply horizontal movement first
        this.mesh.position.add(horizontalMovement);
        this.handleCollisions(walls);

        // Then apply vertical movement
        this.mesh.position.add(verticalMovement);
        this.handleCollisions(walls);

        // Update grounded state
        this.updateGroundedState(walls);
    }

    private checkCollisionPenetration(walls: THREE.Mesh[]): { normal: THREE.Vector3, depth: number } | null {
        const capsuleRadius = 0.5;
        const capsuleHeight = 1;
        
        for (const wall of walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            const playerBox = new THREE.Box3().setFromObject(this.mesh);
            
            if (wallBox.intersectsBox(playerBox)) {
                const wallCenter = wallBox.getCenter(new THREE.Vector3());
                const playerCenter = playerBox.getCenter(new THREE.Vector3());
                
                // Calculate penetration normal and depth
                const normal = new THREE.Vector3()
                    .subVectors(playerCenter, wallCenter)
                    .normalize();
                
                const depth = capsuleRadius - playerCenter.distanceTo(wallCenter);
                
                return { normal, depth };
            }
        }
        
        return null;
    }

    updateTimers(dt: number) {
        if (!this.isGrounded) {
            this.coyoteTimer -= dt;
        } else {
            this.coyoteTimer = this.coyoteTime;
        }
        this.jumpBufferTimer -= dt;
        this.wallSlideTimer -= dt;
    }

    applyGravity(dt: number) {
        if (!this.wallSlideActive) {
            this.velocity.y = Math.max(this.velocity.y - this.gravity * dt, -this.maxFallSpeed);
        } else {
            // Reduce gravity while wall sliding
            this.velocity.y = Math.max(this.velocity.y - (this.gravity * 0.5) * dt, -this.wallSlideSpeed);
        }
    }

    handleJumping() {
        if (this.jumpBufferTimer > 0) {
            if (this.isGrounded || this.coyoteTimer > 0) {
                // Normal jump
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
                this.coyoteTimer = 0;
                this.jumpBufferTimer = 0;
            } else if (this.wallSlideActive && this.wallSlideTimer <= 0) {
                // Wall jump
                this.velocity.y = this.wallJumpForce;
                this.velocity.x = this.wallNormal.x * this.wallJumpForce;
                this.velocity.z = this.wallNormal.z * this.wallJumpForce;
                this.wallSlideActive = false;
                this.wallSlideTimer = this.wallSlideCooldown;
                this.jumpBufferTimer = 0;
            }
        }
    }

    handleWallSliding(dt: number) {
        if (this.wallSlideActive) {
            // Apply wall slide friction
            this.velocity.y = Math.max(this.velocity.y, -this.wallSlideSpeed);
        }
    }

    updatePosition(dt: number) {
        this.mesh.position.x += this.velocity.x * dt;
        this.mesh.position.y += this.velocity.y * dt;
        this.mesh.position.z += this.velocity.z * dt;
    }

    handleCollisions(walls: THREE.Mesh[]) {
        const capsuleRadius = 0.5;
        const capsuleHeight = 1;
        
        // Create points for capsule collision
        const capsuleBottom = this.mesh.position.clone().sub(new THREE.Vector3(0, capsuleHeight/2, 0));
        const capsuleTop = this.mesh.position.clone().add(new THREE.Vector3(0, capsuleHeight/2, 0));
        
        for (const wall of walls) {
            // Get wall collider
            const wallBox = wall.userData.collider as THREE.Box3;
            if (!wallBox) {
                console.warn('Wall missing collider:', wall);
                continue;
            }
            
            // Update wall collider to current position
            wallBox.setFromObject(wall);
            
            // Check capsule-box collision
            const closestPoint = new THREE.Vector3();
            wallBox.clampPoint(this.mesh.position, closestPoint);
            
            const distance = this.mesh.position.distanceTo(closestPoint);
            
            if (distance < capsuleRadius) {
                console.log('Collision detected with wall:', {
                    wallPosition: wall.position,
                    playerPosition: this.mesh.position,
                    distance,
                    closestPoint
                });
                
                // Calculate collision normal
                const normal = this.mesh.position.clone()
                    .sub(closestPoint)
                    .normalize();
                
                // Calculate penetration depth
                const penetration = capsuleRadius - distance;
                
                // Resolve collision by moving player out of wall
                this.mesh.position.add(normal.multiplyScalar(penetration + 0.01)); // Add small offset to prevent sticking
                
                // Update velocity
                const dot = this.velocity.dot(normal);
                if (dot < 0) {
                    // Moving into the wall, reflect velocity
                    this.velocity.sub(normal.multiplyScalar(2 * dot));
                    
                    // Apply friction
                    if (normal.y > 0.5) { // Ground collision
                        this.isGrounded = true;
                        this.velocity.y = 0;
                        this.velocity.x *= 0.8;
                        this.velocity.z *= 0.8;
                    } else {
                        // Wall collision - apply friction and prevent wall sliding
                        this.velocity.x *= 0.5;
                        this.velocity.z *= 0.5;
                    }
                }
            }
        }
    }

    updateGroundedState(walls: THREE.Mesh[]) {
        this.wasGrounded = this.isGrounded;
        this.isGrounded = this.checkGrounded(walls);
    }

    checkGrounded(walls: THREE.Mesh[]): boolean {
        const rayOrigin = this.mesh.position.clone();
        rayOrigin.y -= 0.9; // Slightly less than capsule height
        
        const rayDirection = new THREE.Vector3(0, -1, 0);
        const ray = new THREE.Ray(rayOrigin, rayDirection);
        
        for (const wall of walls) {
            const wallBox = wall.userData.collider as THREE.Box3;
            if (!wallBox) continue;
            
            // Update wall collider to current position
            wallBox.setFromObject(wall);
            
            const intersection = ray.intersectBox(wallBox, new THREE.Vector3());
            if (intersection) {
                const distance = rayOrigin.distanceTo(intersection);
                if (distance < this.groundCheckDistance) {
                    return true;
                }
            }
        }
        
        return false;
    }

    checkGroundCollision(walls: THREE.Mesh[]): number | null {
        const rayStart = this.mesh.position.clone();
        rayStart.y += this.groundCheckOffset;
        
        const ray = new THREE.Raycaster(rayStart, new THREE.Vector3(0, -1, 0));
        const distance = this.groundCheckDistance;

        let closestIntersection = null;
        let closestDistance = distance;

        for (const wall of walls) {
            const intersects = ray.intersectObject(wall);
            if (intersects.length > 0 && intersects[0].distance < closestDistance) {
                closestIntersection = intersects[0];
                closestDistance = intersects[0].distance;
            }
        }

        if (closestIntersection) {
            return closestIntersection.point.y;
        }

        return null;
    }

    applyFriction(dt: number) {
        const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

        if (currentSpeed > 0) {
            const reduction = this.isGrounded ? this.deceleration : this.airDeceleration;
            const newSpeed = Math.max(0, currentSpeed - reduction * dt);
            const scale = newSpeed / currentSpeed;
            this.velocity.x *= scale;
            this.velocity.z *= scale;
        }
    }

    move(direction: THREE.Vector3) {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;

        // Calculate target velocity
        const targetVelocity = new THREE.Vector3();
        if (direction.length() > 0) {
            direction.normalize();
            targetVelocity.copy(direction).multiplyScalar(this.speed);
        }

        // Apply acceleration or deceleration
        if (this.isGrounded) {
            // Ground movement with strong acceleration and deceleration
            this.velocity.x = THREE.MathUtils.lerp(
                this.velocity.x,
                targetVelocity.x,
                this.acceleration * deltaTime
            );
            this.velocity.z = THREE.MathUtils.lerp(
                this.velocity.z,
                targetVelocity.z,
                this.acceleration * deltaTime
            );
        } else {
            // Air movement with reduced control
            this.velocity.x = THREE.MathUtils.lerp(
                this.velocity.x,
                targetVelocity.x,
                this.airAcceleration * deltaTime
            );
            this.velocity.z = THREE.MathUtils.lerp(
                this.velocity.z,
                targetVelocity.z,
                this.airAcceleration * deltaTime
            );
        }
    }

    jump() {
        this.jumpBufferTimer = this.jumpBufferTime;
    }

    rotateTowards(targetRotation: number) {
        // Smoothly rotate the player towards the target rotation
        const currentRotation = this.mesh.rotation.y;
        const rotationSpeed = 0.1;
        
        // Calculate the shortest rotation path
        let rotationDiff = targetRotation - currentRotation;
        if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        
        // Apply rotation
        this.mesh.rotation.y += rotationDiff * rotationSpeed;
    }
}