export const UI_COLORS = Object.freeze({
    bright: '#dffcff',
    ink: '#bde9df',
    muted: '#66978f',
    dim: '#315a58',
    line: 'rgba(85, 255, 194, 0.24)',
    panel: 'rgba(2, 12, 13, 0.82)',
    cyan: '#35f2ff',
    cyanBright: '#7cf7ff',
    mint: '#55ffc2',
    green: '#74ff6a',
    greenBright: '#b8ff5a',
    amber: '#ffc857',
    orange: '#ff8a3d',
    red: '#ff4d5a'
});

export const UI_FONTS = Object.freeze({
    tiny: '11px "Pixelify Sans", "Silkscreen", monospace',
    small: '13px "Pixelify Sans", "Silkscreen", monospace',
    label: '14px "Silkscreen", "Press Start 2P", monospace',
    title: '22px "Silkscreen", "Press Start 2P", monospace',
    large: '32px "Silkscreen", "Press Start 2P", monospace'
});

export function drawUiPanel(ctx, x, y, width, height, accent = UI_COLORS.green) {
    ctx.fillStyle = UI_COLORS.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = UI_COLORS.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 3, height);
    ctx.fillRect(x, y, Math.min(34, width), 2);
}

export function drawUiBar(ctx, x, y, width, height, ratio, color) {
    const safeRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * safeRatio, height);
}
