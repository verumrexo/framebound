import { RoomType } from '../environment/RoomType.js';

export class FullscreenMap {
    constructor(game) {
        this.game = game;
        // Padding from screen edges
        this.padding = 100;
        this.scale = 0.15; // Zoom out to see more
    }

    getDimensions(renderer) {
        const width = renderer.width - (this.padding * 2);
        const height = renderer.height - (this.padding * 2);
        const x = this.padding;
        const y = this.padding;
        return { x, y, width, height };
    }

    getHoveredRoom(mouseX, mouseY) {
        const { x, y, width, height } = this.getDimensions(this.game.renderer);

        // Transform calcs (Center on entire level bounds ideally, or center on player?)
        // Let's center on the grid for now. 
        // Level is roughly 15 rooms, room size ~2000.
        // Let's rely on the same nice centering logic as minimap but dynamically computed to fit bounds.

        // Actually, to ensure consistent mapping between draw and click, we need shared transform logic.
        // Let's compute the transform parameters once per frame or access them here.

        const transform = this.calculateTransform(x, y, width, height);

        // Reverse project mouse to world
        // screenX = cx + (worldX - px) * scale
        // screenX - cx = (worldX - px) * scale
        // (screenX - cx) / scale = worldX - px
        // worldX = ((screenX - cx) / scale) + px

        // However, our generic draw loops over rooms. 
        // Better loop over rooms and check AABB in screen space?
        // Yes, safer since rooms are grids.

        if (!this.game.rooms) return null;

        for (const room of this.game.rooms) {
            if (!room.visited) continue;

            const pos = transform.worldToMap(room.x, room.y);
            const w = room.width * transform.scale;
            const h = room.height * transform.scale;

            if (mouseX >= pos.x && mouseX <= pos.x + w &&
                mouseY >= pos.y && mouseY <= pos.y + h) {
                return room;
            }
        }
        return null;
    }

    calculateTransform(mapX, mapY, mapW, mapH) {
        // Calculate bounds of all visited rooms to center the camera nicely
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        let hasVisited = false;
        if (this.game.rooms) {
            for (const room of this.game.rooms) {
                if (room.visited) {
                    hasVisited = true;
                    minX = Math.min(minX, room.x);
                    minY = Math.min(minY, room.y);
                    maxX = Math.max(maxX, room.x + room.width);
                    maxY = Math.max(maxY, room.y + room.height);
                }
            }
        }

        if (!hasVisited) {
            // Fallback to player pos
            minX = this.game.x - 2000;
            maxX = this.game.x + 2000;
            minY = this.game.y - 2000;
            maxY = this.game.y + 2000;
        }

        // Add some padding in world space
        const margin = 1000;
        minX -= margin; minY -= margin;
        maxX += margin; maxY += margin;

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        // Determine scale to fit content into map rect
        const scaleX = mapW / contentW;
        const scaleY = mapH / contentH;
        let scale = Math.min(scaleX, scaleY);

        // Cap scale to prevent zooming in too much on single rooms
        scale = Math.min(scale, 0.15);

        // Center point of content
        const centerWorldX = minX + contentW / 2;
        const centerWorldY = minY + contentH / 2;

        // Center point of map UI
        const cx = mapX + mapW / 2;
        const cy = mapY + mapH / 2;

        return {
            scale,
            worldToMap: (wx, wy) => ({
                x: cx + (wx - centerWorldX) * scale,
                y: cy + (wy - centerWorldY) * scale
            })
        };
    }

    draw(renderer) {
        const ctx = renderer.ctx;
        const dims = this.getDimensions(renderer);

        // 1. Draw Backdrop (Glass panel effect)
        ctx.save();

        // Darkened background behind map
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, renderer.width, renderer.height);

        // Map Panel
        ctx.fillStyle = '#1a1a20';
        ctx.fillRect(dims.x, dims.y, dims.width, dims.height);

        // Grid pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const dashSize = 25;
        // Clip to map area
        ctx.beginPath();
        ctx.rect(dims.x, dims.y, dims.width, dims.height);
        ctx.clip();

        for (let i = -dims.width; i < dims.width * 2; i += dashSize) {
            ctx.beginPath();
            ctx.moveTo(dims.x + i, dims.y);
            ctx.lineTo(dims.x + i - dims.height, dims.y + dims.height);
            ctx.stroke();
        }

        // Transform
        const transform = this.calculateTransform(dims.x, dims.y, dims.width, dims.height);
        // Store for click handling? No, recomputed is fine.

        // Get hovered room for highlighting
        const mouse = this.game.input.getMousePos();
        const hoveredRoom = this.getHoveredRoom(mouse.x, mouse.y);

        // 2. Draw Rooms
        if (this.game.rooms) {
            // Find "Visible" Set (Visited + Neighbors)
            const visibleRooms = new Set();
            for (const room of this.game.rooms) {
                if (room.visited) {
                    visibleRooms.add(room);
                    // Add neighbors
                    for (let x = room.gridX; x < room.gridX + room.widthUnits; x++) {
                        const nTop = this.game.levelGen.getRoom(x, room.gridY - 1);
                        const nBot = this.game.levelGen.getRoom(x, room.gridY + room.heightUnits);
                        if (nTop) visibleRooms.add(nTop);
                        if (nBot) visibleRooms.add(nBot);
                    }
                    for (let y = room.gridY; y < room.gridY + room.heightUnits; y++) {
                        const nLeft = this.game.levelGen.getRoom(room.gridX - 1, y);
                        const nRight = this.game.levelGen.getRoom(room.gridX + room.widthUnits, y);
                        if (nLeft) visibleRooms.add(nLeft);
                        if (nRight) visibleRooms.add(nRight);
                    }
                }
            }

            for (const room of this.game.rooms) {
                if (!visibleRooms.has(room)) continue;

                const pos = transform.worldToMap(room.x, room.y);
                const w = room.width * transform.scale;
                const h = room.height * transform.scale;
                const isVisited = room.visited;

                // Base Room Color
                if (isVisited) {
                    ctx.fillStyle = '#050505'; // Slightly lighter black
                } else {
                    ctx.fillStyle = '#111'; // Unvisited
                }

                // Highlight Hover
                if (room === hoveredRoom) {
                    ctx.fillStyle = '#222';
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#00ffff';
                }

                ctx.fillRect(pos.x, pos.y, w, h);
                ctx.shadowBlur = 0; // Reset

                // Outline
                let color = '#333';
                if (isVisited) {
                    if (room.locked) color = '#ff3333';
                    else if (room === this.game.currentRoom) color = '#44ff44';
                    else if (room.cleared) color = '#666';
                    else color = '#444';
                } else {
                    color = '#222';
                }

                if (room === hoveredRoom) color = '#00ffff';

                ctx.strokeStyle = color;
                ctx.lineWidth = (room === this.game.currentRoom || room === hoveredRoom) ? 2 : 1;
                ctx.strokeRect(pos.x, pos.y, w, h);

                // Icons
                this.drawRoomIcon(ctx, room, pos.x + w / 2, pos.y + h / 2, transform.scale);

                // "TELEPORT" Text on Hover
                if (room === hoveredRoom && isVisited && room !== this.game.currentRoom) {
                    ctx.fillStyle = '#00ffff';
                    ctx.font = '16px "Press Start 2P"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('teleport', pos.x + w / 2, pos.y + h / 2 + 20);
                }
            }
        }

        // 3. Draw Player
        const pPos = transform.worldToMap(this.game.x, this.game.y);
        ctx.fillStyle = '#44ff44';
        ctx.shadowColor = '#44ff44';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(pPos.x, pPos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 4. Instructions
        ctx.restore(); // Drop clip

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '24px "Press Start 2P"';
        ctx.fillText('tactical map', renderer.width / 2, dims.y - 20);

        ctx.font = '14px "Press Start 2P"';
        ctx.fillStyle = '#888';
        ctx.fillText('[m] or [esc] to close', renderer.width / 2, dims.y + dims.height + 30);
    }

    drawRoomIcon(ctx, room, cx, cy, scale) {
        // Only show special icons if known/visited? 
        // Minimap logic shows them always if in "VisibleRooms".

        let iconScale = 2.0; // Larger for fullscreen

        if (room.type === RoomType.BOSS) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(iconScale, iconScale);
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.rect(-3, -3, 6, 4);
            ctx.rect(-2, 1, 1, 1);
            ctx.rect(0, 1, 1, 1);
            ctx.rect(2, 1, 1, 1);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.fillRect(-2, -2, 1, 1);
            ctx.fillRect(1, -2, 1, 1);
            ctx.restore();
        } else if (room.type === RoomType.SHOP) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(iconScale, iconScale);
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-1, -4, 2, 1);
            ctx.fillRect(-2, -3, 1, 1);
            ctx.fillRect(-2, -2, 2, 1);
            ctx.fillRect(0, -1, 2, 1);
            ctx.fillRect(1, 0, 1, 1);
            ctx.fillRect(-1, 1, 2, 1);
            ctx.fillRect(0, -5, 1, 7);
            ctx.restore();
        } else if (room.type === RoomType.TREASURE) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(iconScale, iconScale);
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-4, -2, 8, 5);
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(-4, -3, 8, 2);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(-1, -1, 2, 2);
            ctx.restore();
        } else if (room.type === RoomType.VAULT) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(iconScale, iconScale);
            ctx.fillStyle = '#aa00ff';
            ctx.fillRect(-3, -1, 6, 4);
            ctx.fillRect(-2, -3, 1, 2);
            ctx.fillRect(1, -3, 1, 2);
            ctx.fillRect(-2, -3, 4, 1);
            ctx.fillStyle = '#000';
            ctx.fillRect(-0.5, 0, 1, 2);
            ctx.restore();
        }
    }
}
