export class Sprite {
    constructor(data, width, height, scale = 1, colorMap = { 1: '#4fec4f', 2: '#333' }) {
        this.data = data;
        this.width = width;
        this.height = height;
        this.scale = scale;
        this.colorMap = colorMap;

        this.ctx = document.createElement('canvas').getContext('2d');
        this.ctx.canvas.width = width * scale;
        this.ctx.canvas.height = height * scale;

        this.silhouetteCtx = document.createElement('canvas').getContext('2d');
        this.silhouetteCtx.canvas.width = width * scale;
        this.silhouetteCtx.canvas.height = height * scale;

        this.generate(data);
    }

    generate(data) {
        this.data = data;
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        this.silhouetteCtx.imageSmoothingEnabled = false;
        this.silhouetteCtx.clearRect(0, 0, this.silhouetteCtx.canvas.width, this.silhouetteCtx.canvas.height);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const colorCode = data[y * this.width + x];
                if (colorCode !== 0) {
                    // Draw Main Sprite
                    if (this.colorMap[colorCode]) {
                        this.ctx.fillStyle = this.colorMap[colorCode];
                        this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
                    }
                    // Draw Silhouette (pure black for masking/outlines)
                    this.silhouetteCtx.fillStyle = '#000';
                    this.silhouetteCtx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
                }
            }
        }
    }

    update(newData) {
        this.generate(newData);
    }
    draw(ctx, x, y, rotation = 0, anchorX = 0.5, anchorY = 0.5, strokeStyle = null, overrideColor = null) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        const dw = this.width * this.scale;
        const dh = this.height * this.scale;
        const dx = -dw * anchorX;
        const dy = -dh * anchorY;

        // Pixel-Perfect Outline (Silhouette Method)
        if (strokeStyle) {
            ctx.save();
            ctx.translate(dx, dy);

            // Draw silhouette shifted 4 directions (1px at scale)
            ctx.globalAlpha = 1.0;
            ctx.drawImage(this.silhouetteCtx.canvas, -1, 0);
            ctx.drawImage(this.silhouetteCtx.canvas, 1, 0);
            ctx.drawImage(this.silhouetteCtx.canvas, 0, -1);
            ctx.drawImage(this.silhouetteCtx.canvas, 0, 1);
            ctx.restore();
        }

        if (overrideColor) {
            // Tinting Logic (Cached)
            if (!this.tintCache) this.tintCache = {};

            if (!this.tintCache[overrideColor]) {
                const c = document.createElement('canvas');
                c.width = this.ctx.canvas.width;
                c.height = this.ctx.canvas.height;
                const cx = c.getContext('2d');
                // Draw sprite
                cx.drawImage(this.ctx.canvas, 0, 0);
                // Tint
                cx.globalCompositeOperation = 'source-in';
                cx.fillStyle = overrideColor;
                cx.fillRect(0, 0, c.width, c.height);

                this.tintCache[overrideColor] = c;
            }

            ctx.drawImage(this.tintCache[overrideColor], dx, dy);
        } else {
            ctx.drawImage(this.ctx.canvas, dx, dy);
        }
        ctx.restore();
    }
}
