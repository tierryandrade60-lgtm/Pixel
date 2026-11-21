import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CharacterAnimator } from './characterAnimator';
import {
  CHARACTER_PRESETS,
  CharacterAppearance,
  CharacterArchetype,
  CharacterSkinId,
  PhoenixSkinVariant,
  resolveCharacterAppearance,
} from './characterConfig';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  GraphicsSettings,
  ResolutionScale,
  ShadowQuality,
} from './graphicsSettings';
import { LandingDustSystem } from './landingDust';
import { NpcCombatSystem, NpcEliminationEvent, NpcHudSnapshot } from './npcSystem';
import {
  HandFireAura,
  PAIN_INFLICTION_EXPLOSION_RADIUS,
  PHOENIX_WAVE_RADIUS,
  PhoenixVfxSystem,
  PhoenixWings,
} from './phoenixAbilities';
import {
  BASEPLATE_BORDER_HEIGHT,
  BASEPLATE_HALF_INNER,
  BASEPLATE_HALF_OUTER,
  CharacterPhysics,
} from './physics';
import {
  createBaseplateTopTexture,
  createBaseplateTrimTexture,
  createContactShadowTexture,
  createSkyDomeTexture,
} from './pixelTextures';
import { createR16Character } from './r16Character';
import { R16Ragdoll } from './ragdoll';
import {
  CHAOS_EXPLOSION_RADIUS,
  DarkholdBookVfx,
  HandChaosAura,
  SCARLET_FLIGHT_CANCEL_RADIUS,
  ScarletShieldVfx,
  ScarletWitchVfxSystem,
  TELEKINETIC_EXPLOSION_RADIUS,
} from './scarletWitchAbilities';
import { EmmaFrostVfxSystem, EmmaIdleForeheadRings } from './emmaFrostAbilities';
import { HelaVfxSystem } from './helaAbilities';
import { MagnetoVfxSystem } from './magnetoAbilities';
import { QuicksilverVfxSystem } from './quicksilverAbilities';
import { DoctorStrangeVfxSystem } from './doctorStrangeAbilities';
import { VisionVfxSystem } from './visionAbilities';
import {
  AUTO_SHIELD_DURATION_MS,
  AUTO_SHIELD_MAX_ABSORB,
  DARKHOLD_DURATION_MS,
  EMMA_ASTRAL_MAX_DURATION_MS,
  EMMA_DIAMOND_DURATION_MS,
  EMMA_MC_MENTAL_DMG_MS,
  EMMA_MC_PARALYSIS_MS,
  EMMA_MC_SLEEP_MS,
  HELA_CROWN_BONUS_DAMAGE,
  HELA_CROWN_DURATION_MS,
  HELA_SWORD_APPEAR_MS,
  HELA_SWORD_SLASH_COOLDOWN_MS,
  HELA_SWORD_SUMMON_DURATION_MS,
  HELA_SWORD_THROW_READY_MS,
  MAGNETO_TORNADO_DURATION_MS,
  PHOENIX_SPECIAL_REVIVAL_COOLDOWN_MS,
  QUICKSILVER_COMBO_DURATION_MS,
  QUICKSILVER_TORNADO_MAX_DURATION_MS,
  STRANGE_SHIELD_MAX_DURATION_MS,
  VISION_HEAD_GRIP_DURATION_MS,
  VISION_INTANGIBLE_MAX_DURATION_MS,
  VISION_LASER_DURATION_MS,
  VISION_MIND_BOLT_CHARGE_MS,
} from './abilityConfig';
import { CinematicFxController, ScreenFxState } from './cinematicFx';
import { SkyAtmosphere, SUN_LIGHT_DIR } from './skyAtmosphere';
import { WindTrailSystem } from './windTrails';

export interface EngineCallbacks {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onJump?: () => void;
  onLandDust?: (intensity: number) => void;
  onHitTarget?: () => void;
  onTeleportStart?: () => void;
  onTeleportArrive?: () => void;
  onTeleportLockChange?: (locked: boolean) => void;
  onChaosImplosionAbsorb?: () => void;
  onScarletFlightCancelShockwave?: () => void;
  onDarkholdChange?: (active: boolean, triggerCooldown: boolean) => void;
  onTelekineticExplosion?: () => void;
  onAutoShieldChange?: (active: boolean) => void;
  onAutoShieldDeflect?: () => void;
  onPhoenixWaveCast?: () => void;
  onPhoenixWaveStep?: (stepIdx: number) => void;
  onPhoenixFireballHit?: () => void;
  onBurnTick?: () => void;
  onPainInflictionTick?: () => void;
  onPainInflictionExplosion?: () => void;
  onPainInflictionChange?: (active: boolean, triggerCooldown: boolean) => void;
  onRevivalStart?: () => void;
  onPhoenixSpecialRevival?: (phase: 'rise' | 'manifest' | 'end') => void;
  onFlightForceChange?: (active: boolean) => void;
  onMindControlChange?: (
    phase: 'idle' | 'choosing' | 'paralysis' | 'sleep' | 'mental-damage',
    triggerCooldown: boolean,
  ) => void;
  onMentalAttackImpact?: () => void;
  onDiamondFormChange?: (active: boolean, triggerCooldown: boolean) => void;
  onDiamondProjectileImpact?: () => void;
  onTelepathicWaveChange?: (active: boolean, triggerCooldown: boolean) => void;
  onAstralProjectionChange?: (active: boolean, triggerCooldown: boolean) => void;
  onCrownFormChange?: (active: boolean, triggerCooldown: boolean) => void;
  onSwordSummonChange?: (active: boolean, triggerCooldown: boolean) => void;
  onSwordThrowAvailabilityChange?: (ready: boolean) => void;
  onSwordSlash?: () => void;
  onSwordEmbed?: () => void;
  onGreenExplosion?: (phase: 'charge' | 'detonate') => void;
  onSpinningLeap?: (phase: 'launch' | 'land') => void;
  onGroundSword?: () => void;
  onAbilityFeedback?: (message: string) => void;
  onMagnetoMeteorStage?: (stage: 'charge' | 'launch' | 'impact') => void;
  onMagnetoTornadoChange?: (active: boolean, triggerCooldown: boolean) => void;
  onMagnetoThrow?: () => void;
  onSuperSpeedChange?: (active: boolean) => void;
  onWindTornadoChange?: (active: boolean, triggerCooldown: boolean) => void;
  onRapidPunchChange?: (active: boolean, triggerCooldown: boolean) => void;
  onRapidPunchStrike?: (finisher: boolean) => void;
  onTimeStopCast?: () => void;
  onStrangeShieldChange?: (active: boolean, triggerCooldown: boolean) => void;
  onStrangeMirrorCast?: () => void;
  onStrangeMirrorImpact?: () => void;
  onStrangeClonesCast?: () => void;
  onVisionPhaseChange?: (active: boolean, triggerCooldown: boolean) => void;
  onVisionLaserChange?: (active: boolean, triggerCooldown: boolean) => void;
  onVisionBoltCharge?: () => void;
  onVisionBoltCast?: () => void;
  onVisionBoltExplode?: () => void;
  onVisionHeadGripChange?: (active: boolean, triggerCooldown: boolean) => void;
  onNpcStrikePlayer?: (kind: 'weapon' | 'punch') => void;
  onPlayerDeath?: () => void;
  onScreenFxUpdate?: (fx: ScreenFxState) => void;
  onNpcEliminated?: (events: NpcEliminationEvent[]) => void;
  onNpcHudUpdate?: (snapshots: NpcHudSnapshot[]) => void;
  onPlayerHealthChange?: (hp: number, maxHp: number) => void;
  onPlayerHeal?: (amount: number) => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

const TELEPORT_PREPARE_SEC = 0.5;
const TELEPORT_REVEAL_SEC = 0.22;
const TELEPORT_MAX_DISTANCE = 16.0;
const IMPLOSION_MAX_DISTANCE = 22.0;

interface ScheduledWave {
  remainingSec: number;
  stepIdx: number;
  position: THREE.Vector3;
  forward: THREE.Vector3;
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;

  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly distanceFog: THREE.Fog;
  private graphicsSettings: GraphicsSettings;

  private readonly physics: CharacterPhysics;
  private archetype: CharacterArchetype;
  private skinVariant: PhoenixSkinVariant;
  private skinId?: CharacterSkinId;
  private rig: ReturnType<typeof createR16Character>;
  private animator: CharacterAnimator;
  private ragdoll: R16Ragdoll;

  // Scarlet Witch auras & VFX
  private leftHandAura: HandChaosAura | null = null;
  private rightHandAura: HandChaosAura | null = null;
  private readonly vfx: ScarletWitchVfxSystem;
  private readonly darkholdBook: DarkholdBookVfx;
  private readonly scarletShield: ScarletShieldVfx;

  // Phoenix Force auras, wings & VFX
  private leftFireAura: HandFireAura | null = null;
  private rightFireAura: HandFireAura | null = null;
  private phoenixWings: PhoenixWings | null = null;
  private phoenixVfx: PhoenixVfxSystem;
  private wingsAlwaysVisible = false;

  // Emma Frost, Hela & 4 New Heroes VFX
  private readonly emmaVfx: EmmaFrostVfxSystem;
  private readonly emmaIdleRings: EmmaIdleForeheadRings;
  private readonly helaVfx: HelaVfxSystem;
  private readonly magnetoVfx: MagnetoVfxSystem;
  private readonly quicksilverVfx: QuicksilverVfxSystem;
  private readonly strangeVfx: DoctorStrangeVfxSystem;
  private readonly visionVfx: VisionVfxSystem;

  // Shared landing dust & NPC targets
  private readonly landingDust: LandingDustSystem;
  private readonly npcs: NpcCombatSystem;

  private readonly contactShadow: THREE.Mesh;
  private readonly skyDome: THREE.Mesh;
  private readonly skyAtmosphere: SkyAtmosphere;
  private readonly windTrails: WindTrailSystem;
  private readonly fx = new CinematicFxController();
  private readonly abilityLight: THREE.PointLight;

  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];
  private readonly disposableTextures: THREE.Texture[] = [];
  private readonly envRT: THREE.WebGLRenderTarget;

  // Input & lifecycle state
  private joyX = 0;
  private joyY = 0;
  private keyForward = 0;
  private keyRight = 0;
  private jumpQueued = false;
  private sprintEnabled = false;
  private flightEnabled = false;
  private dead = false;
  private controlsEnabled = true;
  private wasGrounded = true;

  // Combat & Ability state
  private playerMaxHp = 250;
  private playerHp = 250;
  private damageMultiplier = 1.0;
  private invulnerable = false;
  private nextBoltHand: 'right' | 'left' = 'right';
  private handFlareLeft = 0;
  private handFlareRight = 0;

  // Phoenix Force / Dark Phoenix 60s Special Revival
  private lastPhoenixRevivalMs = -Infinity;
  private phoenixRevivalState: {
    phase: 'idle' | 'rising' | 'manifest';
    elapsed: number;
    spherePos: THREE.Vector3;
    anchorPos: THREE.Vector3;
    tickAccum: number;
  } = {
    phase: 'idle',
    elapsed: 0,
    spherePos: new THREE.Vector3(0, 0.4, 0),
    anchorPos: new THREE.Vector3(0, 5.4, 0),
    tickAccum: 0,
  };

  private scheduledWaves: ScheduledWave[] = [];
  private painState: {
    active: boolean;
    targetId: string | null;
    elapsed: number;
    tickAccum: number;
    ticksDone: number;
    lastTargetPos: THREE.Vector3;
  } = {
    active: false,
    targetId: null,
    elapsed: 0,
    tickAccum: 0,
    ticksDone: 0,
    lastTargetPos: new THREE.Vector3(),
  };

  private teleportState: {
    phase: 'idle' | 'preparing' | 'revealing';
    elapsed: number;
    destination: THREE.Vector3;
  } = {
    phase: 'idle',
    elapsed: 0,
    destination: new THREE.Vector3(),
  };

  private darkholdState = {
    active: false,
    elapsed: 0,
  };

  private shieldState = {
    active: false,
    elapsed: 0,
    absorbRemaining: AUTO_SHIELD_MAX_ABSORB,
  };

  // Emma Frost state
  private mindControlState: {
    phase: 'idle' | 'choosing' | 'paralysis' | 'sleep' | 'mental-damage';
    targetId: string | null;
    elapsed: number;
    dmgAccum: number;
    paralysisTargetId: string | null;
    paralysisRemaining: number;
  } = {
    phase: 'idle',
    targetId: null,
    elapsed: 0,
    dmgAccum: 0,
    paralysisTargetId: null,
    paralysisRemaining: 0,
  };

  private diamondState = {
    active: false,
    elapsed: 0,
    blend: 0,
  };

  private telepathicWaveState = {
    active: false,
    elapsed: 0,
    ringAccum: 0,
    tickAccum: 0,
  };

  private astralState = {
    active: false,
    elapsed: 0,
  };

  // Hela state
  private crownState = {
    active: false,
    elapsed: 0,
    blend: 0,
  };

  private swordSummonState: {
    active: boolean;
    elapsed: number;
    leftInHand: boolean;
    rightInHand: boolean;
    nextThrowHand: 'right' | 'left';
    reloadHand: 'right' | 'left' | null;
    throwReady: boolean;
    reloadElapsed: number;
    reloading: boolean;
    slashCooldownRemaining: number;
  } = {
    active: false,
    elapsed: 0,
    leftInHand: false,
    rightInHand: false,
    nextThrowHand: 'right',
    reloadHand: null,
    throwReady: false,
    reloadElapsed: 0,
    reloading: false,
    slashCooldownRemaining: 0,
  };

  private greenChargeState = {
    active: false,
    elapsed: 0,
  };

  private spinningLeapState = {
    active: false,
    elapsed: 0,
  };

  // Magneto state
  private magnetoShieldState = {
    active: false,
    elapsed: 0,
  };
  private magnetoTornadoState = {
    active: false,
    elapsed: 0,
  };
  private magnetoMeteorActive = false;
  private magnetoPreFlight = false;
  private nextMagnetoHand: 'right' | 'left' = 'right';

  // Quicksilver state
  private superSpeedState = {
    active: false,
  };
  private rapidPunchState: {
    active: boolean;
    targetId: string | null;
    elapsed: number;
    punchAccum: number;
    finished: boolean;
    sideSign: number;
  } = {
    active: false,
    targetId: null,
    elapsed: 0,
    punchAccum: 0,
    finished: false,
    sideSign: 1,
  };
  private windTornadoState = {
    active: false,
    elapsed: 0,
    center: new THREE.Vector3(),
    angle: 0,
  };

  // Doctor Strange state
  private strangeShieldState = {
    active: false,
    elapsed: 0,
  };

  // Vision state
  private visionIntangibleState = {
    active: false,
    elapsed: 0,
    blend: 0,
  };
  private visionLaserState = {
    active: false,
    elapsed: 0,
  };
  private visionBoltChargeState = {
    active: false,
    elapsed: 0,
  };
  private visionHeadGripState: {
    active: boolean;
    targetId: string | null;
    elapsed: number;
    tickAccum: number;
    ticksDone: number;
    slammed: boolean;
    lockedPos: THREE.Vector3;
  } = {
    active: false,
    targetId: null,
    elapsed: 0,
    tickAccum: 0,
    ticksDone: 0,
    slammed: false,
    lockedPos: new THREE.Vector3(),
  };

  private prevTurnYaw = 0;

  // Camera orientation & smooth zoom distance
  private cameraYaw = 0;
  private cameraPitch = 0.22;
  private targetCameraDistance = 4.65;
  private smoothCameraDistance = 4.65;
  private smoothCamPos = new THREE.Vector3(0.62, 2.05, 4.6);
  private smoothCamLook = new THREE.Vector3(0.72, 1.48, -3.5);
  private camInitialized = false;
  private baseFov = 50;
  private lastAppliedFov = 50;
  private lastScreenFxSentActive = false;

  // Frame loop management
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private contextLost = false;

  // Scratch math helpers
  private readonly _fwd = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _desiredCamPos = new THREE.Vector3();
  private readonly _desiredCamLook = new THREE.Vector3();
  private readonly _ragdollFocus = new THREE.Vector3();
  private readonly _raycaster = new THREE.Raycaster();
  private readonly _reticleNdc = new THREE.Vector2();
  private readonly _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly _aimTarget = new THREE.Vector3();
  private readonly _handWorld = new THREE.Vector3();
  private readonly _painTargetWorld = new THREE.Vector3();
  private readonly _camRightVec = new THREE.Vector3();
  private readonly _camUpVec = new THREE.Vector3();
  private readonly _foreheadPos = new THREE.Vector3();
  private readonly _waveDir = new THREE.Vector3();
  private readonly _hitDir = new THREE.Vector3();
  private readonly _mindStoneWorld = new THREE.Vector3();
  private readonly _laserEndWorld = new THREE.Vector3();

  private readonly handleResizeBound: () => void;
  private readonly resizeObserver: ResizeObserver | null = null;
  private readonly handleKeyDownBound: (e: KeyboardEvent) => void;
  private readonly handleKeyUpBound: (e: KeyboardEvent) => void;
  private readonly handleContextLostBound: (e: Event) => void;
  private readonly handleContextRestoredBound: () => void;

  constructor(
    container: HTMLElement,
    callbacks: EngineCallbacks = {},
    initialGraphics: GraphicsSettings = DEFAULT_GRAPHICS_SETTINGS,
    initialAppearance: CharacterAppearance = resolveCharacterAppearance(),
    initialMaxHp = 250,
    initialDamageMultiplier = 1.0,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.graphicsSettings = initialGraphics;
    this.archetype = initialAppearance.archetype ?? 'standard';
    this.skinVariant = initialAppearance.skinVariant ?? 'phoenix';
    this.skinId = initialAppearance.skinId;
    this.playerMaxHp = initialMaxHp;
    this.playerHp = initialMaxHp;
    this.damageMultiplier = initialDamageMultiplier;
    this.targetCameraDistance = initialGraphics.cameraZoom;
    this.smoothCameraDistance = initialGraphics.cameraZoom;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setPixelRatio(this.computePixelRatio(initialGraphics.resolution));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    container.appendChild(this.renderer.domElement);

    // 2. Scene, Sky & Fog
    this.scene = new THREE.Scene();
    const horizonColor = 0xc0dbf4;
    this.scene.background = new THREE.Color(horizonColor);
    this.distanceFog = new THREE.Fog(horizonColor, 22, 102);
    this.scene.fog = initialGraphics.distanceFog ? this.distanceFog : null;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.65;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const skyTex = createSkyDomeTexture();
    this.disposableTextures.push(skyTex);
    const skyGeo = new THREE.SphereGeometry(210, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.disposableGeometries.push(skyGeo);
    this.disposableMaterials.push(skyMat);
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    this.skyAtmosphere = new SkyAtmosphere(initialGraphics.clouds);
    this.scene.add(this.skyAtmosphere.group);

    // 3. Camera
    const aspect = width / height;
    const fov = aspect < 1 ? 58 : 50;
    this.baseFov = fov;
    this.lastAppliedFov = fov;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.15, 320);

    // 4. Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xb8dcff, 0x263b64, 0.96);
    hemiLight.position.set(0, 30, 0);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.54);
    this.sunLight.position.copy(SUN_LIGHT_DIR).multiplyScalar(22);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 52;
    const d = 6.5;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.018;
    this.applyShadowQuality(initialGraphics.shadows);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x9ac6ff, 0.44);
    rimLight.position.set(-10, 8, 14);
    this.scene.add(rimLight);

    // Persistent PointLight for ability glow flares (never toggle .visible to prevent shader recompile)
    this.abilityLight = new THREE.PointLight(0xffffff, 0, 16, 1.7);
    this.abilityLight.castShadow = false;
    this.abilityLight.visible = true;
    this.scene.add(this.abilityLight);

    this.fx.setIdentity(this.archetype, this.skinVariant);
    this.fx.setAllowSubtleBlur(
      initialGraphics.preset === 'high' || initialGraphics.preset === 'ultra',
    );

    // 5. Physics & Minimalistic Dark-Blue Grid Baseplate
    this.physics = new CharacterPhysics();
    const maxAniso = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
    this.buildMinimalBaseplate(maxAniso);

    // 6. R16 Character + Auras / Wings + Ground Contact Shadow
    this.rig = createR16Character(initialAppearance);
    this.scene.add(this.rig.root);
    this.attachCharacterExtras();

    const shadowTex = createContactShadowTexture();
    this.disposableTextures.push(shadowTex);
    const shadowGeo = new THREE.PlaneGeometry(0.92, 0.92);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: initialGraphics.shadows === 'off' ? 0.34 : 0.18,
    });
    this.disposableGeometries.push(shadowGeo);
    this.disposableMaterials.push(shadowMat);
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.set(0, 0.015, 0);
    this.scene.add(this.contactShadow);

    this.animator = new CharacterAnimator(this.rig, this.archetype);
    this.ragdoll = new R16Ragdoll(this.rig);

    // 7. Combat Systems: Scarlet Witch + Darkhold + Phoenix Force VFX + Landing Dust + 3 Thugs
    this.vfx = new ScarletWitchVfxSystem();
    this.scene.add(this.vfx.group);

    this.darkholdBook = new DarkholdBookVfx();
    this.scene.add(this.darkholdBook.group);

    this.scarletShield = new ScarletShieldVfx();
    this.scene.add(this.scarletShield.group);

    this.phoenixVfx = new PhoenixVfxSystem(this.skinVariant);
    this.scene.add(this.phoenixVfx.group);

    this.emmaVfx = new EmmaFrostVfxSystem();
    this.scene.add(this.emmaVfx.group);

    this.emmaIdleRings = new EmmaIdleForeheadRings(4);
    this.scene.add(this.emmaIdleRings.group);

    this.helaVfx = new HelaVfxSystem();
    this.scene.add(this.helaVfx.group);

    this.magnetoVfx = new MagnetoVfxSystem();
    this.scene.add(this.magnetoVfx.group);

    this.quicksilverVfx = new QuicksilverVfxSystem();
    this.scene.add(this.quicksilverVfx.group);

    this.strangeVfx = new DoctorStrangeVfxSystem(initialAppearance);
    this.scene.add(this.strangeVfx.group);

    this.visionVfx = new VisionVfxSystem();
    this.scene.add(this.visionVfx.group);

    this.landingDust = new LandingDustSystem();
    this.scene.add(this.landingDust.group);

    this.npcs = new NpcCombatSystem();
    this.scene.add(this.npcs.group);

    // 8. Wind Trails
    this.windTrails = new WindTrailSystem();
    this.windTrails.lines.visible = initialGraphics.windTrails;
    this.scene.add(this.windTrails.lines);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 9. Listeners
    this.handleResizeBound = this.onResize.bind(this);
    this.handleKeyDownBound = this.onKeyDown.bind(this);
    this.handleKeyUpBound = this.onKeyUp.bind(this);
    this.handleContextLostBound = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      this.callbacks.onContextLost?.();
    };
    this.handleContextRestoredBound = () => {
      this.contextLost = false;
      this.callbacks.onContextRestored?.();
    };

    window.addEventListener('resize', this.handleResizeBound);
    window.addEventListener('orientationchange', this.handleResizeBound);
    document.addEventListener('fullscreenchange', this.handleResizeBound);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.handleContextLostBound,
    );
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.handleContextRestoredBound,
    );

    this.callbacks.onPlayerHealthChange?.(this.playerHp, this.playerMaxHp);
    this.lastTimeMs = performance.now();
    this.scheduleNextTick();
  }

  private attachCharacterExtras(): void {
    this.leftHandAura?.dispose();
    this.rightHandAura?.dispose();
    this.leftFireAura?.dispose();
    this.rightFireAura?.dispose();
    this.phoenixWings?.dispose();

    this.leftHandAura = null;
    this.rightHandAura = null;
    this.leftFireAura = null;
    this.rightFireAura = null;
    this.phoenixWings = null;

    if (this.archetype === 'scarlet-witch') {
      this.leftHandAura = new HandChaosAura(0.24);
      this.rightHandAura = new HandChaosAura(0.24);
      this.leftHandAura.group.position.set(0, -0.09, -0.06);
      this.rightHandAura.group.position.set(0, -0.09, -0.06);
      this.rig.leftHand.add(this.leftHandAura.group);
      this.rig.rightHand.add(this.rightHandAura.group);
    } else if (this.archetype === 'phoenix-force') {
      this.leftFireAura = new HandFireAura(this.skinVariant, 0.25);
      this.rightFireAura = new HandFireAura(this.skinVariant, 0.25);
      this.leftFireAura.group.position.set(0, -0.09, -0.06);
      this.rightFireAura.group.position.set(0, -0.09, -0.06);
      this.rig.leftHand.add(this.leftFireAura.group);
      this.rig.rightHand.add(this.rightFireAura.group);

      this.phoenixWings = new PhoenixWings(this.skinVariant);
      this.rig.chest.add(this.phoenixWings.group);
    }
  }

  private buildMinimalBaseplate(maxAniso: number): void {
    const innerSpan = BASEPLATE_HALF_INNER * 2;
    const outerSpan = BASEPLATE_HALF_OUTER * 2;
    const borderThick = BASEPLATE_HALF_OUTER - BASEPLATE_HALF_INNER;
    const skirtHeight = 2.0;

    const topTex = createBaseplateTopTexture(maxAniso, BASEPLATE_HALF_INNER);
    const trimTex = createBaseplateTrimTexture(maxAniso);
    this.disposableTextures.push(topTex, trimTex);

    const topMat = new THREE.MeshStandardMaterial({
      map: topTex,
      roughness: 0.92,
      metalness: 0.0,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      map: trimTex,
      roughness: 0.88,
      metalness: 0.02,
    });
    const skirtMat = new THREE.MeshStandardMaterial({
      color: '#121C34',
      roughness: 0.92,
      metalness: 0.0,
    });
    this.disposableMaterials.push(topMat, trimMat, skirtMat);

    const floorGeo = new THREE.BoxGeometry(innerSpan, skirtHeight, innerSpan);
    this.disposableGeometries.push(floorGeo);
    const floorMesh = new THREE.Mesh(floorGeo, [
      skirtMat,
      skirtMat,
      topMat,
      skirtMat,
      skirtMat,
      skirtMat,
    ]);
    floorMesh.position.set(0, -skirtHeight / 2, 0);
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    const totalBorderHeight = skirtHeight + BASEPLATE_BORDER_HEIGHT;
    const borderCenterY = (BASEPLATE_BORDER_HEIGHT - skirtHeight) / 2;

    const nsGeo = new THREE.BoxGeometry(outerSpan, totalBorderHeight, borderThick);
    const ewGeo = new THREE.BoxGeometry(borderThick, totalBorderHeight, innerSpan);
    this.disposableGeometries.push(nsGeo, ewGeo);

    const offset = BASEPLATE_HALF_INNER + borderThick / 2;

    const north = new THREE.Mesh(nsGeo, trimMat);
    north.position.set(0, borderCenterY, -offset);
    north.receiveShadow = true;
    north.castShadow = true;

    const south = new THREE.Mesh(nsGeo, trimMat);
    south.position.set(0, borderCenterY, offset);
    south.receiveShadow = true;
    south.castShadow = true;

    const west = new THREE.Mesh(ewGeo, trimMat);
    west.position.set(-offset, borderCenterY, 0);
    west.receiveShadow = true;
    west.castShadow = true;

    const east = new THREE.Mesh(ewGeo, trimMat);
    east.position.set(offset, borderCenterY, 0);
    east.receiveShadow = true;
    east.castShadow = true;

    this.scene.add(north, south, west, east);

    // Architectural pillars & walls around open mid-court (passable by Vision Intangibility)
    const pillars: Array<{ x: number; z: number; w: number; h: number; d: number }> = [
      { x: -9.2, z: 0.0, w: 1.6, h: 4.2, d: 5.2 },
      { x: 9.2, z: 0.0, w: 1.6, h: 4.2, d: 5.2 },
      { x: -9.2, z: -9.2, w: 4.6, h: 3.8, d: 1.6 },
      { x: 9.2, z: -9.2, w: 4.6, h: 3.8, d: 1.6 },
      { x: 0.0, z: -11.6, w: 5.8, h: 4.4, d: 1.6 },
      { x: -11.0, z: 9.2, w: 2.2, h: 3.6, d: 2.2 },
      { x: 11.0, z: 9.2, w: 2.2, h: 3.6, d: 2.2 },
    ];
    const pillarMat = new THREE.MeshStandardMaterial({
      color: '#1E2D4D',
      roughness: 0.78,
      metalness: 0.14,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: '#344B7A',
      roughness: 0.65,
      metalness: 0.18,
    });
    this.disposableMaterials.push(pillarMat, capMat);

    for (const p of pillars) {
      const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
      const capGeo = new THREE.BoxGeometry(p.w + 0.18, 0.24, p.d + 0.18);
      this.disposableGeometries.push(geo, capGeo);

      const mesh = new THREE.Mesh(geo, pillarMat);
      mesh.position.set(p.x, p.h * 0.5, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(p.x, p.h + 0.12, p.z);
      cap.castShadow = true;
      cap.receiveShadow = true;
      this.scene.add(cap);

      this.physics.addCollider({
        minX: p.x - p.w * 0.5,
        maxX: p.x + p.w * 0.5,
        minY: 0,
        maxY: p.h + 0.24,
        minZ: p.z - p.d * 0.5,
        maxZ: p.z + p.d * 0.5,
      });
    }
  }

  public setJoystickVector(x: number, y: number): void {
    if (!this.controlsEnabled || this.dead) {
      this.joyX = 0;
      this.joyY = 0;
      return;
    }
    this.joyX = THREE.MathUtils.clamp(x, -1, 1);
    this.joyY = THREE.MathUtils.clamp(y, -1, 1);
  }

  private isPhoenixReviving(): boolean {
    return this.phoenixRevivalState.phase !== 'idle';
  }

  private scaleDamage(base: number): number {
    return Math.max(1, Math.round(base * this.damageMultiplier));
  }

  public triggerJump(): void {
    if (
      !this.controlsEnabled ||
      this.dead ||
      this.painState.active ||
      this.isPhoenixReviving() ||
      this.mindControlState.phase === 'choosing' ||
      this.mindControlState.phase === 'mental-damage' ||
      this.telepathicWaveState.active ||
      this.magnetoTornadoState.active ||
      this.rapidPunchState.active ||
      this.windTornadoState.active ||
      this.visionBoltChargeState.active ||
      this.visionHeadGripState.active
    ) {
      return;
    }
    if (this.flightEnabled) {
      return;
    }
    this.jumpQueued = true;
    this.physics.queueJump();
  }

  public setSprintEnabled(enabled: boolean): void {
    this.sprintEnabled = enabled;
  }

  public setWingsAlwaysVisible(alwaysOn: boolean): void {
    const changed = this.wingsAlwaysVisible !== alwaysOn;
    this.wingsAlwaysVisible = alwaysOn;
    if (changed && !this.dead && this.archetype === 'phoenix-force') {
      this.fx.triggerCue(alwaysOn ? 'wings-on' : 'wings-off', this.physics.position);
    }
  }

  public setFlightEnabled(enabled: boolean): boolean {
    if (
      this.dead ||
      this.teleportState.phase !== 'idle' ||
      this.painState.active ||
      this.isPhoenixReviving() ||
      this.mindControlState.phase === 'choosing' ||
      this.mindControlState.phase === 'mental-damage' ||
      this.magnetoMeteorActive ||
      this.magnetoTornadoState.active ||
      this.rapidPunchState.active ||
      this.windTornadoState.active ||
      this.visionHeadGripState.active
    ) {
      return false;
    }
    const prev = this.flightEnabled;
    this.flightEnabled = enabled;
    if (enabled && this.archetype === 'phoenix-force') {
      this.animator.triggerAerialSpin(0.44);
    }
    if (enabled && this.archetype === 'doctor-strange') {
      this.animator.triggerCloakSurge();
    }
    if (this.archetype === 'magneto') {
      this.magnetoShieldState.active = enabled;
      this.magnetoVfx.setShieldActive(enabled);
      this.refreshInvulnerable();
    }
    if (this.archetype === 'vision' && !enabled && this.visionIntangibleState.active) {
      this.visionIntangibleState.active = false;
      this.visionIntangibleState.elapsed = 0;
      this.physics.resolveHorizontalOverlap();
      this.refreshInvulnerable();
      this.fx.triggerCue('vision-phase-off', this.physics.position);
      this.callbacks.onVisionPhaseChange?.(false, true);
    }
    if (enabled !== prev) {
      if (this.archetype === 'scarlet-witch') {
        this.fx.triggerCue(
          enabled ? 'scarlet-flight-on' : 'scarlet-flight-off',
          this.physics.position,
        );
      } else if (this.archetype === 'phoenix-force') {
        this.fx.triggerCue(
          enabled ? 'phoenix-flight-on' : 'phoenix-flight-off',
          this.physics.position,
        );
      } else if (this.archetype === 'magneto') {
        this.fx.triggerCue(
          enabled ? 'magneto-flight-on' : 'magneto-flight-off',
          this.physics.position,
        );
      } else if (this.archetype === 'doctor-strange') {
        this.fx.triggerCue(
          enabled ? 'strange-cloak-on' : 'strange-cloak-off',
          this.physics.position,
        );
      } else if (this.archetype === 'vision') {
        this.fx.triggerCue(
          enabled ? 'vision-flight-on' : 'vision-flight-off',
          this.physics.position,
        );
      }
    }
    return true;
  }

  /**
   * Scarlet Witch Flight Cancellation:
   * Immediately exits Flight, unleashes a large red magical shockwave around her,
   * damaging nearby targets with strong knockback + 2s ragdoll.
   */
  public cancelScarletFlightWithShockwave(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'scarlet-witch' ||
      !this.flightEnabled ||
      this.teleportState.phase !== 'idle'
    ) {
      return false;
    }

    this.flightEnabled = false;
    this.physics.velocity.y = Math.min(this.physics.velocity.y, -2.0);
    this.handFlareLeft = 1.4;
    this.handFlareRight = 1.4;
    this.animator.triggerCast('implosion', 0.34);

    this.vfx.spawnFlightCancelShockwave(this.physics.position);
    this.fx.triggerCue('scarlet-flight-cancel', this.physics.position);
    this.callbacks.onScarletFlightCancelShockwave?.();

    const hits = this.npcs.applyAreaFireExplosion(
      this.physics.position,
      SCARLET_FLIGHT_CANCEL_RADIUS,
      this.scaleDamage(25),
      2.0,
      6.4,
      0,
      0,
    );
    if (hits > 0) {
      this.callbacks.onHitTarget?.();
    }
    return true;
  }

  public isTeleporting(): boolean {
    return this.teleportState.phase !== 'idle';
  }

  public isInvulnerable(): boolean {
    return (
      this.invulnerable ||
      this.painState.active ||
      this.astralState.active ||
      this.diamondState.active ||
      this.magnetoShieldState.active ||
      this.strangeShieldState.active ||
      this.visionIntangibleState.active ||
      this.rapidPunchState.active ||
      this.visionHeadGripState.active
    );
  }

  private refreshInvulnerable(): void {
    this.invulnerable =
      this.teleportState.phase !== 'idle' ||
      this.painState.active ||
      this.astralState.active ||
      this.diamondState.active ||
      this.magnetoShieldState.active ||
      this.strangeShieldState.active ||
      this.visionIntangibleState.active ||
      this.rapidPunchState.active ||
      this.visionHeadGripState.active;
  }

  /**
   * Public damage intake entrypoint respecting immunity states (Pain Infliction,
   * Astral Form, Diamond, Teleport, Magnetic Shield, Mystic Shield, Vision Intangibility,
   * combo locks) and Scarlet Witch's 100-damage-pool / 10s Automatic Shield.
   */
  public damagePlayer(rawDamage: number): number {
    if (this.dead || rawDamage <= 0) return 0;
    if (
      this.teleportState.phase !== 'idle' ||
      this.painState.active ||
      this.astralState.active ||
      this.diamondState.active ||
      this.visionIntangibleState.active ||
      this.rapidPunchState.active ||
      this.visionHeadGripState.active
    ) {
      return 0;
    }

    if (this.magnetoShieldState.active) {
      this.fx.triggerCue('magneto-shield-on', this.physics.position);
      this.callbacks.onAutoShieldDeflect?.();
      return 0;
    }

    if (this.strangeShieldState.active) {
      this.fx.triggerCue('strange-shield-on', this.physics.position);
      this.callbacks.onAutoShieldDeflect?.();
      return 0;
    }

    let remainingDamage = rawDamage;
    if (this.shieldState.active && this.shieldState.absorbRemaining > 0) {
      const absorbed = Math.min(this.shieldState.absorbRemaining, remainingDamage);
      this.shieldState.absorbRemaining -= absorbed;
      remainingDamage -= absorbed;

      this.scarletShield.triggerDeflectFlash();
      this.fx.triggerCue('auto-shield-deflect', this.physics.position);
      this.callbacks.onAutoShieldDeflect?.();

      if (this.shieldState.absorbRemaining <= 0) {
        this.shieldState.active = false;
        this.shieldState.elapsed = 0;
        this.callbacks.onAutoShieldChange?.(false);
      }
    }

    if (remainingDamage > 0) {
      this.playerHp = Math.max(0, this.playerHp - remainingDamage);
      this.callbacks.onPlayerHealthChange?.(this.playerHp, this.playerMaxHp);
      if (this.playerHp <= 0) {
        this.callbacks.onPlayerDeath?.();
      }
    }

    return remainingDamage;
  }

  private closeDarkhold(triggerCooldown: boolean, immediate = false): void {
    if (!this.darkholdState.active) return;
    this.darkholdState.active = false;
    this.darkholdState.elapsed = 0;
    this.darkholdBook.setOpen(false, immediate);

    if (this.shieldState.active) {
      this.shieldState.active = false;
      this.shieldState.elapsed = 0;
      this.shieldState.absorbRemaining = AUTO_SHIELD_MAX_ABSORB;
      this.callbacks.onAutoShieldChange?.(false);
    }
    this.refreshInvulnerable();

    if (!immediate && !this.dead) {
      this.fx.triggerCue('darkhold-close', this.physics.position);
    }
    this.callbacks.onDarkholdChange?.(false, triggerCooldown);
  }

  public toggleDarkhold(): boolean {
    if (this.archetype !== 'scarlet-witch') return false;
    if (this.darkholdState.active) {
      if (this.teleportState.phase !== 'idle') return false;
      this.closeDarkhold(true, false);
      return true;
    }

    if (
      this.dead ||
      !this.controlsEnabled ||
      this.teleportState.phase !== 'idle'
    ) {
      return false;
    }

    this.darkholdState.active = true;
    this.darkholdState.elapsed = 0;
    this.darkholdBook.setOpen(true, false);
    this.animator.triggerCast('implosion', 0.34);
    this.handFlareLeft = 1.15;
    this.handFlareRight = 1.3;
    // Subtle crimson eldritch mist only (no explosion or shockwave on Darkhold summon)
    this.vfx.spawnBodyMistCloud(this.physics.position);
    this.fx.triggerCue('darkhold-open', this.physics.position);
    this.callbacks.onDarkholdChange?.(true, false);
    return true;
  }

  public castTelekineticExplosion(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'scarlet-witch' ||
      !this.darkholdState.active ||
      this.teleportState.phase !== 'idle'
    ) {
      return false;
    }

    this.animator.triggerCast('implosion', 0.38);
    this.handFlareLeft = 1.45;
    this.handFlareRight = 1.45;
    this.vfx.spawnTelekineticExplosion(this.physics.position);
    this.fx.triggerCue('telekinetic-explosion', this.physics.position);
    this.callbacks.onTelekineticExplosion?.();

    const hits = this.npcs.applyAreaFireExplosion(
      this.physics.position,
      TELEKINETIC_EXPLOSION_RADIUS,
      this.scaleDamage(28),
      2.0,
      7.4,
      0,
      0,
    );
    if (hits > 0) {
      this.callbacks.onHitTarget?.();
    }
    return true;
  }

  public castAutoShield(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'scarlet-witch' ||
      !this.darkholdState.active ||
      this.shieldState.active ||
      this.teleportState.phase !== 'idle'
    ) {
      return false;
    }

    this.shieldState.active = true;
    this.shieldState.elapsed = 0;
    this.shieldState.absorbRemaining = AUTO_SHIELD_MAX_ABSORB;
    this.refreshInvulnerable();

    this.animator.triggerCast('implosion', 0.28);
    this.handFlareLeft = 1.25;
    this.handFlareRight = 1.25;
    this.fx.triggerCue('auto-shield-on', this.physics.position);
    this.callbacks.onAutoShieldChange?.(true);
    return true;
  }

  private getReticleNdc(): THREE.Vector2 {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this._reticleNdc.set((18 * 2) / w, (22 * 2) / h);
    return this._reticleNdc;
  }

  private computeReticleAimPoint(
    maxDistance: number,
    preferTarget: boolean,
    clampToFloor: boolean,
  ): THREE.Vector3 {
    if (preferTarget && this.npcs.getSelectedTargetAimPoint(this._aimTarget)) {
      const dist = this._aimTarget.distanceTo(this.physics.position);
      if (dist <= maxDistance) {
        return this._aimTarget.clone();
      }
    }

    const ndc = this.getReticleNdc();
    this._raycaster.setFromCamera(ndc, this.camera);
    const ray = this._raycaster.ray;
    const camToPlayer = ray.origin.distanceTo(this.physics.position);

    // For projectiles / airborne aim, intersect exact crosshair ray with alive NPCs & floor
    if (!clampToFloor) {
      let bestRayT = Infinity;
      const hitPoint = new THREE.Vector3();
      const sphereCenter = new THREE.Vector3();
      const probes = this.npcs.getTargetProbes();
      for (const trg of probes) {
        sphereCenter.set(trg.position.x, trg.position.y + trg.height * 0.55, trg.position.z);
        const ocX = ray.origin.x - sphereCenter.x;
        const ocY = ray.origin.y - sphereCenter.y;
        const ocZ = ray.origin.z - sphereCenter.z;
        const b = ocX * ray.direction.x + ocY * ray.direction.y + ocZ * ray.direction.z;
        const r = trg.radius + 0.32;
        const c = ocX * ocX + ocY * ocY + ocZ * ocZ - r * r;
        const disc = b * b - c;
        if (disc >= 0) {
          const t = -b - Math.sqrt(disc);
          if (t > camToPlayer * 0.45 && t < bestRayT) {
            bestRayT = t;
          }
        }
      }

      const floorHit = new THREE.Vector3();
      if (ray.intersectPlane(this._groundPlane, floorHit)) {
        const floorT = ray.origin.distanceTo(floorHit);
        if (floorT > camToPlayer * 0.45 && floorT < bestRayT) {
          bestRayT = floorT;
        }
      }

      const maxRayT = camToPlayer + maxDistance;
      if (bestRayT < Infinity) {
        const chosenT = Math.min(bestRayT, maxRayT);
        ray.at(chosenT, hitPoint);
        hitPoint.y = Math.max(hitPoint.y, 0.08);
        return hitPoint;
      }

      ray.at(camToPlayer + maxDistance * 0.72, hitPoint);
      hitPoint.y = Math.max(hitPoint.y, 0.25);
      return hitPoint;
    }

    const hitFloor = new THREE.Vector3();
    const intersected = ray.intersectPlane(this._groundPlane, hitFloor);

    if (intersected) {
      const toHit = hitFloor.clone().sub(this.physics.position);
      toHit.y = 0;
      const horizDist = toHit.length();
      if (horizDist > maxDistance && horizDist > 0.001) {
        toHit.multiplyScalar(maxDistance / horizDist);
        hitFloor.copy(this.physics.position).add(toHit);
        hitFloor.y = 0;
      }
      return hitFloor;
    }

    const dir = ray.direction.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
    dir.normalize();
    const out = this.physics.position.clone().addScaledVector(dir, maxDistance * 0.72);
    out.y = 0;
    return out;
  }

  private computeForwardAimDirection(): THREE.Vector3 {
    const ndc = this.getReticleNdc();
    this._raycaster.setFromCamera(ndc, this.camera);
    const dir = this._raycaster.ray.direction.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.001) {
      dir.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    } else {
      dir.normalize();
    }
    return dir;
  }

  public castChaosBolt(): boolean {
    if (this.dead || !this.controlsEnabled || this.teleportState.phase !== 'idle') {
      return false;
    }

    const hand = this.nextBoltHand;
    this.nextBoltHand = hand === 'right' ? 'left' : 'right';

    this.animator.triggerCast(hand === 'right' ? 'bolt-right' : 'bolt-left', 0.28);
    if (hand === 'right') {
      this.handFlareRight = 1.0;
    } else {
      this.handFlareLeft = 1.0;
    }

    this.rig.root.updateMatrixWorld(true);
    const handGroup = hand === 'right' ? this.rig.rightHand : this.rig.leftHand;
    handGroup.getWorldPosition(this._handWorld);
    this._handWorld.y -= 0.06;

    const target = this.computeReticleAimPoint(30, true, false);
    this.vfx.spawnChaosBolt(this._handWorld, target);
    this.fx.triggerCue('chaos-bolt-cast', this._handWorld);
    return true;
  }

  public castTeleport(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'scarlet-witch' ||
      !this.darkholdState.active ||
      this.teleportState.phase !== 'idle'
    ) {
      return false;
    }

    const dest = this.computeReticleAimPoint(TELEPORT_MAX_DISTANCE, false, true);
    const safeBound = BASEPLATE_HALF_INNER - 0.85;
    dest.x = THREE.MathUtils.clamp(dest.x, -safeBound, safeBound);
    dest.z = THREE.MathUtils.clamp(dest.z, -safeBound, safeBound);
    dest.y = this.flightEnabled ? Math.max(this.physics.position.y, 0.85) : 0;

    if (this.npcs.isPositionBlockedByNpc(dest, 0.8)) {
      const toDest = dest.clone().sub(this.physics.position);
      toDest.y = 0;
      if (toDest.lengthSq() > 0.01) {
        toDest.normalize();
        dest.addScaledVector(toDest, -1.1);
        dest.x = THREE.MathUtils.clamp(dest.x, -safeBound, safeBound);
        dest.z = THREE.MathUtils.clamp(dest.z, -safeBound, safeBound);
      }
    }

    if (
      Math.hypot(
        dest.x - this.physics.position.x,
        dest.z - this.physics.position.z,
      ) < 0.75
    ) {
      return false;
    }

    this.teleportState = {
      phase: 'preparing',
      elapsed: 0,
      destination: dest,
    };
    this.refreshInvulnerable();
    this.callbacks.onTeleportLockChange?.(true);
    this.callbacks.onTeleportStart?.();

    this.animator.triggerCast('teleport', 0.45);
    this.handFlareLeft = 1.0;
    this.handFlareRight = 1.0;
    this.vfx.spawnBodyMistCloud(this.physics.position);
    this.fx.triggerCue('teleport-vanish', this.physics.position);
    return true;
  }

  public castChaosImplosion(): boolean {
    if (this.dead || !this.controlsEnabled || this.teleportState.phase !== 'idle') {
      return false;
    }

    this.animator.triggerCast('implosion', 0.36);
    this.handFlareLeft = 1.25;
    this.handFlareRight = 1.25;

    this.rig.root.updateMatrixWorld(true);
    const rPos = new THREE.Vector3();
    const lPos = new THREE.Vector3();
    this.rig.rightHand.getWorldPosition(rPos);
    this.rig.leftHand.getWorldPosition(lPos);
    const origin = rPos.add(lPos).multiplyScalar(0.5);

    const target = this.computeReticleAimPoint(IMPLOSION_MAX_DISTANCE, true, true);
    target.y = Math.max(target.y, 0.25);

    this.vfx.spawnChaosImplosion(origin, target);
    this.fx.triggerCue('chaos-implosion-cast', origin);
    return true;
  }

  // Phoenix Force Abilities
  private executeWaveBlast(
    stepIdx: number,
    pos: THREE.Vector3,
    forwardDir: THREE.Vector3,
  ): void {
    if (stepIdx === 0) {
      this.animator.triggerCast('bolt-right', 0.24);
      this.handFlareRight = 1.15;
    } else if (stepIdx === 1) {
      this.animator.triggerCast('bolt-left', 0.24);
      this.handFlareLeft = 1.15;
    } else {
      this.animator.triggerCast('implosion', 0.34);
      this.handFlareLeft = 1.35;
      this.handFlareRight = 1.35;
    }

    this.phoenixVfx.spawnPhoenixWaveExplosion(pos, stepIdx, forwardDir);
    const waveCue =
      stepIdx === 0
        ? 'phoenix-wave-step-0'
        : stepIdx === 1
          ? 'phoenix-wave-step-1'
          : 'phoenix-wave-step-2';
    this.fx.triggerCue(waveCue, pos);
    this.callbacks.onPhoenixWaveStep?.(stepIdx);
    const hits = this.npcs.applyAreaFireExplosion(
      pos,
      PHOENIX_WAVE_RADIUS,
      this.scaleDamage(20),
      1.4,
      3.8,
      3.0,
      this.scaleDamage(2),
    );
    if (hits > 0) {
      this.callbacks.onHitTarget?.();
    }
  }

  public castPhoenixWave(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.teleportState.phase !== 'idle' ||
      this.painState.active
    ) {
      return false;
    }

    const fwd = this.computeForwardAimDirection();
    const safeBound = BASEPLATE_HALF_INNER - 0.85;
    const distances = [3.2, 6.3, 9.5];
    const positions = distances.map((d) => {
      const p = this.physics.position.clone().addScaledVector(fwd, d);
      p.x = THREE.MathUtils.clamp(p.x, -safeBound, safeBound);
      p.z = THREE.MathUtils.clamp(p.z, -safeBound, safeBound);
      p.y = 0;
      return p;
    });

    this.callbacks.onPhoenixWaveCast?.();
    this.fx.triggerCue('phoenix-wave-cast', this.physics.position);
    // Step 0 triggers immediately (right hand); steps 1 (left hand) & 2 (both hands) follow
    this.executeWaveBlast(0, positions[0], fwd);
    this.scheduledWaves.push(
      { remainingSec: 0.24, stepIdx: 1, position: positions[1], forward: fwd.clone() },
      { remainingSec: 0.48, stepIdx: 2, position: positions[2], forward: fwd.clone() },
    );
    return true;
  }

  public castPhoenixFireball(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.teleportState.phase !== 'idle' ||
      this.painState.active
    ) {
      return false;
    }

    const hand = this.nextBoltHand;
    this.nextBoltHand = hand === 'right' ? 'left' : 'right';

    this.animator.triggerCast(hand === 'right' ? 'bolt-right' : 'bolt-left', 0.22);
    if (hand === 'right') {
      this.handFlareRight = 1.05;
    } else {
      this.handFlareLeft = 1.05;
    }

    this.rig.root.updateMatrixWorld(true);
    const handGroup = hand === 'right' ? this.rig.rightHand : this.rig.leftHand;
    handGroup.getWorldPosition(this._handWorld);
    this._handWorld.y -= 0.06;

    const target = this.computeReticleAimPoint(32, true, false);
    this.phoenixVfx.spawnFireball(this._handWorld, target);
    this.fx.triggerCue('phoenix-fireball-cast', this._handWorld);
    return true;
  }

  private cancelPainInfliction(triggerCooldown: boolean): void {
    const tid = this.painState.targetId;
    if (tid) {
      this.npcs.setPainRestricted(tid, false);
    }
    this.painState.active = false;
    this.painState.targetId = null;
    this.painState.elapsed = 0;
    this.painState.tickAccum = 0;
    this.painState.ticksDone = 0;
    this.refreshInvulnerable();
    this.animator.setPainChanneling(false);
    this.phoenixVfx.updatePainTelekinetic(false, null, null, 0);
    this.fx.triggerCue('pain-cancel', this.physics.position);
    this.callbacks.onPainInflictionChange?.(false, triggerCooldown);
  }

  public togglePainInfliction(): boolean {
    if (this.painState.active) {
      this.cancelPainInfliction(true);
      return true;
    }

    if (
      this.dead ||
      !this.controlsEnabled ||
      this.teleportState.phase !== 'idle' ||
      this.isPhoenixReviving()
    ) {
      return false;
    }

    const targetId =
      this.npcs.getSelectedTargetId() ??
      this.npcs.findClosestTargetId(this.physics.position, 22);
    if (!targetId || !this.npcs.getTargetTorsoPosition(targetId, this._painTargetWorld)) {
      return false;
    }

    this.painState.active = true;
    this.painState.targetId = targetId;
    this.painState.elapsed = 0;
    this.painState.tickAccum = 0;
    this.painState.ticksDone = 0;
    this.painState.lastTargetPos.copy(this._painTargetWorld);
    this.physics.velocity.x = 0;
    this.physics.velocity.z = 0;
    this.refreshInvulnerable();

    this.npcs.setPainRestricted(targetId, true);
    this.animator.setPainChanneling(true);
    this.handFlareLeft = 1.15;
    this.handFlareRight = 1.25;
    this.fx.triggerCue('pain-start', this.physics.position);
    this.callbacks.onPainInflictionChange?.(true, false);
    return true;
  }

  // ====================================================================
  // EMMA FROST ABILITIES
  // ====================================================================

  private clearMindControl(triggerCooldown: boolean): void {
    const tid = this.mindControlState.targetId;
    if (tid) {
      this.npcs.setExternalControl(tid, false);
    }
    this.emmaVfx.setMindControlBeam(false);
    this.animator.setTelepathicWave(false);
    const hadActive = this.mindControlState.phase !== 'idle';
    this.mindControlState.phase = 'idle';
    this.mindControlState.targetId = null;
    this.mindControlState.elapsed = 0;
    this.mindControlState.dmgAccum = 0;
    if (hadActive) {
      this.callbacks.onMindControlChange?.('idle', triggerCooldown);
    }
  }

  public activateMindControl(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'emma-frost' ||
      this.skinId !== 'white-queen' ||
      this.diamondState.active ||
      this.telepathicWaveState.active ||
      this.mindControlState.phase !== 'idle'
    ) {
      return false;
    }

    const targetId = this.npcs.getSelectedTargetId();
    if (!targetId) {
      this.callbacks.onAbilityFeedback?.('Select a target first');
      return false;
    }

    const probe = this.npcs.getTargetProbes().find((p) => p.id === targetId);
    const targetHead = new THREE.Vector3();
    if (!probe || !this.npcs.getTargetHeadPosition(targetId, targetHead)) {
      this.callbacks.onAbilityFeedback?.('Select a valid target first');
      return false;
    }

    this.physics.velocity.x = 0;
    this.physics.velocity.z = 0;

    const yawToNpc = Math.atan2(
      -(probe.position.x - this.physics.position.x),
      -(probe.position.z - this.physics.position.z),
    );
    this.cameraYaw = yawToNpc;
    this.rig.root.rotation.y = yawToNpc;

    this.npcs.setExternalControl(targetId, true);
    this.npcs.setExternalPose(targetId, probe.position, yawToNpc + Math.PI, {
      headache: true,
    });

    this.rig.root.updateMatrixWorld(true);
    this._foreheadPos.set(0, 0.3, -0.25).applyMatrix4(this.rig.head.matrixWorld);
    this.emmaVfx.setMindControlBeam(true, this._foreheadPos, targetHead);

    this.animator.setTelepathicWave(true);
    this.mindControlState.phase = 'choosing';
    this.mindControlState.targetId = targetId;
    this.mindControlState.elapsed = 0;
    this.mindControlState.dmgAccum = 0;

    this.fx.triggerCue('mind-control-link', this._foreheadPos);
    this.callbacks.onMindControlChange?.('choosing', false);
    return true;
  }

  public selectMindControlOption(
    option: 'mc-paralysis' | 'mc-sleep' | 'mc-mental-damage',
  ): void {
    if (
      this.dead ||
      this.archetype !== 'emma-frost' ||
      this.mindControlState.phase !== 'choosing' ||
      !this.mindControlState.targetId
    ) {
      return;
    }

    const targetId = this.mindControlState.targetId;
    if (!this.npcs.isTargetAlive(targetId)) {
      this.clearMindControl(true);
      return;
    }

    this.fx.triggerCue('mind-control-select', this.physics.position);

    if (option === 'mc-paralysis') {
      this.npcs.setExternalControl(targetId, false);
      if (
        this.mindControlState.paralysisTargetId &&
        this.mindControlState.paralysisTargetId !== targetId
      ) {
        this.npcs.setMindControlParalysis(
          this.mindControlState.paralysisTargetId,
          false,
        );
      }
      this.npcs.setMindControlParalysis(targetId, true);
      this.mindControlState.paralysisTargetId = targetId;
      this.mindControlState.paralysisRemaining = EMMA_MC_PARALYSIS_MS / 1000;

      this.emmaVfx.setMindControlBeam(false);
      this.animator.setTelepathicWave(false);
      this.mindControlState.phase = 'idle';
      this.mindControlState.targetId = null;
      this.mindControlState.elapsed = 0;
      this.mindControlState.dmgAccum = 0;
      this.callbacks.onMindControlChange?.('idle', true);
      return;
    }

    if (option === 'mc-sleep') {
      this.npcs.setExternalControl(targetId, false);
      this.npcs.triggerTargetRagdoll(targetId, EMMA_MC_SLEEP_MS / 1000);

      this.emmaVfx.setMindControlBeam(false);
      this.animator.setTelepathicWave(false);
      this.mindControlState.phase = 'idle';
      this.mindControlState.targetId = null;
      this.mindControlState.elapsed = 0;
      this.mindControlState.dmgAccum = 0;
      this.callbacks.onMindControlChange?.('idle', true);
      return;
    }

    // option === 'mc-mental-damage'
    this.mindControlState.phase = 'mental-damage';
    this.mindControlState.elapsed = 0;
    this.mindControlState.dmgAccum = 0.25;
    this.callbacks.onMindControlChange?.('mental-damage', false);
  }

  public castMentalAttack(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'emma-frost' ||
      this.diamondState.active ||
      this.telepathicWaveState.active ||
      this.mindControlState.phase === 'choosing' ||
      this.mindControlState.phase === 'mental-damage'
    ) {
      return false;
    }

    this.rig.root.updateMatrixWorld(true);
    this.rig.head.getWorldPosition(this._foreheadPos);
    const sinY = Math.sin(this.rig.root.rotation.y);
    const cosY = Math.cos(this.rig.root.rotation.y);
    this._foreheadPos.x += -sinY * 0.24;
    this._foreheadPos.y += 0.14;
    this._foreheadPos.z += -cosY * 0.24;

    const targetId =
      this.npcs.getSelectedTargetId() ??
      this.npcs.findClosestTargetId(this.physics.position, 24);
    const targetHead = new THREE.Vector3();
    if (!targetId || !this.npcs.getTargetHeadPosition(targetId, targetHead)) {
      targetHead.copy(this.computeReticleAimPoint(24, true, false));
      targetHead.y += 0.5;
    }

    this.animator.triggerCast('mental-focus', 0.3);
    this.fx.triggerCue('mental-attack', this._foreheadPos);

    const originCopy = this._foreheadPos.clone();
    this.emmaVfx.spawnMentalAttack(originCopy, targetHead, targetId, () => {
      const impactPos = targetHead.clone();
      if (targetId && this.npcs.getTargetHeadPosition(targetId, impactPos)) {
        // Updated head world coordinates
      }
      this.emmaVfx.spawnMentalHeadExplosion(impactPos);
      this.fx.triggerCue('mental-impact', impactPos);
      this.callbacks.onMentalAttackImpact?.();

      if (targetId && this.npcs.isTargetAlive(targetId)) {
        const hitDir = impactPos.clone().sub(originCopy).setY(0);
        if (hitDir.lengthSq() < 0.001) hitDir.set(-sinY, 0, -cosY);
        else hitDir.normalize();
        if (this.npcs.applyDamage(targetId, this.scaleDamage(15), hitDir, 0)) {
          this.callbacks.onHitTarget?.();
        }
      }
    });
    return true;
  }

  public toggleAstralProjection(): boolean {
    if (this.archetype !== 'emma-frost' || this.skinId === 'white-queen') {
      return false;
    }
    if (this.astralState.active) {
      this.astralState.active = false;
      this.astralState.elapsed = 0;
      this.rig.setAstralProjection(false);
      this.refreshInvulnerable();
      this.fx.triggerCue('astral-off', this.physics.position);
      this.callbacks.onAstralProjectionChange?.(false, true);
      return true;
    }

    if (
      this.dead ||
      !this.controlsEnabled ||
      this.diamondState.active ||
      this.telepathicWaveState.active ||
      this.mindControlState.phase !== 'idle'
    ) {
      return false;
    }

    this.astralState.active = true;
    this.astralState.elapsed = 0;
    this.rig.setAstralProjection(true);
    this.refreshInvulnerable();
    this.animator.triggerCast('mental-focus', 0.3);
    this.fx.triggerCue('astral-on', this.physics.position);
    this.callbacks.onAstralProjectionChange?.(true, false);
    return true;
  }

  public toggleDiamondForm(): boolean {
    if (this.archetype !== 'emma-frost') return false;
    if (this.diamondState.active) {
      this.diamondState.active = false;
      this.diamondState.elapsed = 0;
      this.refreshInvulnerable();
      this.fx.triggerCue('diamond-off', this.physics.position);
      this.callbacks.onDiamondFormChange?.(false, true);
      return true;
    }

    if (
      this.dead ||
      !this.controlsEnabled ||
      this.astralState.active ||
      this.mindControlState.phase === 'choosing' ||
      this.mindControlState.phase === 'mental-damage' ||
      this.telepathicWaveState.active
    ) {
      return false;
    }

    this.diamondState.active = true;
    this.diamondState.elapsed = 0;
    this.refreshInvulnerable();
    this.animator.triggerCast('diamond-cast', 0.36);
    this.fx.triggerCue('diamond-on', this.physics.position);
    this.callbacks.onDiamondFormChange?.(true, false);
    return true;
  }

  public castDiamondProjectile(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'emma-frost' ||
      !this.diamondState.active
    ) {
      return false;
    }

    const hand = this.nextBoltHand;
    this.nextBoltHand = hand === 'right' ? 'left' : 'right';
    this.animator.triggerCast(hand === 'right' ? 'bolt-right' : 'bolt-left', 0.24);

    this.rig.root.updateMatrixWorld(true);
    const handGroup = hand === 'right' ? this.rig.rightHand : this.rig.leftHand;
    handGroup.getWorldPosition(this._handWorld);
    this._handWorld.y -= 0.05;

    const target = this.computeReticleAimPoint(28, true, false);
    this.emmaVfx.spawnDiamondProjectile(this._handWorld, target);
    this.fx.triggerCue('diamond-shard', this._handWorld);
    return true;
  }

  public castTelepathicWave(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'emma-frost' ||
      this.diamondState.active ||
      this.mindControlState.phase === 'choosing' ||
      this.mindControlState.phase === 'mental-damage' ||
      this.telepathicWaveState.active
    ) {
      return false;
    }

    this.telepathicWaveState = {
      active: true,
      elapsed: 0,
      ringAccum: 0.24,
      tickAccum: 0.38,
    };
    this.animator.setTelepathicWave(true);
    this.fx.triggerCue('telepathic-wave', this.physics.position);
    this.callbacks.onTelepathicWaveChange?.(true, false);
    return true;
  }

  // ====================================================================
  // HELA ABILITIES
  // ====================================================================

  public toggleCrownForm(): boolean {
    if (this.archetype !== 'hela') return false;
    if (this.crownState.active) {
      this.crownState.active = false;
      this.crownState.elapsed = 0;
      this.fx.triggerCue('crown-off', this.physics.position);
      this.callbacks.onCrownFormChange?.(false, true);
      return true;
    }

    if (this.dead || !this.controlsEnabled || this.isPhoenixReviving()) {
      return false;
    }

    this.crownState.active = true;
    this.crownState.elapsed = 0;

    this.animator.triggerCast('crown-transform', 0.44);
    this.fx.triggerCue('crown-on', this.physics.position);
    this.callbacks.onCrownFormChange?.(true, false);
    return true;
  }

  public activateSwordSummon(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.isPhoenixReviving() ||
      this.archetype !== 'hela' ||
      this.swordSummonState.active
    ) {
      return false;
    }

    this.swordSummonState = {
      active: true,
      elapsed: 0,
      leftInHand: true,
      rightInHand: true,
      nextThrowHand: 'right',
      reloadHand: null,
      throwReady: true,
      reloadElapsed: 0,
      reloading: false,
      slashCooldownRemaining: 0,
    };
    this.rig.setHelaHandSwords(true, true);
    this.animator.setSwordHeld(true);
    this.animator.triggerCast('sword-summon-open', 0.42);
    this.fx.triggerCue('sword-summon', this.physics.position);
    this.callbacks.onSwordSummonChange?.(true, false);
    this.callbacks.onSwordThrowAvailabilityChange?.(true);
    return true;
  }

  public throwNecrosword(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.isPhoenixReviving() ||
      this.archetype !== 'hela' ||
      !this.swordSummonState.active ||
      !this.swordSummonState.throwReady
    ) {
      return false;
    }

    const hand = this.swordSummonState.nextThrowHand;
    this.swordSummonState.nextThrowHand = hand === 'right' ? 'left' : 'right';
    if (hand === 'right') {
      this.swordSummonState.rightInHand = false;
    } else {
      this.swordSummonState.leftInHand = false;
    }
    this.swordSummonState.reloadHand = hand;
    this.swordSummonState.throwReady = false;
    this.swordSummonState.reloading = true;
    this.swordSummonState.reloadElapsed = 0;

    this.rig.setHelaHandSwords(
      this.swordSummonState.leftInHand,
      this.swordSummonState.rightInHand,
    );
    this.animator.triggerCast(
      hand === 'right' ? 'sword-throw-right' : 'sword-throw-left',
      0.38,
    );

    this.rig.root.updateMatrixWorld(true);
    const handGroup = hand === 'right' ? this.rig.rightHand : this.rig.leftHand;
    handGroup.getWorldPosition(this._handWorld);
    const target = this.computeReticleAimPoint(28, true, false);
    const dmg = this.scaleDamage(25 + (this.crownState.active ? HELA_CROWN_BONUS_DAMAGE : 0));

    this.helaVfx.spawnThrownSword(this._handWorld, target, dmg);
    this.fx.triggerCue('sword-throw', this._handWorld);
    this.callbacks.onSwordThrowAvailabilityChange?.(false);
    return true;
  }

  public castSwordSlash(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.isPhoenixReviving() ||
      this.archetype !== 'hela' ||
      !this.swordSummonState.active ||
      this.swordSummonState.slashCooldownRemaining > 0
    ) {
      return false;
    }

    const probes = this.npcs.getTargetProbes();
    let closest: { id: string; dist: number; dx: number; dz: number } | null = null;
    for (const trg of probes) {
      const dx = trg.position.x - this.physics.position.x;
      const dz = trg.position.z - this.physics.position.z;
      const dy = Math.abs(trg.position.y - this.physics.position.y);
      const dist = Math.hypot(dx, dz);
      if (dist <= 2.95 && dy <= 2.2 && (!closest || dist < closest.dist)) {
        closest = { id: trg.id, dist, dx, dz };
      }
    }

    this.swordSummonState.slashCooldownRemaining = HELA_SWORD_SLASH_COOLDOWN_MS / 1000;

    const roll = Math.random();
    const kind: 'right' | 'left' | 'dual' =
      roll < 0.34 ? 'right' : roll < 0.68 ? 'left' : 'dual';

    this.animator.triggerCast(
      kind === 'right'
        ? 'sword-slash-right'
        : kind === 'left'
          ? 'sword-slash-left'
          : 'sword-slash-dual',
      0.3,
    );

    const hitDir = closest
      ? new THREE.Vector3(closest.dx, 0, closest.dz)
      : new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    if (hitDir.lengthSq() > 1e-4) {
      hitDir.normalize();
    } else {
      hitDir.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    }

    const slashOrigin = this.physics.position
      .clone()
      .add(new THREE.Vector3(0, 1.15, 0))
      .addScaledVector(hitDir, 0.55);
    this.helaVfx.spawnSwordSlashTrail(slashOrigin, hitDir, kind);
    this.fx.triggerCue('sword-slash', slashOrigin);
    this.callbacks.onSwordSlash?.();

    const baseDmg = kind === 'dual' ? 26 : 20;
    const dmg = this.scaleDamage(baseDmg + (this.crownState.active ? HELA_CROWN_BONUS_DAMAGE : 0));

    // Single-hit close arc validation (never multi-hits the same target per swing)
    let hitAny = false;
    for (const trg of probes) {
      const dx = trg.position.x - this.physics.position.x;
      const dz = trg.position.z - this.physics.position.z;
      const dy = Math.abs(trg.position.y - this.physics.position.y);
      const dist = Math.hypot(dx, dz);
      if (dist <= 2.95 && dy <= 2.2) {
        const dot =
          dist > 0.01 ? (dx * hitDir.x + dz * hitDir.z) / dist : 1;
        if ((closest && trg.id === closest.id) || dot >= 0.35) {
          const knock = dist > 0.01 ? new THREE.Vector3(dx / dist, 0, dz / dist) : hitDir;
          if (this.npcs.applyDamage(trg.id, dmg, knock, 0)) {
            hitAny = true;
          }
        }
      }
    }
    if (hitAny) {
      this.callbacks.onHitTarget?.();
    }
    return true;
  }

  public castGreenExplosion(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.isPhoenixReviving() ||
      this.archetype !== 'hela' ||
      this.greenChargeState.active
    ) {
      return false;
    }

    this.greenChargeState = {
      active: true,
      elapsed: 0,
    };
    this.animator.triggerCast('green-charge-slam', 0.68);
    this.fx.triggerCue('green-charge', this.physics.position);
    this.callbacks.onGreenExplosion?.('charge');
    return true;
  }

  public castSpinningLeap(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.isPhoenixReviving() ||
      this.archetype !== 'hela' ||
      this.spinningLeapState.active
    ) {
      return false;
    }

    const fwd = this.computeForwardAimDirection();
    this.physics.position.y = Math.max(this.physics.position.y, 0.06);
    this.physics.velocity.set(fwd.x * 21.8, 15.2, fwd.z * 21.8);

    this.spinningLeapState = {
      active: true,
      elapsed: 0,
    };
    this.animator.setSpinningLeap(true);
    this.fx.triggerCue('spinning-leap', this.physics.position);
    this.callbacks.onSpinningLeap?.('launch');
    return true;
  }

  public castGroundSword(): boolean {
    if (this.dead || !this.controlsEnabled || this.archetype !== 'hela') {
      return false;
    }

    const center = this.computeReticleAimPoint(22, true, true);
    const safeBound = BASEPLATE_HALF_INNER - 0.85;
    center.x = THREE.MathUtils.clamp(center.x, -safeBound, safeBound);
    center.z = THREE.MathUtils.clamp(center.z, -safeBound, safeBound);
    center.y = 0;

    this.animator.triggerCast('implosion', 0.34);
    this.helaVfx.spawnGroundSword(center);
    this.fx.triggerCue('ground-sword', center);
    this.callbacks.onGroundSword?.();

    const dmg = this.scaleDamage(35 + (this.crownState.active ? HELA_CROWN_BONUS_DAMAGE : 0));
    const hits = this.npcs.applyAreaFireExplosion(
      center,
      3.2,
      dmg,
      1.8,
      6.2,
      0,
      0,
    );
    if (hits > 0) {
      this.callbacks.onHitTarget?.();
    }
    return true;
  }

  // ====================================================================
  // MAGNETO ABILITIES
  // ====================================================================

  public castMetalProjectile(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'magneto' ||
      this.magnetoMeteorActive ||
      this.magnetoTornadoState.active
    ) {
      return false;
    }

    const hand = this.nextMagnetoHand;
    this.nextMagnetoHand = hand === 'right' ? 'left' : 'right';
    this.animator.triggerCast(
      hand === 'right' ? 'magneto-throw-right' : 'magneto-throw-left',
      0.34,
    );

    this.rig.root.updateMatrixWorld(true);
    const handGroup = hand === 'right' ? this.rig.rightHand : this.rig.leftHand;
    handGroup.getWorldPosition(this._handWorld);
    const target = this.computeReticleAimPoint(32, true, false);
    this.magnetoVfx.spawnMetalProjectile(
      this._handWorld,
      target,
      hand === 'right' ? 0 : 1,
    );
    this.fx.triggerCue('magneto-throw', this._handWorld);
    this.callbacks.onMagnetoThrow?.();
    return true;
  }

  public castMagneticMeteor(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'magneto' ||
      this.magnetoMeteorActive ||
      this.magnetoTornadoState.active ||
      this.magnetoVfx.isMeteorBusy()
    ) {
      return false;
    }

    const aimPoint = this.computeReticleAimPoint(24, true, true);
    const safeBound = BASEPLATE_HALF_INNER - 1.2;
    aimPoint.x = THREE.MathUtils.clamp(aimPoint.x, -safeBound, safeBound);
    aimPoint.z = THREE.MathUtils.clamp(aimPoint.z, -safeBound, safeBound);

    if (!this.magnetoVfx.startMeteorSequence(this.physics.position, aimPoint)) {
      return false;
    }
    this.magnetoPreFlight = this.flightEnabled;
    this.magnetoMeteorActive = true;
    this.flightEnabled = true;
    this.magnetoShieldState.active = true;
    this.magnetoVfx.setShieldActive(true);
    this.refreshInvulnerable();
    this.callbacks.onFlightForceChange?.(true);
    this.physics.position.y = Math.max(this.physics.position.y, 1.35);
    this.animator.triggerCast('meteor-raise', 1.15);
    this.fx.triggerCue('magneto-meteor-charge', this.physics.position);
    this.callbacks.onMagnetoMeteorStage?.('charge');
    return true;
  }

  public toggleMetalTornado(): boolean {
    if (this.archetype !== 'magneto') return false;
    if (this.magnetoTornadoState.active) {
      this.magnetoTornadoState.active = false;
      this.magnetoTornadoState.elapsed = 0;
      this.magnetoVfx.setTornadoActive(false);
      this.animator.setMetalTornado(false);
      const restoreFlight = this.magnetoPreFlight;
      this.flightEnabled = restoreFlight;
      this.magnetoShieldState.active = restoreFlight;
      this.magnetoVfx.setShieldActive(restoreFlight);
      this.refreshInvulnerable();
      this.callbacks.onFlightForceChange?.(restoreFlight);
      this.callbacks.onMagnetoTornadoChange?.(false, true);
      return true;
    }

    if (
      this.dead ||
      !this.controlsEnabled ||
      this.magnetoMeteorActive
    ) {
      return false;
    }

    this.magnetoPreFlight = this.flightEnabled;
    this.magnetoTornadoState.active = true;
    this.magnetoTornadoState.elapsed = 0;
    this.flightEnabled = true;
    this.magnetoShieldState.active = true;
    this.magnetoVfx.setShieldActive(true);
    this.refreshInvulnerable();
    this.callbacks.onFlightForceChange?.(true);
    this.physics.position.y = Math.max(this.physics.position.y, 1.5);
    this.magnetoVfx.setTornadoActive(true);
    this.animator.setMetalTornado(true);
    this.fx.triggerCue('magneto-tornado', this.physics.position);
    this.callbacks.onMagnetoTornadoChange?.(true, false);
    return true;
  }

  // ====================================================================
  // QUICKSILVER ABILITIES
  // ====================================================================

  public toggleSuperSpeed(): boolean {
    if (this.archetype !== 'quicksilver') return false;
    if (this.superSpeedState.active) {
      this.superSpeedState.active = false;
      this.fx.triggerCue('qs-speed-off', this.physics.position);
      this.callbacks.onSuperSpeedChange?.(false);
      return true;
    }

    if (this.dead || !this.controlsEnabled) return false;
    this.superSpeedState.active = true;
    this.fx.triggerCue('qs-speed-on', this.physics.position);
    this.callbacks.onSuperSpeedChange?.(true);
    return true;
  }

  public castRapidPunchCombo(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'quicksilver' ||
      this.rapidPunchState.active ||
      this.windTornadoState.active
    ) {
      return false;
    }

    const targetId =
      this.npcs.getSelectedTargetId() ??
      this.npcs.findClosestTargetId(this.physics.position, 22);
    if (!targetId || !this.npcs.getTargetTorsoPosition(targetId, this._aimTarget)) {
      this.callbacks.onAbilityFeedback?.('Select a valid target first');
      return false;
    }

    // Blitz directly in front of target and lock target into inescapable rapid punch combo
    const npcProbe = this.npcs.getTargetProbes().find((p) => p.id === targetId);
    const npcFloor = npcProbe ? npcProbe.position.clone() : this._aimTarget.clone().setY(0);
    const approachDir = npcFloor.clone().sub(this.physics.position).setY(0);
    if (approachDir.lengthSq() < 0.001) {
      approachDir.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    } else {
      approachDir.normalize();
    }

    const frontPos = npcFloor.clone().addScaledVector(approachDir, -1.18);
    const safeBound = BASEPLATE_HALF_INNER - 1.2;
    frontPos.x = THREE.MathUtils.clamp(frontPos.x, -safeBound, safeBound);
    frontPos.z = THREE.MathUtils.clamp(frontPos.z, -safeBound, safeBound);
    frontPos.y = 0;

    this.flightEnabled = false;
    this.physics.position.copy(frontPos);
    this.physics.velocity.set(0, 0, 0);
    this.rig.root.position.copy(frontPos);

    const playerToNpcYaw = Math.atan2(-(npcFloor.x - frontPos.x), -(npcFloor.z - frontPos.z));
    this.cameraYaw = playerToNpcYaw;
    this.rig.root.rotation.y = playerToNpcYaw;
    this.npcs.setExternalControl(targetId, true);
    this.npcs.setExternalPose(targetId, npcFloor, playerToNpcYaw + Math.PI, { headache: true });

    this.rapidPunchState = {
      active: true,
      targetId,
      elapsed: 0,
      punchAccum: 0.18,
      finished: false,
      sideSign: 1,
    };
    this.refreshInvulnerable();
    this.animator.setRapidPunch(true);
    this.fx.triggerCue('qs-punch-hit', npcFloor);
    this.callbacks.onRapidPunchChange?.(true, false);
    return true;
  }

  public toggleWindTornado(): boolean {
    if (this.archetype !== 'quicksilver') return false;
    if (this.windTornadoState.active) {
      this.windTornadoState.active = false;
      this.windTornadoState.elapsed = 0;
      this.quicksilverVfx.setWindTornado(false);
      this.callbacks.onWindTornadoChange?.(false, true);
      return true;
    }

    if (this.dead || !this.controlsEnabled || this.rapidPunchState.active) {
      return false;
    }

    this.flightEnabled = false;
    this.windTornadoState = {
      active: true,
      elapsed: 0,
      center: new THREE.Vector3(this.physics.position.x, 0, this.physics.position.z),
      angle: 0,
    };
    this.quicksilverVfx.setWindTornado(true, this.windTornadoState.center);
    this.fx.triggerCue('qs-tornado', this.windTornadoState.center);
    this.callbacks.onWindTornadoChange?.(true, false);
    return true;
  }

  public castTimeStop(): boolean {
    if (this.dead || !this.controlsEnabled || this.archetype !== 'quicksilver') {
      return false;
    }
    if (!this.quicksilverVfx.spawnTimeStop(this.physics.position)) {
      return false;
    }
    this.animator.triggerCast('qs-time-slam', 0.45);
    this.fx.triggerCue('qs-time-stop', this.physics.position);
    this.callbacks.onTimeStopCast?.();
    return true;
  }

  // ====================================================================
  // DOCTOR STRANGE ABILITIES
  // ====================================================================

  public toggleMysticShield(): boolean {
    if (this.archetype !== 'doctor-strange') return false;
    if (this.strangeShieldState.active) {
      this.strangeShieldState.active = false;
      this.strangeShieldState.elapsed = 0;
      this.strangeVfx.setShieldActive(false);
      this.refreshInvulnerable();
      this.fx.triggerCue('strange-shield-off', this.physics.position);
      this.callbacks.onStrangeShieldChange?.(false, true);
      return true;
    }

    if (this.dead || !this.controlsEnabled) return false;
    this.strangeShieldState.active = true;
    this.strangeShieldState.elapsed = 0;
    this.strangeVfx.setShieldActive(true);
    this.refreshInvulnerable();
    this.fx.triggerCue('strange-shield-on', this.physics.position);
    this.callbacks.onStrangeShieldChange?.(true, false);
    return true;
  }

  public castMysticClones(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'doctor-strange' ||
      this.strangeVfx.isClonesActive()
    ) {
      return false;
    }

    const targetId =
      this.npcs.getSelectedTargetId() ??
      this.npcs.findClosestTargetId(this.physics.position, 24);
    if (!targetId) {
      this.callbacks.onAbilityFeedback?.('Target an enemy first');
      return false;
    }
    const probe = this.npcs.getTargetProbes().find((p) => p.id === targetId);
    if (!probe) return false;

    const ok = this.strangeVfx.spawnMysticClones(
      targetId,
      probe.position,
      resolveCharacterAppearance(CHARACTER_PRESETS.doctorStrange),
    );
    if (!ok) return false;

    this.npcs.setParalyzed(targetId, true);
    this.animator.triggerCast('strange-clones-cast', 0.55);
    this.fx.triggerCue('strange-clones', probe.position);
    this.callbacks.onStrangeClonesCast?.();
    return true;
  }

  public castDimensionalMirror(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'doctor-strange'
    ) {
      return false;
    }

    this.animator.triggerCast('strange-mirror-cast', 0.34);
    this.rig.root.updateMatrixWorld(true);
    this.rig.rightHand.getWorldPosition(this._handWorld);
    this._handWorld.y -= 0.04;

    const target = this.computeReticleAimPoint(34, true, false);
    this.strangeVfx.spawnMirrorShard(this._handWorld, target);
    this.fx.triggerCue('strange-mirror', this._handWorld);
    this.callbacks.onStrangeMirrorCast?.();
    return true;
  }

  // ====================================================================
  // VISION ABILITIES
  // ====================================================================

  private getMindStoneWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    this.rig.root.updateMatrixWorld(true);
    if (this.rig.mindStone) {
      return this.rig.mindStone.getWorldPosition(out);
    }
    return out.set(0, 0.34, -0.22).applyMatrix4(this.rig.head.matrixWorld);
  }

  public toggleIntangibility(): boolean {
    if (this.archetype !== 'vision') return false;
    if (this.visionIntangibleState.active) {
      this.visionIntangibleState.active = false;
      this.visionIntangibleState.elapsed = 0;
      this.physics.resolveHorizontalOverlap();
      this.refreshInvulnerable();
      this.fx.triggerCue('vision-phase-off', this.physics.position);
      this.callbacks.onVisionPhaseChange?.(false, true);
      return true;
    }

    if (
      this.dead ||
      !this.controlsEnabled ||
      !this.flightEnabled ||
      this.visionHeadGripState.active
    ) {
      return false;
    }
    this.visionIntangibleState.active = true;
    this.visionIntangibleState.elapsed = 0;
    this.refreshInvulnerable();
    this.fx.triggerCue('vision-phase-on', this.physics.position);
    this.callbacks.onVisionPhaseChange?.(true, false);
    return true;
  }

  public castMindStoneLaser(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'vision' ||
      this.visionLaserState.active ||
      this.visionBoltChargeState.active ||
      this.visionHeadGripState.active
    ) {
      return false;
    }

    this.visionLaserState = {
      active: true,
      elapsed: 0,
    };
    this.visionVfx.setLaserActive(true);
    this.animator.setMindLaser(true);
    this.getMindStoneWorldPosition(this._mindStoneWorld);
    this.fx.triggerCue('vision-laser', this._mindStoneWorld);
    this.callbacks.onVisionLaserChange?.(true, false);
    return true;
  }

  public castMindStoneProjectile(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'vision' ||
      this.visionBoltChargeState.active ||
      this.visionLaserState.active ||
      this.visionHeadGripState.active
    ) {
      return false;
    }

    this.visionBoltChargeState = {
      active: true,
      elapsed: 0,
    };
    this.physics.velocity.x = 0;
    this.physics.velocity.z = 0;
    this.getMindStoneWorldPosition(this._mindStoneWorld);
    this.animator.setVisionBoltCharge(true);
    this.visionVfx.setBoltCharging(true, 0);
    this.fx.triggerCue('vision-bolt-charge', this._mindStoneWorld);
    this.callbacks.onVisionBoltCharge?.();
    return true;
  }

  public castHeadGrip(): boolean {
    if (
      this.dead ||
      !this.controlsEnabled ||
      this.archetype !== 'vision' ||
      this.visionHeadGripState.active ||
      this.visionBoltChargeState.active ||
      this.visionLaserState.active
    ) {
      return false;
    }

    const targetId = this.npcs.getSelectedTargetId();
    if (!targetId) {
      this.callbacks.onAbilityFeedback?.('Select a valid target first');
      return false;
    }
    const probe = this.npcs.getTargetProbes().find((p) => p.id === targetId);
    if (!probe) return false;

    const npcFloor = probe.position.clone();
    const approachDir = npcFloor.clone().sub(this.physics.position).setY(0);
    if (approachDir.lengthSq() < 0.001) {
      approachDir.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    } else {
      approachDir.normalize();
    }

    const standPos = npcFloor.clone().addScaledVector(approachDir, -0.78);
    const safeBound = BASEPLATE_HALF_INNER - 1.2;
    standPos.x = THREE.MathUtils.clamp(standPos.x, -safeBound, safeBound);
    standPos.z = THREE.MathUtils.clamp(standPos.z, -safeBound, safeBound);
    standPos.y = Math.max(0, npcFloor.y);

    if (this.visionIntangibleState.active) {
      this.visionIntangibleState.active = false;
      this.visionIntangibleState.elapsed = 0;
      this.physics.resolveHorizontalOverlap();
      this.callbacks.onVisionPhaseChange?.(false, true);
    }
    if (this.flightEnabled) {
      this.flightEnabled = false;
      this.callbacks.onFlightForceChange?.(false);
    }

    this.physics.position.copy(standPos);
    this.physics.velocity.set(0, 0, 0);
    this.rig.root.position.copy(standPos);

    const yawToNpc = Math.atan2(-(npcFloor.x - standPos.x), -(npcFloor.z - standPos.z));
    this.cameraYaw = yawToNpc;
    this.rig.root.rotation.y = yawToNpc;

    this.npcs.setExternalControl(targetId, true);
    this.npcs.setExternalPose(targetId, npcFloor, yawToNpc + Math.PI, { headache: true });

    this.visionHeadGripState = {
      active: true,
      targetId,
      elapsed: 0,
      tickAccum: 0.35,
      ticksDone: 0,
      slammed: false,
      lockedPos: npcFloor,
    };
    this.refreshInvulnerable();
    this.animator.setHeadGrip(true);
    this.fx.triggerCue('vision-head-grip', npcFloor);
    this.callbacks.onVisionHeadGripChange?.(true, false);
    return true;
  }

  public setControlsEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled;
    if (!enabled) {
      this.joyX = 0;
      this.joyY = 0;
      this.keyForward = 0;
      this.keyRight = 0;
      this.jumpQueued = false;
    }
  }

  private clearCharacterAbilityStates(immediate = false): void {
    this.scheduledWaves = [];
    if (this.painState.active) {
      this.cancelPainInfliction(false);
    }
    if (this.darkholdState.active) {
      this.closeDarkhold(false, immediate);
    }
    this.darkholdBook.setOpen(false, true);
    this.shieldState.active = false;
    this.shieldState.elapsed = 0;
    this.shieldState.absorbRemaining = AUTO_SHIELD_MAX_ABSORB;
    this.callbacks.onAutoShieldChange?.(false);

    if (this.teleportState.phase !== 'idle') {
      this.teleportState.phase = 'idle';
      this.callbacks.onTeleportLockChange?.(false);
    }

    this.clearMindControl(false);
    if (this.mindControlState.paralysisTargetId) {
      this.npcs.setMindControlParalysis(this.mindControlState.paralysisTargetId, false);
      this.mindControlState.paralysisTargetId = null;
      this.mindControlState.paralysisRemaining = 0;
    }
    if (this.diamondState.active || this.diamondState.blend > 0) {
      this.diamondState.active = false;
      this.diamondState.elapsed = 0;
      this.diamondState.blend = 0;
      this.rig.setDiamondForm(0);
      this.callbacks.onDiamondFormChange?.(false, false);
    }
    if (this.telepathicWaveState.active) {
      this.telepathicWaveState.active = false;
      this.animator.setTelepathicWave(false);
      this.callbacks.onTelepathicWaveChange?.(false, false);
    }
    if (this.astralState.active) {
      this.astralState.active = false;
      this.astralState.elapsed = 0;
      this.rig.setAstralProjection(false);
      this.callbacks.onAstralProjectionChange?.(false, false);
    }

    if (this.crownState.active || this.crownState.blend > 0) {
      this.crownState.active = false;
      this.crownState.elapsed = 0;
      this.crownState.blend = 0;
      this.rig.setHelaCrownMode(false);
      this.callbacks.onCrownFormChange?.(false, false);
    }
    if (this.swordSummonState.active) {
      this.swordSummonState.active = false;
      this.swordSummonState.leftInHand = false;
      this.swordSummonState.rightInHand = false;
      this.swordSummonState.reloadHand = null;
      this.swordSummonState.throwReady = false;
      this.swordSummonState.reloading = false;
      this.swordSummonState.slashCooldownRemaining = 0;
      this.rig.setHelaHandSwords(false, false);
      this.animator.setSwordHeld(false);
      this.callbacks.onSwordSummonChange?.(false, false);
      this.callbacks.onSwordThrowAvailabilityChange?.(false);
    }
    this.emmaIdleRings.clear();
    this.greenChargeState.active = false;
    this.greenChargeState.elapsed = 0;
    this.helaVfx.updateHandGather(0, false, null, 0);
    if (this.spinningLeapState.active) {
      this.spinningLeapState.active = false;
      this.animator.setSpinningLeap(false);
    }
    this.phoenixRevivalState.phase = 'idle';
    this.phoenixRevivalState.elapsed = 0;
    this.animator.setPhoenixManifest(false);

    // Magneto cleanup
    if (this.magnetoShieldState.active) {
      this.magnetoShieldState.active = false;
      this.magnetoShieldState.elapsed = 0;
    }
    if (this.magnetoTornadoState.active) {
      this.magnetoTornadoState.active = false;
      this.magnetoTornadoState.elapsed = 0;
      this.animator.setMetalTornado(false);
      this.callbacks.onMagnetoTornadoChange?.(false, false);
    }
    this.magnetoMeteorActive = false;
    this.magnetoPreFlight = false;
    this.magnetoVfx.clearAll((id) => this.npcs.setExternalControl(id, false));

    // Quicksilver cleanup
    if (this.superSpeedState.active) {
      this.superSpeedState.active = false;
      this.callbacks.onSuperSpeedChange?.(false);
    }
    if (this.rapidPunchState.active) {
      if (this.rapidPunchState.targetId) {
        this.npcs.setExternalControl(this.rapidPunchState.targetId, false);
      }
      this.rapidPunchState.active = false;
      this.rapidPunchState.targetId = null;
      this.animator.setRapidPunch(false);
      this.callbacks.onRapidPunchChange?.(false, false);
    }
    if (this.windTornadoState.active) {
      this.windTornadoState.active = false;
      this.windTornadoState.elapsed = 0;
      this.callbacks.onWindTornadoChange?.(false, false);
    }
    this.quicksilverVfx.clearAll(
      (id) => this.npcs.setExternalControl(id, false),
      (id) => this.npcs.setParalyzed(id, false),
    );

    // Doctor Strange cleanup
    if (this.strangeShieldState.active) {
      this.strangeShieldState.active = false;
      this.strangeShieldState.elapsed = 0;
      this.callbacks.onStrangeShieldChange?.(false, false);
    }
    this.strangeVfx.clearAll((id) => this.npcs.setParalyzed(id, false));

    // Vision cleanup
    if (this.visionIntangibleState.active || this.visionIntangibleState.blend > 0) {
      this.visionIntangibleState.active = false;
      this.visionIntangibleState.elapsed = 0;
      this.visionIntangibleState.blend = 0;
      this.rig.setIntangible(false, 0);
      this.callbacks.onVisionPhaseChange?.(false, false);
    }
    if (this.visionLaserState.active) {
      this.visionLaserState.active = false;
      this.visionLaserState.elapsed = 0;
      this.animator.setMindLaser(false);
      this.callbacks.onVisionLaserChange?.(false, false);
    }
    if (this.visionBoltChargeState.active) {
      this.visionBoltChargeState.active = false;
      this.visionBoltChargeState.elapsed = 0;
      this.animator.setVisionBoltCharge(false);
      this.visionVfx.setBoltCharging(false, 0);
    }
    if (this.visionHeadGripState.active) {
      if (this.visionHeadGripState.targetId) {
        this.npcs.setExternalControl(this.visionHeadGripState.targetId, false);
      }
      this.visionHeadGripState.active = false;
      this.visionHeadGripState.targetId = null;
      this.animator.setHeadGrip(false);
      this.callbacks.onVisionHeadGripChange?.(false, false);
    }
    this.visionVfx.clearAll();
    this.npcs.clearAllCrowdControl();
    this.refreshInvulnerable();
  }

  public triggerDeath(): void {
    if (this.dead) return;
    this.dead = true;
    this.controlsEnabled = false;
    this.flightEnabled = false;
    this.invulnerable = false;
    this.clearCharacterAbilityStates(true);
    this.rig.setOpacity(1);
    this.fx.triggerCue('death', this.physics.position);

    this.playerHp = 0;
    this.callbacks.onPlayerHealthChange?.(0, this.playerMaxHp);

    this.joyX = 0;
    this.joyY = 0;
    this.keyForward = 0;
    this.keyRight = 0;
    this.jumpQueued = false;
    this.ragdoll.trigger(
      this.physics.position,
      this.physics.velocity,
      this.cameraYaw,
    );
  }

  public respawn(cinematic = true): void {
    this.ragdoll.reset();
    this.physics.reset();
    this.vfx.clearActiveProjectiles();
    this.phoenixVfx.clearActiveEffects();
    this.emmaVfx.clearActiveEffects();
    this.helaVfx.clearActiveEffects();
    this.landingDust.clear();
    this.clearCharacterAbilityStates(true);

    this.animator = new CharacterAnimator(this.rig, this.archetype);
    this.rig.setOpacity(1);
    this.rig.root.position.set(0, 0, 0);
    this.rig.root.rotation.set(0, 0, 0);

    this.dead = false;
    this.flightEnabled = false;
    this.invulnerable = false;
    this.wasGrounded = true;
    this.nextBoltHand = 'right';

    this.playerHp = this.playerMaxHp;
    this.callbacks.onPlayerHealthChange?.(this.playerHp, this.playerMaxHp);

    this.controlsEnabled = true;
    this.joyX = 0;
    this.joyY = 0;
    this.keyForward = 0;
    this.keyRight = 0;
    this.jumpQueued = false;
    this.cameraYaw = 0;
    this.cameraPitch = 0.22;
    this.camInitialized = false;

    const nowMs = performance.now();
    const canSpecialPhoenixRevive =
      cinematic &&
      this.archetype === 'phoenix-force' &&
      nowMs - this.lastPhoenixRevivalMs >= PHOENIX_SPECIAL_REVIVAL_COOLDOWN_MS;

    if (canSpecialPhoenixRevive) {
      // Phoenix Force & Dark Phoenix 60s-cooldown Special Revival
      this.lastPhoenixRevivalMs = nowMs;
      this.phoenixRevivalState = {
        phase: 'rising',
        elapsed: 0,
        spherePos: new THREE.Vector3(0, 0.4, 0),
        anchorPos: new THREE.Vector3(0, 5.4, 0),
        tickAccum: 0,
      };
      this.physics.position.set(0, 0.4, 0);
      this.rig.root.position.set(0, 0.4, 0);
      this.rig.setOpacity(0);
      this.fx.resetAll(false);
      this.fx.triggerCue('phoenix-special-rise', this.physics.position);
      this.callbacks.onPhoenixSpecialRevival?.('rise');
    } else {
      // Clean normal respawn: zero explosions, zero Phoenix effects, zero special animations
      this.phoenixRevivalState.phase = 'idle';
      this.fx.resetAll(true);
      this.lastScreenFxSentActive = false;
      this.callbacks.onScreenFxUpdate?.(this.fx.screenFx);
    }
  }

  public setCharacter(
    appearance: CharacterAppearance,
    maxHp = 250,
    damageMultiplier = 1.0,
  ): void {
    this.scene.remove(this.rig.root);
    this.rig.dispose();
    this.archetype = appearance.archetype ?? 'standard';
    this.skinVariant = appearance.skinVariant ?? 'phoenix';
    this.skinId = appearance.skinId;
    this.playerMaxHp = maxHp;
    this.damageMultiplier = damageMultiplier;
    this.fx.setIdentity(this.archetype, this.skinVariant);

    this.scene.remove(this.phoenixVfx.group);
    this.phoenixVfx.dispose();
    this.phoenixVfx = new PhoenixVfxSystem(this.skinVariant);
    this.scene.add(this.phoenixVfx.group);

    this.rig = createR16Character(appearance);
    this.scene.add(this.rig.root);
    this.attachCharacterExtras();
    this.animator = new CharacterAnimator(this.rig, this.archetype);
    this.ragdoll = new R16Ragdoll(this.rig);
    this.respawn(false);
  }

  public rotateCamera(deltaYaw: number, deltaPitch: number): void {
    if (!this.controlsEnabled) return;
    this.cameraYaw -= deltaYaw;
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch + deltaPitch,
      -0.12,
      0.72,
    );
  }

  public zoomCameraByScale(scaleRatio: number): void {
    this.targetCameraDistance = THREE.MathUtils.clamp(
      this.targetCameraDistance * scaleRatio,
      2.4,
      9.5,
    );
  }

  public zoomCameraByDelta(delta: number): void {
    this.targetCameraDistance = THREE.MathUtils.clamp(
      this.targetCameraDistance + delta,
      2.4,
      9.5,
    );
  }

  public setCameraZoomDistance(distance: number): void {
    this.targetCameraDistance = THREE.MathUtils.clamp(distance, 2.4, 9.5);
  }

  private computePixelRatio(resolution: ResolutionScale): number {
    const dpr = window.devicePixelRatio || 1;
    switch (resolution) {
      case 'low':
        return 0.75;
      case 'medium':
        return 1.0;
      case 'high':
        return Math.min(dpr, 1.5);
      case 'native':
        return Math.min(dpr, 2.0);
    }
  }

  private applyShadowQuality(quality: ShadowQuality): void {
    if (quality === 'off') {
      this.sunLight.castShadow = false;
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
      return;
    }

    const size = quality === 'ultra' ? 2048 : quality === 'high' ? 1536 : 1024;
    const radius = quality === 'ultra' ? 3.2 : quality === 'high' ? 2.6 : 1.8;

    if (this.sunLight.shadow.mapSize.x !== size) {
      this.sunLight.shadow.mapSize.set(size, size);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
    this.sunLight.shadow.radius = radius;
    this.sunLight.castShadow = true;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.shadowMap.needsUpdate = true;
  }

  public applyGraphicsSettings(settings: GraphicsSettings): void {
    this.graphicsSettings = settings;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setPixelRatio(this.computePixelRatio(settings.resolution));
    this.renderer.setSize(width, height);

    this.applyShadowQuality(settings.shadows);
    this.skyAtmosphere.setCloudQuality(settings.clouds);
    this.scene.fog = settings.distanceFog ? this.distanceFog : null;
    this.windTrails.lines.visible = settings.windTrails;
    this.fx.setAllowSubtleBlur(
      settings.preset === 'high' || settings.preset === 'ultra',
    );
    this.setCameraZoomDistance(settings.cameraZoom);
  }

  private onResize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const aspect = width / height;
    this.baseFov = aspect < 1 ? 58 : 50;
    this.camera.fov = this.baseFov + this.fx.fovOffset;
    this.lastAppliedFov = this.camera.fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const pr = this.computePixelRatio(this.graphicsSettings.resolution);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.controlsEnabled || this.dead) return;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keyForward = 1;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keyForward = -1;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keyRight = 1;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keyRight = -1;
        break;
      case 'Space':
        if (!e.repeat) this.triggerJump();
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        if (this.keyForward > 0) this.keyForward = 0;
        break;
      case 'KeyS':
      case 'ArrowDown':
        if (this.keyForward < 0) this.keyForward = 0;
        break;
      case 'KeyD':
      case 'ArrowRight':
        if (this.keyRight > 0) this.keyRight = 0;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        if (this.keyRight < 0) this.keyRight = 0;
        break;
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (this.disposed) return;
    if (this.contextLost) {
      this.scheduleNextTick();
      return;
    }

    const nowMs = performance.now();
    const dt = Math.min(Math.max((nowMs - this.lastTimeMs) / 1000, 0.001), 0.05);
    this.lastTimeMs = nowMs;

    // Decay hand cast flare
    this.handFlareLeft = Math.max(0, this.handFlareLeft - dt * 3.2);
    this.handFlareRight = Math.max(0, this.handFlareRight - dt * 3.2);

    // Step Teleport sequence (Scarlet Witch)
    if (!this.dead && this.teleportState.phase !== 'idle') {
      this.teleportState.elapsed += dt;
      if (this.teleportState.phase === 'preparing') {
        const p = THREE.MathUtils.clamp(
          this.teleportState.elapsed / TELEPORT_PREPARE_SEC,
          0,
          1,
        );
        this.rig.setOpacity(1 - p);

        if (this.teleportState.elapsed >= TELEPORT_PREPARE_SEC) {
          this.physics.position.copy(this.teleportState.destination);
          this.physics.velocity.set(0, 0, 0);
          this.rig.root.position.copy(this.physics.position);
          this.vfx.spawnBodyMistCloud(this.physics.position);
          this.fx.triggerCue('teleport-arrive', this.physics.position);
          this.callbacks.onTeleportArrive?.();

          this.teleportState.phase = 'revealing';
          this.teleportState.elapsed = 0;
        }
      } else if (this.teleportState.phase === 'revealing') {
        const p = THREE.MathUtils.clamp(
          this.teleportState.elapsed / TELEPORT_REVEAL_SEC,
          0,
          1,
        );
        this.rig.setOpacity(p);
        if (this.teleportState.elapsed >= TELEPORT_REVEAL_SEC) {
          this.rig.setOpacity(1);
          this.teleportState.phase = 'idle';
          this.refreshInvulnerable();
          this.callbacks.onTeleportLockChange?.(false);
        }
      }
    }

    // Step Phoenix Force / Dark Phoenix Special Revival (1.1s rise -> 4.0s stationary manifest)
    if (!this.dead && this.phoenixRevivalState.phase !== 'idle') {
      const prs = this.phoenixRevivalState;
      prs.elapsed += dt;

      if (prs.phase === 'rising') {
        const t = THREE.MathUtils.clamp(prs.elapsed / 1.1, 0, 1);
        const ease = 1 - Math.pow(1 - t, 2);
        const sphereY = 0.4 + ease * 5.0;
        prs.spherePos.set(0, sphereY, 0);
        this.physics.position.set(0, sphereY, 0);
        this.physics.velocity.set(0, 0, 0);
        this.rig.setOpacity(0);
        this.phoenixVfx.updateSpecialRevival(
          dt,
          'rising',
          prs.spherePos,
          null,
          this.cameraYaw,
          prs.elapsed,
          1.1,
        );

        if (prs.elapsed >= 1.1) {
          prs.phase = 'manifest';
          prs.elapsed = 0;
          prs.tickAccum = 0.75;
          prs.anchorPos.set(0, 5.4, 0);
          this.physics.position.copy(prs.anchorPos);
          this.physics.velocity.set(0, 0, 0);
          this.rig.setOpacity(1);
          this.animator.setPhoenixManifest(true);
          this.handFlareLeft = 1.45;
          this.handFlareRight = 1.45;
          this.fx.triggerCue('phoenix-special-manifest', this.physics.position);
          this.callbacks.onPhoenixSpecialRevival?.('manifest');
        }
      } else if (prs.phase === 'manifest') {
        this.physics.position.copy(prs.anchorPos);
        this.physics.velocity.set(0, 0, 0);
        prs.tickAccum += dt;
        while (prs.tickAccum >= 1.0) {
          prs.tickAccum -= 1.0;
          if (this.npcs.applyGlobalDamage(this.scaleDamage(2)) > 0) {
            this.callbacks.onHitTarget?.();
          }
        }
        this.phoenixVfx.updateSpecialRevival(
          dt,
          'manifest',
          null,
          prs.anchorPos,
          this.cameraYaw,
          prs.elapsed,
          4.0,
        );

        if (prs.elapsed >= 4.0) {
          prs.phase = 'idle';
          prs.elapsed = 0;
          this.animator.setPhoenixManifest(false);
          this.fx.cancelSustainedCues();
          this.phoenixVfx.updateSpecialRevival(dt, 'none', null, null, 0, 0, 0);
          this.callbacks.onPhoenixSpecialRevival?.('end');
        }
      }
    } else {
      this.phoenixVfx.updateSpecialRevival(dt, 'none', null, null, 0, 0, 0);
    }

    // Step scheduled Phoenix Wave blasts
    if (!this.dead && this.scheduledWaves.length > 0) {
      for (let i = this.scheduledWaves.length - 1; i >= 0; i--) {
        const w = this.scheduledWaves[i];
        w.remainingSec -= dt;
        if (w.remainingSec <= 0) {
          this.scheduledWaves.splice(i, 1);
          this.executeWaveBlast(w.stepIdx, w.position, w.forward);
        }
      }
    }

    let focusPos: THREE.Vector3;

    if (this.dead) {
      const pelvisWorld = this.ragdoll.update(dt);
      const onBorder =
        Math.abs(pelvisWorld.x) > BASEPLATE_HALF_INNER ||
        Math.abs(pelvisWorld.z) > BASEPLATE_HALF_INNER;
      const groundSurfaceY = onBorder ? BASEPLATE_BORDER_HEIGHT : 0;
      this._ragdollFocus.set(pelvisWorld.x, groundSurfaceY, pelvisWorld.z);
      focusPos = this._ragdollFocus;
      this.leftHandAura?.update(dt, 0);
      this.rightHandAura?.update(dt, 0);
      this.leftFireAura?.update(dt, 0);
      this.rightFireAura?.update(dt, 0);
      this.phoenixWings?.update(dt, false, false, 0);
    } else if (this.isPhoenixReviving()) {
      // Stationary sky anchor during Phoenix Special Revival
      this.rig.root.position.copy(this.physics.position);
      this.rig.root.rotation.y = this.cameraYaw;
      this.animator.update(dt, {
        localForward: 0,
        localRight: 0,
        verticalVelocity: 0,
        grounded: false,
        justJumped: false,
        landImpactSpeed: 0,
        flying: true,
      });
      const revFlare = this.phoenixRevivalState.phase === 'manifest' ? 1.25 : 0;
      this.leftFireAura?.update(dt, revFlare, 0.25);
      this.rightFireAura?.update(dt, revFlare, 0.25);
      this.phoenixWings?.update(
        dt,
        this.phoenixRevivalState.phase === 'manifest',
        false,
        0,
      );
      focusPos = this.physics.position;
    } else {
      const canMove =
        this.controlsEnabled &&
        this.teleportState.phase !== 'preparing' &&
        !this.painState.active &&
        this.mindControlState.phase !== 'choosing' &&
        this.mindControlState.phase !== 'mental-damage' &&
        !this.telepathicWaveState.active &&
        !this.magnetoTornadoState.active &&
        !this.rapidPunchState.active &&
        !this.windTornadoState.active &&
        !this.visionBoltChargeState.active &&
        !this.visionHeadGripState.active;
      let moveX = canMove ? this.joyX + this.keyRight : 0;
      let moveY = canMove ? this.joyY + this.keyForward : 0;
      const len = Math.hypot(moveX, moveY);
      if (len > 1) {
        moveX /= len;
        moveY /= len;
      }

      if (
        this.painState.active ||
        this.mindControlState.phase === 'choosing' ||
        this.mindControlState.phase === 'mental-damage' ||
        this.telepathicWaveState.active ||
        this.magnetoTornadoState.active ||
        this.rapidPunchState.active ||
        this.visionBoltChargeState.active ||
        this.visionHeadGripState.active
      ) {
        this.physics.velocity.x = 0;
        this.physics.velocity.z = 0;
      }

      const hoverHeight = this.magnetoTornadoState.active
        ? 2.15
        : this.archetype === 'phoenix-force'
          ? 1.15
          : 0.94;

      const isSpeedBoost =
        this.archetype === 'quicksilver' && this.superSpeedState.active;
      const isAstralBoost =
        this.archetype === 'emma-frost' && this.astralState.active;
      const isVisionPhase =
        this.archetype === 'vision' && this.visionIntangibleState.active;

      const step = this.physics.step(dt, {
        moveX,
        moveY,
        facingYaw: this.cameraYaw,
        jumpQueued: this.jumpQueued,
        sprintEnabled: this.sprintEnabled,
        flying: this.flightEnabled,
        hoverHeight,
        speedMultiplier: isSpeedBoost ? 2.35 : isAstralBoost ? 1.28 : 1.0,
        intangible: isVisionPhase,
      });
      this.jumpQueued = false;

      if (step.justJumped) {
        this.callbacks.onJump?.();
      }

      const stepOnBorder =
        Math.abs(step.position.x) > BASEPLATE_HALF_INNER ||
        Math.abs(step.position.z) > BASEPLATE_HALF_INNER;
      const stepSurfaceY = stepOnBorder ? BASEPLATE_BORDER_HEIGHT : 0;

      // Hela Spinning Leap landing check
      if (this.spinningLeapState.active) {
        this.spinningLeapState.elapsed += dt;
        if (this.spinningLeapState.elapsed > 0.16 && step.grounded) {
          this.spinningLeapState.active = false;
          this.animator.setSpinningLeap(false);
          this.animator.triggerCast('hero-landing', 0.48);
          this.landingDust.spawn(step.position, stepSurfaceY, 1.35);
          this.fx.triggerCue('hero-landing', step.position);
          this.callbacks.onSpinningLeap?.('land');
        }
      }

      // Quicksilver Wind Tornado circular running motion override
      if (this.windTornadoState.active) {
        const radius = 3.2;
        this.windTornadoState.angle += 9.2 * dt;
        const nextX =
          this.windTornadoState.center.x + Math.cos(this.windTornadoState.angle) * radius;
        const nextZ =
          this.windTornadoState.center.z + Math.sin(this.windTornadoState.angle) * radius;
        const safeBound = BASEPLATE_HALF_INNER - 1.0;
        step.position.set(
          THREE.MathUtils.clamp(nextX, -safeBound, safeBound),
          0,
          THREE.MathUtils.clamp(nextZ, -safeBound, safeBound),
        );
        this.physics.position.copy(step.position);
        const tangentYaw = Math.atan2(
          Math.sin(this.windTornadoState.angle),
          -Math.cos(this.windTornadoState.angle),
        );
        this.rig.root.rotation.y = tangentYaw;
      }

      // Landing dust cloud + soft shockwave on touchdown from Jump OR Flight
      if (
        !this.flightEnabled &&
        !this.windTornadoState.active &&
        step.grounded &&
        (!this.wasGrounded || step.landImpactSpeed > 0.5)
      ) {
        const intensity = THREE.MathUtils.clamp(
          Math.max(step.landImpactSpeed / 8.5, 0.72),
          0.68,
          1.4,
        );
        this.landingDust.spawn(step.position, stepSurfaceY, intensity);
        this.callbacks.onLandDust?.(intensity);
      }
      this.wasGrounded = step.grounded;

      this.rig.root.position.copy(step.position);
      if (this.painState.active) {
        const dx = this.painState.lastTargetPos.x - step.position.x;
        const dz = this.painState.lastTargetPos.z - step.position.z;
        if (dx * dx + dz * dz > 0.001) {
          this.rig.root.rotation.y = Math.atan2(-dx, -dz);
        }
      } else if (!this.windTornadoState.active) {
        this.rig.root.rotation.y = this.cameraYaw;
      }

      let rawYawDelta = this.rig.root.rotation.y - this.prevTurnYaw;
      while (rawYawDelta > Math.PI) rawYawDelta -= Math.PI * 2;
      while (rawYawDelta < -Math.PI) rawYawDelta += Math.PI * 2;
      this.prevTurnYaw = this.rig.root.rotation.y;
      const turnVelocity = rawYawDelta / Math.max(dt, 0.005);

      this.animator.update(dt, {
        localForward: this.windTornadoState.active ? 1.85 : step.localForwardNorm,
        localRight: this.windTornadoState.active ? 0.35 : step.localRightNorm,
        verticalVelocity: step.velocity.y,
        grounded: this.windTornadoState.active ? true : step.grounded,
        justJumped: step.justJumped,
        landImpactSpeed: step.landImpactSpeed,
        flying: this.flightEnabled,
        superSpeed: isSpeedBoost || this.windTornadoState.active,
        turnVelocity,
      });

      const baseHandGlow = this.flightEnabled ? 0.95 : 0.38;
      const visScale = this.rig.root.visible ? 1 : 0;
      const painBoost = this.painState.active ? 0.55 : 0;

      this.leftHandAura?.update(
        dt,
        (baseHandGlow + this.handFlareLeft * 0.55) * visScale,
        0.24,
      );
      this.rightHandAura?.update(
        dt,
        (baseHandGlow + this.handFlareRight * 0.55) * visScale,
        0.24,
      );

      this.leftFireAura?.update(
        dt,
        (baseHandGlow + this.handFlareLeft * 0.6 + painBoost) * visScale,
        0.25,
      );
      this.rightFireAura?.update(
        dt,
        (baseHandGlow + this.handFlareRight * 0.6 + painBoost) * visScale,
        0.25,
      );

      const moveSpeedNorm = THREE.MathUtils.clamp(
        Math.hypot(step.localForwardNorm, step.localRightNorm),
        0,
        1.4,
      );
      this.phoenixWings?.update(
        dt,
        (this.wingsAlwaysVisible || this.flightEnabled) &&
          this.teleportState.phase !== 'preparing',
        this.flightEnabled,
        moveSpeedNorm,
      );

      focusPos = step.position;
    }

    // Pain Infliction Channeling update (5s total, 5 dmg/sec, ends in Phoenix-origin telekinetic shockwave + knockback + 2s ragdoll)
    if (!this.dead && this.painState.active && this.painState.targetId) {
      const targetId = this.painState.targetId;
      const targetAlive = this.npcs.getTargetTorsoPosition(
        targetId,
        this._painTargetWorld,
      );
      if (!targetAlive || this._painTargetWorld.distanceTo(focusPos) > 28) {
        this.cancelPainInfliction(true);
      } else {
        this.painState.lastTargetPos.copy(this._painTargetWorld);
        this.painState.elapsed += dt;
        this.painState.tickAccum += dt;

        while (this.painState.tickAccum >= 1.0 && this.painState.ticksDone < 5) {
          this.painState.tickAccum -= 1.0;
          this.painState.ticksDone++;
          const dir = this._aimTarget
            .copy(this._painTargetWorld)
            .sub(focusPos)
            .setY(0);
          if (dir.lengthSq() > 0.001) dir.normalize();
          else dir.set(0, 0, -1);

          if (this.npcs.applyDamage(targetId, this.scaleDamage(5), dir, 0)) {
            this.fx.triggerCue('pain-tick', this._painTargetWorld);
            this.callbacks.onPainInflictionTick?.();
            this.callbacks.onHitTarget?.();
          }
          if (!this.npcs.isTargetAlive(targetId)) {
            this.cancelPainInfliction(true);
            break;
          }
        }

        if (this.painState.active) {
          if (this.painState.elapsed >= 5.0) {
            // Complete 5s channel -> telekinetic shockwave originating from PHOENIX pushing nearby targets away + 2s ragdoll
            this.npcs.setPainRestricted(targetId, false);
            this.phoenixVfx.spawnTelekineticShockwave(focusPos);
            this.fx.triggerCue('pain-explosion', focusPos);
            this.callbacks.onPainInflictionExplosion?.();

            const nearbyHits = this.npcs.applyAreaFireExplosion(
              focusPos,
              PAIN_INFLICTION_EXPLOSION_RADIUS,
              this.scaleDamage(15),
              2.0,
              6.2,
              0,
              0,
            );
            if (nearbyHits > 0) {
              this.callbacks.onHitTarget?.();
            }

            this.painState.active = false;
            this.painState.targetId = null;
            this.painState.elapsed = 0;
            this.painState.tickAccum = 0;
            this.painState.ticksDone = 0;
            this.refreshInvulnerable();
            this.animator.setPainChanneling(false);
            this.phoenixVfx.updatePainTelekinetic(false, null, null, dt);
            this.callbacks.onPainInflictionChange?.(false, false);
          } else {
            this._handWorld.set(focusPos.x, focusPos.y + 1.62, focusPos.z);
            this._aimTarget.set(
              this._painTargetWorld.x,
              this._painTargetWorld.y + 0.56,
              this._painTargetWorld.z,
            );
            this.phoenixVfx.updatePainTelekinetic(
              true,
              this._handWorld,
              this._aimTarget,
              dt,
            );
          }
        }
      }
    } else {
      this.phoenixVfx.updatePainTelekinetic(false, null, null, dt);
    }

    // Update Scarlet Witch, Phoenix Force, Emma Frost & Hela VFX against NPCs
    const targetProbes = this.npcs.getTargetProbes();
    this.vfx.update(
      dt,
      focusPos,
      this.archetype === 'scarlet-witch' && this.flightEnabled && !this.dead,
      targetProbes,
      (targetId, hitDir, hitPos) => {
        this.fx.triggerCue('chaos-bolt-impact', hitPos);
        if (this.npcs.applyDamage(targetId, this.scaleDamage(30), hitDir, 0)) {
          this.callbacks.onHitTarget?.();
        }
      },
      (center) => {
        const hits = this.npcs.applyAreaImplosion(
          center,
          CHAOS_EXPLOSION_RADIUS,
          this.scaleDamage(20),
          2.0,
        );
        this.fx.triggerCue('chaos-implosion-detonate', center);
        this.callbacks.onChaosImplosionAbsorb?.();
        if (hits > 0) {
          this.callbacks.onHitTarget?.();
        }
      },
    );

    // Darkhold 12s Active Duration & Simplified 10s / 100-dmg-absorption Automatic Shield
    const darkholdDurSec = DARKHOLD_DURATION_MS / 1000;
    if (!this.dead && this.darkholdState.active) {
      this.darkholdState.elapsed += dt;
      if (
        this.darkholdState.elapsed >= darkholdDurSec &&
        this.teleportState.phase === 'idle'
      ) {
        this.closeDarkhold(true, false);
      }
    }

    const shieldDurSec = AUTO_SHIELD_DURATION_MS / 1000;
    let shieldRemainingRatio = 0;
    if (!this.dead && this.shieldState.active) {
      this.shieldState.elapsed += dt;
      const timeRatio = Math.max(0, 1 - this.shieldState.elapsed / shieldDurSec);
      const poolRatio = Math.max(
        0,
        this.shieldState.absorbRemaining / AUTO_SHIELD_MAX_ABSORB,
      );
      shieldRemainingRatio = Math.min(timeRatio, poolRatio);

      if (
        this.shieldState.elapsed >= shieldDurSec ||
        this.shieldState.absorbRemaining <= 0
      ) {
        this.shieldState.active = false;
        this.shieldState.elapsed = 0;
        this.shieldState.absorbRemaining = AUTO_SHIELD_MAX_ABSORB;
        this.refreshInvulnerable();
        this.callbacks.onAutoShieldChange?.(false);
      }
    }

    this.darkholdBook.update(
      dt,
      focusPos,
      this.rig.root.rotation.y,
      this.dead || this.teleportState.phase === 'preparing',
    );
    this.scarletShield.update(
      dt,
      !this.dead &&
        this.shieldState.active &&
        this.teleportState.phase !== 'preparing',
      focusPos,
      shieldRemainingRatio,
    );

    this.phoenixVfx.update(
      dt,
      focusPos,
      this.archetype === 'phoenix-force' &&
        this.flightEnabled &&
        !this.dead &&
        !this.isPhoenixReviving(),
      targetProbes,
      (targetId, hitDir, hitPos) => {
        this.fx.triggerCue('phoenix-fireball-impact', hitPos);
        if (this.npcs.applyDamage(targetId, this.scaleDamage(10), hitDir, 0)) {
          this.npcs.applyBurn(targetId, 3.0, this.scaleDamage(2));
          this.callbacks.onPhoenixFireballHit?.();
          this.callbacks.onHitTarget?.();
        }
      },
    );

    // Emma Frost Mind Control Paralysis countdown (persists independently across casts)
    if (!this.dead && this.mindControlState.paralysisTargetId) {
      this.mindControlState.paralysisRemaining -= dt;
      if (
        this.mindControlState.paralysisRemaining <= 0 ||
        !this.npcs.isTargetAlive(this.mindControlState.paralysisTargetId)
      ) {
        this.npcs.setMindControlParalysis(
          this.mindControlState.paralysisTargetId,
          false,
        );
        this.mindControlState.paralysisTargetId = null;
        this.mindControlState.paralysisRemaining = 0;
      }
    }

    // Emma Frost Mind Control Choosing / Mental Damage Channel, Diamond Form & Telepathic Wave
    if (!this.dead && this.archetype === 'emma-frost') {
      const mc = this.mindControlState;
      if (
        (mc.phase === 'choosing' || mc.phase === 'mental-damage') &&
        mc.targetId
      ) {
        const targetProbe = targetProbes.find((p) => p.id === mc.targetId);
        const targetHead = new THREE.Vector3();
        if (
          !targetProbe ||
          !this.npcs.getTargetHeadPosition(mc.targetId, targetHead)
        ) {
          this.clearMindControl(true);
        } else {
          const yawToNpc = Math.atan2(
            -(targetProbe.position.x - focusPos.x),
            -(targetProbe.position.z - focusPos.z),
          );
          this.cameraYaw = yawToNpc;
          this.rig.root.rotation.y = yawToNpc;
          this.npcs.setExternalControl(mc.targetId, true);
          this.npcs.setExternalPose(
            mc.targetId,
            targetProbe.position,
            yawToNpc + Math.PI,
            { headache: true },
          );

          this.rig.root.updateMatrixWorld(true);
          this._foreheadPos
            .set(0, 0.3, -0.25)
            .applyMatrix4(this.rig.head.matrixWorld);
          this.emmaVfx.setMindControlBeam(true, this._foreheadPos, targetHead);

          if (mc.phase === 'mental-damage') {
            mc.elapsed += dt;
            mc.dmgAccum += dt;
            if (mc.dmgAccum >= 0.5) {
              mc.dmgAccum -= 0.5;
              const hitDir = targetProbe.position
                .clone()
                .sub(focusPos)
                .setY(0);
              if (hitDir.lengthSq() < 0.001) hitDir.set(0, 0, -1);
              else hitDir.normalize();
              this.emmaVfx.spawnMentalHeadExplosion(targetHead);
              this.callbacks.onMentalAttackImpact?.();
              if (
                this.npcs.applyDamage(
                  mc.targetId,
                  this.scaleDamage(8),
                  hitDir,
                  0,
                )
              ) {
                this.callbacks.onHitTarget?.();
              }
            }
            if (
              !this.npcs.isTargetAlive(mc.targetId) ||
              mc.elapsed >= EMMA_MC_MENTAL_DMG_MS / 1000
            ) {
              this.clearMindControl(true);
            }
          }
        }
      }

      if (this.diamondState.active) {
        this.diamondState.elapsed += dt;
        if (this.diamondState.elapsed >= EMMA_DIAMOND_DURATION_MS / 1000) {
          this.diamondState.active = false;
          this.diamondState.elapsed = 0;
          this.refreshInvulnerable();
          this.fx.triggerCue('diamond-off', focusPos);
          this.callbacks.onDiamondFormChange?.(false, true);
        }
      }
      const targetDiamondBlend = this.diamondState.active ? 1 : 0;
      if (Math.abs(this.diamondState.blend - targetDiamondBlend) > 0.002) {
        this.diamondState.blend = THREE.MathUtils.damp(
          this.diamondState.blend,
          targetDiamondBlend,
          8.5,
          dt,
        );
        if (Math.abs(this.diamondState.blend - targetDiamondBlend) < 0.003) {
          this.diamondState.blend = targetDiamondBlend;
        }
        this.rig.setDiamondForm(this.diamondState.blend);
      }

      if (this.telepathicWaveState.active) {
        this.telepathicWaveState.elapsed += dt;
        this.telepathicWaveState.ringAccum += dt;
        this.telepathicWaveState.tickAccum += dt;

        const sinY = Math.sin(this.rig.root.rotation.y);
        const cosY = Math.cos(this.rig.root.rotation.y);
        this._waveDir.set(-sinY, 0, -cosY).normalize();

        if (this.telepathicWaveState.ringAccum >= 0.24) {
          this.telepathicWaveState.ringAccum -= 0.24;
          this.rig.root.updateMatrixWorld(true);
          this.rig.head.getWorldPosition(this._foreheadPos);
          this._foreheadPos.x += -sinY * 0.24;
          this._foreheadPos.y += 0.14;
          this._foreheadPos.z += -cosY * 0.24;
          this.emmaVfx.spawnTelepathicWaveRing(this._foreheadPos, this._waveDir);
        }

        if (this.telepathicWaveState.tickAccum >= 0.45) {
          this.telepathicWaveState.tickAccum -= 0.45;
          let hitAny = false;
          for (let k = 0; k < targetProbes.length; k++) {
            const trg = targetProbes[k];
            const dx = trg.position.x - focusPos.x;
            const dz = trg.position.z - focusPos.z;
            const dist = Math.hypot(dx, dz);
            if (dist <= 6.5 && dist > 0.01) {
              const dot = (dx * this._waveDir.x + dz * this._waveDir.z) / dist;
              if (dot >= 0.42) {
                this._hitDir.set(dx / dist, 0, dz / dist);
                if (this.npcs.applyDamage(trg.id, this.scaleDamage(4), this._hitDir, 0)) {
                  this.npcs.applyHeadache(trg.id, 1.5);
                  hitAny = true;
                }
              }
            }
          }
          if (hitAny) {
            this.callbacks.onHitTarget?.();
          }
        }

        if (this.telepathicWaveState.elapsed >= 2.4) {
          this.telepathicWaveState.active = false;
          this.animator.setTelepathicWave(false);
          this.callbacks.onTelepathicWaveChange?.(false, true);
        }
      }

      if (this.astralState.active) {
        this.astralState.elapsed += dt;
        if (this.astralState.elapsed >= EMMA_ASTRAL_MAX_DURATION_MS / 1000) {
          this.astralState.active = false;
          this.astralState.elapsed = 0;
          this.rig.setAstralProjection(false);
          this.refreshInvulnerable();
          this.fx.triggerCue('astral-off', focusPos);
          this.callbacks.onAstralProjectionChange?.(false, true);
        }
      }
    }

    // Emma Frost idle circular psychic rings on forehead
    if (this.archetype === 'emma-frost') {
      const emmaIdleActive =
        !this.dead &&
        !this.flightEnabled &&
        !this.telepathicWaveState.active &&
        this.mindControlState.phase === 'idle' &&
        this.teleportState.phase === 'idle' &&
        Math.hypot(
          this.physics.velocity.x,
          this.physics.velocity.z,
        ) < 0.4;
      this.rig.root.updateMatrixWorld(true);
      this._foreheadPos.set(0, 0.3, -0.25).applyMatrix4(this.rig.head.matrixWorld);
      this._waveDir
        .set(0, 0.32, -1.25)
        .applyMatrix4(this.rig.head.matrixWorld)
        .sub(this._foreheadPos)
        .normalize();
      this.emmaIdleRings.update(dt, emmaIdleActive, this._foreheadPos, this._waveDir);
    } else {
      this.emmaIdleRings.clear();
    }

    this.emmaVfx.update(dt, targetProbes, (targetId, hitDir) => {
      this.callbacks.onDiamondProjectileImpact?.();
      if (this.npcs.applyDamage(targetId, this.scaleDamage(22), hitDir, 0)) {
        this.callbacks.onHitTarget?.();
      }
    });

    // Hela Crown Form smooth transition, Dual-Sword Summon reload cadence & Green Explosion charge slam
    if (!this.dead && this.archetype === 'hela') {
      if (this.crownState.active) {
        this.crownState.elapsed += dt;
        if (this.crownState.elapsed >= HELA_CROWN_DURATION_MS / 1000) {
          this.crownState.active = false;
          this.crownState.elapsed = 0;
          this.fx.triggerCue('crown-off', focusPos);
          this.callbacks.onCrownFormChange?.(false, true);
        }
      }
      const targetCrownBlend = this.crownState.active ? 1 : 0;
      if (Math.abs(this.crownState.blend - targetCrownBlend) > 0.002) {
        this.crownState.blend = THREE.MathUtils.damp(
          this.crownState.blend,
          targetCrownBlend,
          12,
          dt,
        );
        if (Math.abs(this.crownState.blend - targetCrownBlend) < 0.004) {
          this.crownState.blend = targetCrownBlend;
        }
        this.rig.setHelaCrownProgress(this.crownState.blend);
      }

      if (this.swordSummonState.slashCooldownRemaining > 0) {
        this.swordSummonState.slashCooldownRemaining = Math.max(
          0,
          this.swordSummonState.slashCooldownRemaining - dt,
        );
      }

      if (this.swordSummonState.active) {
        this.swordSummonState.elapsed += dt;
        if (this.swordSummonState.reloading) {
          this.swordSummonState.reloadElapsed += dt;
          if (
            (!this.swordSummonState.leftInHand || !this.swordSummonState.rightInHand) &&
            this.swordSummonState.reloadElapsed >= HELA_SWORD_APPEAR_MS / 1000
          ) {
            this.swordSummonState.leftInHand = true;
            this.swordSummonState.rightInHand = true;
            this.swordSummonState.reloadHand = null;
            this.rig.setHelaHandSwords(true, true);
          }
          if (
            this.swordSummonState.reloadElapsed >=
            HELA_SWORD_THROW_READY_MS / 1000
          ) {
            this.swordSummonState.reloading = false;
            this.swordSummonState.throwReady = true;
            this.callbacks.onSwordThrowAvailabilityChange?.(true);
          }
        }

        if (
          this.swordSummonState.elapsed >=
          HELA_SWORD_SUMMON_DURATION_MS / 1000
        ) {
          this.swordSummonState.active = false;
          this.swordSummonState.leftInHand = false;
          this.swordSummonState.rightInHand = false;
          this.swordSummonState.reloadHand = null;
          this.swordSummonState.throwReady = false;
          this.swordSummonState.reloading = false;
          this.swordSummonState.slashCooldownRemaining = 0;
          this.rig.setHelaHandSwords(false, false);
          this.animator.setSwordHeld(false);
          this.callbacks.onSwordSummonChange?.(false, true);
          this.callbacks.onSwordThrowAvailabilityChange?.(false);
        }
      }

      if (this.greenChargeState.active) {
        this.greenChargeState.elapsed += dt;
        this.rig.root.updateMatrixWorld(true);
        this.rig.rightHand.getWorldPosition(this._handWorld);
        const ratio = Math.min(1, this.greenChargeState.elapsed / 0.42);
        this.helaVfx.updateHandGather(
          dt,
          this.greenChargeState.elapsed < 0.42,
          this._handWorld,
          ratio,
        );

        if (this.greenChargeState.elapsed >= 0.42) {
          this.greenChargeState.active = false;
          this.greenChargeState.elapsed = 0;
          this.helaVfx.updateHandGather(dt, false, null, 0);
          this.helaVfx.spawnGreenExplosion(focusPos, 7.5);
          this.fx.triggerCue('green-explosion', focusPos);
          this.callbacks.onGreenExplosion?.('detonate');

          const dmg = this.scaleDamage(
            32 + (this.crownState.active ? HELA_CROWN_BONUS_DAMAGE : 0),
          );
          const hits = this.npcs.applyAreaFireExplosion(
            focusPos,
            7.5,
            dmg,
            2.0,
            7.2,
            0,
            0,
          );
          if (hits > 0) {
            this.callbacks.onHitTarget?.();
          }
        }
      }
    }

    this.helaVfx.update(
      dt,
      targetProbes,
      (targetId, outPos) => this.npcs.getNpcSwordEmbedPose(targetId, outPos),
      (targetId, damage, hitDir, hitPos) => {
        this.fx.triggerCue('sword-embed', hitPos);
        this.callbacks.onSwordEmbed?.();
        if (this.npcs.applyDamage(targetId, damage, hitDir, 0)) {
          this.callbacks.onHitTarget?.();
        }
      },
    );

    // ------------------------------------------------------------------
    // MAGNETO STATE & VFX STEP
    // ------------------------------------------------------------------
    if (!this.dead && this.archetype === 'magneto') {
      if (this.magnetoTornadoState.active) {
        this.magnetoTornadoState.elapsed += dt;
        if (this.magnetoTornadoState.elapsed >= MAGNETO_TORNADO_DURATION_MS / 1000) {
          this.magnetoTornadoState.active = false;
          this.magnetoTornadoState.elapsed = 0;
          this.magnetoVfx.setTornadoActive(false);
          this.animator.setMetalTornado(false);
          const restoreFlight = this.magnetoPreFlight;
          this.flightEnabled = restoreFlight;
          this.magnetoShieldState.active = restoreFlight;
          this.magnetoVfx.setShieldActive(restoreFlight);
          this.refreshInvulnerable();
          this.callbacks.onFlightForceChange?.(restoreFlight);
          this.callbacks.onMagnetoTornadoChange?.(false, true);
        }
      }
    }

    this.magnetoVfx.update(dt, focusPos, targetProbes, {
      onProjectileHit: (id, hitDir, damage) => {
        if (this.npcs.applyDamage(id, this.scaleDamage(damage), hitDir, 0)) {
          this.callbacks.onHitTarget?.();
        }
      },
      onMeteorLaunch: () => {
        this.fx.triggerCue('magneto-meteor-impact', focusPos);
        this.callbacks.onMagnetoMeteorStage?.('launch');
      },
      onMeteorImpact: (impactPos) => {
        this.magnetoMeteorActive = false;
        const restoreFlight = this.magnetoPreFlight;
        this.flightEnabled = restoreFlight;
        this.magnetoShieldState.active = restoreFlight;
        this.magnetoVfx.setShieldActive(restoreFlight);
        this.refreshInvulnerable();
        this.callbacks.onFlightForceChange?.(restoreFlight);
        this.fx.triggerCue('magneto-meteor-impact', impactPos);
        this.callbacks.onMagnetoMeteorStage?.('impact');
        const hits = this.npcs.applyAreaFireExplosion(
          impactPos,
          6.2,
          this.scaleDamage(55),
          2.0,
          8.2,
          0,
          0,
        );
        if (hits > 0) this.callbacks.onHitTarget?.();
      },
      onTornadoControl: (id, pos, yaw, tickDamage) => {
        this.npcs.setExternalControl(id, true);
        this.npcs.setExternalPose(id, pos, yaw);
        if (tickDamage > 0) {
          const outDir = pos.clone().sub(focusPos).setY(0).normalize();
          if (this.npcs.applyDamage(id, this.scaleDamage(tickDamage), outDir, 0)) {
            this.callbacks.onHitTarget?.();
          }
        }
      },
      onTornadoRelease: (id) => {
        this.npcs.setExternalControl(id, false);
        const dir = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
        this.npcs.triggerTargetRagdoll(id, 1.35, dir.multiplyScalar(3.4));
      },
    });

    // ------------------------------------------------------------------
    // QUICKSILVER STATE & VFX STEP
    // ------------------------------------------------------------------
    if (!this.dead && this.archetype === 'quicksilver') {
      const rps = this.rapidPunchState;
      const targetId = rps.targetId;
      if (rps.active && targetId) {
        const targetProbe = targetProbes.find((p) => p.id === targetId);
        if (!targetProbe) {
          this.npcs.setExternalControl(targetId, false);
          rps.active = false;
          rps.targetId = null;
          this.refreshInvulnerable();
          this.animator.setRapidPunch(false);
          this.callbacks.onRapidPunchChange?.(false, true);
        } else {
          rps.elapsed += dt;
          const totalDur = QUICKSILVER_COMBO_DURATION_MS / 1000;
          const lockedNpcPos = targetProbe.position.clone();
          lockedNpcPos.y = 0;
          const yawToNpc = Math.atan2(
            -(lockedNpcPos.x - focusPos.x),
            -(lockedNpcPos.z - focusPos.z),
          );
          this.cameraYaw = yawToNpc;
          this.rig.root.rotation.y = yawToNpc;
          this.npcs.setExternalControl(targetId, true);
          this.npcs.setExternalPose(targetId, lockedNpcPos, yawToNpc + Math.PI, {
            headache: true,
          });

          if (!rps.finished && rps.elapsed < totalDur - 0.25) {
            rps.punchAccum += dt;
            if (rps.punchAccum >= 0.22) {
              rps.punchAccum -= 0.22;
              rps.sideSign *= -1;
              const hitDir = lockedNpcPos.clone().sub(focusPos).setY(0).normalize();
              this.quicksilverVfx.spawnPunchImpact(lockedNpcPos, false);
              this.callbacks.onRapidPunchStrike?.(false);
              if (this.npcs.applyDamage(targetId, this.scaleDamage(4), hitDir, 0)) {
                this.callbacks.onHitTarget?.();
              }
            }
          } else if (!rps.finished && rps.elapsed >= totalDur - 0.25) {
            rps.finished = true;
            this.animator.setRapidPunch(false);
            this.animator.triggerCast('qs-finisher-punch', 0.35);
            const launchDir = lockedNpcPos.clone().sub(focusPos).setY(0).normalize();
            const knockImpulse = launchDir.clone().multiplyScalar(11.5);
            knockImpulse.y = 4.2;
            this.npcs.setExternalControl(targetId, false);
            this.quicksilverVfx.spawnPunchImpact(lockedNpcPos, true);
            this.fx.triggerCue('qs-punch-finisher', lockedNpcPos);
            this.callbacks.onRapidPunchStrike?.(true);
            if (
              this.npcs.applyDamage(
                targetId,
                this.scaleDamage(18),
                launchDir,
                2.5,
                knockImpulse,
              )
            ) {
              this.callbacks.onHitTarget?.();
            }
          }

          if (rps.elapsed >= totalDur) {
            rps.active = false;
            rps.targetId = null;
            this.refreshInvulnerable();
            this.animator.setRapidPunch(false);
            this.callbacks.onRapidPunchChange?.(false, true);
          }
        }
      }

      if (this.windTornadoState.active) {
        this.windTornadoState.elapsed += dt;
        if (this.windTornadoState.elapsed >= QUICKSILVER_TORNADO_MAX_DURATION_MS / 1000) {
          this.windTornadoState.active = false;
          this.windTornadoState.elapsed = 0;
          this.quicksilverVfx.setWindTornado(false);
          this.callbacks.onWindTornadoChange?.(false, true);
        }
      }
    }

    const horizSpeed = Math.hypot(this.physics.velocity.x, this.physics.velocity.z);
    const speedVfxOn =
      !this.dead &&
      this.archetype === 'quicksilver' &&
      (this.superSpeedState.active || this.windTornadoState.active || this.rapidPunchState.active);
    this.quicksilverVfx.update(
      dt,
      focusPos,
      this.rig.root.rotation.y,
      this.windTornadoState.active ? 18 : horizSpeed,
      speedVfxOn,
      targetProbes,
      {
        onWindTornadoControl: (id, pos, yaw, tickDamage) => {
          this.npcs.setExternalControl(id, true);
          this.npcs.setExternalPose(id, pos, yaw);
          if (tickDamage > 0) {
            const outDir = pos.clone().sub(this.windTornadoState.center).setY(0).normalize();
            if (this.npcs.applyDamage(id, this.scaleDamage(tickDamage), outDir, 0)) {
              this.callbacks.onHitTarget?.();
            }
          }
        },
        onWindTornadoRelease: (id) => {
          this.npcs.setExternalControl(id, false);
        },
        onTimeFreezeChange: (id, frozen) => {
          this.npcs.setParalyzed(id, frozen);
        },
      },
    );

    // ------------------------------------------------------------------
    // DOCTOR STRANGE STATE & VFX STEP
    // ------------------------------------------------------------------
    if (!this.dead && this.archetype === 'doctor-strange') {
      if (this.strangeShieldState.active) {
        this.strangeShieldState.elapsed += dt;
        if (this.strangeShieldState.elapsed >= STRANGE_SHIELD_MAX_DURATION_MS / 1000) {
          this.strangeShieldState.active = false;
          this.strangeShieldState.elapsed = 0;
          this.strangeVfx.setShieldActive(false);
          this.refreshInvulnerable();
          this.fx.triggerCue('strange-shield-off', focusPos);
          this.callbacks.onStrangeShieldChange?.(false, true);
        }
      }
    }

    this.strangeVfx.update(dt, focusPos, this.rig.root.rotation.y, targetProbes, {
      onClonesTickDamage: (targetId, dmg) => {
        const dir = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
        if (this.npcs.applyDamage(targetId, this.scaleDamage(dmg), dir, 0)) {
          this.callbacks.onHitTarget?.();
        }
      },
      onClonesEnd: (targetId) => {
        this.npcs.setParalyzed(targetId, false);
      },
      onMirrorHitTarget: (targetId, hitDir) => {
        this.callbacks.onStrangeMirrorImpact?.();
        const knock = hitDir.clone().multiplyScalar(5.6);
        knock.y = 0.5;
        if (this.npcs.applyDamage(targetId, this.scaleDamage(28), hitDir, 0, knock)) {
          this.callbacks.onHitTarget?.();
        }
      },
    });

    // ------------------------------------------------------------------
    // VISION STATE & VFX STEP
    // ------------------------------------------------------------------
    if (!this.dead && this.archetype === 'vision') {
      if (this.visionIntangibleState.active) {
        this.visionIntangibleState.elapsed += dt;
        if (
          !this.flightEnabled ||
          this.visionIntangibleState.elapsed >= VISION_INTANGIBLE_MAX_DURATION_MS / 1000
        ) {
          this.visionIntangibleState.active = false;
          this.visionIntangibleState.elapsed = 0;
          this.physics.resolveHorizontalOverlap();
          this.refreshInvulnerable();
          this.fx.triggerCue('vision-phase-off', focusPos);
          this.callbacks.onVisionPhaseChange?.(false, true);
        }
      }

      const targetBlend = this.visionIntangibleState.active ? 1 : 0;
      if (Math.abs(this.visionIntangibleState.blend - targetBlend) > 0.002) {
        this.visionIntangibleState.blend = THREE.MathUtils.damp(
          this.visionIntangibleState.blend,
          targetBlend,
          12,
          dt,
        );
        if (Math.abs(this.visionIntangibleState.blend - targetBlend) < 0.004) {
          this.visionIntangibleState.blend = targetBlend;
        }
        this.rig.setIntangible(
          this.visionIntangibleState.blend > 0.02,
          this.visionIntangibleState.blend,
        );
      }

      if (this.visionLaserState.active) {
        this.visionLaserState.elapsed += dt;
        if (this.visionLaserState.elapsed >= VISION_LASER_DURATION_MS / 1000) {
          this.visionLaserState.active = false;
          this.visionLaserState.elapsed = 0;
          this.visionVfx.setLaserActive(false);
          this.animator.setMindLaser(false);
          this.callbacks.onVisionLaserChange?.(false, true);
        }
      }

      if (this.visionBoltChargeState.active) {
        this.visionBoltChargeState.elapsed += dt;
        const chargeDur = VISION_MIND_BOLT_CHARGE_MS / 1000;
        const progress = Math.min(1, this.visionBoltChargeState.elapsed / chargeDur);
        this.visionVfx.setBoltCharging(true, progress);
        if (this.visionBoltChargeState.elapsed >= chargeDur) {
          this.visionBoltChargeState.active = false;
          this.visionBoltChargeState.elapsed = 0;
          this.animator.setVisionBoltCharge(false);
          this.visionVfx.setBoltCharging(false, 0);
          this.getMindStoneWorldPosition(this._mindStoneWorld);
          const target = this.computeReticleAimPoint(36, true, false);
          this.visionVfx.spawnMindBolt(this._mindStoneWorld, target);
          this.animator.triggerCast('vision-bolt', 0.28);
          this.fx.triggerCue('vision-bolt', this._mindStoneWorld);
          this.callbacks.onVisionBoltCast?.();
        }
      }

      const hg = this.visionHeadGripState;
      const targetId = hg.targetId;
      if (hg.active && targetId) {
        const probe = targetProbes.find((p) => p.id === targetId);
        if (!probe && !hg.slammed) {
          this.npcs.setExternalControl(targetId, false);
          hg.active = false;
          hg.targetId = null;
          this.animator.setHeadGrip(false);
          this.refreshInvulnerable();
          this.callbacks.onVisionHeadGripChange?.(false, true);
        } else {
          hg.elapsed += dt;
          const totalDur = VISION_HEAD_GRIP_DURATION_MS / 1000;

          if (!hg.slammed) {
            const liftRatio = THREE.MathUtils.clamp(hg.elapsed / 0.45, 0, 1);
            const liftY = hg.lockedPos.y + THREE.MathUtils.lerp(0, 0.22, liftRatio);
            const gripPos = new THREE.Vector3(hg.lockedPos.x, liftY, hg.lockedPos.z);

            const yawToNpc = Math.atan2(
              -(gripPos.x - focusPos.x),
              -(gripPos.z - focusPos.z),
            );
            this.cameraYaw = yawToNpc;
            this.rig.root.rotation.y = yawToNpc;
            this.npcs.setExternalControl(targetId, true);
            this.npcs.setExternalPose(targetId, gripPos, yawToNpc + Math.PI, {
              headache: true,
            });

            hg.tickAccum += dt;
            if (hg.tickAccum >= 0.48 && hg.ticksDone < 4) {
              hg.tickAccum -= 0.48;
              hg.ticksDone++;
              const hitDir = gripPos.clone().sub(focusPos).setY(0).normalize();
              if (this.npcs.applyDamage(targetId, this.scaleDamage(6), hitDir, 0)) {
                this.callbacks.onHitTarget?.();
              }
            }

            if (hg.elapsed >= 2.15) {
              hg.slammed = true;
              this.animator.setHeadGrip(false);
              this.fx.triggerCue('vision-head-slam', gripPos);
              const launchDir = gripPos.clone().sub(focusPos).setY(0).normalize();
              const slamImpulse = launchDir.clone().multiplyScalar(8.5);
              slamImpulse.y = -2.2;
              this.npcs.setExternalControl(targetId, false);
              if (
                this.npcs.applyDamage(
                  targetId,
                  this.scaleDamage(18),
                  launchDir,
                  3.0,
                  slamImpulse,
                )
              ) {
                this.callbacks.onHitTarget?.();
              }
            }
          }

          if (hg.elapsed >= totalDur) {
            hg.active = false;
            hg.targetId = null;
            this.refreshInvulnerable();
            this.callbacks.onVisionHeadGripChange?.(false, true);
          }
        }
      }
    }

    this.getMindStoneWorldPosition(this._mindStoneWorld);
    if (this.visionLaserState.active) {
      this._laserEndWorld.copy(this.computeReticleAimPoint(34, true, false));
    }
    this.visionVfx.update(
      dt,
      this._mindStoneWorld,
      this._laserEndWorld,
      targetProbes,
      {
        onLaserHitTarget: (id, dir, dmg) => {
          if (this.npcs.applyDamage(id, this.scaleDamage(dmg), dir, 0)) {
            this.callbacks.onHitTarget?.();
          }
        },
        onBoltHitTarget: (id, dir, dmg) => {
          if (this.npcs.applyDamage(id, this.scaleDamage(dmg), dir, 0)) {
            this.callbacks.onHitTarget?.();
          }
        },
        onExplosiveBoltDetonate: (impactPos) => {
          this.fx.triggerCue('vision-bolt-explode', impactPos);
          this.callbacks.onVisionBoltExplode?.();
          const hits = this.npcs.applyAreaFireExplosion(
            impactPos,
            5.2,
            this.scaleDamage(40),
            1.8,
            6.8,
            0,
            0,
          );
          if (hits > 0) {
            this.callbacks.onHitTarget?.();
          }
        },
      },
    );

    this.landingDust.update(dt);

    // Grounding Contact Shadow
    const onBorder =
      Math.abs(focusPos.x) > BASEPLATE_HALF_INNER ||
      Math.abs(focusPos.z) > BASEPLATE_HALF_INNER;
    const groundSurfaceY = onBorder ? BASEPLATE_BORDER_HEIGHT : 0;
    const heightAboveGround = this.dead
      ? 0
      : Math.max(0, focusPos.y - groundSurfaceY);
    const shadowScale = this.dead
      ? 1.25
      : Math.max(0.45, 1.0 - heightAboveGround * 0.2);
    const sunSlopeX = SUN_LIGHT_DIR.x / Math.max(SUN_LIGHT_DIR.y, 0.25);
    const sunSlopeZ = SUN_LIGHT_DIR.z / Math.max(SUN_LIGHT_DIR.y, 0.25);
    this.contactShadow.position.set(
      focusPos.x - heightAboveGround * sunSlopeX * 0.35,
      groundSurfaceY + 0.015,
      focusPos.z - heightAboveGround * sunSlopeZ * 0.35,
    );
    this.contactShadow.scale.setScalar(shadowScale);
    const baseShadowOpacity = this.graphicsSettings.shadows === 'off' ? 0.34 : 0.18;
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity =
      this.teleportState.phase === 'preparing'
        ? 0.08
        : Math.max(0.05, baseShadowOpacity - heightAboveGround * 0.08);

    // Directional Sun Frustum
    this.sunLight.position.set(
      focusPos.x + SUN_LIGHT_DIR.x * 22,
      focusPos.y + SUN_LIGHT_DIR.y * 22,
      focusPos.z + SUN_LIGHT_DIR.z * 22,
    );
    this.sunLight.target.position.set(focusPos.x, focusPos.y, focusPos.z);
    this.sunLight.target.updateMatrixWorld();

    this.skyDome.position.set(focusPos.x, 0, focusPos.z);

    // Step Cinematic FX controller (zoom, trauma shake, 3D ability light, screen FX)
    this.fx.update(dt, focusPos);
    this.abilityLight.position.copy(this.fx.lightPos);
    this.abilityLight.color.copy(this.fx.lightColor);
    this.abilityLight.intensity = this.fx.lightIntensity;
    this.renderer.toneMappingExposure = 1.02 + this.fx.exposureBoost;

    // Camera
    this.smoothCameraDistance = THREE.MathUtils.damp(
      this.smoothCameraDistance,
      this.targetCameraDistance,
      10,
      dt,
    );

    const sinY = Math.sin(this.cameraYaw);
    const cosY = Math.cos(this.cameraYaw);
    this._fwd.set(-sinY, 0, -cosY);
    this._right.set(cosY, 0, -sinY);

    const baseCamDist = this.dead
      ? Math.max(this.smoothCameraDistance, 5.2)
      : this.smoothCameraDistance;
    const camDist = THREE.MathUtils.clamp(baseCamDist + this.fx.zoomOffset, 2.0, 10.5);
    const horizDist = camDist * Math.cos(this.cameraPitch);
    const vertOffset = 1.48 + camDist * Math.sin(this.cameraPitch);
    const shoulderOffsetX = this.dead
      ? 0
      : 0.62 * THREE.MathUtils.clamp(baseCamDist / 4.65, 0.72, 1.35);

    this._desiredCamPos
      .copy(focusPos)
      .addScaledVector(this._right, shoulderOffsetX)
      .addScaledVector(this._fwd, -horizDist);
    this._desiredCamPos.y = Math.max(groundSurfaceY + 0.65, focusPos.y + vertOffset);

    this._desiredCamLook
      .copy(focusPos)
      .addScaledVector(this._right, shoulderOffsetX + (this.dead ? 0 : 0.12))
      .addScaledVector(this._fwd, this.dead ? 0.2 : 3.6);
    this._desiredCamLook.y = this.dead
      ? focusPos.y + 0.35
      : focusPos.y + 1.52 - Math.sin(this.cameraPitch) * 1.1;

    if (!this.camInitialized) {
      this.smoothCamPos.copy(this._desiredCamPos);
      this.smoothCamLook.copy(this._desiredCamLook);
      this.camInitialized = true;
    } else {
      this.smoothCamPos.x = THREE.MathUtils.damp(
        this.smoothCamPos.x,
        this._desiredCamPos.x,
        16,
        dt,
      );
      this.smoothCamPos.z = THREE.MathUtils.damp(
        this.smoothCamPos.z,
        this._desiredCamPos.z,
        16,
        dt,
      );
      this.smoothCamPos.y = THREE.MathUtils.damp(
        this.smoothCamPos.y,
        this._desiredCamPos.y,
        11,
        dt,
      );

      this.smoothCamLook.x = THREE.MathUtils.damp(
        this.smoothCamLook.x,
        this._desiredCamLook.x,
        18,
        dt,
      );
      this.smoothCamLook.z = THREE.MathUtils.damp(
        this.smoothCamLook.z,
        this._desiredCamLook.z,
        18,
        dt,
      );
      this.smoothCamLook.y = THREE.MathUtils.damp(
        this.smoothCamLook.y,
        this._desiredCamLook.y,
        12,
        dt,
      );
    }

    const desiredFov = this.baseFov + this.fx.fovOffset;
    if (Math.abs(desiredFov - this.lastAppliedFov) > 0.01) {
      this.camera.fov = desiredFov;
      this.lastAppliedFov = desiredFov;
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.copy(this.smoothCamPos);
    this.camera.lookAt(this.smoothCamLook);

    if (
      this.fx.shakeLocalOffset.lengthSq() > 0 ||
      Math.abs(this.fx.shakeRollRad) > 0.00001
    ) {
      this._camRightVec.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this._camUpVec.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
      this.camera.position
        .addScaledVector(this._camRightVec, this.fx.shakeLocalOffset.x)
        .addScaledVector(this._camUpVec, this.fx.shakeLocalOffset.y);
      this.camera.rotateZ(this.fx.shakeRollRad);
    }

    if (this.fx.screenFx.active || this.lastScreenFxSentActive) {
      this.callbacks.onScreenFxUpdate?.(this.fx.screenFx);
      this.lastScreenFxSentActive = this.fx.screenFx.active;
    }

    this.skyAtmosphere.update(dt, focusPos, this.camera);
    if (this.windTrails.lines.visible) {
      this.windTrails.update(dt, focusPos, this.camera);
    }

    this.renderer.render(this.scene, this.camera);

    // Update Bandits, Prisoners & Basic NPCs + push projected HUD snapshot & elimination coin rewards
    const vw = Math.max(this.container.clientWidth, 1);
    const vh = Math.max(this.container.clientHeight, 1);
    const ndc = this.getReticleNdc();
    const playerTargetable =
      !this.dead &&
      !this.isPhoenixReviving() &&
      this.teleportState.phase === 'idle';
    const npcSnapshots = this.npcs.update(
      dt,
      this.camera,
      this.physics.position,
      ndc.x,
      ndc.y,
      vw,
      vh,
      this.callbacks.onBurnTick,
      (events) => {
        if (events.length > 0 && !this.dead) {
          const healGain = 85 * events.length;
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + healGain);
          this.callbacks.onPlayerHealthChange?.(this.playerHp, this.playerMaxHp);
          this.callbacks.onPlayerHeal?.(healGain);
          this.fx.triggerCue('kill-heal', this.physics.position);
        }
        this.callbacks.onNpcEliminated?.(events);
      },
      playerTargetable,
      (dmg, kind) => {
        const dealt = this.damagePlayer(dmg);
        if (dealt > 0 || (this.shieldState.active && !this.diamondState.active)) {
          this.callbacks.onNpcStrikePlayer?.(kind);
        }
      },
    );
    this.callbacks.onNpcHudUpdate?.(npcSnapshots);

    this.scheduleNextTick();
  }

  public dispose(): void {
    this.disposed = true;
    this.fx.resetAll(true);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResizeBound);
    window.removeEventListener('orientationchange', this.handleResizeBound);
    document.removeEventListener('fullscreenchange', this.handleResizeBound);
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.handleContextLostBound,
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestoredBound,
    );

    this.leftHandAura?.dispose();
    this.rightHandAura?.dispose();
    this.leftFireAura?.dispose();
    this.rightFireAura?.dispose();
    this.phoenixWings?.dispose();
    this.rig.dispose();
    this.vfx.dispose();
    this.darkholdBook.dispose();
    this.scarletShield.dispose();
    this.phoenixVfx.dispose();
    this.emmaVfx.dispose();
    this.emmaIdleRings.dispose();
    this.helaVfx.dispose();
    this.magnetoVfx.dispose();
    this.quicksilverVfx.dispose();
    this.strangeVfx.dispose();
    this.visionVfx.dispose();
    this.landingDust.dispose();
    this.npcs.dispose();
    this.skyAtmosphere.dispose();
    this.windTrails.dispose();
    this.disposableGeometries.forEach((g) => g.dispose());
    this.disposableMaterials.forEach((m) => m.dispose());
    this.disposableTextures.forEach((t) => t.dispose());
    this.envRT.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
