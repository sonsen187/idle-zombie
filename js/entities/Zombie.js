import { project3D } from '../helpers.js';
import { playCritChime } from '../audio.js';
import { getAvailableParticle, spawnExplosion, spawnBloodSpurt } from './Particle.js';
import { getAvailableText } from './FloatingText.js';
import { pixi, gameState, zombies, canvas, shakeTime } from '../state.js';
import { hooks } from './hooks.js';

export class Zombie {
    constructor(wave, isBoss = false, groupOffset = 0) {
        const logicalWidth = canvas.width;

        this.id = 'z_' + Math.random().toString(36).substr(2, 9);
        this.isBoss = isBoss;
        this.y = -35 - Math.random() * 60 - (groupOffset * 20);
        this.x = logicalWidth * 0.20 + Math.random() * (logicalWidth * 0.60) + (Math.sin(groupOffset) * 12); 
        this.impulseX = 0;
        this.impulseY = 0;
        this.z = 0;
        this.vz = 0;
        
        const scaleMult = Math.pow(1.18, wave - 1);
        
        const isGolden = !isBoss && (Math.random() < 0.08); 
        const normalTypes = ['normal', 'runner', 'armored', 'toxic', 'necromancer'];
        this.type = isBoss ? 'boss' : (isGolden ? 'golden' : normalTypes[Math.floor(Math.random() * normalTypes.length)]);
        
        let hpMultiplier = 1.0;
        let speedMultiplier = 1.0;
        let dmgMultiplier = 1.0;
        let goldMultiplier = 1.0;
        
        this.isFrozen = false;
        this.freezeTimer = 0;
        this.isBurning = false;
        this.burnTimer = 0;
        this.burnDamage = 0;
        this.burnTickTimer = 0;
        
        if (this.type === 'runner') {
            hpMultiplier = 0.6;
            speedMultiplier = 1.7;
            dmgMultiplier = 0.8;
            goldMultiplier = 0.9;
            this.name = "Zombie Siêu Tốc";
        } else if (this.type === 'armored') {
            hpMultiplier = 4.2;
            speedMultiplier = 0.45;
            dmgMultiplier = 1.2;
            goldMultiplier = 1.8;
            this.name = "Zombie Thiết Giáp";
        } else if (this.type === 'toxic') {
            hpMultiplier = 1.6;
            speedMultiplier = 1.1;
            dmgMultiplier = 1.6;
            goldMultiplier = 1.4;
            this.name = "Đột Biến Axít";
        } else if (this.type === 'necromancer') {
            hpMultiplier = 2.2;
            speedMultiplier = 0.5;
            dmgMultiplier = 1.0;
            goldMultiplier = 2.2;
            this.name = "Xác Sống Triệu Hồi";
            this.summonTimer = 2.0;
        } else if (this.type === 'golden') {
            hpMultiplier = 1.2;
            speedMultiplier = 1.6;
            dmgMultiplier = 0.7;
            goldMultiplier = 10.0;
            this.name = "Thây Ma Mạ Vàng";
        } else if (this.type === 'boss') {
            const bossTypes = ['Butcher', 'Titan Armored', 'Overlord'];
            this.bossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
            
            if (this.bossType === 'Titan Armored') {
                hpMultiplier = 16.0;
                speedMultiplier = 0.22;
                dmgMultiplier = 2.6;
                goldMultiplier = 3.5;
                this.name = "Boss Titan Thiết Giáp";
            } else if (this.bossType === 'Butcher') {
                hpMultiplier = 9.0;
                speedMultiplier = 0.42;
                dmgMultiplier = 2.0;
                goldMultiplier = 2.4;
                this.name = "Boss Đồ Tể Cuồng Loạn";
            } else {
                hpMultiplier = 7.0;
                speedMultiplier = 0.58;
                dmgMultiplier = 1.5;
                goldMultiplier = 2.6;
                this.name = "Boss Chúa Tể Ám Ảnh";
            }
        } else {
            this.name = "Zombie Thường";
        }

        const baseHpValue = isBoss ? 500 : 15;
        this.maxHp = Math.round(baseHpValue * hpMultiplier * scaleMult);
        this.hp = this.maxHp;
        
        this.speed = (isBoss ? 0.35 : 0.55 + Math.random() * 0.45) * speedMultiplier * (1 + Math.min(0.02 * wave, 0.50));
        
        const goldBoostMult = 1 + ((gameState.statUpgrades.goldBoost || 0) * 0.15);
        const baseGoldValue = isBoss ? 150 : 10;
        this.goldReward = Math.round(baseGoldValue * goldMultiplier * Math.pow(1.16, wave - 1) * (1 + (gameState.mutations.dnaGoldDrop.level * gameState.mutations.dnaGoldDrop.mult)) * goldBoostMult);
        
        const baseDna = isBoss ? (this.bossType === 'Titan Armored' ? 3 : 1) : 0;
        this.dnaReward = isBoss ? Math.round(baseDna * (1 + (wave / 8))) : 0;
        
        this.damage = Math.round((isBoss ? 45 : 7) * dmgMultiplier * Math.pow(1.12, wave - 1));
        this.attackCooldown = isBoss ? 1.1 : 0.8; 
        this.attackTimer = 0;
        this.flinchTimer = 0;
        this.walkCycle = Math.random() * 120;
        this.radius = isBoss ? 26 : (this.type === 'armored' ? 14 : 11);
        this.active = true;
        if (pixi.ready && pixi.zombiesContainer) {
            this.graphics = new PIXI.Graphics();
            pixi.zombiesContainer.addChild(this.graphics);
            
            this.bodyGraphics = new PIXI.Graphics();
            this.graphics.addChild(this.bodyGraphics);
        }
    }

    destroyGraphics() {
        if (this.graphics) {
            if (pixi.zombiesContainer) {
                pixi.zombiesContainer.removeChild(this.graphics);
            }
            if (this.bodyGraphics) {
                this.bodyGraphics.destroy();
                this.bodyGraphics = null;
            }
            this.graphics.destroy({ children: true });
            this.graphics = null;
        }
    }

    update(dt, barricadeY) {
        if (!this.active) return;
        
        if (this.z > 0 || this.vz !== 0) {
            this.vz -= 0.28 * dt * 60;
            this.z += this.vz * dt * 60;
            if (this.z < 0) {
                this.z = 0;
                this.vz = 0;
                spawnExplosion(this.x, this.y, '#78716c', 2);
            }
        }
        
        if (Math.abs(this.impulseX) > 0.05 || Math.abs(this.impulseY) > 0.05) {
            this.x += this.impulseX * dt * 60;
            this.y += this.impulseY * dt * 60;
            
            this.impulseX *= Math.pow(0.82, dt * 60);
            this.impulseY *= Math.pow(0.82, dt * 60);
            
            const logicalWidth = canvas.width;
            const minX = logicalWidth * 0.15;
            const maxX = logicalWidth * 0.85;
            if (this.x < minX) {
                this.x = minX;
                this.impulseX = -this.impulseX * 0.3;
            }
            if (this.x > maxX) {
                this.x = maxX;
                this.impulseX = -this.impulseX * 0.3;
            }
            if (this.y < -100) {
                this.y = -100;
                this.impulseY = 0;
            }
        }

        if (this.isBurning) {
            this.burnTimer -= dt;
            this.burnTickTimer += dt;
            if (this.burnTickTimer >= 0.25) {
                this.burnTickTimer = 0;
                this.hp -= this.burnDamage;
                
                const p = getAvailableParticle();
                if (p) {
                    p.spawn(
                        this.x + (Math.random() - 0.5) * this.radius, 
                        this.y - (Math.random() - 0.5) * this.radius * 2, 
                        (Math.random() - 0.5) * 1.5, 
                        -Math.random() * 2.5 - 0.5, 
                        '#f97316', 
                        2, 
                        0.4, 
                        0
                    );
                }
                
                if (this.hp <= 0) {
                    this.active = false;
                    this.destroyGraphics();
                    
                    if (hooks.addGold) hooks.addGold(this.goldReward);
                    else gameState.gold += this.goldReward;
                    
                    const gt = getAvailableText();
                    if (gt) gt.spawn(this.x, this.y - 6, `+🪙 ${this.goldReward}`, '#facc15', 13, false);
                    if (this.dnaReward > 0) {
                        gameState.dna += this.dnaReward;
                        const gdt = getAvailableText();
                        if (gdt) gdt.spawn(this.x, this.y - 24, `+🧬 ${this.dnaReward}`, '#34d399', 14, true);
                    }
                    if (hooks.addBloodSplatterToBg) {
                        hooks.addBloodSplatterToBg(this.x, this.y, this.isBoss ? 16 : 8);
                    }
                    spawnExplosion(this.x, this.y, '#7f1d1d', 14);
                    if (hooks.checkWaveFinished) hooks.checkWaveFinished();
                    if (hooks.saveGameData) hooks.saveGameData();
                    return;
                }
            }
            if (this.burnTimer <= 0) {
                this.isBurning = false;
            }
        }

        if (this.isFrozen) {
            this.freezeTimer -= dt;
            if (this.freezeTimer <= 0) {
                this.isFrozen = false;
            }
        }

        if (this.flinchTimer > 0) {
            this.flinchTimer -= dt;
            return; 
        }

        this.walkCycle += dt * 5.5 * this.speed;

        if (this.type === 'necromancer' && this.y < barricadeY - 110) {
            this.summonTimer -= dt;
            if (this.summonTimer <= 0) {
                this.summonTimer = 4.5;
                const minionCount = Math.random() < 0.45 ? 2 : 1;
                for (let c = 0; c < minionCount; c++) {
                    const mType = Math.random() < 0.65 ? 'normal' : 'runner';
                    const sz = new Zombie(gameState.wave, false, 0);
                    sz.type = mType;
                    sz.name = mType === 'runner' ? "Xác Sống Chạy (Triệu Hồi)" : "Xác Sống Nhỏ (Triệu Hồi)";
                    sz.x = this.x + (Math.random() - 0.5) * 35;
                    sz.y = this.y - 25 - Math.random() * 15;
                    sz.speed = sz.speed * 1.15;
                    sz.maxHp = Math.round(sz.maxHp * 0.65);
                    sz.hp = sz.maxHp;
                    sz.goldReward = Math.round(sz.goldReward * 0.35);
                    zombies.push(sz);
                    spawnExplosion(sz.x, sz.y, '#581c87', 5);
                }
            }
        }

        let currentSpeed = this.speed;
        if (this.isFrozen) {
            currentSpeed *= 0.35;
        }

        const stopY = barricadeY - 32;
        if (this.y + this.radius < stopY) {
            this.y += currentSpeed * dt * 60;
        } else {
            if (this.impulseY >= 0) {
                this.y = stopY - this.radius;
                this.impulseY = 0;
                
                this.attackTimer += dt;
                if (this.attackTimer >= this.attackCooldown) {
                    this.attackTimer = 0;
                    if (hooks.attackBarricade) {
                        hooks.attackBarricade(this.damage);
                    }
                    shakeTime.value = 0.2;
                    spawnExplosion(this.x, this.y + 10 + this.radius, '#ffffff', 4);
                }
            } else {
                this.attackTimer = 0;
            }
        }
        if (this.y + this.radius > stopY) {
            this.y = stopY - this.radius;
            this.impulseY = 0;
        }
    }

    damageTake(amount, isCrit, knockbackForce = 0, knockbackAngle = 0) {
        this.hp -= amount;
        this.flinchTimer = 0.08; 
        
        if (knockbackForce > 0) {
            let mass = 1.0;
            if (this.isBoss) mass = 5.0;
            else if (this.type === 'armored') mass = 2.5;
            else if (this.type === 'toxic') mass = 1.4;
            else if (this.type === 'runner') mass = 0.7;
            
            const push = knockbackForce / mass;
            this.impulseX = Math.cos(knockbackAngle) * push * 1.5;
            this.impulseY = Math.sin(knockbackAngle) * push * 1.5;
            
            if (knockbackForce > 3) {
                this.vz = (knockbackForce / mass) * 0.75;
            }
        }
        
        spawnBloodSpurt(this.x, this.y, isCrit ? 8 : 4);
        
        if (isCrit) playCritChime();
        const t = getAvailableText();
        if (t) t.spawn(this.x, this.y - 12, `-${amount}`, isCrit ? '#f97316' : '#ffffff', isCrit ? 14 : 11, isCrit);
        
        if (this.type === 'golden') {
            const coinSpurtChance = 0.25;
            if (Math.random() < coinSpurtChance) {
                const tinyGold = Math.round(5 * gameState.wave);
                if (hooks.addGold) hooks.addGold(tinyGold);
                else gameState.gold += tinyGold;
                const gt = getAvailableText();
                if (gt) gt.spawn(this.x, this.y - 18, `+🪙 ${tinyGold}`, '#facc15', 10, false);
            }
        }

        if (this.hp <= 0) {
            this.active = false;
            this.destroyGraphics();
            
            if (hooks.addGold) hooks.addGold(this.goldReward);
            else gameState.gold += this.goldReward;
            
            const gt = getAvailableText();
            if (gt) gt.spawn(this.x, this.y - 6, `+🪙 ${this.goldReward}`, '#facc15', 13, false);

            if (this.dnaReward > 0) {
                gameState.dna += this.dnaReward;
                const gdt = getAvailableText();
                if (gdt) gdt.spawn(this.x, this.y - 24, `+🧬 ${this.dnaReward}`, '#34d399', 14, true);
            }
            
            if (hooks.addBloodSplatterToBg) {
                hooks.addBloodSplatterToBg(this.x, this.y, this.isBoss ? 16 : 8);
            }
            spawnExplosion(this.x, this.y, this.type === 'golden' ? '#eab308' : '#7f1d1d', 14);

            const coinsToSpawn = Math.min(6, Math.max(2, Math.floor(this.goldReward / 5) || 2));
            for (let c = 0; c < coinsToSpawn; c++) {
                const cp = getAvailableParticle();
                if (cp) {
                    const cVx = (Math.random() - 0.5) * 4.0;
                    const cVy = (Math.random() - 0.5) * 2.0;
                    cp.spawn(this.x, this.y, cVx, cVy, '#facc15', 2.5, 1.8, 0.25, 'coin', 15, 3.0 + Math.random() * 3.5);
                }
            }

            const cp = getAvailableParticle();
            if (cp) {
                const pushStrength = Math.max(2.5, Math.min(15, knockbackForce * 1.5));
                const pushX = Math.cos(knockbackAngle) * pushStrength;
                const pushY = Math.sin(knockbackAngle) * pushStrength;
                
                let outfitColor = '#1e3a8a';
                if (this.type === 'runner') outfitColor = '#b45309';
                else if (this.type === 'armored') outfitColor = '#3f3f46';
                else if (this.type === 'toxic') outfitColor = '#15803d';
                else if (this.type === 'golden') outfitColor = '#eab308';
                
                cp.spawn(this.x, this.y, pushX, pushY, outfitColor, this.radius, 2.5, 0, 'corpse');
            }

            if (hooks.checkWaveFinished) hooks.checkWaveFinished();
            if (hooks.saveGameData) hooks.saveGameData();
            return true; 
        }
        return false;
    }

    draw() {
        if (!this.active) return;
        if (!this.graphics || !this.bodyGraphics) return;
        
        const g = this.bodyGraphics;
        g.clear();
        
        this.graphics.clear();
        const pt = project3D(this.x, this.y, this.z || 0);
        this.graphics.position.set(pt.x, pt.y);
        this.graphics.scale.set(pt.scale * 1.35); // 35% larger zombie sprites
        
        g.position.set(0, 0);
        g.rotation = 0;
        
        const isHit = this.flinchTimer > 0;
        const sway = Math.sin(this.walkCycle);
        const legSwayL = sway * (this.type === 'runner' ? 3.5 : 2.5);
        const legSwayR = -sway * (this.type === 'runner' ? 3.5 : 2.5);
        
        // 1. Shadows on the ground under the feet (positive Y)
        g.lineStyle(0);
        g.beginFill(0x000000, 0.12);
        g.drawEllipse(0, this.radius * 0.95, this.radius * 1.35, this.radius * 0.5);
        g.endFill();
        g.beginFill(0x000000, 0.22);
        g.drawEllipse(0, this.radius * 0.95, this.radius * 1.0, this.radius * 0.35);
        g.endFill();
        
        // 2. Specialty glows/auras around the torso
        if (!isHit) {
            if (this.type === 'toxic') {
                const bubbleOffset1 = Math.sin(Date.now() * 0.008) * 4;
                const bubbleOffset2 = Math.cos(Date.now() * 0.006) * 3;
                g.beginFill(0x22c55e, 0.2);
                g.drawCircle(0, -this.radius * 0.45, this.radius * 1.45);
                g.endFill();
                
                g.beginFill(0x4ade80, 0.85);
                g.drawCircle(-this.radius * 0.35 + bubbleOffset1, -this.radius * 0.8 + bubbleOffset2, 2.5);
                g.drawCircle(this.radius * 0.35 + bubbleOffset2, -this.radius * 0.6 + bubbleOffset1, 1.8);
                g.endFill();
            } else if (this.type === 'necromancer') {
                g.lineStyle(1.8, 0xa855f7, 0.45 + Math.sin(Date.now() * 0.01) * 0.18);
                g.drawCircle(0, -this.radius * 0.45, this.radius * 1.55);
            } else if (this.type === 'golden') {
                g.lineStyle(2.0, 0xfacc15, 0.5 + Math.sin(Date.now() * 0.015) * 0.22);
                g.drawCircle(0, -this.radius * 0.45, this.radius * 1.45);
            }
        }
        
        // 3. Legs going down to Y positive
        g.lineStyle(this.isBoss ? 4.5 : (this.type === 'armored' ? 3.5 : 2.5), isHit ? 0xffffff : 0x0f172a);
        g.moveTo(-this.radius * 0.3, -this.radius * 0.15);
        g.lineTo(-this.radius * 0.3 + legSwayL * 0.4, this.radius * 0.95);
        
        g.lineStyle(this.isBoss ? 5.2 : (this.type === 'armored' ? 4.2 : 3.0), isHit ? 0xffffff : 0x1e293b);
        g.moveTo(this.radius * 0.3, -this.radius * 0.15);
        g.lineTo(this.radius * 0.3 + legSwayR * 0.4, this.radius * 0.95);
        
        // Foot shapes at Y positive
        g.lineStyle(0);
        g.beginFill(isHit ? 0xffffff : 0x020617);
        g.drawEllipse(-this.radius * 0.3 + legSwayL * 0.4, this.radius * 0.95, this.radius * 0.28, this.radius * 0.16);
        g.drawEllipse(this.radius * 0.3 + legSwayR * 0.4, this.radius * 0.95, this.radius * 0.28, this.radius * 0.16);
        g.endFill();
        
        let fillColor = 0x14532d;
        if (isHit) {
            fillColor = 0xffffff;
        } else {
            if (this.type === 'runner') fillColor = 0xb45309;
            else if (this.type === 'armored') fillColor = 0x1e293b;
            else if (this.type === 'toxic') fillColor = 0x064e3b;
            else if (this.type === 'necromancer') fillColor = 0x3b0764;
            else if (this.type === 'golden') fillColor = 0xeab308;
            else if (this.isBoss) {
                if (this.bossType === 'Titan Armored') fillColor = 0x3f3f46;
                else if (this.bossType === 'Butcher') fillColor = 0x7f1d1d;
                else fillColor = 0x1e1b4b;
            }
        }
        
        // 4. Torso in the middle (negative Y)
        g.lineStyle(0);
        g.beginFill(fillColor);
        g.drawEllipse(0, -this.radius * 0.45, this.radius * 0.85, this.radius * 0.55);
        g.endFill();
        
        g.lineStyle(1.5, isHit ? 0xffffff : 0x052e16, 0.4);
        g.moveTo(-this.radius * 0.75, -this.radius * 0.5);
        g.lineTo(0, -this.radius * 0.4);
        g.lineTo(this.radius * 0.75, -this.radius * 0.5);
        
        // 5. Ragged clothes overlay
        if (!isHit && this.type !== 'golden') {
            const shirtColor = this.type === 'runner' ? 0x7c2d12 : (this.type === 'toxic' ? 0x14532d : 0x1e3a8a);
            g.lineStyle(0);
            g.beginFill(shirtColor);
            g.drawEllipse(0, -this.radius * 0.5, this.radius * 0.75, this.radius * 0.45);
            g.endFill();
            
            g.beginFill(fillColor);
            g.drawCircle(-this.radius * 0.25, -this.radius * 0.55, this.radius * 0.15);
            g.drawCircle(this.radius * 0.2, -this.radius * 0.45, this.radius * 0.12);
            g.endFill();
        }
        
        // Boss spikes / Armored plates
        if (!isHit) {
            if (this.type === 'armored' || (this.isBoss && this.bossType === 'Titan Armored')) {
                g.lineStyle(0);
                g.beginFill(0x64748b);
                g.drawRect(-this.radius * 0.6, -this.radius * 0.75, this.radius * 1.2, this.radius * 0.3);
                g.endFill();
                
                g.beginFill(0x94a3b8);
                g.drawCircle(-this.radius * 0.4, -this.radius * 0.65, 1.2);
                g.drawCircle(this.radius * 0.4, -this.radius * 0.65, 1.2);
                g.endFill();
            } else if (this.isBoss) {
                g.lineStyle(0);
                g.beginFill(0x374151);
                g.drawPolygon([
                    -this.radius * 0.45, -this.radius * 0.7,
                    -this.radius * 0.75, -this.radius * 1.1,
                    -this.radius * 0.2, -this.radius * 0.75
                ]);
                g.drawPolygon([
                    this.radius * 0.45, -this.radius * 0.7,
                    this.radius * 0.75, -this.radius * 1.1,
                    this.radius * 0.2, -this.radius * 0.75
                ]);
                g.endFill();
            }
        }
        
        // 6. Jointed arms reaching forward/downward
        let armColor = fillColor;
        
        const leftElbowX = -this.radius * 0.78 + Math.sin(this.walkCycle) * 2.0;
        const leftElbowY = -this.radius * 0.35 + Math.cos(this.walkCycle) * 2.0;
        const leftHandX = -this.radius * 0.65 + Math.sin(this.walkCycle) * 3.0;
        const leftHandY = -this.radius * 0.05 + Math.cos(this.walkCycle) * 3.0;
        
        g.lineStyle(this.isBoss ? 4.8 : (this.type === 'armored' ? 3.6 : 2.8), isHit ? 0xffffff : armColor * 0.82);
        g.moveTo(-this.radius * 0.7, -this.radius * 0.65);
        g.lineTo(leftElbowX, leftElbowY);
        g.lineTo(leftHandX, leftHandY);
        
        g.lineStyle(0);
        g.beginFill(isHit ? 0xffffff : 0x7f1d1d);
        g.drawCircle(leftHandX, leftHandY, this.radius * 0.18);
        g.beginFill(isHit ? 0xffffff : 0xfca5a5);
        g.drawCircle(leftHandX - 1.5, leftHandY + 1.5, 1.0);
        g.drawCircle(leftHandX, leftHandY + 2.5, 1.0);
        g.drawCircle(leftHandX + 1.5, leftHandY + 1.5, 1.0);
        g.endFill();
        
        const rightElbowX = this.radius * 0.78 - Math.sin(this.walkCycle) * 2.0;
        const rightElbowY = -this.radius * 0.35 - Math.cos(this.walkCycle) * 2.0;
        const rightHandX = this.radius * 0.65 - Math.sin(this.walkCycle) * 3.0;
        const rightHandY = -this.radius * 0.05 - Math.cos(this.walkCycle) * 3.0;
        
        g.lineStyle(this.isBoss ? 5.5 : (this.type === 'armored' ? 4.5 : 3.2), isHit ? 0xffffff : armColor);
        g.moveTo(this.radius * 0.7, -this.radius * 0.65);
        g.lineTo(rightElbowX, rightElbowY);
        g.lineTo(rightHandX, rightHandY);
        
        g.lineStyle(0);
        g.beginFill(isHit ? 0xffffff : 0x7f1d1d);
        g.drawCircle(rightHandX, rightHandY, this.radius * 0.18);
        g.beginFill(isHit ? 0xffffff : 0xfca5a5);
        g.drawCircle(rightHandX - 1.5, rightHandY + 1.5, 1.0);
        g.drawCircle(rightHandX, rightHandY + 2.5, 1.0);
        g.drawCircle(rightHandX + 1.5, rightHandY + 1.5, 1.0);
        g.endFill();
        
        let headColor = 0x16a34a;
        if (isHit) {
            headColor = 0xffffff;
        } else {
            if (this.type === 'runner') headColor = 0xea580c;
            else if (this.type === 'armored') headColor = 0x475569;
            else if (this.type === 'toxic') headColor = 0x22c55e;
            else if (this.type === 'necromancer') headColor = 0xa855f7;
            else if (this.type === 'golden') headColor = 0xfacc15;
            else if (this.isBoss) {
                if (this.bossType === 'Titan Armored') headColor = 0x71717a;
                else if (this.bossType === 'Butcher') headColor = 0xef4444;
                else headColor = 0xd8b4fe;
            }
        }
        
        // 7. Head (at the top: Y negative ~ -1.2 * radius)
        const headCenterY = -this.radius * 1.2;
        
        // Ears
        g.lineStyle(0);
        g.beginFill(headColor * 0.85);
        g.drawEllipse(-this.radius * 0.52, headCenterY, this.radius * 0.14, this.radius * 0.2);
        g.drawEllipse(this.radius * 0.52, headCenterY, this.radius * 0.14, this.radius * 0.2);
        g.endFill();
        
        g.beginFill(headColor);
        g.drawCircle(0, headCenterY, this.radius * 0.52);
        g.endFill();
        
        // Teeth
        if (!isHit && this.type !== 'golden') {
            g.beginFill(0x1a0505);
            g.drawEllipse(0, headCenterY + this.radius * 0.22, this.radius * 0.28, this.radius * 0.12);
            g.endFill();
            
            g.beginFill(0xfbfbfb);
            g.drawPolygon([-this.radius * 0.12, headCenterY + this.radius * 0.18, -this.radius * 0.08, headCenterY + this.radius * 0.25, -this.radius * 0.04, headCenterY + this.radius * 0.18]);
            g.drawPolygon([this.radius * 0.04, headCenterY + this.radius * 0.18, this.radius * 0.08, headCenterY + this.radius * 0.25, this.radius * 0.12, headCenterY + this.radius * 0.18]);
            g.endFill();
        }
        
        // Hair & head wounds
        if (!isHit && this.type !== 'golden') {
            g.beginFill(this.type === 'runner' ? 0x78350f : 0x1e293b);
            g.drawCircle(-this.radius * 0.2, headCenterY - this.radius * 0.22, this.radius * 0.22);
            g.drawCircle(this.radius * 0.15, headCenterY - this.radius * 0.27, this.radius * 0.25);
            g.drawCircle(0, headCenterY - this.radius * 0.32, this.radius * 0.28);
            g.endFill();
            
            g.beginFill(0x990000, 0.7);
            g.drawEllipse(-this.radius * 0.1, headCenterY - this.radius * 0.17, this.radius * 0.15, this.radius * 0.08);
            g.endFill();
        }
        
        // 8. Glowing eyes
        let eyeColor = 0xf87171;
        if (this.type === 'toxic') eyeColor = 0xa3e635;
        else if (this.type === 'necromancer') eyeColor = 0xf0abfc;
        else if (this.type === 'golden') eyeColor = 0xffffff;
        else if (this.isBoss) eyeColor = 0xf43f5e;
        
        g.beginFill(eyeColor);
        g.drawCircle(-this.radius * 0.18, headCenterY + this.radius * 0.02, this.isBoss ? 3.0 : 1.6);
        g.drawCircle(this.radius * 0.18, headCenterY + this.radius * 0.02, this.isBoss ? 3.0 : 1.6);
        g.endFill();
        
        if (!isHit && this.type !== 'golden') {
            g.beginFill(0x450505);
            g.drawCircle(-this.radius * 0.18, headCenterY + this.radius * 0.02, this.isBoss ? 1.2 : 0.6);
            g.drawCircle(this.radius * 0.18, headCenterY + this.radius * 0.02, this.isBoss ? 1.2 : 0.6);
            g.endFill();
        }
        
        // Frozen overlays
        if (this.isFrozen) {
            g.beginFill(0x38bdf8, 0.4);
            g.lineStyle(1.8, 0x06b6d4);
            g.drawCircle(0, -this.radius * 0.4, this.radius * 1.25);
            g.endFill();
            
            g.lineStyle(0.8, 0xffffff, 0.6);
            g.moveTo(-this.radius * 0.8, -this.radius * 0.95);
            g.lineTo(this.radius * 0.8, this.radius * 0.15);
            g.moveTo(this.radius * 0.5, -this.radius * 0.75);
            g.lineTo(-this.radius * 0.5, this.radius * 0.15);
        }
        
        // Burning overlays
        if (this.isBurning) {
            g.lineStyle(0);
            g.beginFill(0xef4444, 0.18);
            g.drawCircle(0, -this.radius * 0.4, this.radius * 1.15);
            g.endFill();
        }
        
        // Floating Health bar
        const parentG = this.graphics;
        if (this.hp < this.maxHp) {
            const barW = this.radius * 2;
            const barH = 3;
            const barX = -this.radius;
            const barY = -this.radius * 1.95;
            
            parentG.lineStyle(0);
            parentG.beginFill(0x0f172a, 0.6);
            parentG.drawRect(barX, barY, barW, barH);
            parentG.endFill();
            
            const pct = Math.max(0, this.hp / this.maxHp);
            let barCol = 0x10b981;
            if (this.isBoss) barCol = 0xef4444;
            else if (this.type === 'golden') barCol = 0xfacc15;
            
            parentG.beginFill(barCol);
            parentG.drawRect(barX, barY, barW * pct, barH);
            parentG.endFill();
        }
        
        // Name Label for special zombies
        if (this.isBoss || this.type === 'golden' || this.type === 'necromancer') {
            if (!this.nameText) {
                const nameCol = this.type === 'golden' ? '#facc15' : (this.type === 'necromancer' ? '#c084fc' : '#ef4444');
                this.nameText = new PIXI.Text(this.name.toUpperCase(), {
                    fontFamily: 'Barlow Condensed',
                    fontSize: 8,
                    fill: nameCol,
                    fontWeight: 'bold',
                    align: 'center'
                });
                this.nameText.anchor.set(0.5, 1.0);
                this.graphics.addChild(this.nameText);
            }
            this.nameText.position.set(0, -this.radius * 2.15);
        }
    }
}

// Find closest zombie to target
export function getPrioritizedZombie() {
    let bestTarget = null;
    let maxY = -Infinity;
    for (let i = 0; i < zombies.length; i++) {
        const z = zombies[i];
        if (z && z.active && z.hp > 0) {
            if (z.y > maxY) {
                maxY = z.y;
                bestTarget = z;
            }
        }
    }
    return bestTarget;
}
