import { 
    project3D 
} from '../helpers.js';

import { 
    MAX_TEXTS 
} from '../constants.js';

import { 
    gameState, 
    player, 
    zombies, 
    airDrops, 
    activeBomberPlanes, 
    activeAirstrikeBombs, 
    activeFlashes, 
    bulletPool, 
    particlePool, 
    textPool, 
    shakeTime, 
    dayNightCycle, 
    canvas,
    pixi,
    isReloading,
    reloadTimer
} from '../state.js';

import { 
    getPrioritizedZombie 
} from '../entities.js';

import { 
    getWeaponDamage,
    getMercenaryRange,
    getActiveWeaponRange,
    getReloadTimeModifier,
    getMercenaryWeaponId
} from '../systems.js';

export function initTextPool() {
    pixi.pixiTextPool.length = 0;
    for (let i = 0; i < MAX_TEXTS; i++) {
        const t = new PIXI.Text("", {
            fontFamily: 'Chakra Petch',
            fontSize: 11,
            fill: 0xffffff,
            fontWeight: 'bold',
            align: 'center'
        });
        t.anchor.set(0.5);
        t.visible = false;
        pixi.shakeContainer.addChild(t);
        pixi.pixiTextPool.push(t);
    }
}

export function initPixi() {
    if (!canvas) return;
    pixi.app = new PIXI.Application({
        view: canvas,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundAlpha: 0
    });
    
    pixi.shakeContainer = new PIXI.Container();
    pixi.app.stage.addChild(pixi.shakeContainer);
    
    pixi.bgGraphics = new PIXI.Graphics();
    pixi.shakeContainer.addChild(pixi.bgGraphics);
    
    pixi.bloodTexture = PIXI.RenderTexture.create({ width: canvas.clientWidth, height: canvas.clientHeight });
    pixi.bloodSprite = new PIXI.Sprite(pixi.bloodTexture);
    pixi.shakeContainer.addChild(pixi.bloodSprite);
    
    pixi.zombiesContainer = new PIXI.Container();
    pixi.shakeContainer.addChild(pixi.zombiesContainer);
    
    pixi.barricadeGraphics = new PIXI.Graphics();
    pixi.shakeContainer.addChild(pixi.barricadeGraphics);
    
    pixi.bulletsGraphics = new PIXI.Graphics();
    pixi.shakeContainer.addChild(pixi.bulletsGraphics);
    
    pixi.particlesGraphics = new PIXI.Graphics();
    pixi.shakeContainer.addChild(pixi.particlesGraphics);
    
    pixi.airDropsContainer = new PIXI.Container();
    pixi.shakeContainer.addChild(pixi.airDropsContainer);
    
    pixi.bombersGraphics = new PIXI.Graphics();
    pixi.shakeContainer.addChild(pixi.bombersGraphics);
    
    pixi.ambientGraphics = new PIXI.Graphics();
    pixi.shakeContainer.addChild(pixi.ambientGraphics);
    
    player.graphics = new PIXI.Graphics();
    pixi.shakeContainer.addChild(player.graphics);
    
    initTextPool();
    
    pixi.ready = true;
}

export function initBgCanvas(logicalWidth, logicalHeight) {
    if (!pixi.bgGraphics) return;
    pixi.bgGraphics.clear();
    
    // Outer boundary background (Dark Earthy Brown)
    pixi.bgGraphics.beginFill(0x241b18);
    pixi.bgGraphics.drawRect(0, 0, logicalWidth, logicalHeight);
    pixi.bgGraphics.endFill();
    
    const ptTL = project3D(logicalWidth * 0.15, -50);
    const ptTR = project3D(logicalWidth * 0.85, -50);
    const ptBR = project3D(logicalWidth * 0.85, logicalHeight);
    const ptBL = project3D(logicalWidth * 0.15, logicalHeight);
    
    // Playable battlefield lane (Sandy/Dusty Muddy Brown)
    pixi.bgGraphics.beginFill(0x42332a);
    pixi.bgGraphics.drawPolygon([
        ptTL.x, ptTL.y,
        ptTR.x, ptTR.y,
        ptBR.x, ptBR.y,
        ptBL.x, ptBL.y
    ]);
    pixi.bgGraphics.endFill();
    
    // Subtle grid lines (Earthy tone)
    pixi.bgGraphics.lineStyle(0.5, 0x5c4a3f, 0.22);
    const gridSize = 45;
    for (let x = 0; x < logicalWidth; x += gridSize) {
        pixi.bgGraphics.moveTo(x, 0);
        pixi.bgGraphics.lineTo(x, logicalHeight);
    }
    for (let y = 0; y < logicalHeight; y += gridSize) {
        pixi.bgGraphics.moveTo(0, y);
        pixi.bgGraphics.lineTo(logicalWidth, y);
    }
    
    // Draw static low-poly rocks (12 rocks)
    const rockColors = [0x57534e, 0x6e6862, 0x44403c];
    for (let i = 0; i < 12; i++) {
        const rx = logicalWidth * 0.22 + Math.random() * (logicalWidth * 0.56);
        const ry = 40 + Math.random() * (logicalHeight - 320);
        
        const pt = project3D(rx, ry, 0);
        const size = (5 + Math.random() * 7) * pt.scale;
        
        // Rock shadow
        pixi.bgGraphics.lineStyle(0);
        pixi.bgGraphics.beginFill(0x1c1512, 0.4);
        pixi.bgGraphics.drawEllipse(pt.x + size * 0.2, pt.y + size * 0.1, size, size * 0.45);
        pixi.bgGraphics.endFill();
        
        // Rock polygon
        const color = rockColors[Math.floor(Math.random() * rockColors.length)];
        pixi.bgGraphics.beginFill(color);
        const pts = [];
        const steps = 5 + Math.floor(Math.random() * 2);
        for (let s = 0; s < steps; s++) {
            const angle = (s / steps) * Math.PI * 2;
            const r = size * (0.85 + Math.random() * 0.3);
            pts.push(pt.x + Math.cos(angle) * r, pt.y + Math.sin(angle) * r * 0.65);
        }
        pixi.bgGraphics.drawPolygon(pts);
        pixi.bgGraphics.endFill();
        
        // Rock facet highlight
        pixi.bgGraphics.beginFill(color + 0x111111, 0.35);
        pixi.bgGraphics.drawPolygon([
            pt.x, pt.y,
            pts[0], pts[1],
            pts[2], pts[3]
        ]);
        pixi.bgGraphics.endFill();
    }
    
    // Draw static dry/wilted grass clumps (18 patches)
    const grassColors = [0x4d5828, 0x705d2e, 0x3d4722];
    for (let i = 0; i < 18; i++) {
        const gx = logicalWidth * 0.20 + Math.random() * (logicalWidth * 0.60);
        const gy = 30 + Math.random() * (logicalHeight - 300);
        
        const pt = project3D(gx, gy, 0);
        const h = (4 + Math.random() * 6) * pt.scale;
        
        pixi.bgGraphics.lineStyle(1.2 * pt.scale, grassColors[Math.floor(Math.random() * grassColors.length)], 0.7);
        for (let c = 0; c < 3; c++) {
            const tilt = (Math.random() - 0.5) * 6 * pt.scale;
            pixi.bgGraphics.moveTo(pt.x, pt.y);
            pixi.bgGraphics.lineTo(pt.x + tilt, pt.y - h);
        }
    }
}

export function addBloodSplatterToBg(worldX, worldY, radius) {
    if (!pixi.app || !pixi.bloodTexture) return;
    
    const pt = project3D(worldX, worldY, 0);
    const screenRadius = radius * pt.scale;
    
    const bloodG = new PIXI.Graphics();
    const baseColor = 0x881313;
    const baseAlpha = Math.random() * 0.25 + 0.15;
    
    bloodG.beginFill(baseColor, baseAlpha);
    bloodG.drawEllipse(pt.x, pt.y, screenRadius, screenRadius * 0.65);
    bloodG.endFill();
    
    const dropQuantity = Math.floor(Math.random() * 5 + 3);
    for (let i = 0; i < dropQuantity; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 18 * pt.scale;
        const dropR = (Math.random() * 2.5 + 1) * pt.scale;
        bloodG.beginFill(baseColor, baseAlpha);
        bloodG.drawEllipse(pt.x + Math.cos(angle) * dist, pt.y + Math.sin(angle) * dist, dropR, dropR * 0.65);
        bloodG.endFill();
    }
    
    pixi.app.renderer.render(bloodG, { renderTexture: pixi.bloodTexture, clear: false });
    bloodG.destroy();
}

export function addToxicSplatterToBg(worldX, worldY, radius) {
    if (!pixi.app || !pixi.bloodTexture) return;
    
    const pt = project3D(worldX, worldY, 0);
    const screenRadius = radius * pt.scale;
    
    const toxicG = new PIXI.Graphics();
    const baseColor = 0x14532d; // dark forest green
    const baseAlpha = Math.random() * 0.22 + 0.18;
    
    toxicG.beginFill(baseColor, baseAlpha);
    toxicG.drawEllipse(pt.x, pt.y, screenRadius * 1.1, screenRadius * 0.65);
    toxicG.endFill();
    
    const dropQuantity = Math.floor(Math.random() * 4 + 3);
    for (let i = 0; i < dropQuantity; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 12 * pt.scale;
        const dropR = (Math.random() * 2 + 1) * pt.scale;
        toxicG.beginFill(0x22c55e, baseAlpha * 1.1); // bright toxic green
        toxicG.drawEllipse(pt.x + Math.cos(angle) * dist, pt.y + Math.sin(angle) * dist, dropR, dropR * 0.65);
        toxicG.endFill();
    }
    
    pixi.app.renderer.render(toxicG, { renderTexture: pixi.bloodTexture, clear: false });
    toxicG.destroy();
}

export function drawBarricadePixi() {
    if (!pixi.barricadeGraphics) return;
    const g = pixi.barricadeGraphics;
    g.clear();
    
    const logicalWidth = canvas.clientWidth;
    const barricadeY = canvas.clientHeight - 160;
    
    const wallH = 28;
    const wallDepth = 12;
    const wallLeft = logicalWidth * 0.10;
    const wallRight = logicalWidth * 0.90;
    
    const pBL = project3D(wallLeft,  barricadeY,            0);
    const pBR = project3D(wallRight, barricadeY,            0);
    const pFL = project3D(wallLeft,  barricadeY,            wallH);
    const pFR = project3D(wallRight, barricadeY,            wallH);
    const pBL_back = project3D(wallLeft,  barricadeY - wallDepth, 0);
    const pBR_back = project3D(wallRight, barricadeY - wallDepth, 0);
    const pTL_back = project3D(wallLeft,  barricadeY - wallDepth, wallH);
    const pTR_back = project3D(wallRight, barricadeY - wallDepth, wallH);
    
    g.lineStyle(0);
    g.beginFill(0x000000, 0.35);
    g.drawPolygon([
        pBL_back.x - 14, pBL_back.y + 6,
        pBR_back.x + 14, pBR_back.y + 6,
        pBR.x, pBR.y,
        pBL.x, pBL.y
    ]);
    g.endFill();
    
    g.beginFill(0x242424, 0.9);
    g.drawPolygon([
        pBL_back.x, pBL_back.y,
        pBR_back.x, pBR_back.y,
        pTR_back.x, pTR_back.y,
        pTL_back.x, pTL_back.y
    ]);
    g.endFill();
    
    g.beginFill(0x3a3a3a);
    g.drawPolygon([
        pFL.x, pFL.y,
        pFR.x, pFR.y,
        pTR_back.x, pTR_back.y,
        pTL_back.x, pTL_back.y
    ]);
    g.endFill();
    
    g.lineStyle(1.5, 0x555555, 0.55);
    g.moveTo(pTL_back.x, pTL_back.y);
    g.lineTo(pTR_back.x, pTR_back.y);
    
    g.lineStyle(0.7, 0x222222, 0.4);
    for (let ratio = 0.12; ratio <= 0.90; ratio += 0.09) {
        const xa = project3D(logicalWidth * ratio, barricadeY, wallH);
        const xb = project3D(logicalWidth * ratio, barricadeY - wallDepth, wallH);
        g.moveTo(xa.x, xa.y);
        g.lineTo(xb.x, xb.y);
    }
    
    g.lineStyle(0);
    g.beginFill(0x2d2d2d);
    g.drawPolygon([
        pBL.x, pBL.y,
        pBR.x, pBR.y,
        pFR.x, pFR.y,
        pFL.x, pFL.y
    ]);
    g.endFill();
    
    const pMidL = project3D(wallLeft,  barricadeY, wallH * 0.5);
    const pMidR = project3D(wallRight, barricadeY, wallH * 0.5);
    g.beginFill(0x383838, 0.6);
    g.drawPolygon([
        pMidL.x, pMidL.y,
        pMidR.x, pMidR.y,
        pFR.x, pFR.y,
        pFL.x, pFL.y
    ]);
    g.endFill();
    
    const rowCount = 2;
    const bagsPerRow = [8, 7];
    const rowZStart = [0, wallH * 0.48];
    const rowZEnd   = [wallH * 0.52, wallH];
    
    const stoneColors = [0x484848, 0x545454, 0x3c3c3c, 0x5c5c5c];
    const stoneHighlights = [0x686868, 0x747474, 0x5c5c5c];
    
    for (let row = 0; row < rowCount; row++) {
        const n = bagsPerRow[row];
        const zBot = rowZStart[row];
        const zTop = rowZEnd[row];
        const offset = row % 2 === 1 ? 0.5 / n : 0;
        const totalW = wallRight - wallLeft;
        const bagW = totalW / n;
        
        for (let i = 0; i < n; i++) {
            const xL = wallLeft + (i + offset) * bagW;
            const xR = wallLeft + (i + offset + 1) * bagW;
            const cxL = Math.max(wallLeft, Math.min(wallRight, xL));
            const cxR = Math.max(wallLeft, Math.min(wallRight, xR));
            
            const padding = 1.0;
            
            const bBL = project3D(cxL + padding, barricadeY, zBot);
            const bBR = project3D(cxR - padding, barricadeY, zBot);
            const bTR = project3D(cxR - padding, barricadeY, zTop);
            const bTL = project3D(cxL + padding, barricadeY, zTop);
            
            const ci = (i + row * 3) % stoneColors.length;
            
            g.lineStyle(0);
            g.beginFill(stoneColors[ci]);
            g.drawPolygon([bBL.x, bBL.y, bBR.x, bBR.y, bTR.x, bTR.y, bTL.x, bTL.y]);
            g.endFill();
            
            const bMidL = project3D(cxL + padding, barricadeY, zBot + (zTop - zBot) * 0.5);
            const bMidR = project3D(cxR - padding, barricadeY, zBot + (zTop - zBot) * 0.5);
            g.beginFill(stoneHighlights[ci % stoneHighlights.length], 0.4);
            g.drawPolygon([bMidL.x, bMidL.y, bMidR.x, bMidR.y, bTR.x, bTR.y, bTL.x, bTL.y]);
            g.endFill();
            
            g.lineStyle(1.2, 0x222222, 0.7);
            g.drawPolygon([bBL.x, bBL.y, bBR.x, bBR.y, bTR.x, bTR.y, bTL.x, bTL.y]);
        }
    }
    
    const spTL = project3D(wallLeft, barricadeY - wallDepth, wallH);
    const spBL = project3D(wallLeft, barricadeY - wallDepth, 0);
    g.lineStyle(0);
    g.beginFill(0x282828, 0.8);
    g.drawPolygon([
        pFL.x, pFL.y,
        pTL_back.x, pTL_back.y,
        spBL.x, spBL.y,
        pBL.x, pBL.y
    ]);
    g.endFill();
    
    const spTR = project3D(wallRight, barricadeY - wallDepth, wallH);
    const spBR = project3D(wallRight, barricadeY - wallDepth, 0);
    g.beginFill(0x282828, 0.8);
    g.drawPolygon([
        pFR.x, pFR.y,
        pTR_back.x, pTR_back.y,
        spBR.x, spBR.y,
        pBR.x, pBR.y
    ]);
    g.endFill();
    
    g.lineStyle(18, 0xef4444, 0.06);
    g.moveTo(pFL.x, pFL.y);
    g.lineTo(pFR.x, pFR.y);
    
    g.lineStyle(8, 0xef4444, 0.22);
    g.moveTo(pFL.x, pFL.y);
    g.lineTo(pFR.x, pFR.y);
    
    g.lineStyle(2.5, 0xff6b6b, 0.95);
    g.moveTo(pFL.x, pFL.y);
    g.lineTo(pFR.x, pFR.y);
    
    g.lineStyle(5, 0xff4444, 0.12);
    g.moveTo(pTL_back.x, pTL_back.y);
    g.lineTo(pTR_back.x, pTR_back.y);
}

export function drawPlayerPixi() {
    if (!player.graphics) return;
    const g = player.graphics;
    g.clear();
    const drawX = player.x - Math.cos(player.angle) * player.recoil;
    const drawY = player.y - Math.sin(player.angle) * player.recoil;
    
    const pt = project3D(drawX, drawY, 10);
    const sc = pt.scale * 1.35;
    
    g.position.set(pt.x, pt.y);
    g.scale.set(sc);
    g.rotation = 0;
    
    const aimDX = Math.cos(player.screenAngle || player.angle);
    const facing = aimDX >= 0 ? 1 : -1;
    
    const legSway = Math.sin(player.walkCycle) * 3;
    
    // Draw 3D Feet (dang rộng)
    g.lineStyle(0);
    g.beginFill(0x020617);
    g.drawEllipse(-5, 14 + legSway, 3, 1.8);
    g.drawEllipse(5, 14 - legSway, 3, 1.8);
    g.endFill();
    
    // Draw Legs (dang rộng hướng xuống)
    g.lineStyle(4.5, 0x0f172a);
    g.moveTo(-4, 2);
    g.lineTo(-5, 14 + legSway);
    g.moveTo(4, 2);
    g.lineTo(5, 14 - legSway);
    
    // Draw Torso (Back View - vai rộng ngang)
    g.lineStyle(1.8, 0x0f766e);
    g.beginFill(0x0f766e); // Teal color shirt
    g.drawEllipse(0, -2, 10, 8);
    g.endFill();
    
    // Draw Backpack (Balo sau lưng - rất thể thao giống ảnh)
    g.lineStyle(1.2, 0x9a3412);
    g.beginFill(0xea580c); // Balo cam nổi bật
    g.drawRoundedRect(-5.5, -6.5, 11, 9, 2);
    g.endFill();
    
    // Balo sọc đen scifi
    g.lineStyle(1.0, 0x1e293b, 0.65);
    g.moveTo(-3, -2);
    g.lineTo(3, -2);
    g.moveTo(-3, 1);
    g.lineTo(3, 1);
    
    // Draw Head/Helmet (Nhìn từ sau lưng)
    g.lineStyle(0);
    g.beginFill(0x1e293b); // Mũ bảo hiểm xám đen
    g.drawCircle(0, -11, 6.2);
    g.endFill();
    
    // Đai mũ sau gáy
    g.lineStyle(1.2, 0x0f172a);
    g.moveTo(-4.5, -9);
    g.lineTo(4.5, -9);
    
    // Cánh tay cầm súng hướng theo player.screenAngle
    const armAngle = player.screenAngle || player.angle;
    const armLen = 10;
    // Vị trí bàn tay cầm súng
    const handX = Math.cos(armAngle) * armLen;
    const handY = -4 + Math.sin(armAngle) * armLen;
    
    g.lineStyle(3.5, 0x334155); // Vai áo
    g.moveTo(-6, -4); // Vai trái
    g.lineTo(handX, handY);
    g.moveTo(6, -4);  // Vai phải
    g.lineTo(handX, handY);
    
    const activeWep = gameState.weapons[gameState.activeWeaponIndex];
    if (activeWep) {
        const gunDirX = Math.cos(player.screenAngle || player.angle);
        const gunDirY = Math.sin(player.screenAngle || player.angle);
        
        g.lineStyle(0);
        
        const gx = handX;
        const gy = handY;
        let gunW, gunH, gunColor, barrelExt;
        switch (activeWep.id) {
            case 'pistol':   gunW=3; gunH=8;  gunColor=0x1e293b; barrelExt=5;  break;
            case 'smg':      gunW=4; gunH=13; gunColor=0x1e293b; barrelExt=4;  break;
            case 'shotgun':  gunW=5; gunH=15; gunColor=0x451a03; barrelExt=5;  break;
            case 'rifle':    gunW=4; gunH=18; gunColor=0x1e293b; barrelExt=6;  break;
            case 'flame':    gunW=6; gunH=12; gunColor=0xef4444; barrelExt=4;  break;
            case 'plasma':   gunW=6; gunH=16; gunColor=0x0891b2; barrelExt=5;  break;
            case 'freeze':   gunW=5; gunH=14; gunColor=0x0284c7; barrelExt=5;  break;
            case 'gatling':  gunW=7; gunH=18; gunColor=0xd97706; barrelExt=8;  break;
            case 'tesla':    gunW=6; gunH=17; gunColor=0x0891b2; barrelExt=6;  break;
            case 'nuclear':  gunW=7; gunH=20; gunColor=0x15803d; barrelExt=7;  break;
            default:         gunW=4; gunH=12; gunColor=0x1e293b; barrelExt=5;
        }
        
        const nx = -gunDirY;
        const ny = gunDirX;
        const hw = gunW * 0.5;
        
        g.beginFill(gunColor);
        g.drawPolygon([
            gx - nx * hw,                  gy - ny * hw,
            gx + nx * hw,                  gy + ny * hw,
            gx + gunDirX * gunH + nx * hw, gy + gunDirY * gunH + ny * hw,
            gx + gunDirX * gunH - nx * hw, gy + gunDirY * gunH - ny * hw,
        ]);
        g.endFill();
        
        g.lineStyle(1.2, 0xffffff, 0.22);
        g.moveTo(gx - nx * hw, gy - ny * hw);
        g.lineTo(gx + gunDirX * gunH - nx * hw, gy + gunDirY * gunH - ny * hw);
        
        const barrelX = gx + gunDirX * (gunH + barrelExt);
        const barrelY = gy + gunDirY * (gunH + barrelExt);
        g.lineStyle(0);
        g.beginFill(0x020617);
        g.drawCircle(barrelX, barrelY, gunW * 0.35);
        g.endFill();
        
        if (player.flashTimer > 0) {
            let flashLen = 14;
            let flashWidth = 5;
            switch (activeWep.id) {
                case 'pistol': flashLen = 11; flashWidth = 3.5; break;
                case 'smg': flashLen = 13; flashWidth = 4.5; break;
                case 'shotgun': flashLen = 22; flashWidth = 9; break;
                case 'rifle': flashLen = 18; flashWidth = 5; break;
                case 'gatling': flashLen = 22; flashWidth = 6.5; break;
                case 'nuclear': flashLen = 28; flashWidth = 10; break;
                case 'plasma': flashLen = 16; flashWidth = 6.5; break;
                default: flashLen = 14; flashWidth = 4.5;
            }
            
            g.lineStyle(0);
            
            // Outer glow spike (yellow/orange)
            g.beginFill(0xfbbf24, 0.45);
            g.drawPolygon([
                barrelX - nx * flashWidth * 1.4, barrelY - ny * flashWidth * 1.4,
                barrelX + gunDirX * flashLen * 1.4, barrelY + gunDirY * flashLen * 1.4,
                barrelX + nx * flashWidth * 1.4, barrelY + ny * flashWidth * 1.4,
                barrelX - gunDirX * flashLen * 0.3, barrelY - gunDirY * flashLen * 0.3
            ]);
            g.endFill();
            
            // Inner hot core spike (white/yellow)
            g.beginFill(0xffffff, 0.9);
            g.drawPolygon([
                barrelX - nx * flashWidth * 0.6, barrelY - ny * flashWidth * 0.6,
                barrelX + gunDirX * flashLen * 0.85, barrelY + gunDirY * flashLen * 0.85,
                barrelX + nx * flashWidth * 0.6, barrelY + ny * flashWidth * 0.6,
                barrelX - gunDirX * flashLen * 0.15, barrelY - gunDirY * flashLen * 0.15
            ]);
            g.endFill();
            
            // Side sparks/flaps (cross shape muzzle flash)
            g.beginFill(0xfbbf24, 0.85);
            const sideLen = flashLen * 0.45;
            const sideW = flashWidth * 0.6;
            // Left flank
            g.drawPolygon([
                barrelX, barrelY,
                barrelX + (gunDirX - nx) * sideLen, barrelY + (gunDirY - ny) * sideLen,
                barrelX - nx * sideW, barrelY - ny * sideW
            ]);
            // Right flank
            g.drawPolygon([
                barrelX, barrelY,
                barrelX + (gunDirX + nx) * sideLen, barrelY + (gunDirY + ny) * sideLen,
                barrelX + nx * sideW, barrelY + ny * sideW
            ]);
            g.endFill();
        }
    }
    
    // Circular Reloading indicator above helmet
    if (isReloading.value && activeWep && activeWep.reloadTime > 0) {
        const progress = Math.max(0, Math.min(1.0, 1.0 - (reloadTimer.value / activeWep.reloadTime)));
        const startAng = -Math.PI / 2; // start from top
        const endAng = startAng + (Math.PI * 2 * progress);
        
        // Draw background track ring
        g.lineStyle(2.2, 0x334155, 0.45);
        g.drawCircle(0, -25, 7.5);
        
        // Draw active progress arc
        g.lineStyle(2.2, 0x38bdf8, 1.0); // Bright cyan
        g.arc(0, -25, 7.5, startAng, endAng);
    }
}

export function drawMercsPixi() {
    gameState.mercenaries.forEach(m => {
        if (!m.graphics) {
            m.graphics = new PIXI.Graphics();
            pixi.shakeContainer.addChild(m.graphics);
        }
        
        const g = m.graphics;
        g.clear();
        
        if (!m.hired) {
            g.visible = false;
            return;
        }
        g.visible = true;

        // Ensure position is initialized dynamically
        if (m.x === undefined) {
            const barricadeY = canvas.clientHeight - 160;
            m.y = barricadeY + 30;
            if (m.id === 'merc_recruit') m.x = canvas.clientWidth * 0.20;
            else if (m.id === 'merc_sniper') m.x = canvas.clientWidth * 0.35;
            else if (m.id === 'merc_gunner') m.x = canvas.clientWidth * 0.65;
            else if (m.id === 'merc_medic') m.x = canvas.clientWidth * 0.80;
            else if (m.id === 'merc_drone') m.x = canvas.clientWidth * 0.92;
            else m.x = canvas.clientWidth * 0.5;
            
            m.angle = -Math.PI / 2;
            m.screenAngle = -Math.PI / 2;
            m.walkCycle = 0;
            m.speed = 110;
            m.targetX = m.x;
            m.flashTimer = 0;
            m.recoil = 0;
        }
        
        const mercWepId = getMercenaryWeaponId(m.id);
        const mercWep = gameState.weapons.find(w => w.id === mercWepId);
        
        const range = getMercenaryRange(m.id);
        const target = getPrioritizedZombie(m.x, m.y, range);
        let mercAim = -Math.PI / 2;
        if (target) {
            mercAim = Math.atan2(target.y - m.y, target.x - m.x);
        }
        
        if (m.id === 'merc_drone') {
            const floatOffset = Math.sin(Date.now() / 240) * 5;
            const drawX = m.x - Math.cos(mercAim) * (m.recoil || 0);
            const drawY = m.y + floatOffset - Math.sin(mercAim) * (m.recoil || 0);
            const pt = project3D(drawX, drawY, 12);
            g.position.set(pt.x, pt.y);
            g.scale.set(pt.scale * 1.3);
            
            g.lineStyle(0);
            g.beginFill(0x64748b);
            g.drawCircle(0, 0, 7);
            g.endFill();
            
            const coreRad = 2.5 + Math.sin(Date.now() / 100) * 0.5;
            g.beginFill(0x06b6d4);
            g.drawCircle(0, 0, coreRad);
            g.endFill();
            
            g.lineStyle(1.5, 0x334155);
            g.moveTo(-7, -4);
            g.lineTo(-12, -7);
            g.moveTo(7, -4);
            g.lineTo(12, -7);
            
            const gunDirX = Math.cos(mercAim);
            const gunDirY = Math.sin(mercAim);
            g.lineStyle(2.5, 0x1e293b);
            g.moveTo(0, 0);
            g.lineTo(gunDirX * 12, gunDirY * 12);
            
            if (mercWep && m.flashTimer && m.flashTimer > 0) {
                const barrelX = gunDirX * 12;
                const barrelY = gunDirY * 12;
                
                let flashLen = 14;
                let flashWidth = 4.5;
                switch (mercWepId) {
                    case 'pistol': flashLen = 11; flashWidth = 3.5; break;
                    case 'smg': flashLen = 13; flashWidth = 4.5; break;
                    case 'shotgun': flashLen = 22; flashWidth = 9; break;
                    case 'rifle': flashLen = 18; flashWidth = 5; break;
                    case 'gatling': flashLen = 22; flashWidth = 6.5; break;
                    case 'nuclear': flashLen = 28; flashWidth = 10; break;
                    case 'plasma': flashLen = 16; flashWidth = 6.5; break;
                    default: flashLen = 14; flashWidth = 4.5;
                }
                
                const nx = -gunDirY;
                const ny = gunDirX;
                
                g.lineStyle(0);
                g.beginFill(0xfbbf24, 0.45);
                g.drawPolygon([
                    barrelX - nx * flashWidth * 1.4, barrelY - ny * flashWidth * 1.4,
                    barrelX + gunDirX * flashLen * 1.4, barrelY + gunDirY * flashLen * 1.4,
                    barrelX + nx * flashWidth * 1.4, barrelY + ny * flashWidth * 1.4,
                    barrelX - gunDirX * flashLen * 0.3, barrelY - gunDirY * flashLen * 0.3
                ]);
                g.endFill();
                
                g.beginFill(0xffffff, 0.95);
                g.drawPolygon([
                    barrelX - nx * flashWidth * 0.6, barrelY - ny * flashWidth * 0.6,
                    barrelX + gunDirX * flashLen * 0.85, barrelY + gunDirY * flashLen * 0.85,
                    barrelX + nx * flashWidth * 0.6, barrelY + ny * flashWidth * 0.6,
                    barrelX - gunDirX * flashLen * 0.15, barrelY - gunDirY * flashLen * 0.15
                ]);
                g.endFill();
            }
            
            if (m.isReloading && mercWep && mercWep.reloadTime > 0) {
                const progress = Math.max(0, Math.min(1.0, 1.0 - (m.reloadTimer / (mercWep.reloadTime * getReloadTimeModifier()))));
                const startAng = -Math.PI / 2;
                const endAng = startAng + (Math.PI * 2 * progress);
                
                g.lineStyle(2.2, 0x334155, 0.45);
                g.drawCircle(0, -18, 5.5);
                
                g.lineStyle(2.2, 0x06b6d4, 1.0);
                g.arc(0, -18, 5.5, startAng, endAng);
            }
        } else {
            const drawX = m.x - Math.cos(mercAim) * (m.recoil || 0);
            const drawY = m.y - Math.sin(mercAim) * (m.recoil || 0);
            const pt = project3D(drawX, drawY, 10);
            const sc = pt.scale * 1.25;
            
            g.position.set(pt.x, pt.y);
            g.scale.set(sc);
            g.rotation = 0;
            
            const legSway = Math.sin(m.walkCycle || 0) * 3;
            g.lineStyle(0);
            g.beginFill(0x020617);
            g.drawEllipse(-5, 14 + legSway, 3, 1.8);
            g.drawEllipse(5, 14 - legSway, 3, 1.8);
            g.endFill();
            
            g.lineStyle(4.5, 0x0f172a);
            g.moveTo(-4, 2);
            g.lineTo(-5, 14 + legSway);
            g.moveTo(4, 2);
            g.lineTo(5, 14 - legSway);
            
            let torsoColor = 0x1e3a8a;
            let backpackColor = 0xea580c;
            let helmetColor = 0x334155;
            
            if (m.id === 'merc_recruit') {
                torsoColor = 0x15803d;
                backpackColor = 0x166534;
                helmetColor = 0x14532d;
            } else if (m.id === 'merc_sniper') {
                torsoColor = 0x475569;
                backpackColor = 0x1e293b;
                helmetColor = 0x0f172a;
            } else if (m.id === 'merc_gunner') {
                torsoColor = 0x7c2d12;
                backpackColor = 0x7f1d1d;
                helmetColor = 0x451a03;
            } else if (m.id === 'merc_medic') {
                torsoColor = 0x0d9488;
                backpackColor = 0xe2e8f0;
                helmetColor = 0x0f766e;
            }
            
            g.lineStyle(1.8, torsoColor * 0.8);
            g.beginFill(torsoColor);
            g.drawEllipse(0, -2, 10, 8);
            g.endFill();
            
            g.lineStyle(1.2, backpackColor * 0.8);
            g.beginFill(backpackColor);
            g.drawRoundedRect(-5.5, -6.5, 11, 9, 2);
            g.endFill();
            
            // Balo sọc đen scifi
            g.lineStyle(1.0, 0x1e293b, 0.65);
            g.moveTo(-3, -2);
            g.lineTo(3, -2);
            g.moveTo(-3, 1);
            g.lineTo(3, 1);
            
            g.lineStyle(0);
            g.beginFill(helmetColor);
            g.drawCircle(0, -11, 6.2);
            g.endFill();
            
            g.lineStyle(1.2, 0x0f172a);
            g.moveTo(-4.5, -9);
            g.lineTo(4.5, -9);
            
            const armLen = 10;
            const handX = Math.cos(mercAim) * armLen;
            const handY = -4 + Math.sin(mercAim) * armLen;
            
            g.lineStyle(3.5, torsoColor * 0.9);
            g.moveTo(-6, -4);
            g.lineTo(handX, handY);
            g.moveTo(6, -4);
            g.lineTo(handX, handY);
            
            let gunW = 4, gunH = 12, gunColor = 0x1e293b, barrelExt = 5;
            switch (mercWepId) {
                case 'pistol':   gunW=3; gunH=8;  gunColor=0x1e293b; barrelExt=5;  break;
                case 'smg':      gunW=4; gunH=13; gunColor=0x1e293b; barrelExt=4;  break;
                case 'shotgun':  gunW=5; gunH=15; gunColor=0x451a03; barrelExt=5;  break;
                case 'rifle':    gunW=4; gunH=18; gunColor=0x1e293b; barrelExt=6;  break;
                case 'flame':    gunW=6; gunH=12; gunColor=0xef4444; barrelExt=4;  break;
                case 'plasma':   gunW=6; gunH=16; gunColor=0x0891b2; barrelExt=5;  break;
                case 'freeze':   gunW=5; gunH=14; gunColor=0x0284c7; barrelExt=5;  break;
                case 'gatling':  gunW=7; gunH=18; gunColor=0xd97706; barrelExt=8;  break;
                case 'tesla':    gunW=6; gunH=17; gunColor=0x0891b2; barrelExt=6;  break;
                case 'nuclear':  gunW=7; gunH=20; gunColor=0x15803d; barrelExt=7;  break;
            }
            
            const gunDirX = Math.cos(mercAim);
            const gunDirY = Math.sin(mercAim);
            const nx = -gunDirY;
            const ny = gunDirX;
            const hw = gunW * 0.5;
            const gx = handX;
            const gy = handY;
            
            g.beginFill(gunColor);
            g.drawPolygon([
                gx - nx * hw,                  gy - ny * hw,
                gx + nx * hw,                  gy + ny * hw,
                gx + gunDirX * gunH + nx * hw, gy + gunDirY * gunH + ny * hw,
                gx + gunDirX * gunH - nx * hw, gy + gunDirY * gunH - nx * hw, // Wait, typo check: gy + gunDirY * gunH - nx * hw in targetContent is gy + gunDirY * gunH - nx * hw, let's look at lines 852-855: gx - nx * hw, gy - ny * hw, gx + nx * hw, gy + ny * hw, gx + gunDirX * gunH + nx * hw, gy + gunDirY * gunH + ny * hw, gx + gunDirX * gunH - nx * hw, gy + gunDirY * gunH - ny * hw
            ]);
            g.endFill();
            
            g.lineStyle(1.2, 0xffffff, 0.22);
            g.moveTo(gx - nx * hw, gy - ny * hw);
            g.lineTo(gx + gunDirX * gunH - nx * hw, gy + gunDirY * gunH - ny * hw);
            
            const barrelX = gx + gunDirX * (gunH + barrelExt);
            const barrelY = gy + gunDirY * (gunH + barrelExt);
            
            g.lineStyle(0);
            g.beginFill(0x020617);
            g.drawCircle(barrelX, barrelY, gunW * 0.35);
            g.endFill();
            
            if (mercWep && m.flashTimer && m.flashTimer > 0) {
                let flashLen = 14;
                let flashWidth = 4.5;
                switch (mercWepId) {
                    case 'pistol': flashLen = 11; flashWidth = 3.5; break;
                    case 'smg': flashLen = 13; flashWidth = 4.5; break;
                    case 'shotgun': flashLen = 22; flashWidth = 9; break;
                    case 'rifle': flashLen = 18; flashWidth = 5; break;
                    case 'gatling': flashLen = 22; flashWidth = 6.5; break;
                    case 'nuclear': flashLen = 28; flashWidth = 10; break;
                    case 'plasma': flashLen = 16; flashWidth = 6.5; break;
                    default: flashLen = 14; flashWidth = 4.5;
                }
                
                g.lineStyle(0);
                
                // Outer glow spike (yellow/orange)
                g.beginFill(0xfbbf24, 0.45);
                g.drawPolygon([
                    barrelX - nx * flashWidth * 1.4, barrelY - ny * flashWidth * 1.4,
                    barrelX + gunDirX * flashLen * 1.4, barrelY + gunDirY * flashLen * 1.4,
                    barrelX + nx * flashWidth * 1.4, barrelY + ny * flashWidth * 1.4,
                    barrelX - gunDirX * flashLen * 0.3, barrelY - gunDirY * flashLen * 0.3
                ]);
                g.endFill();
                
                // Inner hot core spike (white/yellow)
                g.beginFill(0xffffff, 0.95);
                g.drawPolygon([
                    barrelX - nx * flashWidth * 0.6, barrelY - ny * flashWidth * 0.6,
                    barrelX + gunDirX * flashLen * 0.85, barrelY + gunDirY * flashLen * 0.85,
                    barrelX + nx * flashWidth * 0.6, barrelY + ny * flashWidth * 0.6,
                    barrelX - gunDirX * flashLen * 0.15, barrelY - gunDirY * flashLen * 0.15
                ]);
                g.endFill();
                
                // Side sparks/flaps (cross shape muzzle flash)
                g.beginFill(0xfbbf24, 0.85);
                const sideLen = flashLen * 0.45;
                const sideW = flashWidth * 0.6;
                // Left flank
                g.drawPolygon([
                    barrelX, barrelY,
                    barrelX + (gunDirX - nx) * sideLen, barrelY + (gunDirY - ny) * sideLen,
                    barrelX - nx * sideW, barrelY - ny * sideW
                ]);
                // Right flank
                g.drawPolygon([
                    barrelX, barrelY,
                    barrelX + (gunDirX + nx) * sideLen, barrelY + (gunDirY + ny) * sideLen,
                    barrelX + nx * sideW, barrelY + ny * sideW
                ]);
                g.endFill();
            }
            
            if (m.isReloading && mercWep && mercWep.reloadTime > 0) {
                const progress = Math.max(0, Math.min(1.0, 1.0 - (m.reloadTimer / (mercWep.reloadTime * getReloadTimeModifier()))));
                const startAng = -Math.PI / 2;
                const endAng = startAng + (Math.PI * 2 * progress);
                
                g.lineStyle(2.2, 0x334155, 0.45);
                g.drawCircle(0, -25, 7.5);
                
                g.lineStyle(2.2, 0x38bdf8, 1.0);
                g.arc(0, -25, 7.5, startAng, endAng);
            }
        }
    });
}

export function drawBulletsPixi() {
    if (!pixi.bulletsGraphics) return;
    const g = pixi.bulletsGraphics;
    g.clear();
    
    activeFlashes.forEach(f => {
        const pt = project3D(f.x, f.y, 0);
        g.lineStyle(0);
        g.beginFill(0xfde047, 0.04 * (f.life / 0.05)); // Faint ambient light glow on ground
        g.drawCircle(pt.x, pt.y, 45 * pt.scale);
        g.endFill();
        g.beginFill(0xfbbf24, 0.10 * (f.life / 0.05)); // Faint center reflection
        g.drawCircle(pt.x, pt.y, 14 * pt.scale);
        g.endFill();
    });
    
    bulletPool.forEach(b => {
        if (!b.active) return;
        
        const ptScale = project3D(b.x, b.y, 0).scale;
        const drawX = b.screenX;
        const drawY = b.screenY - (b.z || 0) * ptScale;
        
        if (b.z && b.z > 0) {
            g.lineStyle(0);
            g.beginFill(0x000000, 0.25);
            g.drawCircle(b.screenX, b.screenY, 4 * ptScale);
            g.endFill();
        }
        
        const bSize = (b.isFlame ? b.size : (b.isNuclear ? 8 : 3.5)) * ptScale;
        
        if (b.isPlasma) {
            g.lineStyle(0);
            g.beginFill(0x22d3ee);
            g.drawRect(drawX - bSize, drawY - bSize, bSize * 2, bSize * 2);
            g.endFill();
        } else if (b.isFlame) {
            const ageRatio = Math.max(0, b.life / 0.35);
            const rad = b.size * ptScale;
            
            // Wobble/Turbulence effect to make the fire feel alive
            const wobbleX = Math.sin(b.life * 60 + b.startX) * 4 * ptScale;
            const wobbleY = Math.cos(b.life * 60 + b.startY) * 4 * ptScale;
            const fx = drawX + wobbleX;
            const fy = drawY + wobbleY;
            
            g.lineStyle(0);
            
            // Outer red flame glow
            g.beginFill(0xef4444, ageRatio * 0.25);
            g.drawCircle(fx, fy, rad);
            g.endFill();
            
            // Middle orange flame
            g.beginFill(0xf97316, ageRatio * 0.65);
            g.drawCircle(fx, fy, rad * 0.7);
            g.endFill();
            
            // Inner yellow flame
            g.beginFill(0xfacc15, ageRatio * 0.85);
            g.drawCircle(fx, fy, rad * 0.45);
            g.endFill();
            
            // Hot white core
            g.beginFill(0xffffff, ageRatio * 0.95);
            g.drawCircle(fx, fy, rad * 0.22);
            g.endFill();
            
            // Blue flame base close to nozzle
            if (b.life > 0.28) {
                g.beginFill(0x38bdf8, (b.life - 0.28) * 6);
                g.drawCircle(fx, fy, rad * 0.35);
                g.endFill();
            }
        } else if (b.isFreeze) {
            g.lineStyle(0);
            g.beginFill(0x38bdf8);
            g.drawCircle(drawX, drawY, bSize);
            g.endFill();
            
            g.lineStyle(1.2 * ptScale, 0x06b6d4);
            g.drawCircle(drawX, drawY, bSize * 1.75);
        } else if (b.isGatling) {
            g.lineStyle((b.isCrit ? 4.0 : 2.2) * ptScale, 0xeab308);
            g.moveTo(drawX, drawY);
            
            const tailX = b.screenX - b.screenVx * 1.1;
            const tailY = b.screenY - b.screenVy * 1.1 - (b.z || 0) * ptScale;
            g.lineTo(tailX, tailY);
            
            g.lineStyle(0.8 * ptScale, 0xfef08a);
            g.moveTo(drawX, drawY);
            const tailX2 = b.screenX - b.screenVx * 0.7;
            const tailY2 = b.screenY - b.screenVy * 0.7 - (b.z || 0) * ptScale;
            g.lineTo(tailX2, tailY2);
        } else if (b.isTesla) {
            g.lineStyle(3 * ptScale, 0x06b6d4);
            g.moveTo(drawX, drawY);
            const tailX = b.screenX - b.screenVx * 0.7;
            const tailY = b.screenY - b.screenVy * 0.7 - (b.z || 0) * ptScale;
            g.lineTo(tailX, tailY);
        } else if (b.isNuclear) {
            g.lineStyle(0);
            g.beginFill(0x22c55e);
            g.drawCircle(drawX, drawY, 8 * ptScale);
            g.endFill();
            
            g.lineStyle(2 * ptScale, 0xa3e635);
            g.drawCircle(drawX, drawY, 12 * ptScale);
        } else {
            let width = b.isCrit ? 3.0 : 1.5;
            if (b.isShotgun) {
                if (b.phase === 2) width *= 0.65;
                if (b.phase === 3) width *= 0.38;
            }
            g.lineStyle(width * ptScale, b.isCrit ? 0xf97316 : 0xeab308);
            g.moveTo(drawX, drawY);
            const tailX = b.screenX - b.screenVx * 1.0;
            const tailY = b.screenY - b.screenVy * 1.0 - (b.z || 0) * ptScale;
            g.lineTo(tailX, tailY);
        }
    });
}

export function drawParticlesPixi() {
    if (!pixi.particlesGraphics) return;
    const g = pixi.particlesGraphics;
    g.clear();
    
    particlePool.forEach(p => {
        if (!p.active) return;
        
        const pt = project3D(p.x, p.y, p.z || 0);
        const ptShadow = project3D(p.x, p.y, 0);
        const ratio = Math.max(0, p.life / p.maxLife);
        
        if ((p.type === 'shell' || p.type === 'coin' || p.type === 'metal_shard') && p.z > 0) {
            g.lineStyle(0);
            g.beginFill(0x000000, 0.18 * ratio);
            g.drawCircle(ptShadow.x, ptShadow.y, p.size * 0.8 * ptShadow.scale);
            g.endFill();
        }
        
        const pSize = p.size * pt.scale;
        
        if (p.type === 'shell') {
            g.lineStyle(0);
            g.beginFill(0xeab308, ratio);
            
            const cos = Math.cos(p.angle);
            const sin = Math.sin(p.angle);
            const w = pSize * 2;
            const h = pSize;
            
            const pts = [
                { x: -w/2, y: -h/2 },
                { x: w/2, y: -h/2 },
                { x: w/2, y: h/2 },
                { x: -w/2, y: h/2 }
            ].map(ptCoord => ({
                x: pt.x + (ptCoord.x * cos - ptCoord.y * sin),
                y: pt.y + (ptCoord.x * sin + ptCoord.y * cos)
            }));
            
            g.moveTo(pts[0].x, pts[0].y);
            g.lineTo(pts[1].x, pts[1].y);
            g.lineTo(pts[2].x, pts[2].y);
            g.lineTo(pts[3].x, pts[3].y);
            g.closePath();
            g.endFill();
        } else if (p.type === 'metal_shard') {
            g.lineStyle(1, 0x3f3f46, ratio);
            g.beginFill(0xa1a1aa, ratio);
            
            const cos = Math.cos(p.angle);
            const sin = Math.sin(p.angle);
            const w = pSize * 1.8;
            const h = pSize * 1.2;
            
            const pts = [
                { x: -w/2, y: -h/2 },
                { x: w/2, y: -h/3 },
                { x: w/4, y: h/2 },
                { x: -w/2, y: h/3 }
            ].map(ptCoord => ({
                x: pt.x + (ptCoord.x * cos - ptCoord.y * sin),
                y: pt.y + (ptCoord.x * sin + ptCoord.y * cos)
            }));
            
            g.moveTo(pts[0].x, pts[0].y);
            g.lineTo(pts[1].x, pts[1].y);
            g.lineTo(pts[2].x, pts[2].y);
            g.lineTo(pts[3].x, pts[3].y);
            g.closePath();
            g.endFill();
        } else if (p.type === 'coin') {
            g.beginFill(0xfacc15, ratio);
            g.lineStyle(1, 0xeab308, ratio);
            g.drawCircle(pt.x, pt.y, pSize);
            g.endFill();
        } else if (p.type === 'corpse_part') {
            const parts = p.color.split(':');
            const baseColorStr = parts[0] || '#16a34a';
            const partType = parts[1] || 'torso';
            
            const cos = Math.cos(p.angle);
            const sin = Math.sin(p.angle);
            
            const parseColorStr = (str) => {
                if (str.startsWith('#')) return parseInt(str.slice(1), 16);
                return 0x16a34a;
            };
            const colorHex = parseColorStr(baseColorStr);
            
            if (partType === 'head') {
                g.lineStyle(pSize / 3, 0x111827, ratio);
                g.beginFill(colorHex, ratio);
                g.drawCircle(pt.x, pt.y, pSize * 0.5);
                g.endFill();
                
                g.lineStyle(0);
                g.beginFill(0xef4444, ratio);
                g.drawCircle(pt.x + (p.size * 0.15 * cos) * pt.scale, pt.y + (p.size * 0.15 * sin) * pt.scale, pSize * 0.12);
                g.endFill();
            } else if (partType === 'torso') {
                g.lineStyle(pSize / 3, 0x111827, ratio);
                g.beginFill(colorHex, ratio);
                g.drawEllipse(pt.x, pt.y, pSize * 0.7, pSize * 0.45);
                g.endFill();
                
                g.lineStyle(pSize / 4, 0xfafafa, ratio);
                g.moveTo(pt.x - (p.size * 0.5 * cos) * pt.scale, pt.y - (p.size * 0.5 * sin) * pt.scale);
                g.lineTo(pt.x - (p.size * 0.8 * cos) * pt.scale, pt.y - (p.size * 0.8 * sin) * pt.scale);
            } else {
                g.lineStyle(pSize / 2.5, colorHex, ratio);
                const rx1 = pt.x - (p.size * 0.5 * cos) * pt.scale;
                const ry1 = pt.y - (p.size * 0.5 * sin) * pt.scale;
                const rx2 = pt.x + (p.size * 0.5 * cos) * pt.scale;
                const ry2 = pt.y + (p.size * 0.5 * sin) * pt.scale;
                g.moveTo(rx1, ry1);
                g.lineTo(rx2, ry2);
                
                g.lineStyle(0);
                g.beginFill(0x7f1d1d, ratio);
                g.drawCircle(rx2, ry2, pSize * 0.18);
                g.endFill();
            }
        } else if (p.type === 'corpse') {
            const cos = Math.cos(p.angle);
            const sin = Math.sin(p.angle);
            
            g.lineStyle(pSize / 3, 0x111827, ratio);
            
            const drawLine = (x1, y1, x2, y2) => {
                const rx1 = pt.x + (x1 * cos - y1 * sin) * pt.scale;
                const ry1 = pt.y + (x1 * sin + y1 * cos) * pt.scale;
                const rx2 = pt.x + (x2 * cos - y2 * sin) * pt.scale;
                const ry2 = pt.y + (x2 * sin + y2 * cos) * pt.scale;
                g.moveTo(rx1, ry1);
                g.lineTo(rx2, ry2);
            };
            
            drawLine(-p.size * 0.6, -p.size * 0.3, -p.size * 1.1, -p.size * 0.5);
            drawLine(-p.size * 0.6, p.size * 0.3, -p.size * 1.1, p.size * 0.5);
            
            g.lineStyle(pSize / 3, 0x111827, ratio);
            const parseColorStr = (str) => {
                if (str.startsWith('#')) return parseInt(str.slice(1), 16);
                return 0x14532d;
            };
            g.beginFill(parseColorStr(p.color), ratio);
            g.drawCircle(pt.x, pt.y, pSize * 0.75);
            g.endFill();
            
            g.lineStyle(pSize / 3, 0x111827, ratio);
            g.beginFill(0x0f7660, ratio);
            const headX = pt.x + (p.size * 0.6 * cos) * pt.scale;
            const headY = pt.y + (p.size * 0.6 * sin) * pt.scale;
            g.drawCircle(headX, headY, pSize * 0.5);
            g.endFill();
            
            g.lineStyle(0);
            g.beginFill(0xb91c1c, ratio);
            const bloodX = pt.x + (p.size * 0.7 * cos - -p.size * 0.1 * sin) * pt.scale;
            const bloodY = pt.y + (p.size * 0.7 * sin + -p.size * 0.1 * cos) * pt.scale;
            g.drawCircle(bloodX, bloodY, pSize * 0.2);
            g.endFill();
        } else {
            const parseColorStr = (str) => {
                if (str.startsWith('#')) return parseInt(str.slice(1), 16);
                if (str.startsWith('rgba')) {
                    const matches = str.match(/\d+/g);
                    if (matches) {
                        return (parseInt(matches[0]) << 16) + (parseInt(matches[1]) << 8) + parseInt(matches[2]);
                    }
                }
                return 0xef4444;
            };
            const parseAlphaStr = (str) => {
                if (str.startsWith('rgba')) {
                    const parts = str.split(',');
                    if (parts.length === 4) {
                        return parseFloat(parts[3]);
                    }
                }
                return 1.0;
            };
            
            g.lineStyle(0);
            if (p.type === 'spark') {
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                const stretch = Math.min(16, speed * 1.5) * pt.scale;
                const angle = Math.atan2(p.vy, p.vx);
                
                // Draw as a beautiful streak line with round caps
                g.lineStyle(pSize * 0.9, parseColorStr(p.color), ratio * parseAlphaStr(p.color), 0.5, true);
                g.moveTo(pt.x, pt.y);
                g.lineTo(pt.x - Math.cos(angle) * stretch, pt.y - Math.sin(angle) * stretch);
            } else {
                g.beginFill(parseColorStr(p.color), ratio * parseAlphaStr(p.color));
                g.drawRect(pt.x - pSize, pt.y - pSize, pSize * 2, pSize * 2);
                g.endFill();
            }
        }
    });
}

export function drawBombersPixi() {
    if (!pixi.bombersGraphics) return;
    const g = pixi.bombersGraphics;
    g.clear();
    
    activeBomberPlanes.forEach(plane => {
        const pt = project3D(plane.x, plane.y, 150);
        g.beginFill(0x0f232a, 0.9);
        g.lineStyle(1 * pt.scale, 0xef4444);
        
        g.moveTo(pt.x + 35 * pt.scale, pt.y + 0);
        g.lineTo(pt.x - 10 * pt.scale, pt.y - 22 * pt.scale);
        g.lineTo(pt.x - 5 * pt.scale, pt.y - 6 * pt.scale);
        g.lineTo(pt.x - 30 * pt.scale, pt.y - 8 * pt.scale);
        g.lineTo(pt.x - 28 * pt.scale, pt.y + 0);
        g.lineTo(pt.x - 30 * pt.scale, pt.y + 8 * pt.scale);
        g.lineTo(pt.x - 5 * pt.scale, pt.y + 6 * pt.scale);
        g.lineTo(pt.x - 10 * pt.scale, pt.y + 22 * pt.scale);
        g.closePath();
        g.endFill();
        
        g.lineStyle(0);
        g.beginFill(0xf97316);
        g.drawCircle(pt.x - 29 * pt.scale, pt.y - 3 * pt.scale, 2.5 * pt.scale);
        g.drawCircle(pt.x - 29 * pt.scale, pt.y + 3 * pt.scale, 2.5 * pt.scale);
        g.endFill();
    });
    
    activeAirstrikeBombs.forEach(bomb => {
        g.lineStyle(0);
        g.beginFill(0x374151);
        
        const cos = Math.cos(bomb.angle);
        const sin = Math.sin(bomb.angle);
        
        const progress = Math.max(0, Math.min(1, (bomb.y - bomb.startY) / (bomb.targetY - bomb.startY)));
        const bombZ = 150 * (1.0 - progress);
        
        const pt = project3D(bomb.x, bomb.y, bombZ);
        const ptShadow = project3D(bomb.x, bomb.y, 0);
        
        if (bombZ > 0) {
            g.beginFill(0x000000, 0.25);
            g.drawCircle(ptShadow.x, ptShadow.y, 5 * ptShadow.scale);
            g.endFill();
        }
        
        const drawRotatedRect = (x, y, w, h) => {
            const x0 = x - w/2;
            const y0 = y - h/2;
            const pts = [
                { x: x0, y: y0 },
                { x: x0 + w, y: y0 },
                { x: x0 + w, y: y0 + h },
                { x: x0, y: y0 + h }
            ];
            const rotPts = pts.map(p => ({
                x: pt.x + (p.x * cos - p.y * sin) * pt.scale,
                y: pt.y + (p.x * sin + p.y * cos) * pt.scale
            }));
            g.beginFill(0x374151);
            g.moveTo(rotPts[0].x, rotPts[0].y);
            g.lineTo(rotPts[1].x, rotPts[1].y);
            g.lineTo(rotPts[2].x, rotPts[2].y);
            g.lineTo(rotPts[3].x, rotPts[3].y);
            g.closePath();
            g.endFill();
        };
        
        drawRotatedRect(-2, 0, 12, 6);
        
        g.beginFill(0xef4444);
        const nosePts = [
            { x: 4, y: -3 },
            { x: 9, y: 0 },
            { x: 4, y: 3 }
        ].map(p => ({
            x: pt.x + (p.x * cos - p.y * sin) * pt.scale,
            y: pt.y + (p.x * sin + p.y * cos) * pt.scale
        }));
        g.moveTo(nosePts[0].x, nosePts[0].y);
        g.lineTo(nosePts[1].x, nosePts[1].y);
        g.lineTo(nosePts[2].x, nosePts[2].y);
        g.closePath();
        g.endFill();
        
        g.beginFill(0x1f2937);
        const tailPts = [
            { x: -8, y: -3 },
            { x: -12, y: -6 },
            { x: -10, y: 0 },
            { x: -12, y: 6 },
            { x: -8, y: 3 }
        ].map(p => ({
            x: pt.x + (p.x * cos - p.y * sin) * pt.scale,
            y: pt.y + (p.x * sin + p.y * cos) * pt.scale
        }));
        g.moveTo(tailPts[0].x, tailPts[0].y);
        g.lineTo(tailPts[1].x, tailPts[1].y);
        g.lineTo(tailPts[2].x, tailPts[2].y);
        g.lineTo(tailPts[3].x, tailPts[3].y);
        g.lineTo(tailPts[4].x, tailPts[4].y);
        g.closePath();
        g.endFill();
    });
}

export function drawAmbientPixi() {
    if (!pixi.ambientGraphics) return;
    const g = pixi.ambientGraphics;
    g.clear();
    
    const cycleVal = Math.sin(dayNightCycle.value);
    const nightIntensity = Math.max(0, cycleVal * 0.40);
    if (nightIntensity > 0) {
        g.lineStyle(0);
        g.beginFill(0x0f172a, nightIntensity);
        g.drawRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        g.endFill();
    }
}

export function drawGame() {
    if (!pixi.ready) return;
    
    if (shakeTime.value > 0) {
        const intensity = 7.5 * (shakeTime.value / 0.45);
        const dx = (Math.random() - 0.5) * intensity;
        const dy = (Math.random() - 0.5) * intensity;
        pixi.shakeContainer.position.set(dx, dy);
    } else {
        pixi.shakeContainer.position.set(0, 0);
    }
    
    drawBarricadePixi();
    drawPlayerPixi();
    drawMercsPixi();
    drawBulletsPixi();
    drawParticlesPixi();
    drawBombersPixi();
    drawAmbientPixi();
    
    zombies.forEach(z => {
        if (z && z.active) z.draw();
    });
    
    if (pixi.app && pixi.app.renderer) {
        pixi.app.renderer.render(pixi.app.stage);
    }
}
