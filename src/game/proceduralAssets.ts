import * as THREE from 'three';

/**
 * Creates a high-res canvas texture for the AdBlocker stop sign
 */
export function createAdBlockTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Background octagonal stop sign shape
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  const r = 230;
  const cx = 256;
  const cy = 256;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 + Math.PI / 8;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // White inner border
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Stop hand icon / ban symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 130px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STOP', 256, 180);

  // AdBlock text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('ADBLOCK', 256, 310);

  // Small subtitle
  ctx.fillStyle = '#fecaca';
  ctx.font = '600 30px sans-serif';
  ctx.fillText('TRACKING BLOCKED', 256, 370);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a high-res canvas texture for the Cookie Banner overhead obstacle
 */
export function createCookieBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark frosted banner container
  ctx.fillStyle = '#0f172a';
  ctx.roundRect(16, 16, 992, 480, 24);
  ctx.fill();

  // Cyan glowing border
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#38bdf8';
  ctx.stroke();

  // Header bar
  ctx.fillStyle = '#1e293b';
  ctx.roundRect(16, 16, 992, 90, [24, 24, 0, 0]);
  ctx.fill();

  // Window dots
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(60, 60, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(105, 60, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(150, 60, 16, 0, Math.PI * 2);
  ctx.fill();

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🍪 COOKIE BANNER POPUP', 200, 68);

  // Message
  ctx.fillStyle = '#94a3b8';
  ctx.font = '32px sans-serif';
  ctx.fillText('Wir verwenden Cookies & Tracking. Du musst ausweichen!', 60, 175);

  // Big buttons
  // "Alle ablehnen" button (red)
  ctx.fillStyle = '#ef4444';
  ctx.roundRect(60, 240, 420, 110, 16);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Alle ablehnen', 270, 310);

  // "Ducken / Sliden!" subtext
  ctx.fillStyle = '#f87171';
  ctx.font = '600 28px sans-serif';
  ctx.fillText('↓ DUCKEN / SLIDE ↓', 270, 410);

  // "Nur essenzielle" button (slate)
  ctx.fillStyle = '#334155';
  ctx.roundRect(530, 240, 430, 110, 16);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Tracking blockieren', 745, 310);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a high-res canvas texture for 404 Ice Firewall
 */
export function createFirewallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  // Cyber icy blue gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 768);
  grad.addColorStop(0, '#0369a1');
  grad.addColorStop(0.5, '#0284c7');
  grad.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = grad;
  ctx.roundRect(16, 16, 480, 736, 24);
  ctx.fill();

  // Grid lines
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.35;
  for (let y = 50; y < 750; y += 40) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(492, y);
    ctx.stroke();
  }
  for (let x = 50; x < 500; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, 748);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Outer border
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#7dd3fc';
  ctx.stroke();

  // 404 Warning
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 130px sans-serif';
  ctx.fillText('404', 256, 260);

  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('NOT FOUND', 256, 350);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('FIREWALL AKTIV', 256, 460);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 30px sans-serif';
  ctx.fillText('<< SPUR WECHSELN >>', 256, 560);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates track procedural snow texture
 */
export function createSnowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base frosty white/pale cyan
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle snow sparkle noise
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const bright = Math.random() > 0.5;
    ctx.fillStyle = bright ? '#ffffff' : '#bae6fd';
    ctx.fillRect(x, y, 2, 2);
  }

  // 3 Lane guide dashes (Left, Center, Right)
  ctx.fillStyle = '#38bdf8';
  ctx.globalAlpha = 0.55;
  // Left border
  ctx.fillRect(166, 0, 8, 512);
  // Right border
  ctx.fillRect(338, 0, 8, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Radial contact shadow texture for the unicorn
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 20, 35, 0.75)');
  grad.addColorStop(0.5, 'rgba(10, 20, 35, 0.4)');
  grad.addColorStop(1, 'rgba(10, 20, 35, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/**
 * Creates texture for oncoming tracking bot front grille / warning face
 */
export function createBotWarningTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark cyber metallic chassis
  ctx.fillStyle = '#0f172a';
  ctx.roundRect(16, 16, 480, 480, 28);
  ctx.fill();

  // Red/amber hazard border
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#f97316';
  ctx.stroke();

  // Flashing visor / angry eyes
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(90, 190);
  ctx.lineTo(230, 240);
  ctx.lineTo(220, 275);
  ctx.lineTo(80, 225);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(422, 190);
  ctx.lineTo(282, 240);
  ctx.lineTo(292, 275);
  ctx.lineTo(432, 225);
  ctx.closePath();
  ctx.fill();

  // Grille teeth
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(140 + i * 50, 320, 32, 50);
  }

  // Warning text
  ctx.fillStyle = '#f97316';
  ctx.font = '900 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TRACKER BOT', 256, 110);

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('⚡ GEGENVERKEHR ⚡', 256, 430);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates texture for oncoming firewall drone
 */
export function createDroneEyeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, 256, 256);

  // Concentric targeting rings
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 90, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 55, 0, Math.PI * 2);
  ctx.stroke();

  // Center pupil
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(128, 128, 25, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
