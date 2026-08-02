export function drawCustomCursor(game) {
    if (game.hangar.active || game.shipBuilder.active || game.paused) {
        game.renderer.canvas.style.cursor = 'default';
        return;
    }

    // Hide OS cursor in game
    game.renderer.canvas.style.cursor = 'none';

    const mouse = game.input.getMousePos();
    const ctx = game.renderer.ctx;
    const settings = game.cursorSettings;

    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.lineCap = 'square';

    const drawShape = (color, thickness, offset = 0) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;

        const len = settings.length + offset;
        const gap = settings.gap + offset;

        switch (settings.shape) {
            case 'dot':
                ctx.fillStyle = color;
                ctx.fillRect(-(thickness / 2 + offset), -(thickness / 2 + offset), thickness + offset * 2, thickness + offset * 2);
                break;
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, (len + gap) / 2, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case '3-lines':
                for (let i = 0; i < 3; i++) {
                    const angle = (i * Math.PI * 2 / 3) - Math.PI / 2;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * gap, Math.sin(angle) * gap);
                    ctx.lineTo(Math.cos(angle) * (gap + len), Math.sin(angle) * (gap + len));
                    ctx.stroke();
                }
                break;
            case '4-lines':
            default:
                ctx.beginPath(); // Top
                ctx.moveTo(0, -gap); ctx.lineTo(0, -(gap + len));
                ctx.stroke();
                ctx.beginPath(); // Bottom
                ctx.moveTo(0, gap); ctx.lineTo(0, gap + len);
                ctx.stroke();
                ctx.beginPath(); // Left
                ctx.moveTo(-gap, 0); ctx.lineTo(-(gap + len), 0);
                ctx.stroke();
                ctx.beginPath(); // Right
                ctx.moveTo(gap, 0); ctx.lineTo(gap + len, 0);
                ctx.stroke();
                break;
        }
    };

    // Draw Outline First
    if (settings.outline) {
        drawShape('#000000', settings.thickness + 2, 1);
    }

    // Draw Primary
    drawShape(settings.color, settings.thickness);

    ctx.restore();
}
