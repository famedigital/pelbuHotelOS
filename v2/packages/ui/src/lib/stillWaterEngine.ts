/**
 * Lightweight still-water L0 — WebGL2 heightfield (desk-safe).
 *
 * Perf contract:
 * - Lazy: no work until first fine-pointer move
 * - Half-res canvas + 128² sim + ≤30fps loop
 * - Transparent when calm (CSS mesh underneath) — zero overdraw cost when stopped
 * - Auto-disables if frames exceed budget (integrated GPU protect)
 */

const SIM_SIZE = 128;
const DAMPING = 0.97;
const REFRACTION = 0.05;
const WAKE_RADIUS = 0.08;
const INFLUENCE = 0.2;
const IDLE_FRAMES = 36; // ~1.2s at 30fps
const TARGET_DT = 1000 / 30;
const FRAME_BUDGET_MS = 14;
const BAD_FRAME_LIMIT = 8;
const SAMPLE_MIN_MS = 32;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SIM_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform vec2 uDir;
uniform float uRadius;
uniform float uStrength;
uniform float uDamping;
uniform float uHasSeg;
in vec2 vUv;
out vec4 fragColor;

float decode(float c) { return c * 2.0 - 1.0; }
float encode(float v) { return clamp(v * 0.5 + 0.5, 0.0, 1.0); }

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec4 c = texture(uState, vUv);
  float h = decode(c.r);
  float vel = decode(c.g);

  float l = decode(texture(uState, vUv - vec2(uTexel.x, 0.0)).r);
  float r = decode(texture(uState, vUv + vec2(uTexel.x, 0.0)).r);
  float u = decode(texture(uState, vUv + vec2(0.0, uTexel.y)).r);
  float d = decode(texture(uState, vUv - vec2(0.0, uTexel.y)).r);
  float avg = (l + r + u + d) * 0.25;

  vel += (avg - h) * 1.2;
  vel *= uDamping;
  h += vel;
  h *= 0.985;
  vel *= 0.985;
  if (abs(h) < 0.003) h = 0.0;
  if (abs(vel) < 0.003) vel = 0.0;

  if (uHasSeg > 0.5 && uStrength > 0.0005) {
    vec2 dir = uDir;
    float dl = length(dir);
    if (dl > 0.001) dir /= dl;
    else dir = vec2(1.0, 0.0);
    vec2 perp = vec2(-dir.y, dir.x);

    float dist = sdSegment(vUv, uFrom, uTo);
    float across = dot(vUv - uTo, perp);
    float along = dot(vUv - uTo, dir);
    float capsule = smoothstep(uRadius, 0.0, dist);
    float trail = smoothstep(0.35, -1.2, along / max(uRadius, 0.001));
    float body = capsule * mix(0.3, 1.0, trail);
    float trough = exp(-(across * across) / (uRadius * uRadius * 0.2));
    float ridge = exp(-pow(abs(across) - uRadius * 0.5, 2.0) / (uRadius * uRadius * 0.1));
    float stamp = (ridge * 0.6 - trough) * body;
    h += stamp * uStrength;
    vel += stamp * uStrength * 0.4;
  }

  fragColor = vec4(encode(h), encode(vel), 0.5, 1.0);
}`;

const RENDER_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uState;
uniform sampler2D uBg;
uniform vec2 uTexel;
uniform vec2 uFocus;
uniform float uInfluence;
uniform float uRefraction;
uniform float uAspect;
in vec2 vUv;
out vec4 fragColor;

float decode(float c) { return c * 2.0 - 1.0; }

void main() {
  fragColor = vec4(0.0);
  if (uFocus.x < 0.0) return;

  vec2 d = vUv - uFocus;
  d.x *= uAspect;
  float dist = length(d);
  float lens = smoothstep(uInfluence, uInfluence * 0.3, dist);
  if (lens < 0.02) return;

  float h = decode(texture(uState, vUv).r);
  float hx = decode(texture(uState, vUv + vec2(uTexel.x, 0.0)).r) - h;
  float hy = decode(texture(uState, vUv + vec2(0.0, uTexel.y)).r) - h;
  float energy = abs(h) * 2.0 + length(vec2(hx, hy)) * 5.0;
  float water = smoothstep(0.01, 0.045, energy) * lens;
  if (water < 0.02) return;

  vec2 offset = vec2(hx, hy) * uRefraction * water;
  vec3 col = texture(uBg, clamp(vUv + offset, 0.0, 1.0)).rgb;
  float spec = pow(max(1.0 - length(vec2(hx, hy)) * 10.0, 0.0), 24.0) * water;
  col += vec3(0.9, 0.95, 1.0) * spec * 0.2;
  fragColor = vec4(col * water, water * 0.88);
}`;

export type StillWaterColors = {
  canvas: string;
  accents: Array<{ color: string; x: number; y: number; rx: number; ry: number }>;
};

export type StillWaterEngineOptions = {
  onDisable?: (reason: string) => void;
};

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("WebGL shader alloc failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) ?? "compile error";
    gl.deleteShader(sh);
    throw new Error(info);
  }
  return sh;
}

function link(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error("WebGL program alloc failed");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) ?? "link error";
    gl.deleteProgram(prog);
    throw new Error(info);
  }
  return prog;
}

function createSimTarget(
  gl: WebGL2RenderingContext,
  size: number,
): { tex: WebGLTexture; fbo: WebGLFramebuffer } {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error("WebGL FBO alloc failed");

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // 8-bit only — cheaper on iGPU; deadzone hides quantization
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    size,
    size,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("WebGL FBO incomplete");
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo };
}

type Stroke = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  dirX: number;
  dirY: number;
  strength: number;
};

export class StillWaterEngine {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private simA: { tex: WebGLTexture; fbo: WebGLFramebuffer };
  private simB: { tex: WebGLTexture; fbo: WebGLFramebuffer };
  private bgTex: WebGLTexture;
  private simProg: WebGLProgram;
  private renderProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private raf = 0;
  private running = false;
  private idleFrames = 0;
  private focusX = -1;
  private focusY = -1;
  private lastPx = -1;
  private lastPy = -1;
  private lastSampleAt = 0;
  private lastFrameAt = 0;
  private badFrames = 0;
  private queue: Stroke[] = [];
  private destroyed = false;
  private onDisable?: (reason: string) => void;

  constructor(canvas: HTMLCanvasElement, options: StillWaterEngineOptions = {}) {
    this.canvas = canvas;
    this.onDisable = options.onDisable;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      desynchronized: true,
    });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    this.simProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, SIM_FRAG));
    this.renderProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, RENDER_FRAG));

    const buf = gl.createBuffer();
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(this.simProg, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.simA = createSimTarget(gl, SIM_SIZE);
    this.simB = createSimTarget(gl, SIM_SIZE);
    this.clearSim();

    this.bgTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([240, 244, 249, 255]),
    );
    this.clearScreen();
  }

  paintMesh(colors: StillWaterColors): void {
    const gl = this.gl;
    const size = 512; // was 1024 — half the upload cost
    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const ctx = off.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = colors.canvas;
    ctx.fillRect(0, 0, size, size);
    for (const a of colors.accents) {
      const gx = a.x * size;
      const gy = a.y * size;
      const rx = Math.max(1, a.rx * size);
      const ry = Math.max(1, a.ry * size);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(rx, ry));
      g.addColorStop(0, a.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    this.clearSim();
    this.clearScreen();
  }

  resize(): void {
    // Half CSS pixels, DPR capped at 1 — big win on retina desk monitors
    const scale = 0.5;
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * scale));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (!this.running) this.clearScreen();
  }

  pushSample(nx: number, ny: number, impulse = false): void {
    if (this.destroyed) return;
    const now = performance.now();
    if (!impulse && now - this.lastSampleAt < SAMPLE_MIN_MS) return;
    this.lastSampleAt = now;

    const x = Math.min(1, Math.max(0, nx));
    const y = Math.min(1, Math.max(0, 1 - ny));
    this.focusX = x;
    this.focusY = y;

    if (this.lastPx < 0) {
      this.lastPx = x;
      this.lastPy = y;
      if (impulse) {
        this.queue = [
          {
            fromX: x,
            fromY: y,
            toX: x,
            toY: y,
            dirX: 0,
            dirY: 0,
            strength: 0.018,
          },
        ];
        this.wake();
      }
      return;
    }

    const dx = x - this.lastPx;
    const dy = y - this.lastPy;
    const speed = Math.sqrt(dx * dx + dy * dy);
    if (speed < 0.0005 && !impulse) {
      this.lastPx = x;
      this.lastPy = y;
      return;
    }

    const dirX = speed > 1e-6 ? dx / speed : 0;
    const dirY = speed > 1e-6 ? dy / speed : 0;
    this.queue = [
      {
        fromX: this.lastPx,
        fromY: this.lastPy,
        toX: x,
        toY: y,
        dirX,
        dirY,
        strength: impulse
          ? 0.024
          : Math.min(0.036, 0.008 + speed * 2.8),
      },
    ];
    this.lastPx = x;
    this.lastPy = y;
    this.wake();
  }

  clearPointer(): void {
    this.lastPx = -1;
    this.lastPy = -1;
    this.focusX = -1;
    this.focusY = -1;
    this.queue.length = 0;
  }

  private clearSim(): void {
    const gl = this.gl;
    for (const t of [this.simA, this.simB]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      gl.clearColor(0.5, 0.5, 0.5, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private clearScreen(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private wake(): void {
    this.idleFrames = 0;
    if (!this.running && !this.destroyed) this.start();
  }

  start(): void {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.lastFrameAt = performance.now();
    const tick = (t: number) => {
      if (this.destroyed) return;
      if (t - this.lastFrameAt < TARGET_DT - 1) {
        this.raf = requestAnimationFrame(tick);
        return;
      }
      const t0 = performance.now();
      this.step();
      const cost = performance.now() - t0;
      this.lastFrameAt = t;
      if (cost > FRAME_BUDGET_MS) {
        this.badFrames += 1;
        if (this.badFrames >= BAD_FRAME_LIMIT) {
          this.disable("frame-budget");
          return;
        }
      } else {
        this.badFrames = Math.max(0, this.badFrames - 1);
      }
      if (this.running) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private disable(reason: string): void {
    console.warn(`[StillWater] disabled (${reason}) — CSS mesh only`);
    this.clearScreen();
    this.stop();
    this.destroy();
    this.onDisable?.(reason);
  }

  private step(): void {
    const gl = this.gl;
    const texel = 1 / SIM_SIZE;
    const stroke = this.queue.shift() ?? null;

    gl.useProgram(this.simProg);
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.simB.fbo);
    gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.simA.tex);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "uState"), 0);
    gl.uniform2f(gl.getUniformLocation(this.simProg, "uTexel"), texel, texel);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uDamping"), DAMPING);

    if (stroke) {
      gl.uniform2f(gl.getUniformLocation(this.simProg, "uFrom"), stroke.fromX, stroke.fromY);
      gl.uniform2f(gl.getUniformLocation(this.simProg, "uTo"), stroke.toX, stroke.toY);
      gl.uniform2f(gl.getUniformLocation(this.simProg, "uDir"), stroke.dirX, stroke.dirY);
      gl.uniform1f(gl.getUniformLocation(this.simProg, "uRadius"), WAKE_RADIUS);
      gl.uniform1f(gl.getUniformLocation(this.simProg, "uStrength"), stroke.strength);
      gl.uniform1f(gl.getUniformLocation(this.simProg, "uHasSeg"), 1);
    } else {
      gl.uniform2f(gl.getUniformLocation(this.simProg, "uFrom"), -1, -1);
      gl.uniform2f(gl.getUniformLocation(this.simProg, "uTo"), -1, -1);
      gl.uniform2f(gl.getUniformLocation(this.simProg, "uDir"), 0, 0);
      gl.uniform1f(gl.getUniformLocation(this.simProg, "uRadius"), 0);
      gl.uniform1f(gl.getUniformLocation(this.simProg, "uStrength"), 0);
      gl.uniform1f(gl.getUniformLocation(this.simProg, "uHasSeg"), 0);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const swap = this.simA;
    this.simA = this.simB;
    this.simB = swap;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.renderProg);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.simA.tex);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, "uState"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, "uBg"), 1);
    gl.uniform2f(gl.getUniformLocation(this.renderProg, "uTexel"), texel, texel);
    gl.uniform1f(gl.getUniformLocation(this.renderProg, "uRefraction"), REFRACTION);
    gl.uniform1f(gl.getUniformLocation(this.renderProg, "uInfluence"), INFLUENCE);
    const aspect =
      this.canvas.height > 0 ? this.canvas.width / this.canvas.height : 1;
    gl.uniform1f(gl.getUniformLocation(this.renderProg, "uAspect"), aspect);
    gl.uniform2f(
      gl.getUniformLocation(this.renderProg, "uFocus"),
      this.focusX,
      this.focusY,
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!stroke && this.queue.length === 0) this.idleFrames += 1;
    else this.idleFrames = 0;

    if (this.idleFrames > IDLE_FRAMES) {
      this.clearSim();
      this.clearScreen();
      this.focusX = -1;
      this.focusY = -1;
      this.stop();
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    const gl = this.gl;
    gl.deleteTexture(this.simA.tex);
    gl.deleteTexture(this.simB.tex);
    gl.deleteTexture(this.bgTex);
    gl.deleteFramebuffer(this.simA.fbo);
    gl.deleteFramebuffer(this.simB.fbo);
    gl.deleteProgram(this.simProg);
    gl.deleteProgram(this.renderProg);
    gl.deleteVertexArray(this.vao);
  }
}

export function readStillWaterColors(el: Element): StillWaterColors {
  const cs = getComputedStyle(el);
  const canvas = cs.getPropertyValue("--hos-canvas").trim() || "#f0f4f9";
  const primary = cs.getPropertyValue("--hos-primary-mid").trim() || "#1a73e8";
  const teal = cs.getPropertyValue("--hos-teal").trim() || "#007b83";
  const brass = cs.getPropertyValue("--hos-brass").trim() || "#e37400";
  const isDark =
    el.closest("[data-theme='dark'], [data-theme='midnight'], .dark") != null ||
    canvas.startsWith("#0") ||
    canvas.startsWith("#1");

  const alpha = (hex: string, a: number) => {
    const h = hex.replace("#", "");
    if (h.length !== 6) return `rgba(26,115,232,${a})`;
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  return {
    canvas,
    accents: isDark
      ? [
          { color: alpha(brass, 0.14), x: 0.1, y: 0.05, rx: 0.55, ry: 0.4 },
          { color: alpha(primary, 0.18), x: 0.92, y: 0.08, rx: 0.45, ry: 0.38 },
          { color: alpha(teal, 0.1), x: 0.72, y: 0.95, rx: 0.4, ry: 0.32 },
        ]
      : [
          { color: alpha(primary, 0.16), x: 0.12, y: 0.0, rx: 0.55, ry: 0.42 },
          { color: alpha(teal, 0.12), x: 0.92, y: 0.08, rx: 0.42, ry: 0.36 },
          { color: alpha(primary, 0.1), x: 0.78, y: 1.0, rx: 0.4, ry: 0.35 },
        ],
  };
}
