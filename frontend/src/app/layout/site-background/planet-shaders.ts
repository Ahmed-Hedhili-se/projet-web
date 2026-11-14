const SIMPLEX_NOISE = `
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const SUN = 'normalize(vec3(-0.9, 0.18, 0.4))';

export const SURFACE_VERTEX = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
void main(){
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const EARTH_FRAGMENT = `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D oceanMap;
uniform sampler2D reliefMap;
uniform float time;
uniform float nightLights;
uniform vec3 rimColor;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
${SIMPLEX_NOISE}
vec3 bumpNormal(vec3 eyePos, vec3 N, vec3 mapN){
  vec3 q0 = dFdx(eyePos); vec3 q1 = dFdy(eyePos);
  vec2 st0 = dFdx(vUv); vec2 st1 = dFdy(vUv);
  vec3 q1perp = cross(q1, N); vec3 q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float scale = det == 0.0 ? 0.0 : inversesqrt(det);
  return normalize(T * (mapN.x * scale) + B * (mapN.y * scale) + N * mapN.z);
}
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  vec3 sun = ${SUN};
  vec3 color = texture2D(dayMap, vUv).rgb;
  float water = texture2D(oceanMap, vUv).r;
  float ndl = dot(N, sun);
  float dayAmt = smoothstep(-0.05, 0.35, ndl);

  float waves = 0.0;
  if (water > 0.05 && dayAmt > 0.0) {
    float flowTime = time * 3.2;
    waves = snoise(vec3(vUv.x * 16.8 + flowTime * 0.6, vUv.y * 16.8 - flowTime * 0.5, flowTime * 0.7));
  }
  color += water * waves * 0.06;
  color = mix(color, vec3(0.01, 0.06, 0.16), water * 0.12);

  vec3 mapN = texture2D(reliefMap, vUv).xyz * 2.0 - 1.0;
  vec3 shadeN = mix(bumpNormal(-vViewPosition, N, mapN), N, water);
  float relief = dot(shadeN, sun) - ndl;
  color *= clamp(1.0 + relief * 1.3 * dayAmt, 0.55, 1.6);
  color *= mix(0.55, 1.0, smoothstep(-0.1, 0.9, ndl));

  float nightFactor = smoothstep(0.18, -0.30, ndl);
  float lightsFactor = smoothstep(0.30, -0.35, ndl);
  vec3 cityLights = texture2D(nightMap, vUv).rgb * vec3(1.0, 0.82, 0.55) * nightLights;
  color = mix(color, color * 0.08, nightFactor);
  color += cityLights * lightsFactor;

  vec3 halfDir = normalize(sun + V);
  float glint = pow(max(dot(N, halfDir) + waves * 0.02, 0.0), 140.0);
  color += glint * water * dayAmt * 0.45 * vec3(1.0, 0.97, 0.88);

  float rim = pow(1.0 - max(dot(V, N), 0.0), 2.4) * 0.55;
  color = mix(color, rimColor, rim * (0.3 + 0.7 * dayAmt));

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

export const CLOUD_FRAGMENT = `
uniform sampler2D cloudMap;
uniform float opacity;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  vec4 tex = texture2D(cloudMap, vUv);
  float cover = tex.a * tex.r;
  float edge = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float ndl = dot(N, ${SUN});
  float day = 1.0 - smoothstep(0.30, -0.30, ndl) * 0.9;
  float light = 0.5 + 0.4 * smoothstep(-0.2, 0.6, ndl);
  gl_FragColor = vec4(vec3(light), cover * mix(0.8, 1.0, edge) * opacity * day);
  #include <colorspace_fragment>
}
`;

export const HALO_VERTEX = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const HALO_FRAGMENT = `
uniform vec3 glowColor;
uniform float intensity;
varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
  gl_FragColor = vec4(glowColor * a * intensity, a);
  #include <colorspace_fragment>
}
`;

export const STARS_VERTEX = `
attribute float seed;
attribute float bright;
uniform float time;
uniform float size;
uniform float pixelScale;
varying float vTwinkle;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vTwinkle = bright * (0.6 + 0.4 * sin(time + seed));
  gl_PointSize = max(size * pixelScale * (90.0 / max(-mv.z, 1.0)), 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const STARS_FRAGMENT = `
uniform vec3 starColor;
varying float vTwinkle;
void main(){
  float l = length(gl_PointCoord - 0.5);
  if (l > 0.5) discard;
  gl_FragColor = vec4(starColor, smoothstep(0.5, 0.0, l) * vTwinkle);
  #include <colorspace_fragment>
}
`;

export const MARKERS_VERTEX = `
attribute float seed;
attribute float major;
attribute float pulse;
uniform float size;
uniform float pixelScale;
varying float vSeed;
varying float vFade;
varying float vMajor;
varying float vPulse;
void main(){
  vSeed = seed; vMajor = major; vPulse = pulse;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 normalView = normalize(normalMatrix * normalize(position));
  vFade = smoothstep(0.15, 0.5, dot(normalView, normalize(-mv.xyz)));
  gl_PointSize = max(size * (1.0 + major * 0.7 + pulse * 0.8) * pixelScale * (7.0 / max(-mv.z, 1.0)), 2.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const MARKERS_FRAGMENT = `
uniform vec3 coreColor;
uniform vec3 ringColor;
uniform float time;
varying float vSeed;
varying float vFade;
varying float vMajor;
varying float vPulse;
void main(){
  if (vFade <= 0.001) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.30, 0.0, d) * 1.2;
  float phase = fract(time * 0.5 + vSeed);
  float ring = smoothstep(0.07, 0.0, abs(d - phase)) * (1.0 - phase);
  float strength = 0.55 + 0.45 * vMajor + vPulse;
  gl_FragColor = vec4(coreColor * core + ringColor * ring * strength, clamp(core + ring * 0.7 * strength, 0.0, 1.0) * vFade);
  #include <colorspace_fragment>
}
`;
