import { canvas } from './state.js';

export function project3D(worldX, worldY, worldZ = 0) {
    if (!canvas) return { x: worldX, y: worldY, scale: 1.0 };
    return { x: worldX, y: worldY - worldZ, scale: 1.0 };
}

export function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

export function distToSegmentSquared(p, v, w) {
    const l2 = (v.x - w.x)*(v.x - w.x) + (v.y - w.y)*(v.y - w.y);
    if (l2 === 0) return (p.x - v.x)*(p.x - v.x) + (p.y - v.y)*(p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    const dx = p.x - projX;
    const dy = p.y - projY;
    return dx*dx + dy*dy;
}

export function unproject3D(screenX, screenY) {
    return { x: screenX, y: screenY };
}
