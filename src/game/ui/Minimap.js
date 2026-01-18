import { RoomType } from '../environment/LevelGenerator.js';

export class Minimap {
    constructor(x, y, size, scale = 0.05) {
        this.x = x;       // UI X position
        this.y = y;       // UI Y position
        this.size = size; // Width/Height of the minimap box
        this.scale = scale; // Scale factor (World -> Map)
    }

    draw(renderer, game) {
        const ctx = renderer.ctx;

        ctx.save();

        // 1. Draw Background (Inaccessible / Solid Matter / Void)
        // Using a darker, more industrial gray for out-of-bounds
        ctx.fillStyle = '#1a1a20';
        ctx.fillRect(this.x, this.y, this.size, this.size);

        // Solid Area Pattern (Diagonal lines for a "blocked" look)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const dashSize = 15;
        for (let i = -this.size; i < this.size; i += dashSize) {
            ctx.beginPath();
            ctx.moveTo(this.x + i, this.y);
            ctx.lineTo(this.x + i + this.size, this.y + this.size);
            ctx.stroke();
        }

        // Overlay a very faint grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        for (let i = 0; i < this.size; i += 20) {
            ctx.beginPath(); ctx.moveTo(this.x + i, this.y); ctx.lineTo(this.x + i, this.y + this.size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(this.x, this.y + i); ctx.lineTo(this.x + this.size, this.y + i); ctx.stroke();
        }

        // 2. Setup Clipping Region
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.size, this.size);
        ctx.clip();

        // 3. Transform Calculations
        const cx = this.x + this.size / 2;
        const cy = this.y + this.size / 2;
        const px = game.x;
        const py = game.y;

        const worldToMap = (wx, wy) => {
            return {
                x: cx + (wx - px) * this.scale,
                y: cy + (wy - py) * this.scale
            };
        };

        // 4. Draw Rooms (Accessible Areas)
        if (game.rooms) {
            // First, find all visible rooms (visited OR adjacent to visited)
            const visibleRooms = new Set();
            for (const room of game.rooms) {
                if (room.visited) {
                    visibleRooms.add(room);
                    // Add neighbors to visible set (Fog of War: you can see what's next)
                    // For thoroughness, we check all cells on the perimeter
                    for (let x = room.gridX; x < room.gridX + room.widthUnits; x++) {
                        const nTop = game.levelGen.getRoom(x, room.gridY - 1);
                        const nBot = game.levelGen.getRoom(x, room.gridY + room.heightUnits);
                        if (nTop) visibleRooms.add(nTop);
                        if (nBot) visibleRooms.add(nBot);
                    }
                    for (let y = room.gridY; y < room.gridY + room.heightUnits; y++) {
                        const nLeft = game.levelGen.getRoom(room.gridX - 1, y);
                        const nRight = game.levelGen.getRoom(room.gridX + room.widthUnits, y);
                        if (nLeft) visibleRooms.add(nLeft);
                        if (nRight) visibleRooms.add(nRight);
                    }
                }
            }

            for (const room of game.rooms) {
                if (!visibleRooms.has(room)) continue;

                const pos = worldToMap(room.x, room.y);
                const w = room.width * this.scale;
                const h = room.height * this.scale;

                const isVisited = room.visited;

                // Accessible space is pure black void, but unvisited is slightly dimmer/foggy
                ctx.fillStyle = isVisited ? '#000000' : '#0a0a0f';
                ctx.fillRect(pos.x, pos.y, w, h);

                // Room Outline
                let color = '#333';
                let glow = null;

                if (isVisited) {
                    if (room.locked) {
                        color = '#ff3333';
                        glow = 'rgba(255, 51, 51, 0.2)';
                    } else if (room === game.currentRoom) {
                        color = '#44ff44';
                        glow = 'rgba(68, 255, 68, 0.2)';
                    } else if (room.cleared) {
                        color = '#666';
                    } else {
                        color = '#444';
                    }
                } else {
                    // Unvisited but visible neighbor
                    color = '#222';
                }

                if (glow && room === game.currentRoom) {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = color;
                }

                if (room.type === RoomType.BOSS) {
                    // Draw Boss Skull
                    const cx = pos.x + w / 2;
                    const cy = pos.y + h / 2;
                    ctx.save();
                    ctx.translate(cx, cy);
                    // Skull shape (pixel art style)
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.rect(-3, -3, 6, 4); // Head
                    ctx.rect(-2, 1, 1, 1); // Teeth
                    ctx.rect(0, 1, 1, 1);
                    ctx.rect(2, 1, 1, 1);
                    ctx.fill();
                    // Eyes
                    ctx.fillStyle = '#000';
                    ctx.fillRect(-2, -2, 1, 1);
                    ctx.fillRect(1, -2, 1, 1);
                    ctx.restore();
                } else if (room.type === RoomType.SHOP) {
                    // Draw Dollar Sign ($) in gold
                    const cx = pos.x + w / 2;
                    const cy = pos.y + h / 2;
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.fillStyle = '#ffd700';
                    // Pixel art dollar sign
                    ctx.fillRect(-1, -4, 2, 1);   // Top bar
                    ctx.fillRect(-2, -3, 1, 1);   // Top left curve
                    ctx.fillRect(-2, -2, 2, 1);   // Middle left
                    ctx.fillRect(0, -1, 2, 1);    // Middle right
                    ctx.fillRect(1, 0, 1, 1);     // Bottom right curve
                    ctx.fillRect(-1, 1, 2, 1);    // Bottom bar
                    ctx.fillRect(0, -5, 1, 7);    // Vertical line through
                    ctx.restore();
                } else if (room.type === RoomType.TREASURE) {
                    // Draw Treasure Chest icon (gold box)
                    const cx = pos.x + w / 2;
                    const cy = pos.y + h / 2;
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.fillStyle = '#ffd700';
                    // Pixel art chest
                    ctx.fillRect(-4, -2, 8, 5);   // Main body
                    ctx.fillStyle = '#8b4513';    // Brown lid
                    ctx.fillRect(-4, -3, 8, 2);
                    ctx.fillStyle = '#ffff00';    // Lock/clasp
                    ctx.fillRect(-1, -1, 2, 2);
                    ctx.restore();
                }

                ctx.strokeStyle = color;
                ctx.lineWidth = (room === game.currentRoom) ? 2 : 1;
                ctx.strokeRect(pos.x, pos.y, w, h);

                ctx.shadowBlur = 0; // Reset

                // Interior highlight
                if (room === game.currentRoom) {
                    // Current room: slightly stronger tint depending on lock status
                    ctx.fillStyle = room.locked ? 'rgba(255, 50, 50, 0.15)' : 'rgba(50, 255, 50, 0.1)';
                    ctx.fillRect(pos.x, pos.y, w, h);
                } else if (room.visited) {
                    // Visited rooms: subtle green tint
                    ctx.fillStyle = 'rgba(50, 255, 50, 0.03)';
                    ctx.fillRect(pos.x, pos.y, w, h);
                }
            }
        }

        // 5. Draw Enemies (Radar) - Only in visited rooms
        for (const enemy of game.enemies) {
            if (enemy.isDead) continue;

            // Fog of War: Enemies only show up in visited rooms
            const enemyRoom = game.levelGen.getRoomAtWorldPos(enemy.x, enemy.y);
            if (!enemyRoom || !enemyRoom.visited) continue;

            const pos = worldToMap(enemy.x, enemy.y);

            if (pos.x >= this.x && pos.x <= this.x + this.size &&
                pos.y >= this.y && pos.y <= this.y + this.size) {

                ctx.fillStyle = '#ff3333';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
                ctx.fill();

                // Red blip glow
                ctx.fillStyle = 'rgba(255, 51, 51, 0.3)';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 6. Draw XP Orbs - Only in visited rooms
        for (const orb of game.xpOrbs) {
            if (orb.isDead) continue;

            const orbRoom = game.levelGen.getRoomAtWorldPos(orb.x, orb.y);
            if (!orbRoom || !orbRoom.visited) continue;

            const pos = worldToMap(orb.x, orb.y);
            if (pos.x >= this.x && pos.x <= this.x + this.size &&
                pos.y >= this.y && pos.y <= this.y + this.size) {

                ctx.fillStyle = '#00ffff';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Cyan glow
                ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 6b. Draw Gold Orbs
        for (const orb of game.goldOrbs) {
            if (orb.isDead) continue;

            const orbRoom = game.levelGen.getRoomAtWorldPos(orb.x, orb.y);
            if (!orbRoom || !orbRoom.visited) continue;

            const pos = worldToMap(orb.x, orb.y);
            if (pos.x >= this.x && pos.x <= this.x + this.size &&
                pos.y >= this.y && pos.y <= this.y + this.size) {

                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2.0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 7. Draw Player (Always Center)
        ctx.fillStyle = '#44ff44';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#44ff44';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Border around Minimap
        ctx.restore();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.size, this.size);
    }
}
