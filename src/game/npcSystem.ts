import * as THREE from 'three';
import { CharacterAnimator } from './characterAnimator';
import {
  CHARACTER_PRESETS,
  CharacterAppearance,
  CharacterArchetype,
} from './characterConfig';
import { BASEPLATE_HALF_INNER } from './physics';
import { createR16Character, R16Rig } from './r16Character';
import { R16Ragdoll } from './ragdoll';
import { CombatTargetProbe } from './scarletWitchAbilities';

export type NpcCategory = 'bandit' | 'prisoner' | 'basic';

export interface NpcHudSnapshot {
  id: string;
  name: string;
  category: NpcCategory;
  level?: number;
  hp: number;
  maxHp: number;
  trailHp: number;
  visible: boolean;
  screenX: number;
  screenY: number;
  scale: number;
  isTargeted: boolean;
  damageNumber: {
    active: boolean;
    total: number;
    scale: number;
    opacity: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface NpcEliminationEvent {
  id: string;
  coins: number;
  screenX: number;
  screenY: number;
}

interface NpcActor {
  id: string;
  name: string;
  category: NpcCategory;
  archetype: CharacterArchetype;
  weaponKind: 'none' | 'blade' | 'mace';
  level?: number;
  coinReward: number;
  rig: R16Rig;
  animator: CharacterAnimator;
  ragdoll: R16Ragdoll;
  spawnPos: THREE.Vector3;
  zoneCenter: THREE.Vector3;
  zoneRadius: number;
  patrolTarget: THREE.Vector3;
  patrolPause: number;
  position: THREE.Vector3;
  verticalVelocity: number;
  facingYaw: number;
  hp: number;
  maxHp: number;
  trailHp: number;
  trailHoldTimer: number;
  ragdollTimer: number;
  hitFlashTimer: number;
  respawnTimer: number;
  burningTimer: number;
  burnDps: number;
  burnTickAccum: number;
  burnSprite: THREE.Sprite;
  painRestricted: boolean;
  paralyzed: boolean;
  paralysisImmune: boolean;
  externalControl: boolean;
  externalHeadache: boolean;
  headacheTimer: number;
  rewardClaimed: boolean;
  aggro: boolean;
  attackCooldown: number;
  attackPendingHit: boolean;
  attackHitDelay: number;
  attackKind: 'weapon' | 'punch';
  attackDamage: number;
  punchNextHand: 'left' | 'right';
  moveSpeed: number;
  damageDisplay: {
    active: boolean;
    total: number;
    popTimer: number;
    idleTimer: number;
    offsetX: number;
    offsetY: number;
    driftDir: number;
  };
}

const DAMAGE_AGGREGATE_HOLD_SEC = 1.25;
const DAMAGE_FADE_DURATION_SEC = 0.42;
const TRAIL_DELAY_SEC = 0.45;
const DETECT_RANGE_M = 14.5;
const ZONE_CHASE_LIMIT_M = 24.0;

function createBurnAuraTexture(): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half + 6, 3, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 240, 170, 0.92)');
  grad.addColorStop(0.45, 'rgba(255, 118, 18, 0.72)');
  grad.addColorStop(0.8, 'rgba(220, 38, 10, 0.25)');
  grad.addColorStop(1.0, 'rgba(120, 10, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function rollPrisonerStats(): {
  level: number;
  maxHp: number;
  attackDamage: number;
  moveSpeed: number;
  coinReward: number;
} {
  const level = 1 + Math.floor(Math.random() * 100);
  return {
    level,
    maxHp: Math.round(90 + level * 2.2),
    attackDamage: Math.round(5 + level * 0.16),
    moveSpeed: 3.5 + (level / 100) * 1.45,
    coinReward: Math.round(14 + level * 0.65),
  };
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

export class NpcCombatSystem {
  public readonly group = new THREE.Group();
  private readonly npcs: NpcActor[] = [];
  private readonly burnTex: THREE.CanvasTexture;
  private selectedTargetId: string | null = null;
  private pendingEliminations: Array<{
    id: string;
    coins: number;
    worldPos: THREE.Vector3;
  }> = [];
  private animTime = 0;

  private readonly _proj = new THREE.Vector3();
  private readonly _fwd = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _toNpc = new THREE.Vector3();
  private readonly _hitDir = new THREE.Vector3();

  private readonly idleMotion = {
    localForward: 0,
    localRight: 0,
    verticalVelocity: 0,
    grounded: true,
    justJumped: false,
    landImpactSpeed: 0,
  };

  private readonly walkMotion = {
    localForward: 0.72,
    localRight: 0,
    verticalVelocity: 0,
    grounded: true,
    justJumped: false,
    landImpactSpeed: 0,
  };

  constructor() {
    this.burnTex = createBurnAuraTexture();

    const banditCenter = new THREE.Vector3(-18, 0, -14);
    const prisonerCenter = new THREE.Vector3(18, 0, -14);
    const basicCenter = new THREE.Vector3(0, 0, 15);

    const spawns: Array<{
      id: string;
      name: string;
      category: NpcCategory;
      preset: CharacterAppearance;
      weaponKind: 'none' | 'blade' | 'mace';
      x: number;
      z: number;
      yaw: number;
      zoneCenter: THREE.Vector3;
      zoneRadius: number;
      maxHp?: number;
      attackDamage?: number;
      moveSpeed?: number;
      coinReward?: number;
    }> = [
      // Zone 1: Bandit Zone (Northwest Courtyard) - 2 variants x 2 = 4 Bandits with held weapons
      {
        id: 'bandit-1',
        name: 'Bandit',
        category: 'bandit',
        preset: CHARACTER_PRESETS.banditBlade,
        weaponKind: 'blade',
        x: -20.8,
        z: -11.2,
        yaw: -0.45,
        zoneCenter: banditCenter,
        zoneRadius: 10.5,
        maxHp: 165,
        attackDamage: 14,
        moveSpeed: 4.15,
        coinReward: 32,
      },
      {
        id: 'bandit-2',
        name: 'Bandit',
        category: 'bandit',
        preset: CHARACTER_PRESETS.banditBlade,
        weaponKind: 'blade',
        x: -14.8,
        z: -16.8,
        yaw: 0.3,
        zoneCenter: banditCenter,
        zoneRadius: 10.5,
        maxHp: 165,
        attackDamage: 14,
        moveSpeed: 4.15,
        coinReward: 32,
      },
      {
        id: 'bandit-3',
        name: 'Bandit',
        category: 'bandit',
        preset: CHARACTER_PRESETS.banditMace,
        weaponKind: 'mace',
        x: -21.5,
        z: -17.6,
        yaw: -0.8,
        zoneCenter: banditCenter,
        zoneRadius: 10.5,
        maxHp: 190,
        attackDamage: 18,
        moveSpeed: 3.85,
        coinReward: 38,
      },
      {
        id: 'bandit-4',
        name: 'Bandit',
        category: 'bandit',
        preset: CHARACTER_PRESETS.banditMace,
        weaponKind: 'mace',
        x: -14.4,
        z: -10.8,
        yaw: 0.55,
        zoneCenter: banditCenter,
        zoneRadius: 10.5,
        maxHp: 190,
        attackDamage: 18,
        moveSpeed: 3.85,
        coinReward: 38,
      },

      // Zone 2: Prisoner Zone (Northeast Yard) - 2 variants x 2 = 4 Prisoners (Lv 1-100, close punches)
      {
        id: 'prisoner-1',
        name: 'Prisoner',
        category: 'prisoner',
        preset: CHARACTER_PRESETS.prisonerOrange,
        weaponKind: 'none',
        x: 15.2,
        z: -11.4,
        yaw: 0.45,
        zoneCenter: prisonerCenter,
        zoneRadius: 10.5,
      },
      {
        id: 'prisoner-2',
        name: 'Prisoner',
        category: 'prisoner',
        preset: CHARACTER_PRESETS.prisonerOrange,
        weaponKind: 'none',
        x: 20.8,
        z: -16.6,
        yaw: -0.35,
        zoneCenter: prisonerCenter,
        zoneRadius: 10.5,
      },
      {
        id: 'prisoner-3',
        name: 'Prisoner',
        category: 'prisoner',
        preset: CHARACTER_PRESETS.prisonerStriped,
        weaponKind: 'none',
        x: 14.6,
        z: -17.4,
        yaw: 0.75,
        zoneCenter: prisonerCenter,
        zoneRadius: 10.5,
      },
      {
        id: 'prisoner-4',
        name: 'Prisoner',
        category: 'prisoner',
        preset: CHARACTER_PRESETS.prisonerStriped,
        weaponKind: 'none',
        x: 21.4,
        z: -11.0,
        yaw: -0.5,
        zoneCenter: prisonerCenter,
        zoneRadius: 10.5,
      },

      // Zone 3: Basic NPC Zone (South Plaza) - 2 stationary peaceful civilians
      {
        id: 'basic-1',
        name: 'Civilian',
        category: 'basic',
        preset: CHARACTER_PRESETS.basicCivilianA,
        weaponKind: 'none',
        x: -3.2,
        z: 15.0,
        yaw: 0.25,
        zoneCenter: basicCenter,
        zoneRadius: 6.0,
        maxHp: 120,
        attackDamage: 0,
        moveSpeed: 0,
        coinReward: 10,
      },
      {
        id: 'basic-2',
        name: 'Citizen',
        category: 'basic',
        preset: CHARACTER_PRESETS.basicCivilianB,
        weaponKind: 'none',
        x: 3.2,
        z: 15.0,
        yaw: -0.25,
        zoneCenter: basicCenter,
        zoneRadius: 6.0,
        maxHp: 120,
        attackDamage: 0,
        moveSpeed: 0,
        coinReward: 10,
      },
    ];

    for (const sp of spawns) {
      const rig = createR16Character(sp.preset);
      rig.root.position.set(sp.x, 0, sp.z);
      rig.root.rotation.y = sp.yaw;
      if (sp.weaponKind !== 'none') {
        rig.setNpcWeapon(sp.weaponKind);
      }
      this.group.add(rig.root);

      const burnMat = new THREE.SpriteMaterial({
        map: this.burnTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const burnSprite = new THREE.Sprite(burnMat);
      burnSprite.visible = false;
      burnSprite.scale.set(1.05, 1.35, 1);
      this.group.add(burnSprite);

      const archetype = sp.preset.archetype ?? 'standard';
      const animator = new CharacterAnimator(rig, archetype);
      const ragdoll = new R16Ragdoll(rig);

      let level: number | undefined;
      let maxHp = sp.maxHp ?? 150;
      let attackDamage = sp.attackDamage ?? 10;
      let moveSpeed = sp.moveSpeed ?? 3.8;
      let coinReward = sp.coinReward ?? 20;

      if (sp.category === 'prisoner') {
        const rolled = rollPrisonerStats();
        level = rolled.level;
        maxHp = rolled.maxHp;
        attackDamage = rolled.attackDamage;
        moveSpeed = rolled.moveSpeed;
        coinReward = rolled.coinReward;
      }

      const patrolTarget = new THREE.Vector3(sp.x, 0, sp.z);
      this.npcs.push({
        id: sp.id,
        name: sp.name,
        category: sp.category,
        archetype,
        weaponKind: sp.weaponKind,
        level,
        coinReward,
        rig,
        animator,
        ragdoll,
        spawnPos: new THREE.Vector3(sp.x, 0, sp.z),
        zoneCenter: sp.zoneCenter.clone(),
        zoneRadius: sp.zoneRadius,
        patrolTarget,
        patrolPause: 0.6 + Math.random() * 1.4,
        position: new THREE.Vector3(sp.x, 0, sp.z),
        verticalVelocity: 0,
        facingYaw: sp.yaw,
        hp: maxHp,
        maxHp,
        trailHp: maxHp,
        trailHoldTimer: 0,
        ragdollTimer: 0,
        hitFlashTimer: 0,
        respawnTimer: 0,
        burningTimer: 0,
        burnDps: 2,
        burnTickAccum: 0,
        burnSprite,
        painRestricted: false,
        paralyzed: false,
        paralysisImmune: false,
        externalControl: false,
        externalHeadache: false,
        headacheTimer: 0,
        rewardClaimed: false,
        aggro: false,
        attackCooldown: Math.random() * 0.4,
        attackPendingHit: false,
        attackHitDelay: 0,
        attackKind: sp.category === 'bandit' ? 'weapon' : 'punch',
        attackDamage,
        punchNextHand: Math.random() > 0.5 ? 'right' : 'left',
        moveSpeed,
        damageDisplay: {
          active: false,
          total: 0,
          popTimer: 0,
          idleTimer: 0,
          offsetX: 0,
          offsetY: 0,
          driftDir: 1,
        },
      });
    }
  }

  private pickPatrolTarget(npc: NpcActor): void {
    const angle = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * Math.max(2.0, npc.zoneRadius - 2.0);
    npc.patrolTarget.set(
      npc.zoneCenter.x + Math.cos(angle) * rad,
      0,
      npc.zoneCenter.z + Math.sin(angle) * rad,
    );
    npc.patrolPause = 1.0 + Math.random() * 2.0;
  }

  public getTargetProbes(): CombatTargetProbe[] {
    const probes: CombatTargetProbe[] = [];
    for (const npc of this.npcs) {
      if (npc.hp <= 0) continue;
      probes.push({
        id: npc.id,
        position: npc.position,
        radius: 0.45,
        height: 1.85,
      });
    }
    return probes;
  }

  public getSelectedTargetId(): string | null {
    if (!this.selectedTargetId) return null;
    const npc = this.npcs.find((n) => n.id === this.selectedTargetId);
    if (!npc || npc.hp <= 0) return null;
    return npc.id;
  }

  public findClosestTargetId(fromPos: THREE.Vector3, maxDistance: number): string | null {
    let bestId: string | null = null;
    let bestDist = maxDistance;
    for (const npc of this.npcs) {
      if (npc.hp <= 0) continue;
      const d = npc.position.distanceTo(fromPos);
      if (d <= bestDist) {
        bestDist = d;
        bestId = npc.id;
      }
    }
    return bestId;
  }

  public isTargetAlive(targetId: string): boolean {
    const npc = this.npcs.find((n) => n.id === targetId);
    return Boolean(npc && npc.hp > 0);
  }

  public getTargetTorsoPosition(targetId: string, out: THREE.Vector3): boolean {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc || npc.hp <= 0) return false;
    out.set(npc.position.x, npc.position.y + 1.05, npc.position.z);
    return true;
  }

  public getTargetHeadPosition(targetId: string, out: THREE.Vector3): boolean {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc || npc.hp <= 0) return false;
    out.set(
      npc.position.x,
      npc.position.y + (npc.ragdoll.active ? 0.52 : 1.56),
      npc.position.z,
    );
    return true;
  }

  public getNpcSwordEmbedPose(
    targetId: string,
    outPos: THREE.Vector3,
  ): { alive: boolean; facingYaw: number } {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc || npc.hp <= 0) return { alive: false, facingYaw: 0 };
    outPos.set(
      npc.position.x,
      npc.position.y + (npc.ragdoll.active ? 0.35 : 1.05),
      npc.position.z,
    );
    return { alive: true, facingYaw: npc.facingYaw };
  }

  public getSelectedTargetAimPoint(out: THREE.Vector3): boolean {
    if (!this.selectedTargetId) return false;
    const npc = this.npcs.find((n) => n.id === this.selectedTargetId);
    if (!npc || npc.hp <= 0) return false;
    out.set(npc.position.x, npc.position.y + 1.05, npc.position.z);
    return true;
  }

  public isPositionBlockedByNpc(pos: THREE.Vector3, radius = 0.65): boolean {
    for (const npc of this.npcs) {
      if (npc.hp <= 0) continue;
      const dx = pos.x - npc.position.x;
      const dz = pos.z - npc.position.z;
      if (dx * dx + dz * dz < radius * radius) {
        return true;
      }
    }
    return false;
  }

  public setPainRestricted(targetId: string, restricted: boolean): void {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc) return;
    npc.painRestricted = restricted;
    if (restricted) {
      npc.attackPendingHit = false;
    }
  }

  public setParalyzed(targetId: string, active: boolean): void {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc) return;
    npc.paralyzed = active;
    if (active) {
      npc.attackPendingHit = false;
    }
  }

  public setMindControlParalysis(targetId: string, active: boolean): void {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc) return;
    npc.paralyzed = active;
    npc.paralysisImmune = active;
    npc.rig.setWhiteOutline(active);
    if (active) {
      npc.attackPendingHit = false;
    }
  }

  public setExternalControl(targetId: string, active: boolean): void {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc) return;
    npc.externalControl = active;
    if (active) {
      npc.attackPendingHit = false;
      npc.verticalVelocity = 0;
    } else {
      npc.externalHeadache = false;
      npc.position.y = Math.max(0, npc.position.y);
      npc.verticalVelocity = 0;
    }
  }

  public setExternalPose(
    targetId: string,
    pos: THREE.Vector3,
    facingYaw?: number,
    options?: { headache?: boolean },
  ): void {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc || npc.hp <= 0) return;
    const maxBound = BASEPLATE_HALF_INNER - 0.85;
    npc.position.set(
      THREE.MathUtils.clamp(pos.x, -maxBound, maxBound),
      Math.max(0, pos.y),
      THREE.MathUtils.clamp(pos.z, -maxBound, maxBound),
    );
    if (facingYaw !== undefined) {
      npc.facingYaw = facingYaw;
    }
    if (options?.headache !== undefined) {
      npc.externalHeadache = options.headache;
    }
  }

  public clearAllCrowdControl(): void {
    for (const npc of this.npcs) {
      npc.painRestricted = false;
      npc.paralyzed = false;
      npc.paralysisImmune = false;
      npc.rig.setWhiteOutline(false);
      npc.externalControl = false;
      npc.externalHeadache = false;
      npc.verticalVelocity = 0;
      npc.position.y = 0;
    }
  }

  public applyHeadache(targetId: string, durationSec: number): void {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc || npc.hp <= 0) return;
    npc.headacheTimer = Math.max(npc.headacheTimer, durationSec);
    npc.attackPendingHit = false;
  }

  public applyGlobalDamage(amount: number): number {
    let hitCount = 0;
    const dir = this._fwd.set(0, 0, -1);
    for (const npc of this.npcs) {
      if (npc.hp <= 0) continue;
      if (this.applyDamage(npc.id, amount, dir, 0)) {
        hitCount++;
      }
    }
    return hitCount;
  }

  public applyBurn(targetId: string, durationSec: number, dps = 2): void {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc || npc.hp <= 0) return;
    const wasBurning = npc.burningTimer > 0;
    npc.burningTimer = Math.max(npc.burningTimer, durationSec);
    npc.burnDps = dps;
    if (!wasBurning) {
      npc.burnTickAccum = 0;
    }
  }

  public triggerTargetRagdoll(
    targetId: string,
    ragdollDurationSec: number,
    knockbackImpulse?: THREE.Vector3,
  ): void {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc || (npc.paralysisImmune && npc.hp > 0)) return;
    npc.attackPendingHit = false;
    npc.ragdollTimer = Math.max(npc.ragdollTimer, ragdollDurationSec);
    if (!npc.ragdoll.active) {
      npc.ragdoll.trigger(
        npc.position,
        new THREE.Vector3(),
        npc.facingYaw,
        knockbackImpulse,
      );
    }
  }

  public applyDamage(
    targetId: string,
    amount: number,
    hitDir: THREE.Vector3,
    ragdollDurationSec = 0,
    knockbackImpulse?: THREE.Vector3,
  ): boolean {
    const npc = this.npcs.find((n) => n.id === targetId);
    if (!npc || npc.hp <= 0 || amount <= 0) return false;

    npc.hp = Math.max(0, npc.hp - amount);
    npc.trailHoldTimer = TRAIL_DELAY_SEC;
    npc.hitFlashTimer = 0.14;

    // Bandits and Prisoners aggro on damage; Basic NPCs remain completely peaceful
    if (npc.category !== 'basic') {
      npc.aggro = true;
    }

    const dd = npc.damageDisplay;
    if (!dd.active) {
      const side = Math.random() > 0.5 ? 1 : -1;
      dd.active = true;
      dd.total = amount;
      dd.driftDir = side;
      dd.offsetX = side * (62 + Math.random() * 10);
      dd.offsetY = -4 - Math.random() * 8;
    } else {
      dd.total += amount;
    }
    dd.popTimer = 0.22;
    dd.idleTimer = 0;

    const immuneToCc = npc.paralysisImmune && npc.hp > 0;
    if (!immuneToCc) {
      if (ragdollDurationSec > 0) {
        npc.attackPendingHit = false;
        npc.ragdollTimer = Math.max(npc.ragdollTimer, ragdollDurationSec);
        if (!npc.ragdoll.active) {
          npc.ragdoll.trigger(
            npc.position,
            new THREE.Vector3(),
            npc.facingYaw,
            knockbackImpulse,
          );
        }
      } else if (!npc.ragdoll.active) {
        const sinY = Math.sin(npc.facingYaw);
        const cosY = Math.cos(npc.facingYaw);
        this._fwd.set(-sinY, 0, -cosY);
        this._right.set(cosY, 0, -sinY);
        const fwdImp = hitDir.dot(this._fwd);
        const rightImp = hitDir.dot(this._right);
        npc.animator.triggerHitReaction(fwdImp, rightImp);
      }
    }

    if (npc.hp <= 0) {
      npc.burningTimer = 0;
      npc.painRestricted = false;
      npc.paralyzed = false;
      npc.paralysisImmune = false;
      npc.rig.setWhiteOutline(false);
      npc.externalControl = false;
      npc.externalHeadache = false;
      npc.verticalVelocity = 0;
      npc.position.y = 0;
      npc.headacheTimer = 0;
      npc.attackPendingHit = false;
      npc.aggro = false;
      npc.animator.setHeadache(false);
      npc.respawnTimer = 3.2;
      if (!npc.rewardClaimed) {
        npc.rewardClaimed = true;
        this.pendingEliminations.push({
          id: npc.id,
          coins: npc.coinReward,
          worldPos: new THREE.Vector3(npc.position.x, npc.position.y + 1.05, npc.position.z),
        });
      }
      if (!npc.ragdoll.active) {
        npc.ragdollTimer = 3.2;
        npc.ragdoll.trigger(
          npc.position,
          new THREE.Vector3(),
          npc.facingYaw,
          hitDir.clone().multiplyScalar(2.0),
        );
      }
    }

    return true;
  }

  public applyAreaImplosion(
    center: THREE.Vector3,
    radius: number,
    damage: number,
    ragdollDurationSec: number,
  ): number {
    let hitCount = 0;
    const hitSet = new Set<string>();

    for (const npc of this.npcs) {
      if (npc.hp <= 0 || hitSet.has(npc.id)) continue;
      const dx = npc.position.x - center.x;
      const dy = npc.position.y + 0.9 - center.y;
      const dz = npc.position.z - center.z;
      const dist3d = Math.hypot(dx, dy, dz);
      if (dist3d <= radius) {
        hitSet.add(npc.id);
        const pull = new THREE.Vector3(-dx, 0, -dz);
        const horizDist = Math.hypot(dx, dz);
        if (horizDist > 0.05) {
          const pullStrength = THREE.MathUtils.clamp(horizDist * 0.72, 1.4, 3.6);
          pull.normalize().multiplyScalar(pullStrength);
        } else {
          pull.set(0, 0, 0);
        }
        pull.y = 0.28;

        const dir = new THREE.Vector3(dx, 0, dz);
        if (dir.lengthSq() > 0.001) dir.normalize();

        if (this.applyDamage(npc.id, damage, dir, ragdollDurationSec, pull)) {
          hitCount++;
        }
      }
    }
    return hitCount;
  }

  public applyAreaFireExplosion(
    center: THREE.Vector3,
    radius: number,
    damage: number,
    ragdollDurationSec: number,
    knockbackStrength: number,
    burnDurationSec = 0,
    burnDps = 2,
    excludeId?: string,
  ): number {
    let hitCount = 0;
    const hitSet = new Set<string>();

    for (const npc of this.npcs) {
      if (npc.hp <= 0 || npc.id === excludeId || hitSet.has(npc.id)) continue;
      const dx = npc.position.x - center.x;
      const dz = npc.position.z - center.z;
      const distHz = Math.hypot(dx, dz);
      if (distHz <= radius) {
        hitSet.add(npc.id);
        const outDir = new THREE.Vector3(dx, 0, dz);
        if (outDir.lengthSq() < 0.001) {
          outDir.set(Math.sin(npc.facingYaw), 0, Math.cos(npc.facingYaw));
        } else {
          outDir.normalize();
        }
        const knockback = outDir.clone().multiplyScalar(knockbackStrength);
        knockback.y = 0.42;

        if (this.applyDamage(npc.id, damage, outDir, ragdollDurationSec, knockback)) {
          hitCount++;
          if (burnDurationSec > 0 && npc.hp > 0) {
            this.applyBurn(npc.id, burnDurationSec, burnDps);
          }
        }
      }
    }
    return hitCount;
  }

  public update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    playerPos: THREE.Vector3,
    reticleNdcX: number,
    reticleNdcY: number,
    viewportWidth: number,
    viewportHeight: number,
    onBurnTick?: () => void,
    onEliminated?: (events: NpcEliminationEvent[]) => void,
    playerTargetable = true,
    onPlayerHit?: (damage: number, kind: 'weapon' | 'punch', hitDir: THREE.Vector3) => void,
  ): NpcHudSnapshot[] {
    const safeDt = Math.min(dt, 0.05);
    this.animTime += safeDt;
    const maxBound = BASEPLATE_HALF_INNER - 0.85;

    for (const npc of this.npcs) {
      // 1. Burning DoT ticks + visual aura
      if (npc.hp > 0 && npc.burningTimer > 0) {
        npc.burningTimer = Math.max(0, npc.burningTimer - safeDt);
        npc.burnTickAccum += safeDt;
        if (npc.burnTickAccum >= 1.0) {
          npc.burnTickAccum -= 1.0;
          const dir = this._fwd.set(0, 0, -1);
          if (this.applyDamage(npc.id, npc.burnDps, dir, 0)) {
            onBurnTick?.();
          }
        }
      }

      if (npc.hp > 0 && npc.burningTimer > 0) {
        npc.burnSprite.visible = true;
        const flicker = 0.88 + Math.sin(this.animTime * 16 + npc.spawnPos.x) * 0.14;
        npc.burnSprite.position.set(
          npc.position.x,
          npc.position.y + (npc.ragdoll.active ? 0.35 : 0.95),
          npc.position.z,
        );
        npc.burnSprite.scale.set(1.05 * flicker, 1.38 * flicker, 1);
        (npc.burnSprite.material as THREE.SpriteMaterial).opacity =
          Math.min(1, npc.burningTimer * 1.4) * 0.72;
      } else {
        npc.burnSprite.visible = false;
      }

      if (npc.hitFlashTimer > 0) {
        npc.hitFlashTimer = Math.max(0, npc.hitFlashTimer - safeDt);
        npc.rig.setHitFlash(npc.hitFlashTimer / 0.14);
      } else {
        npc.rig.setHitFlash(0);
      }

      if (npc.trailHoldTimer > 0) {
        npc.trailHoldTimer = Math.max(0, npc.trailHoldTimer - safeDt);
      } else if (npc.trailHp > npc.hp) {
        npc.trailHp = Math.max(npc.hp, npc.trailHp - 72 * safeDt);
      } else {
        npc.trailHp = npc.hp;
      }

      if (npc.hp <= 0) {
        npc.respawnTimer -= safeDt;
        if (npc.ragdoll.active) {
          const pelvisPos = npc.ragdoll.update(safeDt);
          npc.position.set(pelvisPos.x, 0, pelvisPos.z);
        }
        if (npc.respawnTimer <= 0) {
          npc.ragdoll.reset();
          npc.position.copy(npc.spawnPos);
          npc.patrolTarget.copy(npc.spawnPos);
          npc.rig.root.position.copy(npc.spawnPos);
          npc.rig.root.rotation.set(0, npc.facingYaw, 0);

          if (npc.category === 'prisoner') {
            const rolled = rollPrisonerStats();
            npc.level = rolled.level;
            npc.maxHp = rolled.maxHp;
            npc.attackDamage = rolled.attackDamage;
            npc.moveSpeed = rolled.moveSpeed;
            npc.coinReward = rolled.coinReward;
          }

          npc.hp = npc.maxHp;
          npc.trailHp = npc.maxHp;
          npc.ragdollTimer = 0;
          npc.burningTimer = 0;
          npc.burnTickAccum = 0;
          npc.painRestricted = false;
          npc.paralyzed = false;
          npc.paralysisImmune = false;
          npc.rig.setWhiteOutline(false);
          npc.externalControl = false;
          npc.externalHeadache = false;
          npc.verticalVelocity = 0;
          npc.headacheTimer = 0;
          npc.rewardClaimed = false;
          npc.aggro = false;
          npc.attackCooldown = 0.5;
          npc.attackPendingHit = false;
          npc.animator = new CharacterAnimator(npc.rig, npc.archetype);
        }
      } else if (npc.ragdoll.active) {
        const pelvisPos = npc.ragdoll.update(safeDt);
        npc.position.set(pelvisPos.x, 0, pelvisPos.z);
        npc.verticalVelocity = 0;
        npc.ragdollTimer -= safeDt;
        if (npc.ragdollTimer <= 0) {
          npc.ragdollTimer = 0;
          npc.ragdoll.reset();
          npc.rig.root.position.copy(npc.position);
          npc.rig.root.rotation.set(0, npc.facingYaw, 0);
          npc.animator = new CharacterAnimator(npc.rig, npc.archetype);
        }
      } else {
        // Gravity pull for NPCs released from aerial abilities (e.g. Wind Tornado)
        if (!npc.externalControl && npc.position.y > 0) {
          npc.verticalVelocity -= 24 * safeDt;
          npc.position.y += npc.verticalVelocity * safeDt;
          if (npc.position.y <= 0) {
            npc.position.y = 0;
            npc.verticalVelocity = 0;
          }
        }
        if (npc.paralyzed && !npc.externalControl) {
          // Complete paralysis: freeze movement, AI, and animation cleanly
          npc.attackPendingHit = false;
          npc.rig.root.position.copy(npc.position);
          npc.rig.root.rotation.y = npc.facingYaw;
        } else {
        if (npc.headacheTimer > 0) {
          npc.headacheTimer = Math.max(0, npc.headacheTimer - safeDt);
        }
        if (npc.attackCooldown > 0) {
          npc.attackCooldown = Math.max(0, npc.attackCooldown - safeDt);
        }

        const headacheActive = npc.headacheTimer > 0 || npc.externalHeadache;
        npc.animator.setHeadache(headacheActive);
        const restricted =
          npc.painRestricted || npc.paralyzed || npc.externalControl || headacheActive;

        let moving = false;

        if (!restricted) {
          if (npc.category === 'basic') {
            // Peaceful stationary civilian: only idle animation, never attacks or chases
            moving = false;
          } else {
            // Bandit or Prisoner AI
            const dxPlayer = playerPos.x - npc.position.x;
            const dzPlayer = playerPos.z - npc.position.z;
            const distPlayer = Math.hypot(dxPlayer, dzPlayer);
            const distPlayerToZone = Math.hypot(
              playerPos.x - npc.zoneCenter.x,
              playerPos.z - npc.zoneCenter.z,
            );

            if (!playerTargetable || distPlayerToZone > ZONE_CHASE_LIMIT_M) {
              npc.aggro = false;
            } else if (distPlayer <= DETECT_RANGE_M && playerPos.y < 3.4) {
              npc.aggro = true;
            }

            if (npc.aggro && playerTargetable) {
              const attackRange = npc.category === 'bandit' ? 2.15 : 1.55;
              const strikeReach = npc.category === 'bandit' ? 2.75 : 2.1;
              const targetYaw = Math.atan2(-dxPlayer, -dzPlayer);
              npc.facingYaw = dampAngle(npc.facingYaw, targetYaw, 10, safeDt);

              // Pending melee strike resolution at impact frame
              if (npc.attackPendingHit) {
                npc.attackHitDelay -= safeDt;
                if (npc.attackHitDelay <= 0) {
                  npc.attackPendingHit = false;
                  if (distPlayer <= strikeReach && Math.abs(playerPos.y - npc.position.y) <= 2.1) {
                    this._hitDir.set(dxPlayer, 0, dzPlayer);
                    if (this._hitDir.lengthSq() > 1e-4) this._hitDir.normalize();
                    else this._hitDir.set(0, 0, -1);
                    onPlayerHit?.(npc.attackDamage, npc.attackKind, this._hitDir);
                  }
                }
              }

              if (distPlayer > attackRange) {
                const stepDist = Math.min(npc.moveSpeed * safeDt, distPlayer - attackRange * 0.85);
                if (stepDist > 0.001 && distPlayer > 0.01) {
                  npc.position.x = THREE.MathUtils.clamp(
                    npc.position.x + (dxPlayer / distPlayer) * stepDist,
                    -maxBound,
                    maxBound,
                  );
                  npc.position.z = THREE.MathUtils.clamp(
                    npc.position.z + (dzPlayer / distPlayer) * stepDist,
                    -maxBound,
                    maxBound,
                  );
                  moving = true;
                }
              } else if (npc.attackCooldown <= 0 && !npc.attackPendingHit && playerPos.y < 2.2) {
                if (npc.category === 'bandit') {
                  npc.animator.triggerCast('npc-weapon-attack', 0.52);
                  npc.attackCooldown = 1.45;
                  npc.attackPendingHit = true;
                  npc.attackHitDelay = 0.24;
                  npc.attackKind = 'weapon';
                } else {
                  const hand = npc.punchNextHand;
                  npc.punchNextHand = hand === 'right' ? 'left' : 'right';
                  npc.animator.triggerCast(
                    hand === 'right' ? 'npc-punch-right' : 'npc-punch-left',
                    0.42,
                  );
                  npc.attackCooldown = 1.05;
                  npc.attackPendingHit = true;
                  npc.attackHitDelay = 0.18;
                  npc.attackKind = 'punch';
                }
              }
            } else {
              // Patrol inside designated zone
              npc.attackPendingHit = false;
              const pdx = npc.patrolTarget.x - npc.position.x;
              const pdz = npc.patrolTarget.z - npc.position.z;
              const pDist = Math.hypot(pdx, pdz);
              if (pDist < 0.45) {
                npc.patrolPause -= safeDt;
                if (npc.patrolPause <= 0) {
                  this.pickPatrolTarget(npc);
                }
              } else {
                const patrolSpeed = npc.moveSpeed * 0.48;
                const step = Math.min(patrolSpeed * safeDt, pDist);
                npc.position.x = THREE.MathUtils.clamp(
                  npc.position.x + (pdx / pDist) * step,
                  -maxBound,
                  maxBound,
                );
                npc.position.z = THREE.MathUtils.clamp(
                  npc.position.z + (pdz / pDist) * step,
                  -maxBound,
                  maxBound,
                );
                const patrolYaw = Math.atan2(-pdx, -pdz);
                npc.facingYaw = dampAngle(npc.facingYaw, patrolYaw, 6, safeDt);
                moving = true;
              }
            }
          }
        } else {
          npc.attackPendingHit = false;
        }

        const shouldShake =
          npc.painRestricted || (headacheActive && !npc.paralyzed);
        const shakeX = shouldShake ? Math.sin(this.animTime * 42) * 0.032 : 0;
        const shakeZ = shouldShake ? Math.cos(this.animTime * 37) * 0.032 : 0;
        npc.rig.root.position.set(
          npc.position.x + shakeX,
          npc.position.y,
          npc.position.z + shakeZ,
        );
        npc.rig.root.rotation.y = npc.facingYaw;
        const animDt =
          headacheActive
            ? safeDt
            : npc.paralyzed
              ? 0
              : restricted
                ? safeDt * 0.15
                : safeDt;
        npc.animator.update(
          animDt,
          moving ? this.walkMotion : this.idleMotion,
        );
        }
      }

      const dd = npc.damageDisplay;
      if (dd.active) {
        if (dd.popTimer > 0) {
          dd.popTimer = Math.max(0, dd.popTimer - safeDt);
        }
        dd.idleTimer += safeDt;
        if (dd.idleTimer >= DAMAGE_AGGREGATE_HOLD_SEC + DAMAGE_FADE_DURATION_SEC) {
          dd.active = false;
          dd.total = 0;
        }
      }
    }

    // Soft separation between active upright moving NPCs so they never stack inside one another
    for (let i = 0; i < this.npcs.length; i++) {
      const a = this.npcs[i];
      if (a.hp <= 0 || a.ragdoll.active || a.category === 'basic' || a.paralyzed || a.externalControl) continue;
      for (let j = i + 1; j < this.npcs.length; j++) {
        const b = this.npcs[j];
        if (b.hp <= 0 || b.ragdoll.active || b.paralyzed || b.externalControl) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;
        const minSep = 1.15;
        if (distSq > 1e-5 && distSq < minSep * minSep) {
          const dist = Math.sqrt(distSq);
          const push = (minSep - dist) * 0.45;
          const nx = dx / dist;
          const nz = dz / dist;
          a.position.x = THREE.MathUtils.clamp(a.position.x - nx * push, -maxBound, maxBound);
          a.position.z = THREE.MathUtils.clamp(a.position.z - nz * push, -maxBound, maxBound);
          if (b.category !== 'basic') {
            b.position.x = THREE.MathUtils.clamp(b.position.x + nx * push, -maxBound, maxBound);
            b.position.z = THREE.MathUtils.clamp(b.position.z + nz * push, -maxBound, maxBound);
          }
        }
      }
    }

    // Flush single-claim coin elimination events projected to current camera viewport
    if (this.pendingEliminations.length > 0) {
      const events: NpcEliminationEvent[] = [];
      for (const ev of this.pendingEliminations) {
        this._proj.copy(ev.worldPos).project(camera);
        const screenX = THREE.MathUtils.clamp(
          (this._proj.x * 0.5 + 0.5) * viewportWidth,
          36,
          viewportWidth - 36,
        );
        const screenY = THREE.MathUtils.clamp(
          (-this._proj.y * 0.5 + 0.5) * viewportHeight,
          56,
          viewportHeight - 56,
        );
        events.push({
          id: ev.id,
          coins: ev.coins,
          screenX,
          screenY,
        });
      }
      this.pendingEliminations = [];
      onEliminated?.(events);
    }

    let bestId: string | null = null;
    let bestScore = Infinity;

    for (const npc of this.npcs) {
      if (npc.hp <= 0) continue;

      const distToPlayer = this._toNpc
        .copy(npc.position)
        .sub(playerPos)
        .length();
      if (distToPlayer > 28) continue;

      this._proj.set(npc.position.x, npc.position.y + 1.15, npc.position.z);
      this._proj.project(camera);

      if (this._proj.z < -1 || this._proj.z > 1) continue;

      const dx = this._proj.x - reticleNdcX;
      const dy = this._proj.y - reticleNdcY;
      const reticleDist = Math.hypot(dx, dy);

      if (reticleDist > 0.34) continue;

      const stickyBonus = npc.id === this.selectedTargetId ? -0.045 : 0;
      const score = reticleDist + distToPlayer * 0.004 + stickyBonus;
      if (score < bestScore) {
        bestScore = score;
        bestId = npc.id;
      }
    }

    this.selectedTargetId = bestId;

    const snapshots: NpcHudSnapshot[] = [];
    for (const npc of this.npcs) {
      const headHeight = npc.ragdoll.active ? 0.95 : 2.15;
      this._proj.set(npc.position.x, npc.position.y + headHeight, npc.position.z);
      this._proj.project(camera);

      const inFront = this._proj.z >= -1 && this._proj.z <= 1;
      const distToCam = camera.position.distanceTo(npc.position);
      const visible =
        inFront &&
        distToCam < 38 &&
        npc.hp > 0 &&
        Math.abs(this._proj.x) <= 1.08 &&
        Math.abs(this._proj.y) <= 1.08;

      const screenX = (this._proj.x * 0.5 + 0.5) * viewportWidth;
      const screenY = (-this._proj.y * 0.5 + 0.5) * viewportHeight;

      const dd = npc.damageDisplay;
      const popRatio = dd.popTimer / 0.22;
      const popScale = dd.popTimer > 0 ? 1 + Math.sin(popRatio * Math.PI) * 0.44 : 1;

      let fadeRatio = 1;
      let driftX = 0;
      if (dd.idleTimer > DAMAGE_AGGREGATE_HOLD_SEC) {
        const f = THREE.MathUtils.clamp(
          (dd.idleTimer - DAMAGE_AGGREGATE_HOLD_SEC) / DAMAGE_FADE_DURATION_SEC,
          0,
          1,
        );
        fadeRatio = 1 - f;
        driftX = dd.driftDir * f * 34;
      }

      const scale = THREE.MathUtils.clamp(
        6.8 / Math.max(distToCam, 6.8),
        0.44,
        1.0,
      );

      snapshots.push({
        id: npc.id,
        name: npc.name,
        category: npc.category,
        level: npc.level,
        hp: npc.hp,
        maxHp: npc.maxHp,
        trailHp: npc.trailHp,
        visible: visible || (dd.active && inFront),
        screenX,
        screenY,
        scale,
        isTargeted: npc.id === this.selectedTargetId && visible,
        damageNumber: {
          active: dd.active && inFront && distToCam < 38,
          total: dd.total,
          scale: popScale,
          opacity: fadeRatio,
          offsetX: dd.offsetX + driftX,
          offsetY: dd.offsetY,
        },
      });
    }

    return snapshots;
  }

  public resetAll(): void {
    this.selectedTargetId = null;
    this.pendingEliminations = [];
    for (const npc of this.npcs) {
      npc.ragdoll.reset();
      npc.position.copy(npc.spawnPos);
      npc.patrolTarget.copy(npc.spawnPos);
      npc.rig.root.position.copy(npc.spawnPos);
      npc.rig.root.rotation.set(0, npc.facingYaw, 0);

      if (npc.category === 'prisoner') {
        const rolled = rollPrisonerStats();
        npc.level = rolled.level;
        npc.maxHp = rolled.maxHp;
        npc.attackDamage = rolled.attackDamage;
        npc.moveSpeed = rolled.moveSpeed;
        npc.coinReward = rolled.coinReward;
      }

      npc.hp = npc.maxHp;
      npc.trailHp = npc.maxHp;
      npc.trailHoldTimer = 0;
      npc.ragdollTimer = 0;
      npc.hitFlashTimer = 0;
      npc.respawnTimer = 0;
      npc.burningTimer = 0;
      npc.burnTickAccum = 0;
      npc.burnSprite.visible = false;
      npc.painRestricted = false;
      npc.paralyzed = false;
      npc.paralysisImmune = false;
      npc.rig.setWhiteOutline(false);
      npc.externalControl = false;
      npc.externalHeadache = false;
      npc.verticalVelocity = 0;
      npc.headacheTimer = 0;
      npc.rewardClaimed = false;
      npc.aggro = false;
      npc.attackCooldown = Math.random() * 0.4;
      npc.attackPendingHit = false;
      npc.damageDisplay.active = false;
      npc.damageDisplay.total = 0;
      npc.animator = new CharacterAnimator(npc.rig, npc.archetype);
    }
  }

  public dispose(): void {
    for (const npc of this.npcs) {
      npc.rig.dispose();
      (npc.burnSprite.material as THREE.Material).dispose();
    }
    this.burnTex.dispose();
  }
}
