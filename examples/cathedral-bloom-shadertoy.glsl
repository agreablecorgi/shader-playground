/*
Cathedral Bloom
Paste into https://www.shadertoy.com/new
No inputs required.
*/

#define TAU 6.28318530718

mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

vec3 palette(float t) {
    return 0.48 + 0.42 * cos(TAU * (vec3(0.11, 0.27, 0.41) + t * vec3(0.90, 1.05, 1.20)));
}

float starLayer(vec2 uv, float seed) {
    vec2 id = floor(uv);
    vec2 gv = fract(uv) - 0.5;
    float n = hash21(id + seed * 17.23);
    vec2 offset = vec2(
        hash21(id + seed * 3.11 + 1.7),
        hash21(id + seed * 5.93 + 9.2)
    ) - 0.5;
    float d = length(gv - offset * 0.65);
    float star = 1.0 - smoothstep(0.0, 0.18, d);
    star *= smoothstep(0.94, 1.0, n);
    star *= 0.6 + 0.4 * sin(iTime * (1.1 + n * 2.0) + n * TAU);
    return star;
}

vec3 bloom(vec2 p, float t) {
    vec3 col = vec3(0.0);
    vec2 base = p;
    base.y -= 0.02;

    float halo = exp(-3.5 * dot(base, base));
    col += vec3(0.05, 0.14, 0.30) * halo * 0.5;

    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec2 q = base * (1.0 + fi * 0.26);
        q *= rot(0.3 * t + fi * 0.75 + 0.2 * sin(t * 0.4 + fi));
        q.x += 0.08 * sin(q.y * 6.0 + t * (0.6 + fi * 0.05) + fi);

        float r = length(q);
        float a = atan(q.y, q.x);
        float petals = 5.0 + mod(fi, 3.0) * 2.0 + floor(fi / 3.0);
        float envelope = 0.18 + 0.06 * sin(a * petals - t * (0.8 + fi * 0.07) + fi * 1.9);
        float shell = exp(-70.0 * abs(r - envelope));
        float spokes = pow(max(0.0, cos(a * petals * 0.5 - t * 1.4 + fi)), 12.0);
        float veil = exp(-12.0 * abs(q.y + 0.05 * sin(q.x * 9.0 + t + fi))) * exp(-3.0 * r);

        vec3 tint = palette(0.12 * fi + r * 0.45 + t * 0.06);
        col += tint * (shell * (0.65 + 1.4 * spokes) + veil * 0.08) / (1.0 + fi * 0.8);
    }

    float core = exp(-34.0 * dot(base, base));
    col += vec3(1.4, 0.95, 0.6) * core * (1.2 + 0.3 * sin(t * 2.0));

    float aura = exp(-8.0 * length(base));
    col += vec3(0.08, 0.30, 0.50) * aura * 0.4;

    return col;
}

vec3 renderUpper(vec2 p, float t) {
    float grad = smoothstep(-0.8, 1.0, p.y);
    vec3 col = mix(vec3(0.01, 0.01, 0.04), vec3(0.03, 0.09, 0.17), grad);

    float moon = exp(-18.0 * length(p - vec2(-0.58, 0.56)));
    col += vec3(0.35, 0.52, 0.95) * moon * 0.18;

    float stars = 0.0;
    float scale = 3.0;
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        stars += starLayer(p * scale + vec2(fi * 27.1, t * 0.03 * (1.0 + fi)), fi);
        scale *= 1.9;
    }
    col += vec3(0.70, 0.82, 1.0) * stars * 0.8;

    float haze = 0.0;
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 q = p * (1.1 + fi * 0.45);
        q.x += 0.18 * sin(q.y * 3.0 + t * 0.15 + fi * 1.7);
        float ribbon = exp(-7.0 * abs(q.y - 0.18 * sin(q.x * 1.9 - t * (0.22 + fi * 0.06) - fi)));
        haze += ribbon / (1.0 + fi);
    }
    col += vec3(0.06, 0.24, 0.32) * haze * 0.18;

    float rays = pow(max(0.0, cos(atan(p.y - 0.02, p.x) * 10.0 - t * 0.5)), 18.0) * exp(-2.6 * length(p));
    col += vec3(0.20, 0.40, 0.90) * rays * 0.06;

    col += bloom(p, t);
    return col;
}

vec3 renderWater(vec2 p, float t, float horizon) {
    float depth = clamp((horizon - p.y) / 0.9, 0.0, 1.0);
    float rippleA = sin(p.x * 24.0 - t * 2.4 + p.y * 18.0);
    float rippleB = sin(p.x * 63.0 + t * 1.7);
    float ripple = (rippleA * 0.012 + rippleB * 0.004) * (0.35 + 0.65 * depth);

    vec2 rp = vec2(p.x + ripple, 2.0 * horizon - p.y + ripple * 1.6);
    vec3 refl = renderUpper(rp, t);

    vec3 tint = mix(vec3(0.02, 0.08, 0.09), vec3(0.01, 0.03, 0.05), depth);
    vec3 col = refl * vec3(0.14, 0.30, 0.34);
    col += tint * 0.8;
    col *= mix(1.0, 0.45, depth);

    float shimmer = pow(max(0.0, sin(p.x * 140.0 + t * 5.0 + rippleA * 2.0)), 18.0);
    col += vec3(0.18, 0.28, 0.26) * shimmer * 0.05 * (1.0 - depth * 0.4);

    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    float horizon = -0.16;

    vec3 sky = renderUpper(uv, t);
    vec3 water = renderWater(uv, t, horizon);
    float waterMask = 1.0 - step(horizon, uv.y);
    vec3 col = mix(sky, water, waterMask);

    float horizonLine = exp(-700.0 * abs(uv.y - horizon));
    col += vec3(1.0, 0.45, 0.18) * horizonLine * 0.18;

    float mist = exp(-20.0 * abs(uv.y - horizon)) * exp(-1.8 * abs(uv.x));
    col += vec3(0.15, 0.08, 0.04) * mist * 0.12;

    float vignette = clamp(1.0 - 0.22 * dot(uv, uv), 0.0, 1.0);
    col *= vignette;

    col = 1.0 - exp(-col);
    col = pow(col, vec3(0.95, 0.98, 1.0));

    float grain = hash21(fragCoord + vec2(fract(t) * 91.7, fract(t * 0.73) * 53.1)) - 0.5;
    col += grain * 0.025;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
