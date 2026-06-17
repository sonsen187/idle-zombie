import { particlePool } from '../state.js';
import { hooks } from './hooks.js';

// Object pool helpers
export function getAvailableParticle() {
    return particlePool.find(p => !p.active);
}

export function spawnExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const p = getAvailableParticle();
        if (p) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            p.spawn(
                x, 
                y, 
                Math.cos(angle) * speed, 
                Math.sin(angle) * speed, 
                color, 
                Math.random() * 3 + 1.5, 
                Math.random() * 0.5 + 0.3, 
                0.05
            );
        }
    }
}

export function spawnBloodSpurt(x, y, count) {
    const colors = ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626'];
    for (let i = 0; i < count; i++) {
        const p = getAvailableParticle();
        if (p) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1.5;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const startZ = 12 + (Math.random() - 0.5) * 4;
            const vz = 1.8 + Math.random() * 2.2;
            p.spawn(
                x, 
                y, 
                Math.cos(angle) * speed, 
                Math.sin(angle) * speed, 
                color, 
                Math.random() * 2.5 + 1.0, 
                Math.random() * 0.6 + 0.2, 
                0.08,
                'fading',
                startZ,
                vz
            );
        }
    }
}

export class Particle {
    constructor() {
        this.active = false;
    }
    spawn(x, y, vx, vy, color, size, maxLife, gravity = 0, type = 'fading', z = 0, vz = 0) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.z = z;
        this.vz = vz;
        this.color = color;
        this.size = size;
        this.life = maxLife;
        this.maxLife = maxLife;
        this.gravity = gravity;
        this.type = type;
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.25;
        this.active = true;
    }
    update(dt) {
        if (!this.active) return;
        
        if (this.type === 'shell' || this.type === 'coin') {
            this.vz -= this.gravity * dt * 60;
            this.z += this.vz * dt * 60;
            this.x += this.vx * dt * 60;
            this.y += this.vy * dt * 60;
            
            // Ground bounce physics
            if (this.z < 0) {
                this.z = 0;
                this.vz = -this.vz * 0.42; // bounce coefficient
                this.vx *= 0.65; // friction
                this.vy *= 0.65;
                this.spin *= 0.6;
                
                if (Math.abs(this.vz) < 0.4) {
                    this.vz = 0;
                    this.vx = 0;
                    this.vy = 0;
                    this.spin = 0;
                }
            }
        } else if (this.type === 'corpse') {
            this.x += this.vx * dt * 60;
            this.y += this.vy * dt * 60;
            
            // Ground sliding friction (deceleration)
            this.vx *= Math.pow(0.92, dt * 60);
            this.vy *= Math.pow(0.92, dt * 60);
            this.angle += this.spin * (this.vx * 0.08);
            
            // Bleeding trail
            if (Math.random() < 0.15 * (dt * 60) && Math.abs(this.vx) > 0.5) {
                const bp = getAvailableParticle();
                if (bp) {
                    bp.spawn(this.x, this.y, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, '#991b1b', 2.0, 1.0, 0.08, 'fading');
                }
                if (Math.random() < 0.08 && hooks.addBloodSplatterToBg) {
                    hooks.addBloodSplatterToBg(this.x, this.y, 1.8);
                }
            }
        } else {
            // Fading blood particle with Z-gravity
            this.vz -= this.gravity * dt * 60;
            this.z += this.vz * dt * 60;
            this.x += this.vx * dt * 60;
            this.y += this.vy * dt * 60;
            
            // Blood splatter on floor
            if (this.z <= 0) {
                this.z = 0;
                this.vz = 0;
                this.vx = 0;
                this.vy = 0;
                if (Math.random() < 0.45 && hooks.addBloodSplatterToBg) {
                    hooks.addBloodSplatterToBg(this.x, this.y, this.size * 1.5);
                }
                this.life = Math.min(this.life, 0.05); // Fade fast on ground
            }
        }

        this.life -= dt;
        this.angle += this.spin;
        if (this.life <= 0) this.active = false;
    }
}
