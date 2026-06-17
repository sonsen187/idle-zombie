import { project3D } from '../helpers.js';
import { playUpgradeChime } from '../audio.js';
import { getAvailableParticle } from './Particle.js';
import { getAvailableText } from './FloatingText.js';
import { pixi, gameState } from '../state.js';
import { hooks } from './hooks.js';

export class AirDrop {
    constructor(x, targetY) {
        this.x = x;
        this.y = -50;
        this.targetY = targetY;
        this.width = 24;
        this.height = 24;
        this.landed = false;
        this.active = true;
        this.glowCycle = 0;
        
        this.vy = 0;
        this.vx = 0;
        this.bounce = 0;
        this.windFreq = 0.8 + Math.random() * 0.5;
        
        if (pixi.ready && pixi.airDropsContainer) {
            this.graphics = new PIXI.Graphics();
            pixi.airDropsContainer.addChild(this.graphics);
        }
    }
    destroyGraphics() {
        if (this.graphics) {
            if (pixi.airDropsContainer) {
                pixi.airDropsContainer.removeChild(this.graphics);
            }
            this.graphics.destroy();
            this.graphics = null;
        }
    }
    update(dt) {
        if (!this.active) return;
        this.glowCycle += dt * 5;
        
        if (!this.landed) {
            this.vx = Math.sin(this.glowCycle * this.windFreq) * 0.6;
            this.x += this.vx * dt * 60;
            
            this.vy = Math.min(1.8, this.vy + 0.05 * dt * 60);
            this.y += this.vy * dt * 60;
            
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                
                if (this.bounce === 0) {
                    this.bounce = 1;
                    this.vy = -1.5;
                    this.y += this.vy;
                } else {
                    this.landed = true;
                    this.vy = 0;
                    this.vx = 0;
                }
            }
        } else {
            if (this.y < this.targetY) {
                this.vy += 0.15 * dt * 60;
                this.y += this.vy * dt * 60;
                if (this.y >= this.targetY) {
                    this.y = this.targetY;
                    this.vy = 0;
                }
            }
        }
        
        if (this.graphics) {
            const g = this.graphics;
            g.clear();
            
            const dropZ = Math.max(0, this.targetY - this.y);
            const pt = project3D(this.x + this.width/2, this.targetY + this.height/2, dropZ);
            const ptShadow = project3D(this.x + this.width/2, this.targetY + this.height/2, 0);
            
            if (dropZ > 0) {
                g.lineStyle(0);
                g.beginFill(0x000000, 0.22);
                g.drawEllipse(ptShadow.x, ptShadow.y, (this.width / 2) * ptShadow.scale, (this.height / 4) * ptShadow.scale);
                g.endFill();
            }
            
            if (!this.landed) {
                const ptDome = project3D(this.x + this.width/2, this.targetY + this.height/2, dropZ + 35);
                g.lineStyle(1.5 * pt.scale, 0xef4444);
                g.moveTo(pt.x, pt.y);
                g.lineTo(ptDome.x - 12 * ptDome.scale, ptDome.y);
                g.moveTo(pt.x, pt.y);
                g.lineTo(ptDome.x + 12 * ptDome.scale, ptDome.y);
                
                g.lineStyle(0);
                g.beginFill(0xf3f4f6);
                g.drawCircle(ptDome.x, ptDome.y, 12 * ptDome.scale);
                g.endFill();
            }
            
            const w = this.width * pt.scale;
            const h = this.height * pt.scale;
            
            const glowRadius = (this.width / 2) * (1.1 + Math.sin(this.glowCycle) * 0.15) * pt.scale;
            g.lineStyle(0);
            g.beginFill(0xeab308, 0.15);
            g.drawCircle(pt.x, pt.y, glowRadius);
            g.endFill();
            g.beginFill(0xeab308, 0.3);
            g.drawCircle(pt.x, pt.y, glowRadius * 0.5);
            g.endFill();
            
            g.beginFill(0x78350f);
            g.drawRect(pt.x - w/2, pt.y - h/2, w, h);
            g.endFill();
            g.lineStyle(2 * pt.scale, 0xd97706);
            g.drawRect(pt.x - w/2, pt.y - h/2, w, h);
            
            g.lineStyle(0);
            g.beginFill(0xfacc15);
            g.drawCircle(pt.x, pt.y, 5 * pt.scale);
            g.endFill();
        }
    }
    collect() {
        this.active = false;
        
        const bonusGold = Math.round(150 * Math.pow(1.16, gameState.wave - 1));
        if (hooks.addGold) {
            hooks.addGold(bonusGold);
        } else {
            gameState.gold += bonusGold;
        }

        playUpgradeChime();

        for(let i=0; i < 15; i++) {
            const p = getAvailableParticle();
            if (p) {
                const angle = Math.random() * Math.PI * 2;
                const spd = Math.random() * 3.5 + 1.5;
                p.spawn(
                    this.x + this.width/2, 
                    this.y + this.height/2, 
                    Math.cos(angle)*spd, 
                    Math.sin(angle)*spd, 
                    '#facc15', 
                    2.8, 
                    1.8, 
                    0.26, 
                    'coin',
                    12,
                    3.0 + Math.random() * 4.0
                );
            }
        }

        const t = getAvailableText();
        if (t) {
            t.spawn(this.x + this.width/2, this.y - 10, `+🪙 ${bonusGold}`, '#facc15', 15, true);
        }
        if (hooks.saveGameData) {
            hooks.saveGameData();
        }
    }
}
