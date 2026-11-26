import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  LANES,
  LaneIndex,
  BASE_SPEED,
  MID_SPEED,
  MAX_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  SLIDE_DURATION,
  ObstacleType,
  CollectibleType,
  ObstacleData,
  CollectibleData,
  GameStats,
} from './constants';
import {
  createAdBlockTexture,
  createCookieBannerTexture,
  createFirewallTexture,
  createSnowTexture,
  createContactShadowTexture,
  createDroneEyeTexture,
} from './proceduralAssets';
import { sounds } from '../audio/soundEffects';
import { FloakUnicorn } from './FloakUnicorn';

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean = false;
  private animFrameId: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  // Player state
  private playerLane: LaneIndex = 1; // 0: Left, 1: Center, 2: Right
  private playerX: number = 0;
  private playerY: number = 0;
  private playerZ: number = 0;
  private playerVelocityY: number = 0;
  private isJumping: boolean = false;
  private isSliding: boolean = false;
  private slideTimer: number = 0;
  private invulnerableTimer: number = 0;
  private scoreRemainder: number = 0;

  // Meshes & Character
  private playerGroup: THREE.Group;
  private unicorn!: FloakUnicorn;
  private shadowPlane!: THREE.Mesh;
  private shieldBubble!: THREE.Mesh;
  private rainbowTrail!: THREE.Points;

  // Track & Infinite Environment Chunks
  private trackGroup: THREE.Group;
  private auroraGroup: THREE.Group;
  private trackChunks: { group: THREE.Group; zCenter: number }[] = [];
  private readonly CHUNK_LENGTH = 160;
  private readonly NUM_CHUNKS = 5;

  // Dynamic Lighting
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  private obstacles: ObstacleData[] = [];
  private collectibles: CollectibleData[] = [];
  private nextSpawnZ: number = -30;
  private lastFreeLane: LaneIndex = 1;
  private nextObstacleId: number = 1;
  private nextCollectibleId: number = 1;

  // Particles
  private snowParticles!: THREE.Points;
  private hoofParticles!: THREE.Points;
  private hoofPositions!: Float32Array;
  private hoofLife!: Float32Array;

  // Cached materials & textures
  private adBlockTexture!: THREE.CanvasTexture;
  private cookieBannerTexture!: THREE.CanvasTexture;
  private firewallTexture!: THREE.CanvasTexture;
  private snowTexture!: THREE.CanvasTexture;
  private shadowTexture!: THREE.CanvasTexture;
  private droneEyeTexture!: THREE.CanvasTexture;

  // Stats
  private stats: GameStats = {
    score: 0,
    crystals: 0,
    distance: 0,
    highScore: 0,
    speed: BASE_SPEED,
    multiplier: 1,
    hasShield: false,
    magnetTimer: 0,
    boostTimer: 0,
    shieldTimer: 0,
  };

  private onStatsCallback?: (stats: GameStats) => void;
  private onGameOverCallback?: (stats: GameStats) => void;

  // Camera Shake
  private cameraShake: number = 0;
  private resizeObserver?: ResizeObserver;

  // Reusable vectors to avoid GC in loop
  private readonly _vec3A = new THREE.Vector3();
  private lastTime: number = 0;

  constructor(
    container: HTMLElement,
    onStats?: (stats: GameStats) => void,
    onGameOver?: (stats: GameStats) => void
  ) {
    this.container = container;
    this.onStatsCallback = onStats;
    this.onGameOverCallback = onGameOver;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // Scene & Camera - Deep arctic night sky with soft horizon fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1e36);
    this.scene.fog = new THREE.FogExp2(0x0c1e36, 0.0075);

    this.camera = new THREE.PerspectiveCamera(
      60,
      Math.max(0.3, container.clientWidth / Math.max(1, container.clientHeight)),
      0.1,
      380
    );
    this.updateCameraProjection(container.clientWidth, container.clientHeight);
    this.camera.position.set(0, 4.4, 8.5);

    // Setup RoomEnvironment for reflection
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // Lighting
    this.setupLighting();

    // Textures
    this.initTextures();

    // Scene groups
    this.trackGroup = new THREE.Group();
    this.auroraGroup = new THREE.Group();
    this.playerGroup = new THREE.Group();

    this.scene.add(this.trackGroup);
    this.scene.add(this.auroraGroup);
    this.scene.add(this.playerGroup);

    // Build components
    this.createInfiniteTrackAndScenery();
    this.createAurorasAndSky();
    this.createFallingSnow();
    this.createPlayerUnicorn();
    this.createHoofParticleSystem();

    // Event listeners (window resize, orientation change, and container ResizeObserver)
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(container);
    }

    // Initial render
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Adapts vertical FOV dynamically so all 3 lanes stay clearly visible
   * on narrow mobile portrait screens as well as widescreen desktop monitors.
   */
  private updateCameraProjection(width: number, height: number) {
    const safeH = Math.max(1, height);
    const aspect = width / safeH;
    this.camera.aspect = aspect;

    // On portrait/narrow viewports (aspect < 1.15), widen vertical FOV smoothly up to 80 deg
    if (aspect < 1.15) {
      const t = Math.min(1, Math.max(0, (1.15 - aspect) / 0.7));
      this.camera.fov = 60 + t * 20;
    } else {
      this.camera.fov = 60;
    }
    this.camera.updateProjectionMatrix();
  }

  private initTextures() {
    this.adBlockTexture = createAdBlockTexture();
    this.cookieBannerTexture = createCookieBannerTexture();
    this.firewallTexture = createFirewallTexture();
    this.snowTexture = createSnowTexture();
    this.shadowTexture = createContactShadowTexture();
    this.droneEyeTexture = createDroneEyeTexture();
  }

  private setupLighting() {
    // Dynamic Key Light with tight shadow bounds tracking the player
    this.keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    this.keyLight.position.set(10, 22, 15);
    this.keyLight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      this.keyLight.shadow.mapSize.width = 1024;
      this.keyLight.shadow.mapSize.height = 1024;
      this.keyLight.shadow.camera.near = 0.5;
      this.keyLight.shadow.camera.far = 70;
      this.keyLight.shadow.camera.left = -16;
      this.keyLight.shadow.camera.right = 16;
      this.keyLight.shadow.camera.top = 16;
      this.keyLight.shadow.camera.bottom = -16;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    // Cool winter ambient fill
    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0c1e36, 1.3);
    this.scene.add(this.hemiLight);

    // Back rim light for metallic edge shine
    this.rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.0);
    this.rimLight.position.set(-10, 16, -20);
    this.scene.add(this.rimLight);
    this.scene.add(this.rimLight.target);
  }

  /**
   * Builds the infinite looping track chunks (modular ground & roadside scenery)
   */
  private createInfiniteTrackAndScenery() {
    this.trackChunks = [];
    for (let i = 0; i < this.NUM_CHUNKS; i++) {
      const zCenter = 80 - i * this.CHUNK_LENGTH;
      const chunkGroup = this.buildChunkGroup();
      chunkGroup.position.z = zCenter;
      this.trackGroup.add(chunkGroup);
      this.trackChunks.push({ group: chunkGroup, zCenter });
    }
  }

  private buildChunkGroup(): THREE.Group {
    const chunkGroup = new THREE.Group();
    const len = this.CHUNK_LENGTH;

    // 1. Central 3-Lane Snowy Runway
    const groundGeo = new THREE.PlaneGeometry(16, len, 1, 16);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.1,
      map: this.snowTexture,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !this.isSoftwareGl;
    chunkGroup.add(ground);

    // 2. Wide Snowy Winter Plains (extending 80m left and 80m right)
    const sidePlainGeo = new THREE.PlaneGeometry(80, len, 1, 16);
    const sidePlainMat = new THREE.MeshStandardMaterial({
      color: 0xe2f1fc,
      roughness: 0.85,
      metalness: 0.05,
    });

    const leftPlain = new THREE.Mesh(sidePlainGeo, sidePlainMat);
    leftPlain.rotation.x = -Math.PI / 2;
    leftPlain.position.set(-48, -0.02, 0);
    leftPlain.receiveShadow = !this.isSoftwareGl;
    chunkGroup.add(leftPlain);

    const rightPlain = new THREE.Mesh(sidePlainGeo, sidePlainMat);
    rightPlain.rotation.x = -Math.PI / 2;
    rightPlain.position.set(48, -0.02, 0);
    rightPlain.receiveShadow = !this.isSoftwareGl;
    chunkGroup.add(rightPlain);

    // 3. Glowing Frosted Lane Dividers
    const laneDividerGeo = new THREE.BoxGeometry(0.08, 0.04, len);
    const laneDividerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    [-1.2, 1.2].forEach((x) => {
      const divider = new THREE.Mesh(laneDividerGeo, laneDividerMat);
      divider.position.set(x, 0.02, 0);
      chunkGroup.add(divider);
    });

    // 4. Outer Frosted Roadside Curbs
    const borderGeo = new THREE.BoxGeometry(0.3, 0.4, len);
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.3,
      metalness: 0.7,
    });
    [-4.2, 4.2].forEach((x) => {
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.position.set(x, 0.2, 0);
      chunkGroup.add(border);
    });

    // 5. Procedural Pine Trees along the roadside
    const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.5, 6);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x472d1c, roughness: 0.9 });
    const foliageTier1 = new THREE.ConeGeometry(1.8, 2.2, 7);
    const foliageTier2 = new THREE.ConeGeometry(1.4, 1.8, 7);
    const foliageTier3 = new THREE.ConeGeometry(0.9, 1.4, 7);
    const snowFoliageMat = new THREE.MeshStandardMaterial({ color: 0x1e3a34, roughness: 0.85 });
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, roughness: 0.6 });

    for (let lz = -70; lz <= 70; lz += 14) {
      // Left tree
      const treeL = this.createPineTree(treeTrunkGeo, treeTrunkMat, foliageTier1, foliageTier2, foliageTier3, snowFoliageMat, snowCapMat);
      treeL.position.set(-7.5 - Math.random() * 12, 0, lz + (Math.random() - 0.5) * 6);
      chunkGroup.add(treeL);

      // Right tree
      const treeR = this.createPineTree(treeTrunkGeo, treeTrunkMat, foliageTier1, foliageTier2, foliageTier3, snowFoliageMat, snowCapMat);
      treeR.position.set(7.5 + Math.random() * 12, 0, lz + (Math.random() - 0.5) * 6);
      chunkGroup.add(treeR);

      // Occasional glowing crystal stalagmite
      if (Math.random() > 0.45) {
        const crystalGeo = new THREE.ConeGeometry(0.48, 3.2, 5);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: 0x67e8f9,
          roughness: 0.1,
          metalness: 0.85,
          emissive: 0x083344,
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        const sideX = (Math.random() > 0.5 ? 1 : -1) * (5.5 + Math.random() * 4.0);
        crystal.position.set(sideX, 1.6, lz + 4);
        crystal.rotation.z = (Math.random() - 0.5) * 0.3;
        chunkGroup.add(crystal);
      }
    }

    // 6. Distant Low-Poly Snowy Mountain Peaks on the horizon flanks
    const mountainGeo = new THREE.ConeGeometry(18, 36, 5);
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x0f2942,
      roughness: 0.85,
      metalness: 0.2,
      flatShading: true,
    });
    const mtnCapGeo = new THREE.ConeGeometry(9, 18, 5);
    const mtnCapMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.5,
      flatShading: true,
    });

    [-58, 58].forEach((mx, idx) => {
      const mtnGroup = new THREE.Group();
      const mtn = new THREE.Mesh(mountainGeo, mountainMat);
      mtn.position.y = 18;
      mtnGroup.add(mtn);

      const mtnCap = new THREE.Mesh(mtnCapGeo, mtnCapMat);
      mtnCap.position.y = 27;
      mtnGroup.add(mtnCap);

      mtnGroup.position.set(mx, 0, (idx === 0 ? -35 : 35));
      chunkGroup.add(mtnGroup);
    });

    return chunkGroup;
  }

  private createPineTree(
    trunkGeo: THREE.BufferGeometry,
    trunkMat: THREE.Material,
    t1Geo: THREE.BufferGeometry,
    t2Geo: THREE.BufferGeometry,
    t3Geo: THREE.BufferGeometry,
    foliageMat: THREE.Material,
    snowMat: THREE.Material
  ): THREE.Group {
    const treeGroup = new THREE.Group();

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = !this.isSoftwareGl;
    treeGroup.add(trunk);

    const t1 = new THREE.Mesh(t1Geo, foliageMat);
    t1.position.y = 2.0;
    t1.castShadow = !this.isSoftwareGl;
    treeGroup.add(t1);

    const t2 = new THREE.Mesh(t2Geo, foliageMat);
    t2.position.y = 3.0;
    treeGroup.add(t2);

    const t3 = new THREE.Mesh(t3Geo, snowMat);
    t3.position.y = 3.9;
    treeGroup.add(t3);

    const scale = 0.85 + Math.random() * 0.45;
    treeGroup.scale.set(scale, scale, scale);
    return treeGroup;
  }

  /**
   * Endless Sky & Northern Lights (Aurora Borealis) that follow the player
   */
  private createAurorasAndSky() {
    // 3 Radiant Aurora Borealis ribbons
    for (let i = 0; i < 3; i++) {
      const auroraGeo = new THREE.PlaneGeometry(80, 22, 24, 4);
      const auroraMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0x22d3ee : i === 1 ? 0xa855f7 : 0x10b981,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
      });
      const aurora = new THREE.Mesh(auroraGeo, auroraMat);
      aurora.position.set((i - 1) * 18, 30 + i * 5, -i * 45);
      aurora.rotation.x = Math.PI / 4.5;
      this.auroraGroup.add(aurora);
    }

    // Twinkling arctic stars
    const starCount = 350;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 160;
      starPositions[i * 3 + 1] = 25 + Math.random() * 45;
      starPositions[i * 3 + 2] = -Math.random() * 200;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.35,
      transparent: true,
      opacity: 0.75,
    });
    const starField = new THREE.Points(starGeo, starMat);
    this.auroraGroup.add(starField);
  }

  private createFallingSnow() {
    const snowCount = 1500;
    const snowGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 48;
      positions[i * 3 + 1] = Math.random() * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }

    snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      transparent: true,
      opacity: 0.88,
    });

    this.snowParticles = new THREE.Points(snowGeo, snowMat);
    this.scene.add(this.snowParticles);
  }

  private createPlayerUnicorn() {
    // Articulated 3D Floak Unicorn facing forward down the track
    this.unicorn = new FloakUnicorn(this.isSoftwareGl);
    this.playerGroup.add(this.unicorn.group);

    // Contact shadow plane beneath the unicorn
    const shadowGeo = new THREE.PlaneGeometry(1.6, 2.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.set(0, 0.03, 0);
    this.playerGroup.add(this.shadowPlane);

    // Shield Bubble (invisible until acquired)
    const shieldGeo = new THREE.SphereGeometry(1.6, 24, 24);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      wireframe: true,
    });
    this.shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldBubble.position.set(0, 1.2, 0);
    this.shieldBubble.visible = false;
    this.playerGroup.add(this.shieldBubble);
  }

  private createHoofParticleSystem() {
    const count = 120;
    const geo = new THREE.BufferGeometry();
    this.hoofPositions = new Float32Array(count * 3);
    this.hoofLife = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.hoofPositions[i * 3] = 0;
      this.hoofPositions[i * 3 + 1] = -100;
      this.hoofPositions[i * 3 + 2] = 0;
      this.hoofLife[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.hoofPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xa5f3fc,
      size: 0.14,
      transparent: true,
      opacity: 0.7,
    });

    this.hoofParticles = new THREE.Points(geo, mat);
    this.scene.add(this.hoofParticles);
  }

  // --- Obstacle & Collectible Spawners ---

  private spawnPattern(atZ: number, isInitialWave: boolean = false) {
    // Pick a guaranteed completely clear escape lane at most 1 lane away from the previous safe lane
    // so the player is never trapped by a 3-lane blockade or impossible 2-lane jump.
    const candidateFreeLanes: LaneIndex[] = ([0, 1, 2] as LaneIndex[]).filter(
      (l) => Math.abs(l - this.lastFreeLane) <= 1
    );
    const freeLane = candidateFreeLanes[Math.floor(Math.random() * candidateFreeLanes.length)];
    this.lastFreeLane = freeLane;

    const blockedCandidates = ([0, 1, 2] as LaneIndex[]).filter((l) => l !== freeLane);
    // Shuffle the two remaining lanes
    const laneA = Math.random() > 0.5 ? blockedCandidates[0] : blockedCandidates[1];
    const laneB = blockedCandidates[0] === laneA ? blockedCandidates[1] : blockedCandidates[0];

    // Progressive difficulty factor based on distance run (0.0 at start -> 1.0 at 2600m)
    const difficulty = isInitialWave ? 0 : Math.min(1.0, Math.max(0, -atZ) / 2600);

    // Check if an already-spawned Drone's flight path crosses this wave (z <= atZ + 35)
    const crossingDrone = this.obstacles.find(
      (o) => o.type === ObstacleType.ONCOMING_DRONE && o.z <= atZ + 35
    );

    if (crossingDrone) {
      // A drone is actively flying through this Z-zone!
      // Keep the drone's own lane AND at least one flanking lane free of banners/walls
      // so a drone can NEVER fly between two banners or trap the player.
      const safeStaticLane = blockedCandidates.find((l) => l !== crossingDrone.lane);
      if (safeStaticLane !== undefined && Math.random() > 0.25) {
        if (Math.random() > 0.5) {
          this.spawnAdBlocker(safeStaticLane, atZ);
        } else {
          this.spawnTrackingBarrier(safeStaticLane, atZ);
        }
        this.spawnCrystalArc(safeStaticLane, atZ);
      }
      this.spawnCrystalLine(freeLane, atZ - 4, 4);
      return;
    }

    // Probability of filling the second blocked lane (increases from ~35% at start to ~92% late-game)
    const doubleObstacleChance = 0.35 + difficulty * 0.57;
    const useDoubleObstacle = !isInitialWave && Math.random() < doubleObstacleChance;

    // Helper: ensure a newly spawned Drone won't fly through an existing 2-lane obstacle/banner corridor
    const canSpawnDroneOn = (dLane: LaneIndex): boolean => {
      const occupiedOther = new Set<LaneIndex>();
      for (const o of this.obstacles) {
        if (o.lane !== dLane && o.z >= atZ - 95 && o.z <= atZ + 35) {
          occupiedOther.add(o.lane);
        }
      }
      return occupiedOther.size < 2;
    };

    // On initial opening wave, avoid spawning oncoming threats right in the player's face
    const maxPatterns = isInitialWave ? 5 : 10;
    let patternType = Math.floor(Math.random() * maxPatterns);

    // If pattern calls for a Drone, ensure its corridor isn't flanked by 2 obstacle lanes
    let droneLane: LaneIndex | null = null;
    if (patternType === 6 || patternType === 7) {
      if (canSpawnDroneOn(laneA)) {
        droneLane = laneA;
      } else if (canSpawnDroneOn(laneB)) {
        droneLane = laneB;
      } else {
        // Corridor already has obstacles on multiple lanes -> switch to non-drone pattern
        patternType = 3;
      }
    }

    if (patternType === 0) {
      // AdBlocker(s): 1 early, 2 as distance increases, with jump crystal arcs
      this.spawnAdBlocker(laneA, atZ);
      this.spawnCrystalArc(laneA, atZ);
      if (useDoubleObstacle) {
        this.spawnAdBlocker(laneB, atZ);
        this.spawnCrystalArc(laneB, atZ);
      } else {
        this.spawnCrystalLine(laneB, atZ - 4, 4);
      }
      this.spawnCrystalLine(freeLane, atZ - 4, 4);
    } else if (patternType === 1) {
      // Cookie Banner + optional second lane obstacle at higher distance
      this.spawnCookieBanner(laneA, atZ);
      this.spawnCrystalLine(laneA, atZ - 3, 3, 0.4);
      if (useDoubleObstacle) {
        this.spawnAdBlocker(laneB, atZ);
        this.spawnCrystalArc(laneB, atZ);
      }
      this.spawnCrystalLine(freeLane, atZ - 4, 4);
    } else if (patternType === 2) {
      // Two 404 Ice Firewalls on laneA & laneB; freeLane is 100% open (rarer power-ups!)
      this.spawnFirewall(laneA, atZ);
      this.spawnFirewall(laneB, atZ);
      if (Math.random() > 0.72) {
        this.spawnPowerUp(freeLane, atZ);
      } else {
        this.spawnGoldClick(freeLane, atZ);
      }
    } else if (patternType === 3) {
      // Two AdBlockers on laneA & laneB with jump crystal arcs; freeLane open with crystals
      this.spawnAdBlocker(laneA, atZ);
      this.spawnCrystalArc(laneA, atZ);
      this.spawnAdBlocker(laneB, atZ);
      this.spawnCrystalArc(laneB, atZ);
      this.spawnCrystalLine(freeLane, atZ - 4, 3);
    } else if (patternType === 4) {
      // Tracking barrier laser hurdle(s) with jump crystal arcs
      this.spawnTrackingBarrier(laneA, atZ);
      this.spawnCrystalArc(laneA, atZ);
      if (useDoubleObstacle) {
        this.spawnTrackingBarrier(laneB, atZ);
        this.spawnCrystalArc(laneB, atZ);
      }
      this.spawnCrystalLine(freeLane, atZ - 4, 3);
    } else if (patternType === 5) {
      // Firewall + Tracking Barrier / Crystals; freeLane 100% open
      this.spawnFirewall(laneA, atZ);
      if (useDoubleObstacle) {
        this.spawnTrackingBarrier(laneB, atZ);
        this.spawnCrystalArc(laneB, atZ);
      } else {
        this.spawnCrystalLine(laneB, atZ - 4, 4);
      }
      this.spawnCrystalLine(freeLane, atZ - 4, 4);
    } else if (patternType === 6 && droneLane !== null) {
      // ONCOMING THREAT: Hovering Firewall Drone on droneLane + optional low AdBlocker on other lane (never a Banner/Firewall!)
      const otherBlockedLane = droneLane === laneA ? laneB : laneA;
      this.spawnOncomingDrone(droneLane, atZ, difficulty);
      if (useDoubleObstacle || Math.random() > 0.35) {
        this.spawnAdBlocker(otherBlockedLane, atZ);
        this.spawnCrystalArc(otherBlockedLane, atZ);
      } else if (Math.random() > 0.65) {
        this.spawnPowerUp(otherBlockedLane, atZ);
      }
      this.spawnCrystalLine(freeLane, atZ - 4, 4);
    } else if (patternType === 7 && droneLane !== null) {
      // Paired oncoming Drone + low Tracking Barrier (never flanking Banners/Firewalls); freeLane always 100% open!
      const otherBlockedLane = droneLane === laneA ? laneB : laneA;
      this.spawnOncomingDrone(droneLane, atZ, difficulty);
      this.spawnTrackingBarrier(otherBlockedLane, atZ);
      this.spawnCrystalArc(otherBlockedLane, atZ);
      this.spawnCrystalLine(freeLane, atZ - 4, 4);
    } else if (patternType === 8) {
      // High-intensity: Firewall on laneA + Cookie Banner or Tracking Barrier on laneB; freeLane open!
      this.spawnFirewall(laneA, atZ);
      if (Math.random() > 0.45) {
        this.spawnCookieBanner(laneB, atZ);
      } else {
        this.spawnTrackingBarrier(laneB, atZ);
        this.spawnCrystalArc(laneB, atZ);
      }
      this.spawnCrystalLine(freeLane, atZ - 4, 3);
    } else {
      // Cookie Banner + AdBlocker or Tracking Barrier while freeLane stays 100% clear!
      this.spawnCookieBanner(laneA, atZ);
      if (Math.random() > 0.5) {
        this.spawnTrackingBarrier(laneB, atZ);
      } else {
        this.spawnAdBlocker(laneB, atZ);
      }
      this.spawnCrystalArc(laneB, atZ);
      this.spawnCrystalLine(freeLane, atZ - 4, 4);
    }
  }

  private spawnAdBlocker(lane: LaneIndex, z: number) {
    const group = new THREE.Group();

    // Octagonal stop sign face
    const signGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.08, 8);
    const signMat = new THREE.MeshStandardMaterial({
      map: this.adBlockTexture,
      roughness: 0.3,
      metalness: 0.5,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.rotation.x = Math.PI / 2;
    sign.rotation.z = Math.PI / 8;
    sign.position.y = 1.05;
    sign.castShadow = !this.isSoftwareGl;
    group.add(sign);

    // Chrome post
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.2,
    });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 0.55;
    group.add(post);

    // Flashing red warning light on top
    const lightGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const redLight = new THREE.Mesh(lightGeo, lightMat);
    redLight.position.y = 1.95;
    group.add(redLight);

    group.position.set(LANES[lane], 0, z);
    this.scene.add(group);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: ObstacleType.ADBLOCK_SHIELD,
      lane,
      z,
      width: 1.6,
      height: 1.2,
      minY: 0,
      maxY: 1.15,
      meshGroup: group,
    });
  }

  private spawnCookieBanner(lane: LaneIndex, z: number) {
    const group = new THREE.Group();

    // 2 Side posts
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.8,
      roughness: 0.2,
    });

    const postL = new THREE.Mesh(postGeo, postMat);
    postL.position.set(-1.15, 1.6, 0);
    group.add(postL);

    const postR = new THREE.Mesh(postGeo, postMat);
    postR.position.set(1.15, 1.6, 0);
    group.add(postR);

    // Overhead Banner Box
    const bannerGeo = new THREE.BoxGeometry(2.35, 1.1, 0.15);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: this.cookieBannerTexture,
      roughness: 0.2,
      metalness: 0.4,
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 2.05, 0); // Bottom is at 1.5, allowing ducking/sliding!
    banner.castShadow = !this.isSoftwareGl;
    group.add(banner);

    group.position.set(LANES[lane], 0, z);
    this.scene.add(group);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: ObstacleType.COOKIE_BANNER,
      lane,
      z,
      width: 2.3,
      height: 1.5,
      minY: 1.1, // Clearance underneath is 1.1 - sliding player is 0.6 tall!
      maxY: 2.7,
      meshGroup: group,
    });
  }

  private spawnFirewall(lane: LaneIndex, z: number) {
    const group = new THREE.Group();

    // Massive 404 Ice Firewall
    const wallGeo = new THREE.BoxGeometry(2.1, 3.4, 0.2);
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.firewallTexture,
      transparent: true,
      opacity: 0.92,
      roughness: 0.1,
      metalness: 0.8,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 1.7;
    wall.castShadow = !this.isSoftwareGl;
    group.add(wall);

    group.position.set(LANES[lane], 0, z);
    this.scene.add(group);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: ObstacleType.FIREWALL_404,
      lane,
      z,
      width: 2.0,
      height: 3.5,
      minY: 0,
      maxY: 3.5,
      meshGroup: group,
    });
  }

  private spawnTrackingBarrier(lane: LaneIndex, z: number) {
    const group = new THREE.Group();

    // Two low warning cones / pylons
    const pylonGeo = new THREE.ConeGeometry(0.2, 0.8, 8);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4,
    });

    const pylon1 = new THREE.Mesh(pylonGeo, pylonMat);
    pylon1.position.set(-0.85, 0.4, 0);
    group.add(pylon1);

    const pylon2 = new THREE.Mesh(pylonGeo, pylonMat);
    pylon2.position.set(0.85, 0.4, 0);
    group.add(pylon2);

    // Glowing laser beam between them
    const laserGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.7, 8);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.rotation.z = Math.PI / 2;
    laser.position.set(0, 0.45, 0);
    group.add(laser);

    group.position.set(LANES[lane], 0, z);
    this.scene.add(group);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: ObstacleType.TRACKING_BARRIER,
      lane,
      z,
      width: 1.7,
      height: 0.9,
      minY: 0,
      maxY: 0.85,
      meshGroup: group,
    });
  }

  private spawnOncomingDrone(lane: LaneIndex, z: number, difficulty: number = 0) {
    const group = new THREE.Group();

    // Hover Drone Body
    const bodyGeo = new THREE.SphereGeometry(0.42, 14, 14);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.92,
      roughness: 0.15,
      emissive: 0x1e1b4b,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1.2, 0.7, 1.2);
    body.position.y = 1.95;
    group.add(body);

    // Front targeting eye visor (facing +Z towards player!)
    const eyeGeo = new THREE.PlaneGeometry(0.48, 0.48);
    const eyeMat = new THREE.MeshBasicMaterial({
      map: this.droneEyeTexture,
      transparent: true,
    });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 1.95, 0.46);
    group.add(eye);

    // 4 Quadcopter Rotor Arms
    const rotorsGroup = new THREE.Group();
    rotorsGroup.name = 'rotors';
    rotorsGroup.position.set(0, 1.95, 0);

    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
    const arm1 = new THREE.Mesh(armGeo, armMat);
    arm1.rotation.z = Math.PI / 4;
    const arm2 = new THREE.Mesh(armGeo, armMat);
    arm2.rotation.z = -Math.PI / 4;
    rotorsGroup.add(arm1, arm2);

    // Rotor spinning discs at arm tips
    const rotorBladeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.02, 8);
    const rotorBladeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
    });
    [[-0.64, 0.64], [0.64, 0.64], [-0.64, -0.64], [0.64, -0.64]].forEach(([rx, ry]) => {
      const blade = new THREE.Mesh(rotorBladeGeo, rotorBladeMat);
      blade.position.set(rx, ry, 0);
      rotorsGroup.add(blade);
    });
    group.add(rotorsGroup);

    // Red downward targeting beam (cone)
    const beamGeo = new THREE.ConeGeometry(0.65, 1.8, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 1.0;
    group.add(beam);

    // Speed: moves along +Z towards player, scaling faster at higher distance
    const moveSpeed = 16 + difficulty * 6 + Math.random() * 5;
    const playerSpeed = Math.max(BASE_SPEED, this.stats?.speed || BASE_SPEED);
    const timeToMeet = Math.max(0.6, (this.playerZ - z) / playerSpeed);
    const spawnZ = z - moveSpeed * timeToMeet;

    group.position.set(LANES[lane], 0, spawnZ);
    this.scene.add(group);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: ObstacleType.ONCOMING_DRONE,
      lane,
      z: spawnZ,
      width: 1.9,
      height: 1.5,
      minY: 1.25, // Clearance underneath is 1.25 -> can slide!
      maxY: 2.7,
      speed: moveSpeed,
      meshGroup: group,
    });
  }

  private spawnCrystalLine(lane: LaneIndex, startZ: number, count: number, y: number = 0.8) {
    for (let i = 0; i < count; i++) {
      this.spawnCrystal(lane, startZ - i * 3.5, y);
    }
  }

  private spawnCrystalArc(lane: LaneIndex, centerZ: number) {
    // Only spawn jump-arc diamonds on 10% of jump hurdles
    if (Math.random() >= 0.1) return;

    const offsets = [-7.5, -3.75, 0, 3.75, 7.5];
    const heights = [1.2, 2.35, 2.9, 2.35, 1.2];
    offsets.forEach((off, idx) => {
      this.spawnCrystal(lane, centerZ + off, heights[idx]);
    });
  }

  private spawnCrystal(lane: LaneIndex, z: number, y: number = 0.8) {
    const group = new THREE.Group();

    // Cyan glowing octahedron crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.32);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.9,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    group.add(crystal);

    group.position.set(LANES[lane], y, z);
    this.scene.add(group);

    this.collectibles.push({
      id: this.nextCollectibleId++,
      type: CollectibleType.CRYSTAL,
      lane,
      z,
      y,
      meshGroup: group,
      collected: false,
    });
  }

  private spawnGoldClick(lane: LaneIndex, z: number) {
    const group = new THREE.Group();

    const starGeo = new THREE.IcosahedronGeometry(0.42);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.7,
      metalness: 0.9,
      roughness: 0.15,
    });
    const star = new THREE.Mesh(starGeo, starMat);
    group.add(star);

    group.position.set(LANES[lane], 1.2, z);
    this.scene.add(group);

    this.collectibles.push({
      id: this.nextCollectibleId++,
      type: CollectibleType.GOLD_CLICK,
      lane,
      z,
      y: 1.2,
      meshGroup: group,
      collected: false,
    });
  }

  private spawnPowerUp(lane: LaneIndex, z: number) {
    const group = new THREE.Group();
    const r = Math.random();
    // Shields are significantly rarer (~12% chance, and 0% if player already has one active)
    let pType: CollectibleType;
    if (!this.stats.hasShield && r < 0.12) {
      pType = CollectibleType.POWERUP_SHIELD;
    } else if (r < 0.58) {
      pType = CollectibleType.POWERUP_MAGNET;
    } else {
      pType = CollectibleType.POWERUP_BOOST;
    }

    // Glowing orb container
    const orbGeo = new THREE.SphereGeometry(0.48, 16, 16);
    let color = 0xef4444;
    if (pType === CollectibleType.POWERUP_SHIELD) color = 0x38bdf8;
    if (pType === CollectibleType.POWERUP_BOOST) color = 0xa855f7;

    const orbMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    group.add(orb);

    group.position.set(LANES[lane], 1.3, z);
    this.scene.add(group);

    this.collectibles.push({
      id: this.nextCollectibleId++,
      type: pType,
      lane,
      z,
      y: 1.3,
      meshGroup: group,
      collected: false,
    });
  }

  // --- Input Handlers ---

  public moveLeft() {
    if (!this.isRunning || this.isPaused) return;
    if (this.playerLane > 0) {
      this.playerLane = (this.playerLane - 1) as LaneIndex;
      sounds.playLaneSwitch();
    }
  }

  public moveRight() {
    if (!this.isRunning || this.isPaused) return;
    if (this.playerLane < 2) {
      this.playerLane = (this.playerLane + 1) as LaneIndex;
      sounds.playLaneSwitch();
    }
  }

  public jump() {
    if (!this.isRunning || this.isPaused) return;
    if (!this.isJumping) {
      this.isJumping = true;
      this.isSliding = false;
      this.playerVelocityY = JUMP_VELOCITY;
      sounds.playJump();
    }
  }

  public slide() {
    if (!this.isRunning || this.isPaused) return;
    // In Subway Surfers, if in the air, sliding makes you fast-drop immediately!
    if (this.isJumping) {
      this.playerVelocityY = -GRAVITY * 0.9;
    }
    this.isSliding = true;
    this.slideTimer = SLIDE_DURATION;
    sounds.playSlide();
  }

  public startGame() {
    // Reset all gameplay variables
    this.playerLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.playerVelocityY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.invulnerableTimer = 0;
    this.scoreRemainder = 0;
    this.nextSpawnZ = -30;

    // Reset stats
    this.stats = {
      score: 0,
      crystals: 0,
      distance: 0,
      highScore: this.stats.highScore,
      speed: BASE_SPEED,
      multiplier: 1,
      hasShield: false,
      magnetTimer: 0,
      boostTimer: 0,
      shieldTimer: 0,
      reasonForDeath: undefined,
    };

    // Reset infinite track chunks
    this.trackChunks.forEach((chunk, idx) => {
      chunk.zCenter = 80 - idx * this.CHUNK_LENGTH;
      chunk.group.position.z = chunk.zCenter;
    });

    // Clean existing obstacles & collectibles
    this.obstacles.forEach((o) => this.scene.remove(o.meshGroup));
    this.obstacles = [];
    this.collectibles.forEach((c) => this.scene.remove(c.meshGroup));
    this.collectibles = [];
    this.lastFreeLane = 1;

    // Pre-spawn first few segments cleanly spaced, starting further down the runway
    this.spawnCrystalLine(1, -35, 4);
    for (let z = -85; z >= -225; z -= 35) {
      this.spawnPattern(z, z > -115);
    }
    this.nextSpawnZ = -260;

    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    sounds.startBgm();

    if (!this.animFrameId) {
      this.loop(this.lastTime);
    }
  }

  public pauseGame() {
    this.isPaused = true;
  }

  public resumeGame() {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  private triggerGameOver(reason: string) {
    this.isRunning = false;
    sounds.stopBgm();
    sounds.playHit();
    this.cameraShake = 0.6;
    this.stats.reasonForDeath = reason;

    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
    }

    if (this.onGameOverCallback) {
      this.onGameOverCallback({ ...this.stats });
    }
  }

  // --- Main Game Loop ---

  private loop = (time: number) => {
    this.animFrameId = requestAnimationFrame(this.loop);

    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    if (this.isRunning && !this.isPaused) {
      this.update(delta, time / 1000);
    }

    this.render(time / 1000);
  };

  private update(delta: number, elapsedSec: number) {
    // Current speed calculation (boost increases speed)
    const boostActive = this.stats.boostTimer > 0;
    const currentSpeed = (this.stats.speed + (boostActive ? 12 : 0));

    // Move player forward
    const forwardDistance = currentSpeed * delta;
    this.playerZ -= forwardDistance;
    this.stats.distance = Math.floor(-this.playerZ);

    // Score accumulation from running distance (framerate-independent via remainder)
    const scoreMultiplier = (boostActive ? 2 : 1) * this.stats.multiplier;
    const rawScoreGain = forwardDistance * scoreMultiplier * 1.5 + this.scoreRemainder;
    const wholeScoreGain = Math.floor(rawScoreGain);
    this.scoreRemainder = rawScoreGain - wholeScoreGain;
    this.stats.score += wholeScoreGain;

    // Langsamere, gleichmäßige Tempo-Steigerung:
    // Erreicht bei ca. 20.000 Punkten ~50 km/h und steigt danach weiter bis 68 km/h.
    const scoreProgress = this.stats.score / 20000;
    const distProgress = this.stats.distance / 11500;
    const pace = Math.max(scoreProgress, distProgress);

    const primaryProgress = Math.min(1.0, pace);
    const speedCurve = BASE_SPEED + primaryProgress * (MID_SPEED - BASE_SPEED);
    const excessProgress = Math.max(0, pace - 1.0);
    const extraSpeed = Math.min(
      MAX_SPEED - MID_SPEED,
      (excessProgress / 1.5) * (MAX_SPEED - MID_SPEED)
    );
    this.stats.speed = Math.min(MAX_SPEED, speedCurve + extraSpeed);

    // Power-up timers countdown
    if (this.stats.magnetTimer > 0) {
      this.stats.magnetTimer = Math.max(0, this.stats.magnetTimer - delta);
    }
    if (this.stats.boostTimer > 0) {
      this.stats.boostTimer = Math.max(0, this.stats.boostTimer - delta);
    }
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - delta);
    }

    // Lane switching with smooth exponential damping
    const targetX = LANES[this.playerLane];
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 16, delta);

    // Jumping physics
    if (this.isJumping) {
      this.playerY += this.playerVelocityY * delta;
      this.playerVelocityY -= GRAVITY * delta;

      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerVelocityY = 0;
        this.isJumping = false;
      }
    }

    // Sliding duration
    if (this.isSliding) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // Update Player group position & animations
    this.playerGroup.position.set(this.playerX, 0, this.playerZ);

    // Update Floak Unicorn gallop, posture, and forward orientation
    const laneOffset = targetX - this.playerX;
    this.unicorn.group.position.y = 1.15 + this.playerY;
    this.unicorn.update(
      delta,
      currentSpeed,
      this.isJumping,
      this.isSliding,
      laneOffset,
      elapsedSec
    );

    // Shadow plane scaling with jump height
    const shadowScale = Math.max(0.3, 1.0 - this.playerY * 0.25);
    this.shadowPlane.scale.set(shadowScale, shadowScale, 1.0);
    const shadowMat = this.shadowPlane.material as THREE.MeshBasicMaterial;
    shadowMat.opacity = Math.max(0.15, 0.55 - this.playerY * 0.15);

    // Shield visual status
    this.shieldBubble.visible = this.stats.hasShield;
    if (this.stats.hasShield) {
      this.shieldBubble.rotation.y += delta * 2.0;
      this.shieldBubble.position.y = 1.2 + this.playerY * 0.6;
    }

    // Update hoof particle trail
    this.updateHoofParticles(delta);

    // Spawn new obstacles & collectibles ahead:
    // Wave spacing tightens progressively the longer the player runs (more obstacles per second!)
    const distanceFactor = Math.min(1.0, Math.max(0, -this.playerZ) / 2800);
    const targetReactionSec = 0.92 - distanceFactor * 0.42; // 0.92s early -> 0.50s late-game
    const minWaveGap = Math.max(24, currentSpeed * targetReactionSec);
    const randomPadding = Math.random() * (7 - distanceFactor * 4.5);

    if (this.playerZ - 145 < this.nextSpawnZ) {
      this.spawnPattern(this.nextSpawnZ, false);
      this.nextSpawnZ -= minWaveGap + randomPadding;
    }

    // Clean up passed obstacles and check collisions
    this.updateObstaclesAndCollisions(delta);

    // Magnet and collectibles update
    this.updateCollectibles(delta);

    // Endless track chunk recycling
    this.updateInfiniteTrack();

    // Notify React HUD
    if (this.onStatsCallback) {
      this.onStatsCallback({ ...this.stats });
    }
  }

  /**
   * Recycles passed track chunks ahead of the player, ensuring the winter world never ends
   */
  private updateInfiniteTrack() {
    for (let i = 0; i < this.trackChunks.length; i++) {
      const chunk = this.trackChunks[i];
      // If the back edge of this chunk is comfortably behind the camera/player (+80)
      if (chunk.zCenter - this.CHUNK_LENGTH / 2 > this.playerZ + 80) {
        // Find current furthest forward chunk (lowest zCenter)
        let minZ = chunk.zCenter;
        for (const c of this.trackChunks) {
          if (c.zCenter < minZ) minZ = c.zCenter;
        }
        chunk.zCenter = minZ - this.CHUNK_LENGTH;
        chunk.group.position.z = chunk.zCenter;
      }
    }
  }

  private updateHoofParticles(delta: number) {
    const count = this.hoofLife.length;
    // Spawn 2 new particles per frame behind galloping hooves
    for (let k = 0; k < 2; k++) {
      const idx = Math.floor(Math.random() * count);
      this.hoofLife[idx] = 0.45;
      const hoofSide = Math.random() > 0.5 ? 0.22 : -0.22;
      this.hoofPositions[idx * 3] = this.playerX + hoofSide + (Math.random() - 0.5) * 0.08;
      this.hoofPositions[idx * 3 + 1] = Math.max(0.05, this.playerY + 0.08);
      this.hoofPositions[idx * 3 + 2] = this.playerZ + 0.65 + Math.random() * 0.2;
    }

    for (let i = 0; i < count; i++) {
      if (this.hoofLife[i] > 0) {
        this.hoofLife[i] -= delta;
        this.hoofPositions[i * 3 + 1] += delta * 0.45;
        this.hoofPositions[i * 3 + 2] += delta * 2.2;
        if (this.hoofLife[i] <= 0) {
          this.hoofPositions[i * 3 + 1] = -100;
        }
      }
    }
    this.hoofParticles.geometry.attributes.position.needsUpdate = true;
  }

  private updateObstaclesAndCollisions(delta: number) {
    const playerZ = this.playerZ;
    const playerX = this.playerX;
    const playerY = this.playerY;
    const isSliding = this.isSliding;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];

      // Update position of oncoming obstacles traveling towards player
      if (obs.speed) {
        const nextZ = obs.z + obs.speed * delta;

        // Runtime Anti-Blockade Safeguard:
        // Never allow an oncoming drone to fly into a 26m Z-window where both other lanes
        // have obstacles/banners that haven't been passed by the player yet.
        let shouldHold = false;
        const blockedOtherLanes = new Set<LaneIndex>();
        for (let j = 0; j < this.obstacles.length; j++) {
          const other = this.obstacles[j];
          if (other.id === obs.id) continue;
          // Keep counting static obstacles until player has completely passed them (+2m past)
          if (other.z > playerZ + 2) continue;

          // Never overlap another obstacle ahead on the exact same lane (between obs and player)
          if (other.lane === obs.lane && other.z >= obs.z && other.z < nextZ + 14) {
            shouldHold = true;
            break;
          }

          if (other.lane !== obs.lane && Math.abs(other.z - nextZ) < 26) {
            blockedOtherLanes.add(other.lane);
          }
        }

        if (blockedOtherLanes.size >= 2) {
          shouldHold = true;
        }

        if (!shouldHold) {
          obs.z = nextZ;
          obs.meshGroup.position.z = obs.z;
        }

        // Animate moving components
        if (obs.type === ObstacleType.ONCOMING_DRONE) {
          const rotors = obs.meshGroup.getObjectByName('rotors');
          if (rotors) rotors.rotation.z += delta * 24;
          obs.meshGroup.position.y = 1.95 + Math.sin(obs.z * 0.25) * 0.18;
        }

        // Proximity warning sound if approaching fast
        const distToPlayer = obs.z - playerZ;
        if (distToPlayer > -35 && distToPlayer < -25 && !obs.animTime) {
          obs.animTime = 1;
          sounds.playOncomingWarning();
        }
      }

      // Remove obstacles far behind player
      if (obs.z > playerZ + 15) {
        this.scene.remove(obs.meshGroup);
        this.obstacles.splice(i, 1);
        continue;
      }

      // Check collision box: within Z depth
      const zDiff = Math.abs(obs.z - playerZ);
      if (zDiff < (obs.speed ? 1.25 : 1.1)) {
        const laneX = LANES[obs.lane];
        const xDiff = Math.abs(laneX - playerX);

        if (xDiff < 0.95) {
          // Player is horizontally aligned with the obstacle!
          // Check vertical / posture clearance:
          let collides = false;
          let hitReason = 'Kollision mit Hindernis!';

          if (obs.type === ObstacleType.ADBLOCK_SHIELD) {
            hitReason = 'Vom AdBlocker gestoppt! Springe drüber oder weiche aus.';
            // Jump clears if playerY > 1.05
            if (playerY < 1.05) {
              collides = true;
            }
          } else if (obs.type === ObstacleType.COOKIE_BANNER) {
            hitReason = 'Im Cookie-Banner hängengeblieben! Ducke dich / slide unten durch.';
            // Banner spans from Y=1.1 to 2.7.
            // If player is sliding (height ~0.5) and playerY < 0.4 -> clear!
            if (!isSliding || playerY > 0.4) {
              collides = true;
            }
          } else if (obs.type === ObstacleType.FIREWALL_404) {
            hitReason = '404 Firewall Blockade! Wechsle rechtzeitig die Spur.';
            collides = true;
          } else if (obs.type === ObstacleType.TRACKING_BARRIER) {
            hitReason = 'Tracking-Barriere berührt! Springe über die Laser-Schranke.';
            if (playerY < 0.8) {
              collides = true;
            }
          } else if (obs.type === ObstacleType.ONCOMING_DRONE) {
            hitReason = 'Von der anfliegenden Firewall-Drohne erfasst! Ducke dich / slide drunter oder wechsle die Spur.';
            if (!isSliding || playerY > 0.4) {
              collides = true;
            }
          }

          if (collides && this.invulnerableTimer <= 0) {
            if (this.stats.hasShield) {
              // Shield absorbs the hit!
              this.stats.hasShield = false;
              this.invulnerableTimer = 1.0;
              this.cameraShake = 0.35;
              sounds.playShieldBreak();
              // Remove the hit obstacle
              this.scene.remove(obs.meshGroup);
              this.obstacles.splice(i, 1);
            } else if (this.stats.boostTimer > 0) {
              // Boost mode crushes through obstacles!
              this.cameraShake = 0.2;
              sounds.playShieldBreak();
              this.scene.remove(obs.meshGroup);
              this.obstacles.splice(i, 1);
            } else {
              this.triggerGameOver(hitReason);
              return;
            }
          }
        }
      }
    }
  }

  private updateCollectibles(delta: number) {
    const playerZ = this.playerZ;
    const playerX = this.playerX;
    const playerY = this.playerY;
    const hasMagnet = this.stats.magnetTimer > 0;

    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];

      // Remove passed collectibles
      if (c.z > playerZ + 15) {
        this.scene.remove(c.meshGroup);
        this.collectibles.splice(i, 1);
        continue;
      }

      // Rotate crystal / orb
      c.meshGroup.rotation.y += delta * 3.0;

      // Magnetic pull towards unicorn
      const zDiff = Math.abs(c.z - playerZ);
      const laneX = LANES[c.lane];
      const xDiff = Math.abs(laneX - playerX);

      if (hasMagnet && zDiff < 20 && c.z < playerZ) {
        // Fly towards player
        c.meshGroup.position.x = THREE.MathUtils.damp(
          c.meshGroup.position.x,
          playerX,
          10,
          delta
        );
        c.meshGroup.position.y = THREE.MathUtils.damp(
          c.meshGroup.position.y,
          playerY + 1.1,
          10,
          delta
        );
        c.meshGroup.position.z = THREE.MathUtils.damp(
          c.meshGroup.position.z,
          playerZ,
          10,
          delta
        );
      }

      // Collection detection (accounts for full jumping unicorn body height & high-speed Z sweep)
      const dx = Math.abs(c.meshGroup.position.x - playerX);
      const dz = Math.abs(c.meshGroup.position.z - playerZ);
      const cy = c.meshGroup.position.y;
      const inJumpBodyReach = cy >= playerY - 0.5 && cy <= playerY + 2.65;

      const curDist = this._vec3A.set(
        c.meshGroup.position.x - playerX,
        c.meshGroup.position.y - (playerY + 1.1),
        c.meshGroup.position.z - playerZ
      ).length();

      if (((dx < 1.25 && dz < 1.65 && inJumpBodyReach) || curDist < 1.45) && !c.collected) {
        c.collected = true;
        this.scene.remove(c.meshGroup);
        this.collectibles.splice(i, 1);

        // Apply item effect
        if (c.type === CollectibleType.CRYSTAL) {
          this.stats.crystals += 1;
          this.stats.score += 20 * (this.stats.boostTimer > 0 ? 2 : 1);
          sounds.playCollect(this.stats.crystals);
        } else if (c.type === CollectibleType.GOLD_CLICK) {
          this.stats.crystals += 5;
          this.stats.score += 100 * (this.stats.boostTimer > 0 ? 2 : 1);
          sounds.playPowerUp();
        } else if (c.type === CollectibleType.POWERUP_SHIELD) {
          this.stats.hasShield = true;
          sounds.playPowerUp();
        } else if (c.type === CollectibleType.POWERUP_MAGNET) {
          this.stats.magnetTimer = 8.0;
          sounds.playPowerUp();
        } else if (c.type === CollectibleType.POWERUP_BOOST) {
          this.stats.boostTimer = 6.0;
          sounds.playPowerUp();
        }
      }
    }
  }

  private render(time: number) {
    // Dynamic camera follow behind forward-facing galloping unicorn
    // Slightly pull back on portrait mobile viewports so outer lanes remain comfortable to read
    const portraitFactor = this.camera.aspect < 1.0 ? Math.min(1, (1.0 - this.camera.aspect) / 0.55) : 0;
    const camDistZ = 6.8 + portraitFactor * 1.65;
    const camHeightY = 3.6 + portraitFactor * 0.55;

    const targetCamX = this.playerX * (0.45 - portraitFactor * 0.10);
    const targetCamY = camHeightY + this.playerY * 0.35;
    const targetCamZ = this.playerZ + camDistZ;

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      targetCamX,
      14,
      0.016
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      targetCamY,
      14,
      0.016
    );
    this.camera.position.z = targetCamZ;

    // Camera shake dampening
    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - 0.03);
    }

    this.camera.lookAt(
      this.playerX * 0.3,
      1.6 + this.playerY * 0.3,
      this.playerZ - 12
    );

    // Follow player with directional lighting so shadows and highlights never fade out
    if (this.keyLight) {
      this.keyLight.position.set(this.playerX + 12, 22, this.playerZ + 16);
      this.keyLight.target.position.set(this.playerX, 0, this.playerZ - 8);
      this.keyLight.target.updateMatrixWorld();
    }
    if (this.rimLight) {
      this.rimLight.position.set(this.playerX - 12, 16, this.playerZ - 24);
      this.rimLight.target.position.set(this.playerX, 0, this.playerZ - 6);
      this.rimLight.target.updateMatrixWorld();
    }

    // Sky & Northern lights follow player into the infinite distance
    if (this.auroraGroup) {
      this.auroraGroup.position.set(this.playerX * 0.12, 0, this.playerZ);
    }

    // Update falling snow particles around camera and wrap seamlessly
    const snowPositions = this.snowParticles.geometry.attributes.position.array as Float32Array;
    const snowCount = snowPositions.length / 3;
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3 + 1] -= 0.09;
      // Wrap Y
      if (snowPositions[i * 3 + 1] < 0) {
        snowPositions[i * 3 + 1] = 22;
      }

      // Keep snow centered relative to player X
      const dx = snowPositions[i * 3] - this.playerX;
      if (dx > 28) {
        snowPositions[i * 3] -= 56;
      } else if (dx < -28) {
        snowPositions[i * 3] += 56;
      }

      // Wrap Z so snow field is continuously dense around and ahead of the player
      if (snowPositions[i * 3 + 2] > this.playerZ + 15) {
        snowPositions[i * 3 + 2] = this.playerZ - 140 - Math.random() * 25;
      } else if (snowPositions[i * 3 + 2] < this.playerZ - 170) {
        snowPositions[i * 3 + 2] = this.playerZ + 10 - Math.random() * 15;
      }
    }
    this.snowParticles.geometry.attributes.position.needsUpdate = true;

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;

    this.updateCameraProjection(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(width, height);
  };

  public destroy() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.animFrameId);
    sounds.stopBgm();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
