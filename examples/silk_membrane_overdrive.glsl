/*
Silk Membrane // Overdrive
Paste into https://www.shadertoy.com/new
No inputs required. Mouse adds a puncture/tension reaction.

Adapted from the mood of "Silk Membrane" and pushed toward
something more bioluminescent, dimensional, and unstable.
*/

#define TAU 6.28318530718

mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float amp = 0.5;
    float freq = 1.0;

    for (int i = 0; i < 7; i++) {
        if (i >= octaves) break;
        v += amp * noise(p * freq);
        p = rot(0.37) * p + vec2(2.3, -1.7);
        freq *= 2.07;
        amp *= 0.48;
    }

    return v;
}

float ridgeFbm(vec2 p, int octaves) {
    float v = 0.0;
    float amp = 0.55;
    float freq = 1.0;

    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        float n = noise(p * freq) * 2.0 - 1.0;
        n = 1.0 - abs(n);
        n *= n;
        v += n * amp;
        p = rot(0.52) * p + vec2(-3.1, 4.2);
        freq *= 1.98;
        amp *= 0.53;
    }

    return v;
}

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
}

vec3 iridescent(float t) {
    return palette(
        t,
        vec3(0.55, 0.50, 0.52),
        vec3(0.45, 0.48, 0.46),
        vec3(1.00, 1.00, 0.50),
        vec3(0.00, 0.10, 0.60)
    );
}

vec3 pearlSheen(float t) {
    return palette(
        t,
        vec3(0.52, 0.44, 0.49),
        vec3(0.48, 0.45, 0.43),
        vec3(1.00, 0.75, 0.42),
        vec3(0.02, 0.22, 0.48)
    );
}

vec3 bioGlow(float t) {
    return palette(
        t,
        vec3(0.30, 0.18, 0.34),
        vec3(0.28, 0.22, 0.38),
        vec3(0.80, 1.00, 0.65),
        vec3(0.15, 0.40, 0.72)
    );
}

float breathe(float t) {
    return 0.5 + 0.25 * sin(t * 0.7) + 0.25 * sin(t * 1.13 + 1.0);
}

float warpBase(vec2 p, float t, out float warpStrength) {
    vec2 q = vec2(
        fbm(p + 0.10 * t, 5),
        fbm(p + vec2(5.2, 1.3) + 0.10 * t, 5)
    );

    vec2 r = vec2(
        fbm(p + 3.8 * q + vec2(1.7, 9.2) + 0.15 * t, 5),
        fbm(p + 3.8 * q + vec2(8.3, 2.8) + 0.15 * t, 5)
    );

    warpStrength = length(r);
    return fbm(p + 4.2 * r + 0.08 * t, 6);
}

float weaveField(vec2 p, float t) {
    vec2 q = rot(0.35) * p;
    float ridges = ridgeFbm(q * 1.8 + vec2(0.0, t * 0.12), 4);
    float weave = 0.5 + 0.5 * sin(q.x * 8.5 - q.y * 6.0 + ridges * 4.5 - t * 1.2);
    float pores = fbm(q * 4.2 + vec2(-t * 0.16, t * 0.10) + vec2(ridges * 1.8), 3);
    return ridges * 0.55 + weave * 0.25 + pores * 0.20;
}

float vesicleField(vec2 p, float t, float warpStrength) {
    vec2 q = rot(-0.4) * p;
    float bands = sin(length(q * vec2(1.0, 1.35)) * 12.0 - t * 2.6 + warpStrength * 4.0);
    float cells = fbm(q * 2.8 - vec2(t * 0.08, -t * 0.05), 4);
    return smoothstep(0.45, 0.92, 0.5 + 0.5 * bands + 0.22 * cells);
}

float heightLite(vec2 p, float t) {
    float ridges = ridgeFbm(p * 1.65 + vec2(0.0, t * 0.10), 4);
    float folds = 0.5 + 0.5 * sin(p.x * 5.0 + p.y * 3.2 + ridges * 5.5 - t);
    return ridges * 0.68 + folds * 0.32;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = (fragCoord - 0.5 * res) / res.y;

    float t = iTime;
    float breath = breathe(t);

    vec2 mouse = (iMouse.xy - 0.5 * res) / res.y;
    float mouseActive = step(0.001, dot(iMouse.xy, iMouse.xy));

    float radius = length(uv);
    float angle = atan(uv.y, uv.x);
    float distToMouse = length(uv - mouse);
    vec2 awayFromMouse = normalize(uv - mouse + vec2(0.0001, 0.0));

    float puncture = mouseActive * exp(-distToMouse * 5.0);
    float shock = mouseActive * sin(distToMouse * 38.0 - t * 7.0) * exp(-distToMouse * 4.0);

    float pulse = breath * 0.11 * sin(angle * 6.0 + t * 1.3) * (1.0 - radius * 0.55);
    vec2 swirl = vec2(
        cos(angle * 3.0 + t * 0.7),
        sin(angle * 4.0 - t * 0.9)
    ) * (0.03 * exp(-radius * 1.5));

    vec2 warpedUV = uv;
    warpedUV *= 1.0 + pulse;
    warpedUV += swirl;
    warpedUV += awayFromMouse * shock * 0.035;
    warpedUV += (mouse - uv) * puncture * 0.05;

    vec2 domain = warpedUV * 2.15 + vec2(0.35, 0.08);
    float timeWarp = t * 0.30;

    float warpStrength;
    float base = warpBase(domain, timeWarp, warpStrength);

    float spread = 0.006 + 0.005 * breath + 0.004 * puncture;
    vec2 splitDir = normalize(uv + vec2(0.001, 0.002));
    float tmpWarp;
    float baseR = warpBase(domain + splitDir * spread, timeWarp, tmpWarp);
    float baseB = warpBase(domain - splitDir * spread * 0.85, timeWarp, tmpWarp);

    float weave = weaveField(domain + vec2(warpStrength * 1.2), t * 0.55);
    float micro = weaveField(domain * 1.7 - vec2(t * 0.10, -t * 0.07), t * 0.85);
    float vesicle = vesicleField(domain, t, warpStrength) * exp(-radius * 0.9);
    float tension = smoothstep(0.25, 0.95, warpStrength) * (0.65 + 0.35 * weave);

    float eps = 0.03;
    float h = heightLite(domain, t) + base * 0.35;
    float hx = heightLite(domain + vec2(eps, 0.0), t) + baseR * 0.35;
    float hy = heightLite(domain + vec2(0.0, eps), t) + baseB * 0.35;
    vec3 normal = normalize(vec3(h - hx, h - hy, 0.22));

    vec3 lightDir = normalize(vec3(
        -0.45 + 0.25 * sin(t * 0.23),
         0.30 + 0.20 * cos(t * 0.17),
         0.95
    ));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    float diff = max(dot(normal, lightDir), 0.0);
    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.8);
    float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 26.0);

    float shimmer = pow(max(0.0, sin((base + weave * 0.8) * 26.0 - t * 5.2 + spec * 2.0)), 18.0);
    float veins = pow(clamp(weave, 0.0, 1.0), 3.2);
    float pressureBands = 0.5 + 0.5 * sin(base * 18.0 - t * 2.4 + warpStrength * 4.0);

    vec3 prism = vec3(
        iridescent(baseR + warpStrength * 0.35 + weave * 0.20 + t * 0.10).r,
        iridescent(base  + warpStrength * 0.35 + weave * 0.25 + t * 0.10 + 0.07).g,
        iridescent(baseB + warpStrength * 0.35 + weave * 0.30 + t * 0.10 + 0.14).b
    );

    vec3 sheen = pearlSheen(base * 2.1 + micro * 0.8 + diff * 0.4 + t * 0.35);
    vec3 innerGlow = bioGlow(base * 1.6 - micro * 0.9 - fresnel * 0.6 + t * 0.22);

    vec3 col = prism;
    col = mix(col, sheen, tension * 0.35 + 0.12 * pressureBands);
    col += innerGlow * diff * 0.18;
    col += innerGlow * fresnel * (0.45 + 0.25 * breath);
    col += vec3(1.0, 0.95, 0.88) * spec * 0.75;
    col += sheen * shimmer * (0.10 + 0.38 * tension);
    col += vec3(0.95, 0.25, 0.72) * veins * 0.14;
    col += vec3(0.15, 0.65, 1.10) * vesicle * 0.18;
    col += vec3(0.55, 0.08, 0.18) * puncture * 0.35;

    col -= vec3(0.05, 0.02, 0.06) * pow(1.0 - pressureBands, 2.0) * 0.75;

    vec3 bg = mix(vec3(0.008, 0.004, 0.025), vec3(0.025, 0.035, 0.085), 0.5 + 0.5 * uv.y);
    bg += vec3(0.10, 0.03, 0.08) * exp(-9.0 * abs(radius - 0.88 + 0.04 * sin(angle * 4.0 - t * 0.3)));

    float silhouette = radius + 0.10 * sin(angle * 3.0 - t * 0.35 + base * 5.0) + 0.07 * (weave - 0.5);
    float membraneMask = 1.0 - smoothstep(0.88, 1.12, silhouette);
    float rim = smoothstep(0.30, 0.95, membraneMask) * (1.0 - smoothstep(0.82, 0.99, membraneMask));

    col = mix(bg, col, membraneMask);
    col += vec3(0.30, 0.75, 1.20) * rim * fresnel * 0.55;

    float grain = hash21(fragCoord + vec2(fract(t) * 91.7, fract(t * 0.73) * 53.1)) - 0.5;
    col += grain * 0.025;

    col = max(col, 0.0);
    col = 1.0 - exp(-col * 1.25);
    col = pow(col, vec3(0.92, 0.94, 0.97));

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
