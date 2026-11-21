import * as THREE from 'three';

export interface AabbCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface PhysicsInput {
  /** Joystick horizontal X (-1 left .. +1 right) */
  moveX: number;
  /** Joystick vertical Y (-1 backward .. +1 forward) */
  moveY: number;
  /** Camera / character forward yaw in radians */
  facingYaw: number;
  /** Jump pressed or buffered */
  jumpQueued: boolean;
  /** Sprint toggle state (only sprints while moving forward) */
  sprintEnabled?: boolean;
  /** Smooth slow floating flight mode */
  flying?: boolean;
  /** Optional flight hover elevation above ground (defaults to 0.94m) */
  hoverHeight?: number;
  /** Multiplier on max ground/air movement speed (e.g. Quicksilver Super Speed) */
  speedMultiplier?: number;
  /** Vision Intangibility: passes cleanly through walls/obstacles/NPCs while staying on ground/world bounds */
  intangible?: boolean;
}

export interface PhysicsStepResult {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  grounded: boolean;
  justJumped: boolean;
  landImpactSpeed: number;
  localForwardNorm: number;
  localRightNorm: number;
}

export const BASEPLATE_HALF_INNER = 108.0;
export const BASEPLATE_HALF_OUTER = 109.4;
export const BASEPLATE_BORDER_HEIGHT = 0.28;

const CHAR_RADIUS = 0.34;
const CHAR_HEIGHT = 1.9;
const GRAVITY = -28.0;
const JUMP_SPEED = 9.85;
const MAX_SPEED = 7.4;
const GROUND_ACCEL = 42.0;
const GROUND_DECEL = 34.0;
const AIR_ACCEL = 22.0;
const AIR_DECEL = 6.0;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER_TIME = 0.12;
const FIXED_DT = 1 / 120;

export class CharacterPhysics {
  public readonly position = new THREE.Vector3(0, 0, 0);
  public readonly velocity = new THREE.Vector3(0, 0, 0);

  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private accumulator = 0;

  private readonly colliders: AabbCollider[];

  // Reusable scratch vectors (zero GC in loop)
  private readonly _fwd = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _wishVel = new THREE.Vector3();
  private readonly _resultPos = new THREE.Vector3();
  private readonly _resultVel = new THREE.Vector3();

  constructor() {
    // Minimalistic baseplate + integrated low stone border colliders
    const inner = BASEPLATE_HALF_INNER;
    const outer = BASEPLATE_HALF_OUTER;
    const h = BASEPLATE_BORDER_HEIGHT;

    this.colliders = [
      // Main baseplate floor slab
      {
        minX: -inner,
        maxX: inner,
        minY: -2.0,
        maxY: 0.0,
        minZ: -inner,
        maxZ: inner,
      },
      // North trim (-Z)
      {
        minX: -outer,
        maxX: outer,
        minY: -2.0,
        maxY: h,
        minZ: -outer,
        maxZ: -inner,
      },
      // South trim (+Z)
      {
        minX: -outer,
        maxX: outer,
        minY: -2.0,
        maxY: h,
        minZ: inner,
        maxZ: outer,
      },
      // West trim (-X)
      {
        minX: -outer,
        maxX: -inner,
        minY: -2.0,
        maxY: h,
        minZ: -inner,
        maxZ: inner,
      },
      // East trim (+X)
      {
        minX: inner,
        maxX: outer,
        minY: -2.0,
        maxY: h,
        minZ: -inner,
        maxZ: inner,
      },
    ];
  }

  public addCollider(box: AabbCollider): void {
    this.colliders.push(box);
  }

  public queueJump(): void {
    this.jumpBufferTimer = JUMP_BUFFER_TIME;
  }

  public reset(): void {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.accumulator = 0;
  }

  /** Pushes character cleanly out of any raised AABB obstacles (used when Vision Intangibility turns off) */
  public resolveHorizontalOverlap(): void {
    for (let pass = 0; pass < 3; pass++) {
      this.resolveHorizontalCollisions(false);
    }
    const maxBound = BASEPLATE_HALF_OUTER - CHAR_RADIUS - 0.12;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -maxBound, maxBound);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -maxBound, maxBound);
  }

  public step(dt: number, input: PhysicsInput): PhysicsStepResult {
    const safeDt = Math.min(dt, 0.05);
    if (input.jumpQueued) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME;
    }

    this.accumulator += safeDt;

    let justJumpedAny = false;
    let maxLandImpact = 0;

    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      const sub = this.stepFixed(FIXED_DT, input);
      if (sub.justJumped) justJumpedAny = true;
      if (sub.landImpactSpeed > maxLandImpact) {
        maxLandImpact = sub.landImpactSpeed;
      }
    }

    // Compute local forward/right velocity relative to character facing yaw
    const sinY = Math.sin(input.facingYaw);
    const cosY = Math.cos(input.facingYaw);
    // Forward direction in Three.js for yaw rotation around Y: (-sin(yaw), 0, -cos(yaw))
    this._fwd.set(-sinY, 0, -cosY);
    this._right.set(cosY, 0, -sinY);

    const localForwardNorm =
      (this.velocity.x * this._fwd.x + this.velocity.z * this._fwd.z) / MAX_SPEED;
    const localRightNorm =
      (this.velocity.x * this._right.x + this.velocity.z * this._right.z) / MAX_SPEED;

    this._resultPos.copy(this.position);
    this._resultVel.copy(this.velocity);

    return {
      position: this._resultPos,
      velocity: this._resultVel,
      grounded: this.grounded,
      justJumped: justJumpedAny,
      landImpactSpeed: maxLandImpact,
      localForwardNorm,
      localRightNorm,
    };
  }

  private stepFixed(
    dt: number,
    input: PhysicsInput,
  ): { justJumped: boolean; landImpactSpeed: number } {
    let justJumped = false;
    let landImpactSpeed = 0;

    // Timers
    if (this.grounded) {
      this.coyoteTimer = COYOTE_TIME;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Forward & right unit vectors for facingYaw
    const sinY = Math.sin(input.facingYaw);
    const cosY = Math.cos(input.facingYaw);
    this._fwd.set(-sinY, 0, -cosY);
    this._right.set(cosY, 0, -sinY);

    // Normalize joystick magnitude gently while keeping analog walk->run range
    const rawMag = Math.hypot(input.moveX, input.moveY);
    const clampedMag = Math.min(rawMag, 1);
    let normX = 0;
    let normY = 0;
    if (rawMag > 0.0001) {
      normX = (input.moveX / rawMag) * clampedMag;
      normY = (input.moveY / rawMag) * clampedMag;
    }

    // Sprint only activates when toggle is ON AND character is actively moving forward
    // (never when idle, moving backward, or strafing sideways)
    const isFlying = Boolean(input.flying);
    const speedMul = Math.max(0.25, input.speedMultiplier ?? 1);
    const isMovingForward =
      !isFlying && normY > 0.2 && Math.abs(normY) > Math.abs(normX) * 0.75;
    const sprintActive = Boolean(input.sprintEnabled) && isMovingForward;

    // Flight is swift, responsive, and smoothly controlled
    const speedLimit = (isFlying ? 9.6 : MAX_SPEED) * speedMul;
    const fwdSpeedScale = isFlying
      ? normY >= 0
        ? 1.04
        : 0.86
      : normY >= 0
        ? sprintActive
          ? 1.48
          : 1.0
        : 0.84;
    const strafeScale = isFlying ? 0.94 : 0.88;
    const targetVx =
      (this._fwd.x * normY * fwdSpeedScale + this._right.x * normX * strafeScale) *
      speedLimit;
    const targetVz =
      (this._fwd.z * normY * fwdSpeedScale + this._right.z * normX * strafeScale) *
      speedLimit;

    this._wishVel.set(targetVx, 0, targetVz);

    const hasInput = clampedMag > 0.02;
    const baseAccel = isFlying
      ? hasInput
        ? 22.0
        : 13.5
      : this.grounded
        ? hasInput
          ? GROUND_ACCEL
          : GROUND_DECEL
        : hasInput
          ? AIR_ACCEL
          : AIR_DECEL;
    const accel = baseAccel * Math.max(1, speedMul * 0.82);

    const dvx = this._wishVel.x - this.velocity.x;
    const dvz = this._wishVel.z - this.velocity.z;
    const dvLen = Math.hypot(dvx, dvz);
    const maxStep = accel * dt;

    if (dvLen <= maxStep) {
      this.velocity.x = this._wishVel.x;
      this.velocity.z = this._wishVel.z;
    } else if (dvLen > 0.0001) {
      this.velocity.x += (dvx / dvLen) * maxStep;
      this.velocity.z += (dvz / dvLen) * maxStep;
    }

    if (isFlying) {
      // Graceful floating elevation above ground
      const targetHoverY = input.hoverHeight ?? 0.94;
      const verticalDiff = targetHoverY - this.position.y;
      const desiredVy = THREE.MathUtils.clamp(verticalDiff * 4.8, -2.6, 3.2);
      this.velocity.y = THREE.MathUtils.damp(this.velocity.y, desiredVy, 8.5, dt);
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    } else {
      // Jump execution (coyote + buffered)
      if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
        this.velocity.y = JUMP_SPEED;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        justJumped = true;
      }

      // Gravity
      if (!this.grounded) {
        this.velocity.y += GRAVITY * dt;
      }
    }

    // Move horizontally & resolve XZ collisions against raised colliders
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.resolveHorizontalCollisions(Boolean(input.intangible));

    // Clamp cleanly within outer baseplate boundary
    const maxBound = BASEPLATE_HALF_OUTER - CHAR_RADIUS - 0.12;
    if (this.position.x < -maxBound) {
      this.position.x = -maxBound;
      if (this.velocity.x < 0) this.velocity.x = 0;
    } else if (this.position.x > maxBound) {
      this.position.x = maxBound;
      if (this.velocity.x > 0) this.velocity.x = 0;
    }

    if (this.position.z < -maxBound) {
      this.position.z = -maxBound;
      if (this.velocity.z < 0) this.velocity.z = 0;
    } else if (this.position.z > maxBound) {
      this.position.z = maxBound;
      if (this.velocity.z > 0) this.velocity.z = 0;
    }

    // Move vertically & resolve swept ground/ceiling collisions
    const prevY = this.position.y;
    const prevVy = this.velocity.y;
    this.position.y += this.velocity.y * dt;

    let highestFloor = -Infinity;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (this.overlapsXZ(this.position.x, this.position.z, CHAR_RADIUS, c)) {
        // Check if character feet were at or above top surface (with small tolerance)
        if (prevY >= c.maxY - 0.06 && this.position.y <= c.maxY + 0.002 && this.velocity.y <= 0) {
          if (c.maxY > highestFloor) {
            highestFloor = c.maxY;
          }
        }
      }
    }

    if (highestFloor > -Infinity) {
      if (!this.grounded && prevVy < -0.5) {
        landImpactSpeed = Math.abs(prevVy);
      }
      this.position.y = highestFloor;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      // Check if still supported right beneath feet when walking horizontally
      let supportY = -Infinity;
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        if (this.overlapsXZ(this.position.x, this.position.z, CHAR_RADIUS, c)) {
          if (Math.abs(this.position.y - c.maxY) < 0.025 && this.velocity.y <= 0) {
            if (c.maxY > supportY) supportY = c.maxY;
          }
        }
      }
      if (supportY > -Infinity && this.velocity.y <= 0) {
        this.position.y = supportY;
        this.velocity.y = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    }

    // Safety floor clamp
    if (this.position.y < 0) {
      if (!this.grounded && prevVy < -0.5) {
        landImpactSpeed = Math.abs(prevVy);
      }
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }

    return { justJumped, landImpactSpeed };
  }

  private overlapsXZ(
    px: number,
    pz: number,
    radius: number,
    box: AabbCollider,
  ): boolean {
    const closestX = Math.max(box.minX, Math.min(px, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
    const dx = px - closestX;
    const dz = pz - closestZ;
    return dx * dx + dz * dz < radius * radius;
  }

  private resolveHorizontalCollisions(intangible = false): void {
    if (intangible) return;
    const footY = this.position.y;
    const headY = this.position.y + CHAR_HEIGHT;

    for (let i = 0; i < this.colliders.length; i++) {
      const box = this.colliders[i];
      // Ignore floor slabs or colliders strictly below feet / above head
      if (box.maxY <= footY + 0.04 || box.minY >= headY) continue;

      const closestX = Math.max(box.minX, Math.min(this.position.x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(this.position.z, box.maxZ));
      const dx = this.position.x - closestX;
      const dz = this.position.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < CHAR_RADIUS * CHAR_RADIUS) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = CHAR_RADIUS - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          this.position.x += nx * push;
          this.position.z += nz * push;

          // Cancel inward velocity component
          const vDotN = this.velocity.x * nx + this.velocity.z * nz;
          if (vDotN < 0) {
            this.velocity.x -= nx * vDotN;
            this.velocity.z -= nz * vDotN;
          }
        } else {
          // Center inside AABB fallback: push out along shallowest axis
          const penLeft = Math.abs(this.position.x - box.minX);
          const penRight = Math.abs(box.maxX - this.position.x);
          const penTop = Math.abs(this.position.z - box.minZ);
          const penBottom = Math.abs(box.maxZ - this.position.z);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);

          if (minPen === penLeft) {
            this.position.x = box.minX - CHAR_RADIUS;
            if (this.velocity.x > 0) this.velocity.x = 0;
          } else if (minPen === penRight) {
            this.position.x = box.maxX + CHAR_RADIUS;
            if (this.velocity.x < 0) this.velocity.x = 0;
          } else if (minPen === penTop) {
            this.position.z = box.minZ - CHAR_RADIUS;
            if (this.velocity.z > 0) this.velocity.z = 0;
          } else {
            this.position.z = box.maxZ + CHAR_RADIUS;
            if (this.velocity.z < 0) this.velocity.z = 0;
          }
        }
      }
    }
  }
}
