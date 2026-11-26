import * as THREE from 'three';

/**
 * Helper to create a smooth, tapered elliptical lofted mesh along a 3D curve.
 * Produces seamless organic liquid-chrome surfaces (torso, arched neck, S-curved mane locks, tail plumes).
 */
function createTaperedLoftGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radialSegments: number,
  radiusXFn: (t: number) => number,
  radiusYFn: (t: number) => number,
  capEnds: boolean = true,
  fluteFn?: (t: number, theta: number) => number
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);

    // Stabilize orientation using world-up/right projection where possible to avoid Frenet twist
    const tangent = frames.tangents[i];
    const worldRight = new THREE.Vector3(1, 0, 0);
    // Lateral axis stays aligned with X as long as tangent isn't parallel to X
    if (Math.abs(tangent.x) < 0.95) {
      B.crossVectors(tangent, worldRight).normalize(); // vertical-ish axis in cross section
      N.crossVectors(B, tangent).normalize(); // lateral X-ish axis in cross section
    }

    const rx = Math.max(0.0005, radiusXFn(t));
    const ry = Math.max(0.0005, radiusYFn(t));

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = Math.cos(v);
      const flute = fluteFn ? fluteFn(t, v) : 1.0;

      vertex.copy(P)
        .addScaledVector(N, cos * rx * flute)
        .addScaledVector(B, sin * ry * flute);

      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(j / radialSegments, t);
    }
  }

  const rowStride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * rowStride + j;
      const b = (i + 1) * rowStride + j;
      const c = (i + 1) * rowStride + (j + 1);
      const d = i * rowStride + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capEnds) {
    // Start cap center
    const startPt = curve.getPointAt(0);
    const startCenterIdx = positions.length / 3;
    positions.push(startPt.x, startPt.y, startPt.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(startCenterIdx, j + 1, j);
    }

    // End cap center
    const endPt = curve.getPointAt(1);
    const endCenterIdx = positions.length / 3;
    positions.push(endPt.x, endPt.y, endPt.z);
    uvs.push(0.5, 1);
    const lastRowStart = tubularSegments * rowStride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(endCenterIdx, lastRowStart + j, lastRowStart + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smooth cosine interpolation helper for organic anatomical cross-sections.
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Generates high-resolution procedural hair-fiber textures (albedo, bump, roughness)
 * so the sculpted mane displays hundreds of crisp, gleaming individual silver hairs.
 */
function createManeHairTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const colorCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d')!;

  // Base recessed shadow grooves between individual hairs
  colorCtx.fillStyle = '#9db0c4';
  colorCtx.fillRect(0, 0, width, height);

  bumpCtx.fillStyle = '#18202c';
  bumpCtx.fillRect(0, 0, width, height);

  roughCtx.fillStyle = '#888888';
  roughCtx.fillRect(0, 0, width, height);

  // Deterministic PRNG for consistent sculpted hair strands
  let seed = 42817;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const drawStrands = (
    count: number,
    minW: number,
    maxW: number,
    bumpMin: number,
    bumpMax: number,
    roughMin: number,
    roughMax: number,
    colorBrightMin: number
  ) => {
    for (let i = 0; i < count; i++) {
      const x0 = rand() * width;
      const startY = height * (0.94 + rand() * 0.06); // near root (uv.y = 0 -> canvas bottom)
      const endY = height * (0.0 + rand() * 0.24); // toward tips (uv.y = 1 -> canvas top)
      const drift1 = (rand() - 0.45) * 34;
      const drift2 = (rand() - 0.42) * 48;
      const lw = minW + rand() * (maxW - minW);

      const bVal = Math.round(bumpMin + rand() * (bumpMax - bumpMin));
      const rVal = Math.round(roughMin + rand() * (roughMax - roughMin));
      const cVal = Math.round(colorBrightMin + rand() * (255 - colorBrightMin));

      const drawPath = (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.moveTo(x0, startY);
        ctx.bezierCurveTo(
          x0 + drift1,
          startY * 0.66 + endY * 0.34,
          x0 + drift2,
          startY * 0.32 + endY * 0.68,
          x0 + drift2 * 0.9 + (rand() - 0.5) * 18,
          endY
        );
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.stroke();
      };

      bumpCtx.strokeStyle = `rgb(${bVal},${bVal},${bVal})`;
      drawPath(bumpCtx);

      roughCtx.strokeStyle = `rgb(${rVal},${rVal},${rVal})`;
      drawPath(roughCtx);

      const cBlue = Math.min(255, cVal + 6);
      colorCtx.strokeStyle = `rgb(${Math.max(180, cVal - 10)},${cVal},${cBlue})`;
      drawPath(colorCtx);
    }
  };

  // Layered micro-hairs: medium lock base -> dense fine hairs -> crisp bright top filaments
  drawStrands(220, 2.2, 3.8, 110, 175, 42, 78, 200);
  drawStrands(520, 1.0, 2.0, 160, 225, 16, 48, 222);
  drawStrands(260, 0.7, 1.3, 215, 255, 6, 22, 240);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
  roughnessMap.anisotropy = 4;

  return { map, bumpMap, roughnessMap };
}

/**
 * Creates a slender, gracefully wind-swept 3D hair strand geometry for instanced micro-hairs.
 */
function createFineHairStrandGeometry(): THREE.BufferGeometry {
  const strandCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.008, 0.34, 0.08),
    new THREE.Vector3(-0.006, 0.70, 0.24),
    new THREE.Vector3(0.004, 1.0, 0.44),
  ]);
  return createTaperedLoftGeometry(
    strandCurve,
    7,
    5,
    (t) => 0.0095 * (1 - Math.pow(t, 0.85) * 0.92),
    (t) => 0.0065 * (1 - Math.pow(t, 0.85) * 0.92),
    true
  );
}

/**
 * Builds a single cohesive, sculpted mane crest centered along the dorsal arch of neckCurve.
 * Features finely serrated, tousled lock tips and root-to-tip UVs for high-detail hair fibers.
 */
function createSculptedManeGeometry(neckCurve: THREE.Curve<THREE.Vector3>): THREE.BufferGeometry {
  const uSegs = 128;
  const vSegs = 22;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const worldRight = new THREE.Vector3(1, 0, 0);
  const spinePt = new THREE.Vector3();
  const tUp = new THREE.Vector3();
  const neckTangent = new THREE.Vector3();
  const crestOut = new THREE.Vector3();
  const root = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const drapeDir = new THREE.Vector3();
  const thicknessDir = new THREE.Vector3();
  const curvePt = new THREE.Vector3();
  const pos = new THREE.Vector3();

  let startCapCenter = new THREE.Vector3();
  let endCapCenter = new THREE.Vector3();

  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs; // 0 = poll (top behind ears), 1 = withers/upper back
    const tNeck = 0.96 - u * 0.94;
    neckCurve.getPointAt(tNeck, spinePt);
    neckCurve.getTangentAt(tNeck, tUp);
    tUp.normalize();

    // neckTangent points along +du (from poll down to withers)
    neckTangent.copy(tUp).negate();
    // crestOut points perpendicular out of the dorsal neck crest (upward & backward in YZ plane)
    crestOut.crossVectors(worldRight, tUp).normalize();

    // Match neck dorsal radius so root anchors cleanly centered inside the neck crest
    const arch = 1.0 + 0.12 * Math.sin(tNeck * Math.PI);
    const neckRyBase = 0.23 * (1 - tNeck * 0.48) * arch;
    const neckRy = tNeck > 0.92 ? neckRyBase * (1 - (tNeck - 0.92) * 8) : neckRyBase;

    const env = Math.sin(u * Math.PI);
    const endTaper = smoothstep(0.0, 0.10, u) * (1.0 - smoothstep(0.86, 1.0, u));

    // Anchor root squarely along the dorsal centerline of the neck
    root.copy(spinePt).addScaledVector(crestOut, neckRy * 0.62);

    // Multi-frequency organic lock + fine serrated tuft waves for detailed windswept hairs
    const lockWave1 = Math.sin(u * Math.PI * 5.2 + 0.35);
    const lockWave2 = Math.sin(u * Math.PI * 10.8 + 1.7);
    const lockWave3 = Math.cos(u * Math.PI * 17.3 - 0.5);
    const lockWave4 = Math.sin(u * Math.PI * 33.0 + 0.8);
    const lockWave5 = Math.cos(u * Math.PI * 57.0 + 1.9);
    const lockReach =
      1.0 +
      0.26 * lockWave1 +
      0.15 * lockWave2 +
      0.10 * lockWave3 +
      0.08 * lockWave4 +
      0.05 * lockWave5;

    // Keep mane centered on the unicorn with fuller, voluminous tousled locks fanning left/right
    const sideX =
      (0.026 * env +
        0.064 * Math.sin(u * Math.PI * 4.4 + 0.6) +
        0.036 * Math.sin(u * Math.PI * 9.5 + 2.1) +
        0.016 * Math.sin(u * Math.PI * 24.0)) *
      endTaper;

    const reachOut =
      0.048 +
      (0.17 + 0.19 * Math.pow(env, 0.70)) *
        (0.22 + 0.78 * endTaper) *
        Math.max(0.52, lockReach);
    const dropY = (0.045 + 0.09 * env) * (0.22 + 0.78 * endTaper) * (0.8 + 0.2 * lockWave2);
    const windBackZ = (0.04 + 0.11 * Math.pow(env, 0.8)) * (0.2 + 0.8 * endTaper);

    // Bezier midpoint arches boldly along the centered crest before curling into tousled tips
    mid
      .copy(root)
      .addScaledVector(crestOut, reachOut * 0.58)
      .add(new THREE.Vector3(sideX * 0.38, 0.028 * endTaper, windBackZ * 0.35));

    tip
      .copy(root)
      .addScaledVector(crestOut, reachOut)
      .add(new THREE.Vector3(sideX, -dropY, windBackZ));

    if (i === 0) {
      startCapCenter = new THREE.Vector3().lerpVectors(root, tip, 0.45);
    }
    if (i === uSegs) {
      endCapCenter = new THREE.Vector3().lerpVectors(root, tip, 0.45);
    }

    drapeDir.subVectors(tip, root).normalize();
    thicknessDir.crossVectors(neckTangent, drapeDir).normalize();

    const maxHalfW = 0.105 * (0.26 + 0.74 * Math.pow(endTaper, 0.50));

    for (let j = 0; j <= vSegs; j++) {
      const v = j / vSegs;
      const theta = v * Math.PI * 2;
      // s goes 0 (root on neck crest) -> 1 (tousled outer lock edge) -> 0
      const s = 0.5 - 0.5 * Math.cos(theta);
      const omt = 1 - s;

      // Quadratic Bezier profile from centered neck crest to tousled windblown edge
      curvePt.set(
        omt * omt * root.x + 2 * omt * s * mid.x + s * s * tip.x,
        omt * omt * root.y + 2 * omt * s * mid.y + s * s * tip.y,
        omt * omt * root.z + 2 * omt * s * mid.z + s * s * tip.z
      );

      // Fine multi-scale hair-bundle fluting & micro-tuft ridges
      const flute =
        1.0 +
        0.28 * s * Math.cos(u * Math.PI * 15.0 + s * 2.8) +
        0.18 * s * Math.sin(u * Math.PI * 31.0 - s * 1.5) +
        0.11 * s * Math.cos(u * Math.PI * 59.0 + s * 3.1);
      const waveDrop =
        (0.028 * Math.sin(u * Math.PI * 6.5 + 0.4) +
          0.017 * Math.cos(u * Math.PI * 16.0) +
          0.010 * Math.sin(u * Math.PI * 38.0)) *
        Math.pow(s, 1.15);

      const profile = Math.sin(theta) * (1.0 - s * 0.50);
      const w = maxHalfW * profile * flute;

      pos.copy(curvePt).addScaledVector(thicknessDir, w + waveDrop);

      positions.push(pos.x, pos.y, pos.z);
      // Map u along neck and s from root (0) to tip (1) so procedural hair fibers flow root-to-tip
      uvs.push(u, s);
    }
  }

  const rowStride = vSegs + 1;
  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < vSegs; j++) {
      const a = i * rowStride + j;
      const b = (i + 1) * rowStride + j;
      const c = (i + 1) * rowStride + (j + 1);
      const d = i * rowStride + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Cap top & bottom cleanly with outward normals
  const startCenterIdx = positions.length / 3;
  positions.push(startCapCenter.x, startCapCenter.y, startCapCenter.z);
  uvs.push(0, 0.45);
  for (let j = 0; j < vSegs; j++) {
    indices.push(startCenterIdx, j, j + 1);
  }

  const endCenterIdx = positions.length / 3;
  positions.push(endCapCenter.x, endCapCenter.y, endCapCenter.z);
  uvs.push(1, 0.45);
  const lastRowStart = uSegs * rowStride;
  for (let j = 0; j < vSegs; j++) {
    indices.push(endCenterIdx, lastRowStart + j + 1, lastRowStart + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Articulated 3D Procedural Liquid Chrome Floak Unicorn
 *
 * Sculpted with seamless lofted equine contours inspired by the liquid-chrome stallion artwork:
 * - Continuous sculpted body barrel with muscular chest, deep ribcage, tucked athletic flank, and proud croup
 * - S-curved arched stallion neck blending smoothly from withers to poll
 * - Refined chiseled equine head with nasal bridge, mandible contours, hollowed ears, and glowing eyes
 * - Continuous helical spiral horn with celestial cyan luminescence
 * - S-curved wind-swept silver mane locks & cascading stallion tail plumes
 * - Authentic 4-beat asymmetric gallop kinematics with non-synchronous leg movement
 */
export class FloakUnicorn {
  public group: THREE.Group;

  // Anatomy Groups
  private bodyGroup: THREE.Group;
  private spineGroup: THREE.Group;
  private neckGroup: THREE.Group;
  private headGroup: THREE.Group;
  private maneGroup!: THREE.Group;
  private tailGroup!: THREE.Group;
  public hornLight!: THREE.PointLight;
  private hornBeam!: THREE.SpotLight;

  // Articulated legs (Thoroughbred anatomy: Hip/Shoulder -> Knee/Hock -> Cannon -> Fetlock/Pastern -> Hoof)
  private frontLeftLeg: {
    upper: THREE.Group;
    lower: THREE.Group;
    pastern: THREE.Group;
    hoof: THREE.Group;
  };
  private frontRightLeg: {
    upper: THREE.Group;
    lower: THREE.Group;
    pastern: THREE.Group;
    hoof: THREE.Group;
  };
  private backLeftLeg: {
    upper: THREE.Group;
    lower: THREE.Group;
    pastern: THREE.Group;
    hoof: THREE.Group;
  };
  private backRightLeg: {
    upper: THREE.Group;
    lower: THREE.Group;
    pastern: THREE.Group;
    hoof: THREE.Group;
  };

  // Gallop animation state
  private gallopPhase: number = 0;
  private isSoftwareGl: boolean;

  // Transition smoothing for jump & slide states
  private jumpBlend: number = 0;
  private slideBlend: number = 0;

  constructor(isSoftwareGl: boolean = false) {
    this.isSoftwareGl = isSoftwareGl;
    this.group = new THREE.Group();

    // --- High-Fidelity PBR Liquid Chrome Materials ---
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.98,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 1.0,
      envMapIntensity: 1.35,
    });

    // Subtle brushed silver for recessed anatomical contours (ear interior, nostrils, joints)
    const chromeShadowMat = new THREE.MeshPhysicalMaterial({
      color: 0xb0bec5,
      metalness: 0.94,
      roughness: 0.18,
      clearcoat: 0.65,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.1,
    });

    // Gleaming dark chrome hooves (like the metallic hooves in the artwork)
    const hoofMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      metalness: 0.95,
      roughness: 0.16,
      clearcoat: 0.9,
      envMapIntensity: 1.2,
    });

    // Coronet band collar
    const coronetMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Polished silver horseshoe rim
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.98,
      roughness: 0.08,
    });

    // Glowing crystalline celestial spiral horn
    const hornMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      metalness: 0.95,
      roughness: 0.05,
      clearcoat: 1.0,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.65,
      envMapIntensity: 1.4,
    });

    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    const eyeCoreMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
    });

    // 1. Root Body Group
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    this.spineGroup = new THREE.Group();
    this.bodyGroup.add(this.spineGroup);

    // --- SEAMLESS SCULPTED EQUINE TORSO (Lofted Thoroughbred Silhouette) ---
    // Curves from pectoral chest (-Z) -> deep ribcage -> tucked flank -> proud rounded croup (+Z)
    const torsoCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.04, -0.72), // Chest tip
      new THREE.Vector3(0, 0.05, -0.50), // Pectoral / Shoulder girth
      new THREE.Vector3(0, 0.01, -0.15), // Deep barrel ribcage
      new THREE.Vector3(0, 0.06, 0.24),  // Tucked athletic waist / loin
      new THREE.Vector3(0, 0.12, 0.56),  // Muscular croup / pelvis
      new THREE.Vector3(0, 0.07, 0.78),  // Rounded hindquarters end
    ]);

    const torsoGeo = createTaperedLoftGeometry(
      torsoCurve,
      36,
      24,
      (t) => {
        // Lateral half-width (slender top-down silhouette!)
        const capStart = smoothstep(0.0, 0.14, t);
        const capEnd = 1.0 - smoothstep(0.84, 1.0, t);
        // Chest flare -> subtle waist tuck around t=0.60 -> proud hip flare around t=0.80
        const waistDip = 1.0 - 0.22 * Math.exp(-Math.pow((t - 0.58) / 0.15, 2));
        const hipFlare = 1.0 + 0.10 * Math.exp(-Math.pow((t - 0.80) / 0.11, 2));
        return 0.215 * capStart * capEnd * waistDip * hipFlare;
      },
      (t) => {
        // Vertical half-height (deep chest & barrel, tucked belly at flank)
        const capStart = smoothstep(0.0, 0.14, t);
        const capEnd = 1.0 - smoothstep(0.84, 1.0, t);
        const deepChest = 1.0 + 0.14 * Math.exp(-Math.pow((t - 0.28) / 0.18, 2));
        const flankTuck = 1.0 - 0.16 * Math.exp(-Math.pow((t - 0.62) / 0.14, 2));
        return 0.295 * capStart * capEnd * deepChest * flankTuck;
      },
      true
    );
    const torsoMesh = new THREE.Mesh(torsoGeo, chromeMat);
    torsoMesh.castShadow = !this.isSoftwareGl;
    this.spineGroup.add(torsoMesh);

    // Sculpted Shoulder Muscles (Scapula plates) blending smoothly into chest & withers
    const scapulaGeo = new THREE.SphereGeometry(0.20, 16, 14);
    const scapulaL = new THREE.Mesh(scapulaGeo, chromeMat);
    scapulaL.scale.set(0.38, 1.25, 0.92);
    scapulaL.rotation.set(-0.28, 0.08, 0.14);
    scapulaL.position.set(-0.175, 0.11, -0.46);
    scapulaL.castShadow = !this.isSoftwareGl;

    const scapulaR = new THREE.Mesh(scapulaGeo, chromeMat);
    scapulaR.scale.set(0.38, 1.25, 0.92);
    scapulaR.rotation.set(-0.28, -0.08, -0.14);
    scapulaR.position.set(0.175, 0.11, -0.46);
    scapulaR.castShadow = !this.isSoftwareGl;
    this.spineGroup.add(scapulaL, scapulaR);

    // Sculpted Withers Ridge (smooth teardrop crest behind neck)
    const withersCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.30, -0.56),
      new THREE.Vector3(0, 0.29, -0.40),
      new THREE.Vector3(0, 0.24, -0.22),
    ]);
    const withersGeo = createTaperedLoftGeometry(
      withersCurve,
      12,
      12,
      (t) => 0.065 * Math.sin(t * Math.PI * 0.9 + 0.15),
      (t) => 0.085 * Math.sin(t * Math.PI * 0.9 + 0.15),
      true
    );
    const withersMesh = new THREE.Mesh(withersGeo, chromeMat);
    this.spineGroup.add(withersMesh);

    // Muscular Haunch / Gluteal Contours (Dual curved flanks on hindquarters)
    const haunchGeo = new THREE.SphereGeometry(0.25, 16, 14);
    const haunchLeft = new THREE.Mesh(haunchGeo, chromeMat);
    haunchLeft.scale.set(0.50, 1.08, 1.15);
    haunchLeft.rotation.y = -0.08;
    haunchLeft.position.set(-0.135, 0.10, 0.52);
    haunchLeft.castShadow = !this.isSoftwareGl;

    const haunchRight = new THREE.Mesh(haunchGeo, chromeMat);
    haunchRight.scale.set(0.50, 1.08, 1.15);
    haunchRight.rotation.y = 0.08;
    haunchRight.position.set(0.135, 0.10, 0.52);
    haunchRight.castShadow = !this.isSoftwareGl;
    this.spineGroup.add(haunchLeft, haunchRight);

    // 2. GRACEFUL S-ARCHED NECK & HEAD
    this.neckGroup = new THREE.Group();
    this.neckGroup.position.set(0, 0.20, -0.54);
    this.bodyGroup.add(this.neckGroup);

    // S-curved equine neck spline from chest/withers base up to head poll
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.06, 0.08),
      new THREE.Vector3(0, 0.24, -0.14),
      new THREE.Vector3(0, 0.56, -0.30),
      new THREE.Vector3(0, 0.74, -0.44),
    ]);
    const neckGeo = createTaperedLoftGeometry(
      neckCurve,
      20,
      16,
      (t) => {
        // Slender neck width tapering gently toward poll
        const base = 0.145 * (1 - t * 0.42);
        return t > 0.92 ? base * (1 - (t - 0.92) * 8) : base;
      },
      (t) => {
        // Proud arched neck depth (crest bulge along upper curve)
        const arch = 1.0 + 0.12 * Math.sin(t * Math.PI);
        const base = 0.23 * (1 - t * 0.48) * arch;
        return t > 0.92 ? base * (1 - (t - 0.92) * 8) : base;
      },
      true
    );
    const neckMesh = new THREE.Mesh(neckGeo, chromeMat);
    neckMesh.castShadow = !this.isSoftwareGl;
    this.neckGroup.add(neckMesh);

    // --- HIGH-DETAIL SCULPTED MANE WITH FINE MICRO-HAIRS ---
    this.maneGroup = new THREE.Group();
    const maneTextures = createManeHairTextures();
    const maneMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: maneTextures.map,
      bumpMap: maneTextures.bumpMap,
      bumpScale: 0.036,
      roughnessMap: maneTextures.roughnessMap,
      metalness: 0.96,
      roughness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 1.0,
      envMapIntensity: 1.4,
    });

    const maneGeo = createSculptedManeGeometry(neckCurve);
    const maneMesh = new THREE.Mesh(maneGeo, maneMat);
    maneMesh.castShadow = !this.isSoftwareGl;
    this.maneGroup.add(maneMesh);

    // Dense layer of countless fine 3D chrome hair strands emerging along the mane crest & tips
    const strandCount = this.isSoftwareGl ? 220 : 400;
    const strandGeo = createFineHairStrandGeometry();
    const strandInstanced = new THREE.InstancedMesh(strandGeo, chromeMat, strandCount);
    strandInstanced.castShadow = false;

    let strandSeed = 91823;
    const nextStrandRand = () => {
      strandSeed = (strandSeed * 1664525 + 1013904223) >>> 0;
      return strandSeed / 4294967296;
    };

    const dummyObj = new THREE.Object3D();
    const basisMat = new THREE.Matrix4();
    const worldRightVec = new THREE.Vector3(1, 0, 0);
    const sSpine = new THREE.Vector3();
    const sTangentUp = new THREE.Vector3();
    const sNeckTan = new THREE.Vector3();
    const sCrestOut = new THREE.Vector3();
    const axisX = new THREE.Vector3();
    const axisY = new THREE.Vector3();
    const axisZ = new THREE.Vector3();

    for (let k = 0; k < strandCount; k++) {
      const u = 0.03 + (k / strandCount) * 0.91 + (nextStrandRand() - 0.5) * 0.03;
      const clampedU = Math.max(0.02, Math.min(0.95, u));
      const tNeck = 0.96 - clampedU * 0.94;
      neckCurve.getPointAt(tNeck, sSpine);
      neckCurve.getTangentAt(tNeck, sTangentUp);
      sTangentUp.normalize();

      sNeckTan.copy(sTangentUp).negate();
      sCrestOut.crossVectors(worldRightVec, sTangentUp).normalize();

      const arch = 1.0 + 0.12 * Math.sin(tNeck * Math.PI);
      const neckRyBase = 0.23 * (1 - tNeck * 0.48) * arch;
      const neckRy = tNeck > 0.92 ? neckRyBase * (1 - (tNeck - 0.92) * 8) : neckRyBase;

      const env = Math.sin(clampedU * Math.PI);
      const endTaper = smoothstep(0.0, 0.10, clampedU) * (1.0 - smoothstep(0.86, 1.0, clampedU));

      // Position strand root along the centered dorsal crest & voluminous mid-mane layers
      const layerLift = nextStrandRand() * 0.165 * env;
      const latOffset = (nextStrandRand() - 0.5) * 0.115 * (0.35 + 0.65 * endTaper);
      dummyObj.position
        .copy(sSpine)
        .addScaledVector(sCrestOut, neckRy * 0.64 + layerLift)
        .addScaledVector(worldRightVec, latOffset);

      // Build hair orientation pointing out of crest and sweeping naturally back in the wind
      const lateralTilt = latOffset * 2.5 + (nextStrandRand() - 0.5) * 0.34;
      const windTilt = 0.18 + nextStrandRand() * 0.36;
      axisY
        .copy(sCrestOut)
        .addScaledVector(worldRightVec, lateralTilt)
        .addScaledVector(sNeckTan, windTilt)
        .normalize();

      axisX.crossVectors(axisY, sNeckTan);
      if (axisX.lengthSq() < 1e-4) {
        axisX.set(1, 0, 0);
      } else {
        axisX.normalize();
      }
      axisZ.crossVectors(axisX, axisY).normalize();

      basisMat.makeBasis(axisX, axisY, axisZ);
      dummyObj.quaternion.setFromRotationMatrix(basisMat);

      const lengthScale = (0.14 + nextStrandRand() * 0.20) * (0.44 + 0.56 * env) * (0.5 + 0.5 * endTaper);
      const thicknessScale = 0.68 + nextStrandRand() * 0.85;
      dummyObj.scale.set(thicknessScale, lengthScale, thicknessScale);
      dummyObj.updateMatrix();
      strandInstanced.setMatrixAt(k, dummyObj.matrix);
    }
    strandInstanced.instanceMatrix.needsUpdate = true;
    this.maneGroup.add(strandInstanced);

    this.neckGroup.add(this.maneGroup);

    // Head Group at top of arched neck
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.72, -0.43);
    this.neckGroup.add(this.headGroup);

    // --- REFINED THOROUGHBRED EQUINE HEAD ---
    // Seamless lofted skull & tapered nasal bridge
    const headCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.08, 0.08),   // Poll
      new THREE.Vector3(0, 0.02, -0.04),  // Forehead / temples
      new THREE.Vector3(0, -0.16, -0.22), // Nasal bridge
      new THREE.Vector3(0, -0.34, -0.39), // Soft rounded muzzle tip
    ]);
    const headGeo = createTaperedLoftGeometry(
      headCurve,
      18,
      16,
      (t) => {
        const capStart = smoothstep(0.0, 0.18, t);
        const capEnd = 1.0 - smoothstep(0.82, 1.0, t);
        const taper = 1.0 - t * 0.42;
        return 0.135 * capStart * capEnd * taper;
      },
      (t) => {
        const capStart = smoothstep(0.0, 0.18, t);
        const capEnd = 1.0 - smoothstep(0.82, 1.0, t);
        // Slightly fuller at cheekbones (t ~ 0.3), tapering smoothly down muzzle
        const cheekSwell = 1.0 + 0.18 * Math.exp(-Math.pow((t - 0.30) / 0.16, 2));
        const taper = 1.0 - t * 0.48;
        return 0.165 * capStart * capEnd * cheekSwell * taper;
      },
      true
    );
    const headMesh = new THREE.Mesh(headGeo, chromeMat);
    headMesh.castShadow = !this.isSoftwareGl;
    this.headGroup.add(headMesh);

    // Sculpted Equine Cheek / Mandible Curves
    const jawGeo = new THREE.SphereGeometry(0.115, 14, 12);
    const jawL = new THREE.Mesh(jawGeo, chromeMat);
    jawL.scale.set(0.45, 0.92, 0.98);
    jawL.position.set(-0.075, -0.07, -0.04);

    const jawR = new THREE.Mesh(jawGeo, chromeMat);
    jawR.scale.set(0.45, 0.92, 0.98);
    jawR.position.set(0.075, -0.07, -0.04);
    this.headGroup.add(jawL, jawR);

    // Flared Nostrils & Sculpted Muzzle Tip
    const nostrilGeo = new THREE.SphereGeometry(0.028, 8, 8);
    const nostrilL = new THREE.Mesh(nostrilGeo, chromeShadowMat);
    nostrilL.scale.set(0.7, 1.1, 1.2);
    nostrilL.position.set(-0.044, -0.31, -0.36);
    const nostrilR = new THREE.Mesh(nostrilGeo, chromeShadowMat);
    nostrilR.scale.set(0.7, 1.1, 1.2);
    nostrilR.position.set(0.044, -0.31, -0.36);
    this.headGroup.add(nostrilL, nostrilR);

    // Expressive Sapphire-Cyan Eyes with Sculpted Brow Ridges
    const browGeo = new THREE.SphereGeometry(0.042, 10, 8);
    const browL = new THREE.Mesh(browGeo, chromeMat);
    browL.scale.set(0.55, 0.45, 1.35);
    browL.position.set(-0.105, 0.07, -0.10);
    const browR = new THREE.Mesh(browGeo, chromeMat);
    browR.scale.set(0.55, 0.45, 1.35);
    browR.position.set(0.105, 0.07, -0.10);
    this.headGroup.add(browL, browR);

    const eyeGeo = new THREE.SphereGeometry(0.034, 10, 10);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.scale.set(0.65, 0.9, 1.1);
    eyeL.position.set(-0.11, 0.038, -0.105);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.scale.set(0.65, 0.9, 1.1);
    eyeR.position.set(0.11, 0.038, -0.105);
    this.headGroup.add(eyeL, eyeR);

    const eyeCoreGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const coreL = new THREE.Mesh(eyeCoreGeo, eyeCoreMat);
    coreL.position.set(-0.122, 0.04, -0.115);
    const coreR = new THREE.Mesh(eyeCoreGeo, eyeCoreMat);
    coreR.position.set(0.122, 0.04, -0.115);
    this.headGroup.add(coreL, coreR);

    // Sculpted Curved Equine Ears (with brushed inner ear hollow)
    const earGeo = new THREE.ConeGeometry(0.048, 0.25, 8);
    const earInnerGeo = new THREE.ConeGeometry(0.028, 0.18, 6);

    const earGroupL = new THREE.Group();
    earGroupL.position.set(-0.088, 0.19, 0.01);
    earGroupL.rotation.set(0.18, -0.14, -0.24);
    const earShellL = new THREE.Mesh(earGeo, chromeMat);
    earShellL.scale.set(0.52, 1.0, 0.85);
    const earHollowL = new THREE.Mesh(earInnerGeo, chromeShadowMat);
    earHollowL.scale.set(0.45, 1.0, 0.5);
    earHollowL.position.set(0, -0.01, -0.015);
    earGroupL.add(earShellL, earHollowL);

    const earGroupR = new THREE.Group();
    earGroupR.position.set(0.088, 0.19, 0.01);
    earGroupR.rotation.set(0.18, 0.14, 0.24);
    const earShellR = new THREE.Mesh(earGeo, chromeMat);
    earShellR.scale.set(0.52, 1.0, 0.85);
    const earHollowR = new THREE.Mesh(earInnerGeo, chromeShadowMat);
    earHollowR.scale.set(0.45, 1.0, 0.5);
    earHollowR.position.set(0, -0.01, -0.015);
    earGroupR.add(earShellR, earHollowR);

    this.headGroup.add(earGroupL, earGroupR);

    // --- CONTINUOUS HELICAL SPIRAL UNICORN HORN ---
    const hornGroup = new THREE.Group();
    hornGroup.position.set(0, 0.16, -0.18);
    hornGroup.rotation.x = -Math.PI / 3.1; // Pointing majestically forward down the winter runway

    const hornLength = 0.96;
    const hornBaseR = 0.048;
    const hornConeGeo = new THREE.ConeGeometry(hornBaseR, hornLength, 14);
    const hornBase = new THREE.Mesh(hornConeGeo, hornMat);
    hornBase.position.y = hornLength / 2;
    hornBase.castShadow = !this.isSoftwareGl;
    hornGroup.add(hornBase);

    // Continuous sculpted spiral ridge wrapping cleanly from base to tip
    const spiralPts: THREE.Vector3[] = [];
    const spiralSteps = 44;
    const turns = 5.5;
    for (let s = 0; s <= spiralSteps; s++) {
      const u = s / spiralSteps;
      const y = u * (hornLength * 0.95);
      const r = hornBaseR * (1 - u * 0.92);
      const theta = u * Math.PI * 2 * turns;
      spiralPts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
    }
    const spiralCurve = new THREE.CatmullRomCurve3(spiralPts);
    const spiralGeo = createTaperedLoftGeometry(
      spiralCurve,
      44,
      6,
      (t) => 0.011 * (1 - t * 0.82),
      (t) => 0.011 * (1 - t * 0.82),
      true
    );
    const spiralMesh = new THREE.Mesh(spiralGeo, chromeMat);
    hornGroup.add(spiralMesh);
    this.headGroup.add(hornGroup);

    // Horn Luminescence & Runway Beam
    this.hornLight = new THREE.PointLight(0x38bdf8, 2.8, 9);
    this.hornLight.position.set(0, 0.65, -0.68);
    this.headGroup.add(this.hornLight);

    this.hornBeam = new THREE.SpotLight(0x7dd3fc, 3.2, 32, Math.PI / 6, 0.4);
    this.hornBeam.position.set(0, 0.65, -0.68);
    this.hornBeam.target.position.set(0, -1.0, -16);
    this.headGroup.add(this.hornBeam);
    this.headGroup.add(this.hornBeam.target);

    // --- UNIFIED SCULPTED STALLION TAIL (Single flowing, fluted liquid-chrome mass) ---
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(0, 0.20, 0.72);
    this.bodyGroup.add(this.tailGroup);

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.0, 0.0),        // Dock embedded cleanly in croup
      new THREE.Vector3(0.015, 0.16, 0.28),  // Proud arched stallion lift
      new THREE.Vector3(-0.025, 0.02, 0.68), // Flowing lush wave mid-section
      new THREE.Vector3(0.035, -0.20, 1.02), // Extended sweeping cascade
      new THREE.Vector3(0.01, -0.36, 1.24),  // Graceful long curling tip
    ]);
    const tailGeo = createTaperedLoftGeometry(
      tailCurve,
      34,
      16,
      (t) => {
        const capStart = smoothstep(0.0, 0.08, t);
        const fullness = 0.055 + 0.082 * Math.sin(Math.min(1, t * 0.92 + 0.08) * Math.PI);
        return fullness * (0.35 + 0.65 * capStart) * (1 - Math.pow(t, 2.3) * 0.96);
      },
      (t) => {
        const capStart = smoothstep(0.0, 0.08, t);
        const fullness = 0.065 + 0.105 * Math.sin(Math.min(1, t * 0.92 + 0.08) * Math.PI);
        return fullness * (0.35 + 0.65 * capStart) * (1 - Math.pow(t, 2.2) * 0.96);
      },
      true,
      (t, theta) => 1.0 + 0.16 * Math.sin(t * Math.PI) * Math.cos(theta * 5 + t * 3.5)
    );
    const tailMesh = new THREE.Mesh(tailGeo, chromeMat);
    tailMesh.castShadow = !this.isSoftwareGl;
    this.tailGroup.add(tailMesh);

    // --- ARTICULATED SLENDER THOROUGHBRED LEGS ---
    this.frontLeftLeg = this.createLeg(chromeMat, chromeShadowMat, hoofMat, coronetMat, shoeMat, true);
    this.frontLeftLeg.upper.position.set(-0.19, -0.12, -0.47);
    this.bodyGroup.add(this.frontLeftLeg.upper);

    this.frontRightLeg = this.createLeg(chromeMat, chromeShadowMat, hoofMat, coronetMat, shoeMat, true);
    this.frontRightLeg.upper.position.set(0.19, -0.12, -0.47);
    this.bodyGroup.add(this.frontRightLeg.upper);

    this.backLeftLeg = this.createLeg(chromeMat, chromeShadowMat, hoofMat, coronetMat, shoeMat, false);
    this.backLeftLeg.upper.position.set(-0.21, -0.08, 0.48);
    this.bodyGroup.add(this.backLeftLeg.upper);

    this.backRightLeg = this.createLeg(chromeMat, chromeShadowMat, hoofMat, coronetMat, shoeMat, false);
    this.backRightLeg.upper.position.set(0.21, -0.08, 0.48);
    this.bodyGroup.add(this.backRightLeg.upper);

    // Initial scale and lift above snowy ground
    this.group.scale.set(0.85, 0.85, 0.85);
    this.group.position.y = 1.15;
  }

  /**
   * Builds an anatomically slender equine leg with sculpted upper muscle taper,
   * anatomical knee/hock with calcaneus heel point, thin cannon bone,
   * springy fetlock joint, sloping pastern, coronet band, and polished shoe.
   */
  private createLeg(
    chromeMat: THREE.Material,
    shadowMat: THREE.Material,
    hoofMat: THREE.Material,
    coronetMat: THREE.Material,
    shoeMat: THREE.Material,
    isFront: boolean
  ) {
    const upperGroup = new THREE.Group();

    // 1. Upper Limb (Muscular Forearm for front, Sculpted Thigh/Gaskin for rear)
    const upperLength = isFront ? 0.54 : 0.60;
    const upperRadiusTop = isFront ? 0.098 : 0.145;
    const upperRadiusBottom = isFront ? 0.058 : 0.068;

    const upperGeo = new THREE.CylinderGeometry(upperRadiusBottom, upperRadiusTop, upperLength, 14);
    const upperMesh = new THREE.Mesh(upperGeo, chromeMat);
    upperMesh.position.y = -upperLength / 2;
    upperMesh.scale.set(0.68, 1.0, 1.02);
    upperMesh.castShadow = !this.isSoftwareGl;
    upperGroup.add(upperMesh);

    // 2. Knee (Front Carpus) or Hock (Rear Tarsus with calcaneus heel point)
    const jointGeo = new THREE.SphereGeometry(upperRadiusBottom * 0.96, 10, 10);
    const jointMesh = new THREE.Mesh(jointGeo, chromeMat);
    jointMesh.position.y = -upperLength;
    jointMesh.scale.set(0.72, 1.12, 0.92);
    upperGroup.add(jointMesh);

    if (!isFront) {
      const hockPointGeo = new THREE.ConeGeometry(0.042, 0.12, 8);
      const hockPoint = new THREE.Mesh(hockPointGeo, chromeMat);
      hockPoint.position.set(0, -upperLength + 0.02, 0.055);
      hockPoint.rotation.x = -Math.PI / 2.5;
      upperGroup.add(hockPoint);
    }

    // 3. Lower Leg / Slender Cannon Bone Group
    const lowerGroup = new THREE.Group();
    lowerGroup.position.y = -upperLength;
    upperGroup.add(lowerGroup);

    const lowerLength = 0.54;
    const lowerGeo = new THREE.CylinderGeometry(0.042, 0.036, lowerLength, 12);
    const lowerMesh = new THREE.Mesh(lowerGeo, chromeMat);
    lowerMesh.position.y = -lowerLength / 2;
    lowerMesh.scale.set(0.70, 1.0, 0.85);
    lowerMesh.castShadow = !this.isSoftwareGl;
    lowerGroup.add(lowerMesh);

    // 4. Fetlock Joint Bulb
    const fetlockGroup = new THREE.Group();
    fetlockGroup.position.y = -lowerLength;
    lowerGroup.add(fetlockGroup);

    const fetlockGeo = new THREE.SphereGeometry(0.044, 10, 10);
    const fetlockMesh = new THREE.Mesh(fetlockGeo, shadowMat);
    fetlockMesh.position.set(0, 0.02, isFront ? 0.01 : -0.015);
    fetlockGroup.add(fetlockMesh);

    // 5. Sloping Pastern
    const pasternGroup = new THREE.Group();
    pasternGroup.position.y = 0;
    fetlockGroup.add(pasternGroup);

    const pasternLength = 0.14;
    const pasternGeo = new THREE.CylinderGeometry(0.038, 0.042, pasternLength, 10);
    const pasternMesh = new THREE.Mesh(pasternGeo, chromeMat);
    pasternMesh.position.set(0, -pasternLength / 2, -0.02);
    pasternMesh.rotation.x = -0.35;
    pasternGroup.add(pasternMesh);

    // 6. Hoof Group with Coronet Band and Silver Horseshoe
    const hoofGroup = new THREE.Group();
    hoofGroup.position.set(0, -pasternLength, -0.04);
    pasternGroup.add(hoofGroup);

    const coronetGeo = new THREE.CylinderGeometry(0.048, 0.056, 0.032, 12);
    const coronetMesh = new THREE.Mesh(coronetGeo, coronetMat);
    coronetMesh.position.set(0, 0.01, 0);
    hoofGroup.add(coronetMesh);

    const hoofGeo = new THREE.CylinderGeometry(0.052, 0.072, 0.10, 12);
    const hoofMesh = new THREE.Mesh(hoofGeo, hoofMat);
    hoofMesh.position.set(0, -0.04, 0.01);
    hoofMesh.rotation.x = 0.16;
    hoofMesh.scale.set(0.88, 1.0, 1.0);
    hoofMesh.castShadow = !this.isSoftwareGl;
    hoofGroup.add(hoofMesh);

    const shoeGeo = new THREE.TorusGeometry(0.062, 0.009, 4, 12, Math.PI * 1.5);
    const shoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
    shoeMesh.rotation.x = Math.PI / 2;
    shoeMesh.position.set(0, -0.09, 0.01);
    hoofGroup.add(shoeMesh);

    return { upper: upperGroup, lower: lowerGroup, pastern: pasternGroup, hoof: hoofGroup };
  }

  /**
   * Anatomical Equine Front Leg Kinematics
   */
  private calculateFrontLegKinematics(phase: number) {
    const p = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    let upperRotX = 0;
    let lowerRotX = 0;
    let pasternRotX = 0;
    let lateralSpreadZ = 0;

    if (p < Math.PI) {
      const t = p / Math.PI;
      upperRotX = 0.48 - t * 0.98;
      lowerRotX = 0.05 + Math.sin(t * Math.PI) * 0.10;
      pasternRotX = -0.15 + t * 0.25;
      lateralSpreadZ = 0;
    } else if (p < Math.PI * 1.6) {
      const t = (p - Math.PI) / (Math.PI * 0.6);
      upperRotX = -0.50 + t * 0.75;
      lowerRotX = Math.sin(t * Math.PI) * 1.25;
      pasternRotX = 0.35 * Math.sin(t * Math.PI);
      lateralSpreadZ = Math.sin(t * Math.PI) * 0.04;
    } else {
      const t = (p - Math.PI * 1.6) / (Math.PI * 0.4);
      upperRotX = 0.25 + t * 0.23;
      lowerRotX = 0.20 * (1 - t);
      pasternRotX = -0.15 * t;
      lateralSpreadZ = 0;
    }

    return { upperRotX, lowerRotX, pasternRotX, lateralSpreadZ };
  }

  /**
   * Anatomical Equine Hind Leg Kinematics
   */
  private calculateHindLegKinematics(phase: number) {
    const p = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    let upperRotX = 0;
    let lowerRotX = 0;
    let pasternRotX = 0;
    let lateralSpreadZ = 0;

    if (p < Math.PI) {
      const t = p / Math.PI;
      upperRotX = -0.42 + t * 0.95;
      lowerRotX = -0.12 - t * 0.18;
      pasternRotX = 0.15 - t * 0.30;
      lateralSpreadZ = 0;
    } else if (p < Math.PI * 1.6) {
      const t = (p - Math.PI) / (Math.PI * 0.6);
      upperRotX = 0.53 - t * 0.78;
      lowerRotX = -0.30 - Math.sin(t * Math.PI) * 0.70;
      pasternRotX = -0.25 + Math.sin(t * Math.PI) * 0.30;
      lateralSpreadZ = Math.sin(t * Math.PI) * 0.035;
    } else {
      const t = (p - Math.PI * 1.6) / (Math.PI * 0.4);
      upperRotX = -0.25 - t * 0.17;
      lowerRotX = -0.30 * (1 - t) - 0.12 * t;
      pasternRotX = 0.05 + 0.10 * t;
      lateralSpreadZ = 0;
    }

    return { upperRotX, lowerRotX, pasternRotX, lateralSpreadZ };
  }

  /**
   * Dynamic Gallop & Motion Update
   */
  public update(
    delta: number,
    speed: number,
    isJumping: boolean,
    isSliding: boolean,
    laneOffset: number,
    elapsedSec: number
  ) {
    // 1. Gallop Cadence (natural frequency scaling with running speed)
    const gallopRate = 11.5 + (speed - 26) * 0.22;
    this.gallopPhase += delta * gallopRate;

    // Smooth blending between running, jumping, and sliding
    const blendSpeed = 10;
    this.jumpBlend = THREE.MathUtils.damp(this.jumpBlend, isJumping ? 1 : 0, blendSpeed, delta);
    this.slideBlend = THREE.MathUtils.damp(this.slideBlend, isSliding ? 1 : 0, blendSpeed, delta);
    const runWeight = Math.max(0, 1 - this.jumpBlend - this.slideBlend);

    const p = this.gallopPhase;

    // 2. Authentic 4-Beat Asymmetric Equine Gallop Cadence
    const phiBL = 0.00;
    const phiBR = 1.35;
    const phiFL = 3.10;
    const phiFR = 4.45;

    const kFL = this.calculateFrontLegKinematics(p + phiFL);
    const kFR = this.calculateFrontLegKinematics(p + phiFR);
    const kBL = this.calculateHindLegKinematics(p + phiBL);
    const kBR = this.calculateHindLegKinematics(p + phiBR);

    // Dynamic Torso & Spine Undulation
    const runBodyY = Math.sin(p) * 0.09 + Math.sin(p * 2) * 0.04;
    const runPitch = Math.sin(p - 1.2) * 0.085;
    const runRoll = Math.sin(p) * 0.035;
    const runYaw = Math.cos(p) * 0.025;
    const runNeckPitch = -Math.sin(p - 1.2) * 0.075;
    const runHeadPitch = Math.sin(p - 0.6) * 0.055;

    const jumpBodyY = 0.15;
    const jumpPitch = -0.28;
    const jumpNeckPitch = 0.18;
    const jumpHeadPitch = -0.12;

    const slideBodyY = -0.38;
    const slidePitch = 0.04;
    const slideNeckPitch = -0.42;
    const slideHeadPitch = 0.32;

    this.bodyGroup.position.y =
      runBodyY * runWeight + jumpBodyY * this.jumpBlend + slideBodyY * this.slideBlend;
    this.spineGroup.rotation.x =
      runPitch * runWeight + jumpPitch * this.jumpBlend + slidePitch * this.slideBlend;
    this.spineGroup.rotation.z = runRoll * runWeight;
    this.spineGroup.rotation.y = runYaw * runWeight;

    this.neckGroup.rotation.x =
      runNeckPitch * runWeight + jumpNeckPitch * this.jumpBlend + slideNeckPitch * this.slideBlend;
    this.headGroup.rotation.x =
      runHeadPitch * runWeight + jumpHeadPitch * this.jumpBlend + slideHeadPitch * this.slideBlend;

    // --- APPLY ASYMMETRIC LEG ROTATIONS ---
    this.frontLeftLeg.upper.rotation.x =
      kFL.upperRotX * runWeight + -0.76 * this.jumpBlend + -1.15 * this.slideBlend;
    this.frontLeftLeg.lower.rotation.x =
      kFL.lowerRotX * runWeight + 1.20 * this.jumpBlend + 1.45 * this.slideBlend;
    this.frontLeftLeg.pastern.rotation.x =
      kFL.pasternRotX * runWeight + 0.35 * (this.jumpBlend + this.slideBlend);
    this.frontLeftLeg.upper.rotation.z = -kFL.lateralSpreadZ * runWeight;

    this.frontRightLeg.upper.rotation.x =
      kFR.upperRotX * runWeight + -0.60 * this.jumpBlend + -1.15 * this.slideBlend;
    this.frontRightLeg.lower.rotation.x =
      kFR.lowerRotX * runWeight + 1.05 * this.jumpBlend + 1.45 * this.slideBlend;
    this.frontRightLeg.pastern.rotation.x =
      kFR.pasternRotX * runWeight + 0.30 * (this.jumpBlend + this.slideBlend);
    this.frontRightLeg.upper.rotation.z = kFR.lateralSpreadZ * runWeight;

    this.backLeftLeg.upper.rotation.x =
      kBL.upperRotX * runWeight + 0.88 * this.jumpBlend + 0.98 * this.slideBlend;
    this.backLeftLeg.lower.rotation.x =
      kBL.lowerRotX * runWeight + -0.28 * this.jumpBlend + -1.25 * this.slideBlend;
    this.backLeftLeg.pastern.rotation.x = kBL.pasternRotX * runWeight - 0.35 * this.jumpBlend;
    this.backLeftLeg.upper.rotation.z = -kBL.lateralSpreadZ * runWeight;

    this.backRightLeg.upper.rotation.x =
      kBR.upperRotX * runWeight + 0.76 * this.jumpBlend + 0.98 * this.slideBlend;
    this.backRightLeg.lower.rotation.x =
      kBR.lowerRotX * runWeight + -0.22 * this.jumpBlend + -1.25 * this.slideBlend;
    this.backRightLeg.pastern.rotation.x = kBR.pasternRotX * runWeight - 0.30 * this.jumpBlend;
    this.backRightLeg.upper.rotation.z = kBR.lateralSpreadZ * runWeight;

    // 3. Cohesive Tail & Mane Wind Undulation (matching unified flow)
    const runTailX = 0.10 + Math.sin(p) * 0.12;
    const runTailY = Math.sin(elapsedSec * 5.5) * 0.16;
    const jumpTailX = 0.36;
    const slideTailX = 0.05;
    this.tailGroup.rotation.x =
      runTailX * runWeight + jumpTailX * this.jumpBlend + slideTailX * this.slideBlend;
    this.tailGroup.rotation.y = runTailY * runWeight;
    this.tailGroup.rotation.z = Math.cos(elapsedSec * 5.0) * 0.05 * runWeight;

    this.maneGroup.rotation.z = Math.sin(elapsedSec * 6.5) * 0.025 * runWeight;
    this.maneGroup.rotation.x = Math.sin(p - 0.5) * 0.025 * runWeight;

    // 4. Lane Switch Banking & Turn
    this.group.rotation.z = THREE.MathUtils.damp(
      this.group.rotation.z,
      -laneOffset * 0.20,
      12,
      delta
    );
    this.neckGroup.rotation.y = THREE.MathUtils.damp(
      this.neckGroup.rotation.y,
      -laneOffset * 0.26,
      12,
      delta
    );

    // 6. Glowing Horn Starlight Pulse
    this.hornLight.intensity = 2.6 + Math.sin(elapsedSec * 8) * 0.75;
  }
}
