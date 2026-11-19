// ---------- tiny WebGL2 renderer ----------
class Nd {
  constructor(prim, col) {
    this.p = [0, 0, 0];
    this.r = [0, 0, 0];
    this.s = [1, 1, 1];
    this.ch = [];
    this.prim = prim || null;
    this.col = col || [1, 1, 1];
    this.em = [0, 0, 0];
    this.vis = true;
    this.m = new Float32Array(16);
  }
  add(c) {
    this.ch.push(c);
    return c;
  }
}
function part(prim, col, sx, sy, sz, x = 0, y = 0, z = 0) {
  const n = new Nd(prim, col);
  n.s = [sx, sy, sz];
  n.p = [x, y, z];
  return n;
}

const R = (() => {
  let gl,
    canvas,
    lit,
    fx,
    world = null;
  const prims = {};
  const VP = new Float32Array(16),
    V = new Float32Array(16),
    P = new Float32Array(16),
    ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const cam = {
    x: 0,
    y: 2,
    z: 0,
    rx: 1,
    ry: 0,
    rz: 0,
    ux: 0,
    uy: 1,
    uz: 0,
    fov: 1.1,
  };
  const FXV = 9,
    FXMAX = 60000;
  const fxA = new Float32Array(FXMAX * FXV),
    fxD = new Float32Array(8000 * FXV);
  let nA = 0,
    nD = 0,
    fxBuf,
    fxVao;
  const LP = new Float32Array(24),
    LC = new Float32Array(24),
    LR = new Float32Array(8);
  // t is the game clock, for the water's motion
  const env = {
    amb: [0.1, 0.12, 0.16],
    fog: [0.02, 0.027, 0.04],
    fogD: 0.03,
    t: 0,
  };
  const stats = { draws: 0, tris: 0 };

  // aMat is the world's material byte (MAT in 03_world.js): 0 plain, 1 brick,
  // 2 water. Anything without one reads 0.
  const VS_LIT = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=3) in float aMat;
  uniform mat4 uVP, uM; uniform vec3 uTint,uCam;
  out vec3 vW,vR; out vec4 vC; flat out float vMat;
  void main(){ vec4 w=uM*vec4(aPos,1.); vW=w.xyz; vR=w.xyz-uCam; vC=vec4(aCol.rgb*aCol.rgb*uTint,aCol.a); vMat=floor(aMat*255.+.5); gl_Position=uVP*w; }`;
  const FS_LIT = `#version 300 es
  precision highp float;
  in vec3 vW,vR; in vec4 vC; flat in float vMat;
  uniform vec3 uCam,uAmb,uFog,uEmis,uRim; uniform float uFogD,uToon,uTime;
  uniform vec3 uLP[8]; uniform vec3 uLC[8]; uniform float uLR[8];
  out vec4 o;
  float hash(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
  // Brick: courses 0.22 m high, bricks 0.5 m long, every other course half a
  // brick along, mortar 0.025 m at 0.55, some bricks dark or missing. Returns
  // the colour scale. A wall runs
  // along its normal's horizontal tangent; a floor lies in xz. The normal is
  // taken from camera-relative positions, and a wall measures from the middle
  // of its 8 m square of ground, so that the tangent's rounding error is not
  // multiplied by the distance from the origin. 8 m is a whole number of
  // bricks, so a wall along x or z runs on unbroken across squares.
  float brick(vec3 w,vec3 r){
    vec3 n=normalize(cross(dFdx(r),dFdy(r)));
    vec2 c=(floor(w.xz/8.)+.5)*8.;
    vec2 q=abs(n.y)>0.7?w.xz:vec2(dot(w.xz-c,normalize(vec2(-n.z,n.x)+1e-6)),w.y);
    float row=floor(q.y/0.22), u=q.x/0.5+0.5*mod(row,2.);
    float d=min((0.5-abs(fract(u)-0.5))*0.5,(0.5-abs(fract(q.y/0.22)-0.5))*0.22);
    float px=length(fwidth(q));
    float m=1.-smoothstep(0.0125-px*0.5,0.0125+px*0.5,d);
    m=mix(m,0.16,smoothstep(0.02,0.06,px));
    // each brick's shade, hashed with its square so the pattern never repeats;
    // a few are dark, and a few are missing: a hole shaded from its top edge
    vec2 b=vec2(floor(u),row)+c*0.731;
    float sh=1.+0.12*(hash(b)*2.-1.), k=hash(b.yx+17.3);
    if(k>0.984) sh=0.2+0.16*(1.-fract(q.y/0.22));
    else if(k>0.945) sh*=0.62;
    return mix(sh,0.55,m);
  }
  // Water: the slope of slow ripples running with the flow, and how bright
  // the streaks along it are at p.
  const vec2 FLOW=vec2(0.9285,0.3714);
  vec3 water(vec2 p,float t){
    vec2 g=FLOW*cos(dot(p,FLOW)*2.3-t*1.1)*0.05
      +vec2(-0.5,0.866)*cos(dot(p,vec2(-0.5,0.866))*3.9-t*1.4)*0.03
      +vec2(0.259,-0.966)*cos(dot(p,vec2(0.259,-0.966))*6.1-t*2.)*0.02;
    vec2 r=p*1.6-FLOW*t*0.5; float e=0.05, h0=vnoise(r);
    g+=vec2(vnoise(r+vec2(e,0))-h0,vnoise(r+vec2(0,e))-h0)/e*0.05;
    vec2 a=vec2(dot(p,FLOW)*0.5-t*0.45,dot(p,vec2(-FLOW.y,FLOW.x))*4.);
    float s=smoothstep(0.62,0.92,vnoise(a))*(0.6+0.4*vnoise(a*vec2(0.3,1.)+7.3));
    return vec3(g,s);
  }
  void main(){
    vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));
    vec3 vv=uCam-vW; float fd=length(vv); vec3 v=vv/max(fd,1e-4);
    if(dot(n,v)<0.) n=-n;
    vec3 base=vC.rgb; float glow=vC.a, wet=0.;
    if(vMat>1.5){
      vec3 wa=water(vW.xz,uTime);
      n=normalize(vec3(-wa.x,1.,-wa.y));
      glow+=0.12+0.5*wa.z; base*=1.+wa.z; wet=1.;
    } else if(vMat>0.5) base*=brick(vW,vR);
    vec3 l=uAmb*(0.55+0.45*n.y), sp=vec3(0.);
    for(int i=0;i<8;i++){
      vec3 d=uLP[i]-vW; float dist=length(d);
      float att=max(0.,1.-dist/uLR[i]); att*=att;
      float nd=max(dot(n,d/max(dist,1e-4)),0.);
      float tn=nd>0.5?1.:(nd>0.1?0.55:0.16);
      nd=mix(nd*0.8+0.2,tn,uToon);
      l+=uLC[i]*att*nd;
      if(wet>0.) sp+=uLC[i]*att*pow(max(dot(n,normalize(d/max(dist,1e-4)+v)),0.),60.);
    }
    vec3 c=base*l+base*glow*2.4+uEmis;
    if(wet>0.) c+=sp*0.6+uAmb*0.5*pow(1.-max(dot(n,v),0.),4.);
    c+=uRim*pow(1.-max(dot(n,v),0.),2.5);
    c=c/(1.+c*0.55);
    c=pow(c,vec3(.4545));
    float f=1.-exp(-fd*fd*uFogD*uFogD);
    o=vec4(mix(c,uFog,f),1.);
  }`;
  const VS_FX = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aCol;
  uniform mat4 uVP; uniform vec3 uCam; uniform float uFogD;
  out vec2 vUV; out vec4 vCol;
  void main(){ vUV=aUV; float d=length(uCam-aPos); float f=exp(-d*d*uFogD*uFogD*0.6); vCol=vec4(aCol.rgb,aCol.a*f); gl_Position=uVP*vec4(aPos,1.); }`;
  const FS_FX = `#version 300 es
  precision highp float;
  in vec2 vUV; in vec4 vCol; out vec4 o;
  void main(){ float a=max(0.,1.-dot(vUV,vUV)); o=vec4(vCol.rgb*vCol.a*a*a,1.); }`;

  function prog(vs, fs) {
    const mk = (t, s) => {
      const sh = gl.createShader(t);
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const inf = gl.getActiveUniform(p, i);
      const nm = inf.name.replace("[0]", "");
      u[nm] = gl.getUniformLocation(p, inf.name);
    }
    return { p, u };
  }
  function mesh(pos, col, mat) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const b = gl.createBuffer(),
      bufs = [b];
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    if (col) {
      const c = gl.createBuffer();
      bufs.push(c);
      gl.bindBuffer(gl.ARRAY_BUFFER, c);
      gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    }
    if (mat) {
      const m = gl.createBuffer();
      bufs.push(m);
      gl.bindBuffer(gl.ARRAY_BUFFER, m);
      gl.bufferData(gl.ARRAY_BUFFER, mat, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    }
    gl.bindVertexArray(null);
    return { vao, n: pos.length / 3, bufs };
  }
  function buildPrims() {
    const tri = [];
    const quad = (a, b, c, d) => tri.push(...a, ...b, ...c, ...a, ...c, ...d);
    // box
    const h = 0.5,
      c = [
        [-h, -h, -h],
        [h, -h, -h],
        [h, h, -h],
        [-h, h, -h],
        [-h, -h, h],
        [h, -h, h],
        [h, h, h],
        [-h, h, h],
      ];
    quad(c[0], c[1], c[2], c[3]);
    quad(c[5], c[4], c[7], c[6]);
    quad(c[4], c[0], c[3], c[7]);
    quad(c[1], c[5], c[6], c[2]);
    quad(c[3], c[2], c[6], c[7]);
    quad(c[4], c[5], c[1], c[0]);
    prims.box = mesh(new Float32Array(tri));
    tri.length = 0;
    // cone (tip up), 6 sides
    const ring = (n, y, r) => {
      const o = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        o.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      return o;
    };
    let rb = ring(6, -h, h);
    for (let i = 0; i < 6; i++) {
      tri.push(...rb[i], ...rb[(i + 1) % 6], 0, h, 0);
      tri.push(...rb[(i + 1) % 6], ...rb[i], 0, -h, 0);
    }
    prims.cone = mesh(new Float32Array(tri));
    tri.length = 0;
    // cylinder 8 sides
    const r0 = ring(8, -h, h),
      r1 = ring(8, h, h);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      quad(r0[i], r0[j], r1[j], r1[i]);
      tri.push(...r1[i], ...r1[j], 0, h, 0);
      tri.push(...r0[j], ...r0[i], 0, -h, 0);
    }
    prims.cyl = mesh(new Float32Array(tri));
    tri.length = 0;
    // octahedron + subdivided sphere
    const ov = [
      [0, h, 0],
      [h, 0, 0],
      [0, 0, h],
      [-h, 0, 0],
      [0, 0, -h],
      [0, -h, 0],
    ];
    const of = [
      [0, 2, 1],
      [0, 3, 2],
      [0, 4, 3],
      [0, 1, 4],
      [5, 1, 2],
      [5, 2, 3],
      [5, 3, 4],
      [5, 4, 1],
    ];
    for (const f of of) tri.push(...ov[f[0]], ...ov[f[1]], ...ov[f[2]]);
    prims.oct = mesh(new Float32Array(tri));
    tri.length = 0;
    const nrm = (a) => {
      const l = Math.hypot(a[0], a[1], a[2]);
      return [(a[0] / l) * h, (a[1] / l) * h, (a[2] / l) * h];
    };
    const mid = (a, b) =>
      nrm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
    let faces = of.map((f) => [ov[f[0]], ov[f[1]], ov[f[2]]]);
    for (let it = 0; it < 2; it++) {
      const nf = [];
      for (const [a, b, c2] of faces) {
        const ab = mid(a, b),
          bc = mid(b, c2),
          ca = mid(c2, a);
        nf.push([a, ab, ca], [ab, b, bc], [ca, bc, c2], [ab, bc, ca]);
      }
      faces = nf;
    }
    for (const f of faces) tri.push(...f[0], ...f[1], ...f[2]);
    prims.sph = mesh(new Float32Array(tri));
    tri.length = 0;
  }
  function init(cv) {
    canvas = cv;
    gl = cv.getContext("webgl2", {
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) return false;
    lit = prog(VS_LIT, FS_LIT);
    fx = prog(VS_FX, FS_FX);
    buildPrims();
    // a mesh with no material reads plain
    gl.vertexAttrib1f(3, 0);
    fxVao = gl.createVertexArray();
    gl.bindVertexArray(fxVao);
    fxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, fxA.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, FXV * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, FXV * 4, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, FXV * 4, 20);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    return true;
  }
  // pieces, when given, are ranges of the mesh that drawWorld can draw alone
  function setWorld(pos, col, mat = null, pieces = null) {
    // worlds are swapped on every portal trip, so free the one being replaced
    if (world) {
      gl.deleteVertexArray(world.vao);
      for (const b of world.bufs) gl.deleteBuffer(b);
    }
    world = mesh(pos, col, mat);
    world.pieces = pieces;
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.floor(canvas.clientWidth * dpr)),
      h2 = Math.max(2, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h2) {
      canvas.width = w;
      canvas.height = h2;
    }
  }
  function setCam(ex, ey, ez, tx, ty, tz, fov) {
    cam.x = ex;
    cam.y = ey;
    cam.z = ez;
    cam.fov = fov;
    M4.lookAt(V, ex, ey, ez, tx, ty, tz);
    M4.persp(P, fov, canvas.width / canvas.height, 0.12, 160);
    M4.mul(VP, P, V);
    cam.rx = V[0];
    cam.ry = V[4];
    cam.rz = V[8];
    cam.ux = V[1];
    cam.uy = V[5];
    cam.uz = V[9];
  }
  function setLights(list) {
    for (let i = 0; i < 8; i++) {
      const L = list[i];
      if (L) {
        LP[i * 3] = L.x;
        LP[i * 3 + 1] = L.y;
        LP[i * 3 + 2] = L.z;
        LC[i * 3] = L.c[0] * L.i;
        LC[i * 3 + 1] = L.c[1] * L.i;
        LC[i * 3 + 2] = L.c[2] * L.i;
        LR[i] = L.r;
      } else {
        LC[i * 3] = LC[i * 3 + 1] = LC[i * 3 + 2] = 0;
        LR[i] = 1;
      }
    }
  }
  function begin() {
    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    const fg = env.fog;
    gl.clearColor(fg[0], fg[1], fg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.useProgram(lit.p);
    const u = lit.u;
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniform3f(u.uCam, cam.x, cam.y, cam.z);
    gl.uniform3fv(u.uAmb, env.amb);
    gl.uniform3fv(u.uFog, fg);
    gl.uniform1f(u.uFogD, env.fogD);
    gl.uniform1f(u.uTime, env.t);
    gl.uniform3fv(u.uLP, LP);
    gl.uniform3fv(u.uLC, LC);
    gl.uniform1fv(u.uLR, LR);
    nA = 0;
    nD = 0;
    stats.draws = 0;
    stats.tris = 0;
  }
  // Whether any of box [x0, y0, z0, x1, y1, z1] is inside the view: it is
  // out only when all eight corners are past the same clip plane.
  function boxVisible(b) {
    let all = 63;
    for (let c = 0; c < 8; c++) {
      const x = b[c & 1 ? 3 : 0],
        y = b[c & 2 ? 4 : 1],
        z = b[c & 4 ? 5 : 2],
        cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12],
        cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13],
        cz = VP[2] * x + VP[6] * y + VP[10] * z + VP[14],
        cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      all &=
        (cx < -cw ? 1 : 0) |
        (cx > cw ? 2 : 0) |
        (cy < -cw ? 4 : 0) |
        (cy > cw ? 8 : 0) |
        (cz < -cw ? 16 : 0) |
        (cz > cw ? 32 : 0);
      if (!all) return true;
    }
    return false;
  }
  // With ids null, or a world set without pieces, draws the whole world;
  // otherwise only those pieces.
  function drawWorld(ids = null) {
    if (!world) return;
    const u = lit.u;
    gl.uniformMatrix4fv(u.uM, false, ID);
    gl.uniform3f(u.uTint, 1, 1, 1);
    gl.uniform3f(u.uEmis, 0, 0, 0);
    gl.uniform3f(u.uRim, 0, 0, 0);
    gl.uniform1f(u.uToon, 0);
    gl.bindVertexArray(world.vao);
    if (!ids || !world.pieces) {
      gl.drawArrays(gl.TRIANGLES, 0, world.n);
      stats.draws++;
      stats.tris += world.n / 3;
      return;
    }
    for (const id of ids) {
      const q = world.pieces[id];
      if (!q.count) continue;
      gl.drawArrays(gl.TRIANGLES, q.first, q.count);
      stats.draws++;
      stats.tris += q.count / 3;
    }
  }
  const _L = new Float32Array(16);
  function walk(n, pm, rim) {
    if (!n.vis) return;
    M4.trs(
      _L,
      n.p[0],
      n.p[1],
      n.p[2],
      n.r[0],
      n.r[1],
      n.r[2],
      n.s[0],
      n.s[1],
      n.s[2],
    );
    M4.mul(n.m, pm, _L);
    if (n.prim) {
      const u = lit.u,
        pr = prims[n.prim];
      gl.uniformMatrix4fv(u.uM, false, n.m);
      gl.uniform3fv(u.uTint, n.col);
      gl.uniform3fv(u.uEmis, n.em);
      gl.uniform3fv(u.uRim, rim);
      gl.bindVertexArray(pr.vao);
      gl.drawArrays(gl.TRIANGLES, 0, pr.n);
      stats.draws++;
    }
    for (let i = 0; i < n.ch.length; i++) walk(n.ch[i], n.m, rim);
  }
  function drawNode(root, rim) {
    gl.bindVertexArray(null);
    gl.vertexAttrib4f(1, 1, 1, 1, 0);
    gl.uniform1f(lit.u.uToon, 1);
    walk(root, ID, rim || [0, 0, 0]);
  }
  // world position of a node-local point (after drawNode computed matrices)
  function nodePos(n, lx = 0, ly = 0, lz = 0) {
    const m = n.m;
    return [
      m[0] * lx + m[4] * ly + m[8] * lz + m[12],
      m[1] * lx + m[5] * ly + m[9] * lz + m[13],
      m[2] * lx + m[6] * ly + m[10] * lz + m[14],
    ];
  }
  function pv(arr, i, x, y, z, u, v, r, g, b, a) {
    const o = i * FXV;
    arr[o] = x;
    arr[o + 1] = y;
    arr[o + 2] = z;
    arr[o + 3] = u;
    arr[o + 4] = v;
    arr[o + 5] = r;
    arr[o + 6] = g;
    arr[o + 7] = b;
    arr[o + 8] = a;
  }
  function sprite(x, y, z, s, r, g, b, a) {
    if (nA + 6 > FXMAX) return;
    const ax = cam.rx * s,
      ay = cam.ry * s,
      az = cam.rz * s,
      bx = cam.ux * s,
      by = cam.uy * s,
      bz = cam.uz * s;
    pv(fxA, nA++, x - ax - bx, y - ay - by, z - az - bz, -1, -1, r, g, b, a);
    pv(fxA, nA++, x + ax - bx, y + ay - by, z + az - bz, 1, -1, r, g, b, a);
    pv(fxA, nA++, x + ax + bx, y + ay + by, z + az + bz, 1, 1, r, g, b, a);
    pv(fxA, nA++, x - ax - bx, y - ay - by, z - az - bz, -1, -1, r, g, b, a);
    pv(fxA, nA++, x + ax + bx, y + ay + by, z + az + bz, 1, 1, r, g, b, a);
    pv(fxA, nA++, x - ax + bx, y - ay + by, z - az + bz, -1, 1, r, g, b, a);
  }
  // a soft disc of additive light lying flat at height y, s in radius
  function flat(x, y, z, s, r, g, b, a) {
    if (nA + 6 > FXMAX) return;
    pv(fxA, nA++, x - s, y, z - s, -1, -1, r, g, b, a);
    pv(fxA, nA++, x + s, y, z - s, 1, -1, r, g, b, a);
    pv(fxA, nA++, x + s, y, z + s, 1, 1, r, g, b, a);
    pv(fxA, nA++, x - s, y, z - s, -1, -1, r, g, b, a);
    pv(fxA, nA++, x + s, y, z + s, 1, 1, r, g, b, a);
    pv(fxA, nA++, x - s, y, z + s, -1, 1, r, g, b, a);
  }
  // a soft dark disc on the ground, s in radius; with yaw and len, stretched
  // len times along the heading yaw (an ellipse), and at height y
  function blob(x, z, s, a, yaw = 0, len = 1, y = 0.12) {
    if (nD + 6 > 8000) return;
    const ux = Math.sin(yaw) * s * len,
      uz = Math.cos(yaw) * s * len,
      vx = Math.cos(yaw) * s,
      vz = -Math.sin(yaw) * s,
      c = (i, j) => pv(fxD, nD++, x + vx * i + ux * j, y, z + vz * i + uz * j, i, j, a, a, a, 1);
    c(-1, -1);
    c(1, -1);
    c(1, 1);
    c(-1, -1);
    c(1, 1);
    c(-1, 1);
  }
  // ribbon: pts(i)->[x,y,z] inner/outer supplied by callback f(t, side) ; alpha(t)
  function ribbon(segs, f, r, g, b, alphaFn) {
    if (nA + segs * 6 > FXMAX) return;
    let p0 = f(0, 0),
      p1 = f(0, 1),
      a0 = alphaFn(0);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs,
        q0 = f(t, 0),
        q1 = f(t, 1),
        a1 = alphaFn(t);
      pv(fxA, nA++, p0[0], p0[1], p0[2], 0, -1, r, g, b, a0);
      pv(fxA, nA++, p1[0], p1[1], p1[2], 0, 1, r, g, b, a0);
      pv(fxA, nA++, q1[0], q1[1], q1[2], 0, 1, r, g, b, a1);
      pv(fxA, nA++, p0[0], p0[1], p0[2], 0, -1, r, g, b, a0);
      pv(fxA, nA++, q1[0], q1[1], q1[2], 0, 1, r, g, b, a1);
      pv(fxA, nA++, q0[0], q0[1], q0[2], 0, -1, r, g, b, a1);
      p0 = q0;
      p1 = q1;
      a0 = a1;
    }
  }
  function ring(x, y, z, r0, r1, r, g, b, a) {
    ribbon(
      28,
      (t, s) => {
        const an = t * TAU,
          rr = s ? r1 : r0;
        return [x + Math.cos(an) * rr, y, z + Math.sin(an) * rr];
      },
      r,
      g,
      b,
      () => a,
    );
  }
  function end() {
    gl.useProgram(fx.p);
    gl.uniformMatrix4fv(fx.u.uVP, false, VP);
    gl.uniform3f(fx.u.uCam, cam.x, cam.y, cam.z);
    gl.bindVertexArray(fxVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, fxBuf);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    if (nD) {
      gl.uniform1f(fx.u.uFogD, 0);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, fxD.subarray(0, nD * FXV));
      gl.drawArrays(gl.TRIANGLES, 0, nD);
    }
    if (nA) {
      gl.uniform1f(fx.u.uFogD, env.fogD);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, fxA.subarray(0, nA * FXV));
      gl.drawArrays(gl.TRIANGLES, 0, nA);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
  function toScreen(x, y, z) {
    const w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
    if (w <= 0.05) return null;
    const cx = (VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w,
      cy = (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w;
    return [
      (cx * 0.5 + 0.5) * canvas.clientWidth,
      (1 - (cy * 0.5 + 0.5)) * canvas.clientHeight,
      w,
    ];
  }
  return {
    init,
    setWorld,
    setCam,
    setLights,
    begin,
    drawWorld,
    boxVisible,
    drawNode,
    nodePos,
    sprite,
    flat,
    blob,
    ribbon,
    ring,
    end,
    toScreen,
    env,
    cam,
    stats,
  };
})();
