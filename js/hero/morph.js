import * as THREE from 'three';

const CONTAINER_ID = 'threejs-container-hero';
const CONTAINER = document.getElementById(CONTAINER_ID);

if (!CONTAINER) {
    throw new Error(`Container #${CONTAINER_ID} not found`);
}

const VERTEX_COUNT = 4000;

// --- Timing Configuration (PhD Level Precision) ---
// Each phase = Morphing Transition + Steady State Dwell
const MORPH_TIME = 1.5;   // Time spent moving particles
const DWELL_TIME = 2.25;  // Time spent in final configuration (as requested)
const PHASE_DURATION = MORPH_TIME + DWELL_TIME;

// Total phases: 1. Hypercube(init), 2. Ellipsoid, 3. Manifold, 4. Graph(messy), 5. Lattice, 6. Cube
// We loop back to 1.
const TOTAL_PHASES = 6;
const CYCLE_DURATION = PHASE_DURATION * TOTAL_PHASES;

// --- Physics & Geometry Helpers ---

function createCircleTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d');
    context.beginPath();
    context.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
    context.fillStyle = 'white';
    context.fill();
    return new THREE.CanvasTexture(canvas);
}

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap for performance
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); 
CONTAINER.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 2.8;

// --- Buffer Generation (Pre-calculating to avoid JIT lag) ---

function get_hyper_raw() {
    const data = new Float32Array(VERTEX_COUNT * 4);
    for (let i = 0; i < VERTEX_COUNT; i++) {
        let x = Math.random() - 0.5, y = Math.random() - 0.5, z = Math.random() - 0.5, w = Math.random() - 0.5;
        const mag = Math.sqrt(x*x + y*y + z*z + w*w);
        const stride = i * 4;
        data[stride] = (x/mag) * 1.5;
        data[stride+1] = (y/mag) * 1.5;
        data[stride+2] = (z/mag) * 1.5;
        data[stride+3] = (w/mag) * 1.5;
    }
    return data;
}

const hyper_4d_base = get_hyper_raw();

function get_ellipsoid() {
    const p = new Float32Array(VERTEX_COUNT * 3);
    for (let i = 0; i < VERTEX_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
        p[i*3] = 1.4 * Math.sin(phi) * Math.cos(theta);
        p[i*3+1] = 0.9 * Math.sin(phi) * Math.sin(theta);
        p[i*3+2] = 0.9 * Math.cos(phi);
    }
    return p;
}

function get_manifold() {
    const p = new Float32Array(VERTEX_COUNT * 3);
    for (let i = 0; i < VERTEX_COUNT; i++) {
        const u = Math.random() * Math.PI * 2, v = Math.random() * Math.PI * 2;
        const r = 0.4 + 0.1 * Math.sin(3*u);
        p[i*3] = (1.0 + r * Math.cos(v)) * Math.cos(u);
        p[i*3+1] = (1.0 + r * Math.cos(v)) * Math.sin(u);
        p[i*3+2] = r * Math.sin(v) + 0.2 * Math.sin(2*u);
    }
    return p;
}

function get_graph() {
    const p = new Float32Array(VERTEX_COUNT * 3);
    for (let i = 0; i < VERTEX_COUNT; i++) {
        const r = Math.pow(Math.random(), 0.5) * 1.6;
        const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
        p[i*3] = r * Math.sin(phi) * Math.cos(theta);
        p[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        p[i*3+2] = r * Math.cos(phi);
    }
    return p;
}

function get_lattice() {
    const p = new Float32Array(VERTEX_COUNT * 3);
    const side = Math.ceil(Math.cbrt(VERTEX_COUNT));
    const step = 2.2 / side;
    let idx = 0;
    for (let x = 0; x < side && idx < VERTEX_COUNT; x++) {
        for (let y = 0; y < side && idx < VERTEX_COUNT; y++) {
            for (let z = 0; z < side && idx < VERTEX_COUNT; z++) {
                p[idx*3] = (x * step) - 1.1;
                p[idx*3+1] = (y * step) - 1.1;
                p[idx*3+2] = (z * step) - 1.1;
                idx++;
            }
        }
    }
    return p;
}

function get_cube() {
    const p = new Float32Array(VERTEX_COUNT * 3);
    for (let i = 0; i < VERTEX_COUNT; i++) {
        let x = Math.random() - 0.5, y = Math.random() - 0.5, z = Math.random() - 0.5;
        const max = Math.max(Math.abs(x), Math.max(Math.abs(y), Math.abs(z)));
        p[i*3] = (x/max) * 1.25; p[i*3+1] = (y/max) * 1.25; p[i*3+2] = (z/max) * 1.25;
    }
    return p;
}

const BUFFERS = [
    null, // Dynamic Hypercube
    get_ellipsoid(),
    get_manifold(),
    get_graph(),
    get_lattice(),
    get_cube()
];

// --- Projection Logic ---

function project_4d(i, angle) {
    const s = i * 4;
    const x = hyper_4d_base[s], y = hyper_4d_base[s+1], z = hyper_4d_base[s+2], w = hyper_4d_base[s+3];
    const cA = Math.cos(angle), sA = Math.sin(angle);
    
    // Rotation in XW and ZW planes
    const x1 = x * cA - w * sA;
    const w1 = x * sA + w * cA;
    const z2 = z * cA - w1 * sA;
    const w2 = z * sA + w1 * cA;

    const p = 1 / (2.5 - w2);
    return [x1 * p, y * p, z2 * p];
}

// --- Initialization ---

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VERTEX_COUNT * 3), 3));

const material = new THREE.PointsMaterial({
    color: 0x44aaff, size: 0.035, map: createCircleTexture(),
    transparent: true, opacity: 0.8, alphaTest: 0.05, depthWrite: false
});

const particle_system = new THREE.Points(geometry, material);
scene.add(particle_system);

// Pre-compile to prevent initial frame stutter
renderer.compile(scene, camera);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    const cycle_time = time % CYCLE_DURATION;
    
    // Determine which phase we are in
    const phase_idx = Math.floor(cycle_time / PHASE_DURATION);
    const local_time = cycle_time % PHASE_DURATION;
    
    // Calculate Smoothing (Hermite Interpolation)
    // t goes from 0 to 1 during MORPH_TIME, then stays at 1 during DWELL_TIME
    const raw_t = Math.min(local_time / MORPH_TIME, 1.0);
    const smooth_t = raw_t * raw_t * (3 - 2 * raw_t);

    const positions = geometry.attributes.position.array;
    const angle = time * 0.5;

    // Get current and next buffer
    const next_phase_idx = (phase_idx + 1) % TOTAL_PHASES;
    const bufA_type = phase_idx;
    const bufB_type = next_phase_idx;

    for (let i = 0; i < VERTEX_COUNT; i++) {
        const i3 = i * 3;
        
        // Helper to get coordinates for a phase
        const getCoord = (pIdx) => {
            if (pIdx === 0) return project_4d(i, angle); // Hypercube phase
            const b = BUFFERS[pIdx];
            return [b[i3], b[i3+1], b[i3+2]];
        };

        const posA = getCoord(bufA_type);
        const posB = getCoord(bufB_type);

        // Linear interpolation between states
        positions[i3]     = posA[0] + (posB[0] - posA[0]) * smooth_t;
        positions[i3 + 1] = posA[1] + (posB[1] - posA[1]) * smooth_t;
        positions[i3 + 2] = posA[2] + (posB[2] - posA[2]) * smooth_t;
    }

    geometry.attributes.position.needsUpdate = true;
    particle_system.rotation.y = time * 0.1;
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();