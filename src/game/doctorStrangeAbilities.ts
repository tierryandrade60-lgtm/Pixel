import * as THREE from 'three';
import { CharacterAnimator } from './characterAnimator';
import { CharacterAppearance } from './characterConfig';
import { createR16Character, R16Rig } from './r16Character';
import { CombatTargetProbe } from './scarletWitchAbilities';

function createMandalaTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size * 0.5;

  ctx.clearRect(0, 0, size, size);

  // Warm orange radial glow backdrop
  const glow = ctx.createRadialGradient(half, half, 12, half, half, half);
  glow.addColorStop(0.0, 'rgba(255, 220, 120, 0.34)');
  glow.addColorStop(0.55, 'rgba(255, 138, 28, 0.24)');
  glow.addColorStop(0.9, 'rgba(255, 102, 12, 0.08)');
  glow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255, 214, 108, 0.96)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(half, half, half * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 146, 36, 0.92)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(half, half, half * 0.78, 0, Math.PI * 2);
  ctx.stroke();

  // Concentric rotated eldritch squares
  ctx.save();
  ctx.translate(half, half);
  for (let s = 0; s < 2; s++) {
    ctx.rotate(Math.PI * 0.25);
    ctx.strokeStyle = s === 0 ? 'rgba(255, 232, 160, 0.94)' : 'rgba(255, 152, 42, 0.9)';
    ctx.lineWidth = 2.6;
    const side = half * 1.1;
    ctx.strokeRect(-side * 0.5, -side * 0.5, side, side);
  }
  ctx.restore();

  // Outer ring runes/ticks
  ctx.strokeStyle = 'rgba(255, 238, 185, 0.95)';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    const r0 = half * 0.79;
    const r1 = half * 0.89;
    ctx.beginPath();
    ctx.moveTo(half + Math.cos(a) * r0, half + Math.sin(a) * r0);
    ctx.lineTo(half + Math.cos(a) * r1, half + Math.sin(a) * r1);
    ctx.stroke();
  }

  // Inner circle
  ctx.beginPath();
  ctx.arc(half, half, half * 0.36, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSparkTexture(): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 248, 210, 1)');
  grad.addColorStop(0.35, 'rgba(255, 164, 48, 0.88)');
  grad.addColorStop(0.75, 'rgba(255, 102, 14, 0.3)');
  grad.addColorStop(1.0, 'rgba(180, 50, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface CloneEntity {
  rig: R16Rig;
  animator: CharacterAnimator;
  startPos: THREE.Vector3;
  pos: THREE.Vector3;
  chainMesh: THREE.Mesh;
  chainGlow: THREE.Sprite;
}

interface MirrorShardProjectile {
  group: THREE.Group;
  crystal: THREE.Mesh;
  rim: THREE.Mesh;
  halo: THREE.Sprite;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  hitIds: Set<string>;
}

interface MirrorShardFragment {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  life: number;
}

export class DoctorStrangeVfxSystem {
  public readonly group = new THREE.Group();

  private readonly mandalaTex: THREE.CanvasTexture;
  private readonly sparkTex: THREE.CanvasTexture;

  // Mystic Mandala Shield (thin circular orange rotating rune shield)
  private readonly shieldGroup = new THREE.Group();
  private readonly shieldDiscFront: THREE.Mesh;
  private readonly shieldDiscInner: THREE.Mesh;
  private shieldActive = false;
  private shieldBlend = 0;

  // Mystic Clones & Chains sequence
  private clonesState: {
    phase: 'binding' | 'returning';
    elapsed: number;
    bindDuration: number;
    returnDuration: number;
    targetId: string;
    targetPos: THREE.Vector3;
    clones: CloneEntity[];
    dmgAccum: number;
  } | null = null;

  // Dimensional Mirror projectiles & shatter burst fragments
  private readonly mirrorGeo = new THREE.OctahedronGeometry(0.24, 0);
  private readonly mirrorFragGeo = new THREE.OctahedronGeometry(0.085, 0);
  private readonly mirrorShards: MirrorShardProjectile[] = [];
  private readonly mirrorFragments: MirrorShardFragment[] = [];

  private readonly _tmpDir = new THREE.Vector3();
  private animTime = 0;

  constructor(private readonly appearance: CharacterAppearance) {
    this.mandalaTex = createMandalaTexture();
    this.sparkTex = createSparkTexture();

    // Front Mandala Shield
    this.shieldGroup.visible = false;
    const shieldGeo = new THREE.CircleGeometry(0.98, 40);
    const shieldMatFront = new THREE.MeshBasicMaterial({
      map: this.mandalaTex,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shieldDiscFront = new THREE.Mesh(shieldGeo, shieldMatFront);

    const innerGeo = new THREE.CircleGeometry(0.58, 32);
    const innerMat = shieldMatFront.clone();
    this.shieldDiscInner = new THREE.Mesh(innerGeo, innerMat);
    this.shieldDiscInner.position.z = -0.02;

    this.shieldGroup.add(this.shieldDiscFront, this.shieldDiscInner);
    this.group.add(this.shieldGroup);
  }

  public setShieldActive(active: boolean): void {
    this.shieldActive = active;
  }

  public isShieldActive(): boolean {
    return this.shieldActive;
  }

  public isClonesActive(): boolean {
    return this.clonesState !== null;
  }

  public spawnMysticClones(
    targetId: string,
    targetPos: THREE.Vector3,
    strangeAppearance: CharacterAppearance,
  ): boolean {
    if (this.clonesState) return false;

    const clones: CloneEntity[] = [];
    const chainGeo = new THREE.CylinderGeometry(0.042, 0.042, 1, 8);
    chainGeo.rotateX(Math.PI * 0.5);

    const count = 4;
    for (let i = 0; i < count; i++) {
      const baseAngle = (i * Math.PI * 2) / count + (Math.random() - 0.5) * 0.65;
      const rad = 2.9 + Math.random() * 1.1;
      const elevation = 1.05 + Math.random() * 1.25;
      const pos = new THREE.Vector3(
        targetPos.x + Math.cos(baseAngle) * rad,
        elevation,
        targetPos.z + Math.sin(baseAngle) * rad,
      );

      const rig = createR16Character(strangeAppearance);
      const facingYaw = Math.atan2(-(targetPos.x - pos.x), -(targetPos.z - pos.z));
      rig.root.position.copy(pos);
      rig.root.rotation.y = facingYaw;
      rig.setIntangible(true, 0.3);
      this.group.add(rig.root);

      const animator = new CharacterAnimator(rig, 'doctor-strange');
      animator.triggerCast('strange-clones-cast', 4.0);

      const chainMat = new THREE.MeshBasicMaterial({
        color: 0xffa638,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const chainMesh = new THREE.Mesh(chainGeo, chainMat);
      this.group.add(chainMesh);

      const chainGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.sparkTex,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      chainGlow.scale.setScalar(0.75);
      this.group.add(chainGlow);

      clones.push({
        rig,
        animator,
        startPos: pos.clone(),
        pos,
        chainMesh,
        chainGlow,
      });
    }

    this.clonesState = {
      phase: 'binding',
      elapsed: 0,
      bindDuration: 4.0,
      returnDuration: 0.55,
      targetId,
      targetPos: targetPos.clone(),
      clones,
      dmgAccum: 0,
    };
    return true;
  }

  public spawnMirrorShard(origin: THREE.Vector3, targetPoint: THREE.Vector3): void {
    const grp = new THREE.Group();
    grp.position.copy(origin);

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xe6f8ff,
      roughness: 0.08,
      metalness: 0.9,
      emissive: 0x80d8ff,
      emissiveIntensity: 0.42,
      transparent: true,
      opacity: 0.94,
    });
    const crystal = new THREE.Mesh(this.mirrorGeo, crystalMat);
    crystal.scale.set(0.82, 1.55, 0.56);

    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xffb84d,
      wireframe: true,
      transparent: true,
      opacity: 0.72,
    });
    const rim = new THREE.Mesh(this.mirrorGeo, rimMat);
    rim.scale.set(0.92, 1.68, 0.64);

    const haloMat = new THREE.SpriteMaterial({
      map: this.sparkTex,
      color: 0xc2f0ff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(0.88);

    grp.add(crystal, rim, halo);
    grp.lookAt(targetPoint);
    this.group.add(grp);

    const dir = this._tmpDir.copy(targetPoint).sub(origin);
    if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
    else dir.normalize();

    this.mirrorShards.push({
      group: grp,
      crystal,
      rim,
      halo,
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(30),
      age: 0,
      maxAge: 1.5,
      hitIds: new Set(),
    });
  }

  private spawnMirrorShatterBurst(pos: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0xffc86b : 0xdff5ff,
        roughness: 0.1,
        metalness: 0.85,
        emissive: i % 3 === 0 ? 0xff9a2e : 0x7fd4ff,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.92,
      });
      const mesh = new THREE.Mesh(this.mirrorFragGeo, mat);
      mesh.position.copy(pos);
      mesh.scale.set(0.9, 1.35, 0.45);
      this.group.add(mesh);
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.35;
      this.mirrorFragments.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(a) * (3.6 + Math.random() * 2.8),
          1.6 + Math.random() * 2.5,
          Math.sin(a) * (3.6 + Math.random() * 2.8),
        ),
        age: 0,
        life: 0.48,
      });
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    targets: ReadonlyArray<CombatTargetProbe>,
    callbacks: {
      onClonesTickDamage?: (targetId: string, damage: number) => void;
      onClonesEnd?: (targetId: string) => void;
      onMirrorHitTarget?: (targetId: string, hitDir: THREE.Vector3) => void;
    },
  ): void {
    const safeDt = Math.min(dt, 0.05);
    this.animTime += safeDt;

    // 1. Mystic Mandala Shield
    this.shieldBlend = THREE.MathUtils.damp(
      this.shieldBlend,
      this.shieldActive ? 1 : 0,
      15,
      safeDt,
    );
    this.shieldGroup.visible = this.shieldBlend > 0.02;
    if (this.shieldGroup.visible) {
      const fwdX = -Math.sin(playerYaw);
      const fwdZ = -Math.cos(playerYaw);
      this.shieldGroup.position.set(
        playerPos.x + fwdX * 0.78,
        playerPos.y + 1.08,
        playerPos.z + fwdZ * 0.78,
      );
      this.shieldGroup.rotation.y = playerYaw;
      this.shieldGroup.scale.setScalar(0.35 + this.shieldBlend * 0.65);
      this.shieldDiscFront.rotation.z += safeDt * 1.45;
      this.shieldDiscInner.rotation.z -= safeDt * 2.25;
    }

    // 2. Mystic Clones & Chains
    if (this.clonesState) {
      const cs = this.clonesState;
      cs.elapsed += safeDt;

      if (cs.phase === 'binding') {
        cs.dmgAccum += safeDt;
        if (cs.dmgAccum >= 0.8) {
          cs.dmgAccum -= 0.8;
          callbacks.onClonesTickDamage?.(cs.targetId, 5);
        }

        const chestPos = new THREE.Vector3(
          cs.targetPos.x,
          cs.targetPos.y + 1.05,
          cs.targetPos.z,
        );

        for (let i = 0; i < cs.clones.length; i++) {
          const c = cs.clones[i];
          const hover = Math.sin(this.animTime * 3.5 + i * 1.7) * 0.14;
          c.rig.root.position.set(c.startPos.x, c.startPos.y + hover, c.startPos.z);
          c.animator.update(safeDt, {
            localForward: 0,
            localRight: 0,
            verticalVelocity: 0,
            grounded: false,
            justJumped: false,
            landImpactSpeed: 0,
            flying: true,
          });

          // Orange chain connecting clone to target
          const start = new THREE.Vector3(
            c.rig.root.position.x,
            c.rig.root.position.y + 1.15,
            c.rig.root.position.z,
          );
          const mid = start.clone().lerp(chestPos, 0.5);
          const len = start.distanceTo(chestPos);
          c.chainMesh.position.copy(mid);
          c.chainMesh.lookAt(chestPos);
          c.chainMesh.scale.set(1, 1, Math.max(0.1, len));
          c.chainGlow.position.copy(
            start.clone().lerp(chestPos, (this.animTime * 2.4 + i * 0.25) % 1),
          );
        }

        if (cs.elapsed >= cs.bindDuration) {
          cs.phase = 'returning';
          cs.elapsed = 0;
          callbacks.onClonesEnd?.(cs.targetId);
          for (const c of cs.clones) {
            c.chainMesh.visible = false;
            c.chainGlow.visible = false;
          }
        }
      } else {
        const u = Math.min(1, cs.elapsed / cs.returnDuration);
        const mergeTarget = new THREE.Vector3(playerPos.x, playerPos.y + 0.1, playerPos.z);
        for (const c of cs.clones) {
          c.pos.lerpVectors(c.startPos, mergeTarget, u * u);
          c.rig.root.position.copy(c.pos);
          c.rig.root.scale.setScalar(Math.max(0.08, 1 - u * 0.85));
        }
        if (u >= 1) {
          for (const c of cs.clones) {
            this.group.remove(c.rig.root);
            this.group.remove(c.chainMesh);
            this.group.remove(c.chainGlow);
            (c.chainMesh.material as THREE.Material).dispose();
            (c.chainGlow.material as THREE.Material).dispose();
            c.rig.dispose();
          }
          this.clonesState = null;
        }
      }
    }

    // 3. Dimensional Mirror Shard Projectiles
    for (let i = this.mirrorShards.length - 1; i >= 0; i--) {
      const ms = this.mirrorShards[i];
      ms.age += safeDt;
      ms.pos.addScaledVector(ms.vel, safeDt);
      ms.group.position.copy(ms.pos);
      ms.crystal.rotation.z += safeDt * 9;
      ms.rim.rotation.z -= safeDt * 6;

      let done = ms.age >= ms.maxAge || ms.pos.y <= 0.1;
      if (!done) {
        for (let k = 0; k < targets.length; k++) {
          const trg = targets[k];
          if (ms.hitIds.has(trg.id)) continue;
          const dx = ms.pos.x - trg.position.x;
          const dz = ms.pos.z - trg.position.z;
          const dy = ms.pos.y - (trg.position.y + trg.height * 0.56);
          const hitR = trg.radius + 0.42;
          if (dx * dx + dz * dz <= hitR * hitR && Math.abs(dy) <= trg.height * 0.68) {
            ms.hitIds.add(trg.id);
            this._tmpDir.copy(ms.vel).setY(0).normalize();
            callbacks.onMirrorHitTarget?.(trg.id, this._tmpDir);
            this.spawnMirrorShatterBurst(ms.pos);
            done = true;
            break;
          }
        }
      } else {
        this.spawnMirrorShatterBurst(ms.pos);
      }

      if (done) {
        this.group.remove(ms.group);
        (ms.crystal.material as THREE.Material).dispose();
        (ms.rim.material as THREE.Material).dispose();
        (ms.halo.material as THREE.Material).dispose();
        this.mirrorShards.splice(i, 1);
      }
    }

    // 4. Mirror Shatter Fragments
    for (let i = this.mirrorFragments.length - 1; i >= 0; i--) {
      const mf = this.mirrorFragments[i];
      mf.age += safeDt;
      mf.vel.y -= 12 * safeDt;
      mf.mesh.position.addScaledVector(mf.vel, safeDt);
      mf.mesh.rotation.x += safeDt * 11;
      mf.mesh.rotation.y += safeDt * 8;
      const t = mf.age / mf.life;
      mf.mesh.scale.setScalar(1 - t * 0.8);
      const mat = mf.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.92 * (1 - t);
      if (mf.age >= mf.life) {
        this.group.remove(mf.mesh);
        mat.dispose();
        this.mirrorFragments.splice(i, 1);
      }
    }
  }

  public clearAll(onClonesRelease?: (targetId: string) => void): void {
    this.shieldActive = false;
    this.shieldBlend = 0;
    this.shieldGroup.visible = false;

    for (const ms of this.mirrorShards) {
      this.group.remove(ms.group);
      (ms.crystal.material as THREE.Material).dispose();
      (ms.rim.material as THREE.Material).dispose();
      (ms.halo.material as THREE.Material).dispose();
    }
    this.mirrorShards.length = 0;

    for (const mf of this.mirrorFragments) {
      this.group.remove(mf.mesh);
      (mf.mesh.material as THREE.Material).dispose();
    }
    this.mirrorFragments.length = 0;

    if (this.clonesState) {
      if (this.clonesState.phase === 'binding') {
        onClonesRelease?.(this.clonesState.targetId);
      }
      for (const c of this.clonesState.clones) {
        this.group.remove(c.rig.root);
        this.group.remove(c.chainMesh);
        this.group.remove(c.chainGlow);
        (c.chainMesh.material as THREE.Material).dispose();
        (c.chainGlow.material as THREE.Material).dispose();
        c.rig.dispose();
      }
      this.clonesState = null;
    }
  }

  public dispose(): void {
    this.clearAll();
    this.mirrorGeo.dispose();
    this.mirrorFragGeo.dispose();
    this.mandalaTex.dispose();
    this.sparkTex.dispose();
    this.shieldDiscFront.geometry.dispose();
    (this.shieldDiscFront.material as THREE.Material).dispose();
    this.shieldDiscInner.geometry.dispose();
    (this.shieldDiscInner.material as THREE.Material).dispose();
    void this.appearance;
  }
}
