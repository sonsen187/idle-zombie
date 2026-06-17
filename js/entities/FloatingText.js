import { textPool, pixi } from '../state.js';

export function getAvailableText() {
    return textPool.find(t => !t.active);
}

export class FloatingText {
    constructor() {
        this.active = false;
        this.pixiTextIndex = -1;
    }
    spawn(x, y, text, color, size = 11, isCrit = false) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.isCrit = isCrit;
        this.life = 0.8;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = -Math.random() * 1.5 - 1.0;
        this.active = true;
        
        if (pixi.ready) {
            const idx = pixi.pixiTextPool.findIndex(pt => !pt.visible);
            if (idx !== -1) {
                this.pixiTextIndex = idx;
                const pt = pixi.pixiTextPool[idx];
                pt.text = text;
                pt.style.fontSize = isCrit ? size + 4 : size;
                pt.style.fontFamily = isCrit ? 'Orbitron' : 'Rajdhani';
                
                let parseColor = 0xffffff;
                if (color.startsWith('#')) {
                    parseColor = parseInt(color.slice(1), 16);
                }
                pt.style.fill = parseColor;
                pt.position.set(x, y);
                pt.alpha = 1.0;
                pt.visible = true;
            } else {
                this.pixiTextIndex = -1;
            }
        }
    }
    update(dt) {
        if (!this.active) return;
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.life -= dt * 1.4;
        
        if (this.pixiTextIndex !== -1 && pixi.pixiTextPool[this.pixiTextIndex]) {
            const pt = pixi.pixiTextPool[this.pixiTextIndex];
            pt.position.set(this.x, this.y);
            pt.alpha = Math.max(0, this.life / 0.8);
        }
        
        if (this.life <= 0) {
            this.active = false;
            if (this.pixiTextIndex !== -1 && pixi.pixiTextPool[this.pixiTextIndex]) {
                pixi.pixiTextPool[this.pixiTextIndex].visible = false;
                this.pixiTextIndex = -1;
            }
        }
    }
}
