import { project3D } from '../helpers.js';
import { bulletPool, canvas, shakeTime, zombies } from '../state.js';
import { getAvailableParticle, spawnExplosion } from './Particle.js';
import { playExplosionSound } from '../audio.js';
import { hooks } from './hooks.js';

export function getAvailableBullet() {
    return bulletPool.find(b => !b.active);
}

export class Bullet {
    constructor() {
        this.active = false;
    }
    spawn(x, y, targetX, targetY, damage, isCrit, speed = 10, isPlasma = false, isShotgun = false, phase = 1, customAngle = null, isGatling = false, isTesla = false, isNuclear = false, isFlame = false, isFreeze = false) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.z = 0;
        this.vz = 0;
        this.damage = damage;
        this.isCrit = isCrit;
        this.speed = speed;
        this.isPlasma = isPlasma;
        this.isShotgun = isShotgun;
        this.isGatling = isGatling;
        this.isTesla = isTesla;
        this.isNuclear = isNuclear;
        this.isFlame = isFlame;
        this.isFreeze = isFreeze;
        this.phase = phase;
        this.life = 1.5;
        this.size = isFlame ? 4 : (isNuclear ? 8 : 3);
        this.hitZombies = [];

        // Realistic knockback
        if (isShotgun) {
            this.knockback = 4.8;
        } else if (isGatling) {
            this.knockback = 3.2;
        } else if (isPlasma) {
            this.knockback = 10.0;
        } else if (isTesla) {
            this.knockback = 0.5;
        } else if (isNuclear) {
            this.knockback = 35.0;
            this.vz = 6.5;
        } else if (isFlame) {
            this.knockback = 0.05;
        } else if (isFreeze) {
            this.knockback = 0;
        } else {
            if (this.speed === 34) this.knockback = 7.5; // rifle
            else if (this.speed === 26) this.knockback = 2.8; // smg
            else if (this.speed === 36) this.knockback = 16.0; // sniper
            else if (this.speed === 22) this.knockback = 4.5; // pistol
            else this.knockback = 5.0;
        }

        let angle = 0;
        if (customAngle !== null) {
            angle = customAngle;
        } else {
            angle = Math.atan2(targetY - y, targetX - x);
        }

        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Screen coords for flat straight trajectory
        const ptStart = project3D(x, y, 0);
        let ptTarget;
        if (customAngle !== null) {
            const targetDist = 600;
            const tx = x + Math.cos(customAngle) * targetDist;
            const ty = y + Math.sin(customAngle) * targetDist;
            ptTarget = project3D(tx, ty, 0);
        } else {
            ptTarget = project3D(targetX, targetY, 0);
        }

        this.screenX = ptStart.x;
        this.screenY = ptStart.y;

        const sDx = ptTarget.x - ptStart.x;
        const sDy = ptTarget.y - ptStart.y;
        const sAngle = Math.atan2(sDy, sDx);
        
        const avgScale = (ptStart.scale + ptTarget.scale) / 2;
        const screenSpeed = speed * avgScale;
        this.screenVx = Math.cos(sAngle) * screenSpeed;
        this.screenVy = Math.sin(sAngle) * screenSpeed;

        if (isShotgun) {
            this.splitDelay = 0.18 + Math.random() * 0.06;
        }

        this.active = true;
    }
    update(dt) {
        if (!this.active) return;
        this.prevX = this.x;
        this.prevY = this.y;
        
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        
        this.screenX += this.screenVx * dt * 60;
        this.screenY += this.screenVy * dt * 60;

        if (this.isNuclear) {
            this.vz -= 0.28 * dt * 60;
            this.z += this.vz * dt * 60;
            
            if (Math.random() < 0.45 * (dt * 60)) {
                const p = getAvailableParticle();
                if (p) {
                    const drawY = this.y - this.z;
                    p.spawn(
                        this.x - (this.vx / this.speed) * 8, 
                        drawY, 
                        -this.vx * 0.12 + (Math.random() - 0.5) * 0.6, 
                        -this.vy * 0.12 + (Math.random() - 0.5) * 0.6, 
                        'rgba(156, 163, 175, 0.45)', 
                        Math.random() * 2.5 + 2.0, 
                        0.55, 
                        -0.03, 
                        'fading'
                    );
                }
            }

            if (this.z < 0) {
                this.z = 0;
                this.explode();
                return;
            }
        }
        
        this.life -= dt;

        if (this.isFlame) {
            const ageRatio = 1.0 - (this.life / 0.35);
            this.size = 4 + ageRatio * 20;
        }

        if (this.isShotgun && this.phase < 3) {
            this.splitDelay -= dt;
            if (this.splitDelay <= 0) {
                this.split();
            }
        }

        if (this.x < -50 || this.x > canvas.width + 50 || this.y < -50 || this.y > canvas.height + 50) {
            this.active = false;
        }

        if (this.life <= 0) this.active = false;
    }
    explode() {
        this.active = false;
        spawnExplosion(this.x, this.y, '#22c55e', 45);
        shakeTime.value = 0.4;
        
        playExplosionSound();
        
        let anyDead = false;
        zombies.forEach(nz => {
            if (nz && nz.active && nz.hp > 0) {
                const nzDx = nz.x - this.x;
                const nzDy = nz.y - this.y;
                const nzDist = nzDx*nzDx + nzDy*nzDy;
                if (nzDist < 25600) {
                    const pushForce = 35.0;
                    const blastAngle = Math.atan2(nzDy, nzDx);
                    if (nz.damageTake(Math.round(this.damage * 0.8), false, pushForce, blastAngle)) {
                        anyDead = true;
                    }
                }
            }
        });
        if (anyDead && hooks.checkWaveFinished) {
            hooks.checkWaveFinished();
        }
        if (hooks.dispatchDOMUpdates) {
            hooks.dispatchDOMUpdates();
        }
    }
    split() {
        this.active = false;
        
        const baseAngle = Math.atan2(this.vy, this.vx);
        const nextPhase = this.phase + 1;
        const nextDamage = Math.max(1, Math.round(this.damage / 2));
        
        const angles = [baseAngle - 0.10, baseAngle + 0.10];
        angles.forEach(ang => {
            const b = getAvailableBullet();
            if (b) {
                b.spawn(
                    this.x, 
                    this.y, 
                    0, 0, 
                    nextDamage, 
                    this.isCrit, 
                    this.speed * 0.95,
                    false, 
                    true, 
                    nextPhase, 
                    ang
                );
            }
        });
    }
}
