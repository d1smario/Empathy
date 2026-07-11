"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Altezza del terreno: picco centrale + creste + micro-rumore (coerente per terreno e rotta). */
function terrainHeight(x: number, z: number): number {
  const r = Math.sqrt(x * x + z * z);
  const peak = 3.5 * Math.exp(-(r * r) / 6);
  const ridge = 0.6 * Math.exp(-(r * r) / 20) * (Math.sin(x * 1.3) + Math.cos(z * 1.15));
  const noise = 0.16 * (Math.sin(x * 2.7 + z * 1.9) + Math.sin(x * 4.1 - z * 3.3));
  return Math.max(0, peak + ridge + noise);
}

function heightColor(h: number, out: THREE.Color): void {
  // verde base → roccia → neve
  if (h < 0.7) out.setRGB(0.16, 0.34, 0.2);
  else if (h < 1.7) out.lerpColors(new THREE.Color(0.16, 0.34, 0.2), new THREE.Color(0.42, 0.36, 0.28), (h - 0.7) / 1.0);
  else if (h < 2.7) out.lerpColors(new THREE.Color(0.42, 0.36, 0.28), new THREE.Color(0.62, 0.6, 0.58), (h - 1.7) / 1.0);
  else out.lerpColors(new THREE.Color(0.62, 0.6, 0.58), new THREE.Color(0.92, 0.95, 0.98), Math.min(1, (h - 2.7) / 0.8));
}

/** Montagna 3D procedurale con rotta a spirale e camera che orbita (WebGL, self-contained). */
export function Mountain3D() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // WebGL non disponibile: nessun render (il resto della card resta)
    }
    const width = el.clientWidth || 420;
    const height = Math.round(width * 0.62);
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "auto";
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0b0f, 14, 30);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const camY = 5.2;
    const camR = 12.5;
    camera.position.set(camR, camY, 0);
    camera.lookAt(0, 1.1, 0);

    // luci
    scene.add(new THREE.AmbientLight(0x9fb4d6, 0.6));
    const sun = new THREE.DirectionalLight(0xfff1e0, 1.15);
    sun.position.set(-8, 12, 6);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xa855f7, 0.5);
    rim.position.set(6, 4, -8);
    scene.add(rim);

    // terreno
    const SIZE = 16;
    const SEG = 120;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      heightColor(h, c);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, flatShading: false });
    const terrain = new THREE.Mesh(geo, mat);
    scene.add(terrain);

    // rotta a spirale che sale la montagna
    const routePts: THREE.Vector3[] = [];
    const LOOPS = 2.6;
    const STEPS = 260;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const ang = t * Math.PI * 2 * LOOPS;
      const radius = 5.6 * (1 - t) + 0.5;
      const x = Math.cos(ang) * radius;
      const z = Math.sin(ang) * radius;
      routePts.push(new THREE.Vector3(x, terrainHeight(x, z) + 0.18, z));
    }
    const curve = new THREE.CatmullRomCurve3(routePts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 300, 0.09, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.55, roughness: 0.4 }),
    );
    scene.add(tube);

    // marcatori start/end + puntino che scorre
    const start = routePts[0]!;
    const end = routePts[routePts.length - 1]!;
    const mkMarker = (color: number, p: THREE.Vector3) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshBasicMaterial({ color }));
      m.position.copy(p);
      scene.add(m);
      return m;
    };
    mkMarker(0x22d3ee, start);
    mkMarker(0x34d399, end);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    scene.add(dot);

    // loop
    let raf = 0;
    let visible = true;
    let t0 = 0;
    const render = (ms: number) => {
      if (!t0) t0 = ms;
      const el2 = (ms - t0) / 1000;
      if (!reduce) {
        const a = el2 * 0.16;
        camera.position.set(Math.cos(a) * camR, camY, Math.sin(a) * camR);
        camera.lookAt(0, 1.1, 0);
        const u = (el2 * 0.06) % 1;
        curve.getPointAt(u, dot.position);
      } else {
        curve.getPointAt(0.5, dot.position);
      }
      renderer.render(scene, camera);
      if (!reduce && visible) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    // pausa quando fuori viewport
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible && !reduce && !raf) raf = requestAnimationFrame(render);
        if (!visible && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0.05 },
    );
    io.observe(el);

    // resize
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || width;
      const h = Math.round(w * 0.62);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });
    ro.observe(el);

    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      geo.dispose();
      mat.dispose();
      tube.geometry.dispose();
      (tube.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className="w-full overflow-hidden rounded-xl" aria-hidden />;
}
