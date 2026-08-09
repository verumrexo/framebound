const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_world;
uniform vec2 u_source_size;
in vec2 v_uv;
out vec4 out_color;
void main() {
  vec2 snapped = (floor(v_uv * u_source_size) + 0.5) / u_source_size;
  out_color = texture(u_world, snapped);
}`;

export const defaultWebGLAdapter = {
    createContext(canvas) {
        return canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            premultipliedAlpha: false,
            // Visual-gallery evidence and browser screenshots read the final
            // compositor canvas directly, so keep this frame available.
            preserveDrawingBuffer: true
        });
    }
};

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'webgl shader compilation failed');
    }
    return shader;
}

/**
 * A tiny, injectable WebGL2 full-screen pass. Its fallback is intentionally
 * boring: one nearest-neighbour 2d blit, never a second renderer tree.
 */
export class WebGLCompositor {
    constructor(canvas, viewport, {
        adapter = defaultWebGLAdapter,
        warn = message => console.warn(message),
        createFallbackCanvas = () => globalThis.document?.createElement?.('canvas')
    } = {}) {
        this.canvas = canvas;
        this.viewport = viewport;
        this.adapter = adapter;
        this.warn = warn;
        this.gl = null;
        this.fallbackCtx = null;
        this.available = false;
        this.backend = 'fallback';
        this.warningIssued = false;
        this.contextLost = false;
        this.resources = null;
        this.fallbackCanvas = createFallbackCanvas?.() || null;
        this.attachFallbackCanvas();
        this.onContextLost = event => {
            event.preventDefault?.();
            this.contextLost = true;
            this.available = false;
            this.setBackend('fallback');
            this.warnOnce('[renderer] webgl context lost; using the safe world fallback.');
        };
        this.onContextRestored = () => this.initialize();
        canvas.addEventListener?.('webglcontextlost', this.onContextLost);
        canvas.addEventListener?.('webglcontextrestored', this.onContextRestored);
        this.initialize();
    }

    attachFallbackCanvas() {
        if (!this.fallbackCanvas || !this.canvas.parentElement) return;
        const fallback = this.fallbackCanvas;
        fallback.dataset.renderSurface = 'world-fallback';
        fallback.setAttribute?.('aria-hidden', 'true');
        fallback.style.position = 'absolute';
        fallback.style.inset = '0';
        fallback.style.zIndex = '0';
        fallback.style.pointerEvents = 'none';
        fallback.style.display = 'none';
        this.canvas.parentElement.insertBefore(fallback, this.canvas);
    }

    activateDetachedFallback() {
        if (!this.fallbackCanvas) return null;
        this.fallbackCanvas.width = this.viewport.physicalWidth;
        this.fallbackCanvas.height = this.viewport.physicalHeight;
        this.fallbackCanvas.style.display = 'block';
        if (this.canvas.style) this.canvas.style.visibility = 'hidden';
        return this.fallbackCanvas.getContext('2d');
    }

    deactivateDetachedFallback() {
        if (!this.fallbackCanvas) return;
        this.fallbackCanvas.style.display = 'none';
        if (this.canvas.style) this.canvas.style.visibility = '';
    }

    warnOnce(message) {
        if (!this.warningIssued) {
            this.warningIssued = true;
            this.warn(message);
        }
    }

    setBackend(backend) {
        this.backend = backend;
        if (this.canvas.dataset) this.canvas.dataset.rasterBackend = backend;
    }

    initialize() {
        try {
            const gl = this.adapter.createContext(this.canvas);
            if (!gl || typeof gl.createShader !== 'function') throw new Error('webgl2 unavailable');
            this.gl = gl;
            const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
            const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
            const program = gl.createProgram();
            gl.attachShader(program, vertex);
            gl.attachShader(program, fragment);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program) || 'webgl program link failed');
            }
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this.resources = {
                program,
                buffer,
                texture,
                position: gl.getAttribLocation(program, 'a_position'),
                sourceSize: gl.getUniformLocation(program, 'u_source_size')
            };
            this.available = true;
            this.setBackend('webgl2');
            this.contextLost = false;
            this.fallbackCtx = null;
            this.deactivateDetachedFallback();
        } catch (error) {
            this.available = false;
            this.setBackend('fallback');
            this.gl = null;
            this.resources = null;
            let directFallback = null;
            try {
                directFallback = this.canvas.getContext('2d');
            } catch {
                // A canvas that already owns WebGL cannot always issue a 2d
                // context. The stacked emergency surface handles that case.
            }
            this.fallbackCtx = directFallback || this.activateDetachedFallback();
            if (this.fallbackCtx) this.fallbackCtx.imageSmoothingEnabled = false;
            this.warnOnce(`[renderer] webgl2 unavailable; using nearest-neighbour fallback (${error.message}).`);
        }
    }

    resize() {
        this.canvas.width = this.viewport.physicalWidth;
        this.canvas.height = this.viewport.physicalHeight;
        if (this.available) {
            this.gl.viewport(
                this.viewport.worldOffsetX,
                this.viewport.worldOffsetY,
                this.viewport.worldPhysicalWidth,
                this.viewport.worldPhysicalHeight
            );
        }
        if (this.fallbackCanvas?.style.display === 'block') {
            this.fallbackCanvas.width = this.viewport.physicalWidth;
            this.fallbackCanvas.height = this.viewport.physicalHeight;
        }
    }

    present(sourceCanvas) {
        if (!this.available || this.contextLost) return this.presentFallback(sourceCanvas);
        const { gl, resources } = this;
        gl.viewport(
            this.viewport.worldOffsetX,
            this.viewport.worldOffsetY,
            this.viewport.worldPhysicalWidth,
            this.viewport.worldPhysicalHeight
        );
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.BLEND);
        gl.useProgram(resources.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
        gl.enableVertexAttribArray(resources.position);
        gl.vertexAttribPointer(resources.position, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, resources.texture);
        // Canvas 2d has a top-left origin, WebGL texture coordinates do not.
        // Flip on upload so the compositor preserves world orientation.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
        gl.uniform2f(resources.sourceSize, sourceCanvas.width, sourceCanvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    presentFallback(sourceCanvas) {
        const ctx = this.fallbackCtx || (this.fallbackCtx = this.activateDetachedFallback());
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(
            sourceCanvas,
            0,
            0,
            sourceCanvas.width,
            sourceCanvas.height,
            this.viewport.worldOffsetX,
            this.viewport.worldOffsetY,
            this.viewport.worldPhysicalWidth,
            this.viewport.worldPhysicalHeight
        );
    }
}
