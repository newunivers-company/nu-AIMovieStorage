/**
 * 타임라인 시험용 **GLB 한 개**를 만듭니다 — 애니메이션이 든 작은 모형.
 *
 *
 *
 * 밖에서 받아 오지 않고 three.js 로 **직접 지어** 내보냅니다 — 인터넷 없이도 다시 만들 수 있어야
 * 시험이 재현됩니다. 모양은 «걷는 사람» 을 흉내 낸 막대 인형(몸통·머리·팔다리)이고,
 * 클립 하나(`걷기`, 2초 루프)가 들어 있습니다.
 *
 * node scripts/makeTestGlb.mjs [나갈 경로]
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { writeFile, mkdir } from "node:fs/promises";

/*
  GLTFExporter 는 브라우저의 `FileReader` 로 Blob 을 읽습니다. 노드에는 그게 없어서
  «FileReader is not defined» 로 멈춥니다. 우리가 쓰는 길(readAsArrayBuffer → onloadend)만
  흉내 내는 아주 작은 대역을 놓습니다.
*/
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
  };
}
import { dirname, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "scratch/story/walker.glb");

function limb(name, color, size, at) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  mesh.name = name;
  mesh.position.set(at.x, at.y, at.z);
  return mesh;
}

const root = new THREE.Group();
root.name = "걷는 인형";

const body = limb("몸통", 0x6fb7e8, { x: 0.36, y: 0.6, z: 0.22 }, { x: 0, y: 1.1, z: 0 });
const head = limb("머리", 0xe8c15a, { x: 0.24, y: 0.24, z: 0.24 }, { x: 0, y: 1.54, z: 0 });
const armL = limb("왼팔", 0x9a9ae8, { x: 0.1, y: 0.5, z: 0.1 }, { x: -0.26, y: 1.15, z: 0 });
const armR = limb("오른팔", 0x9a9ae8, { x: 0.1, y: 0.5, z: 0.1 }, { x: 0.26, y: 1.15, z: 0 });
const legL = limb("왼다리", 0xd98ad4, { x: 0.12, y: 0.75, z: 0.12 }, { x: -0.11, y: 0.4, z: 0 });
const legR = limb("오른다리", 0xd98ad4, { x: 0.12, y: 0.75, z: 0.12 }, { x: 0.11, y: 0.4, z: 0 });
root.add(body, head, armL, armR, legL, legR);

/** 앞뒤로 흔드는 회전 트랙 — 2초에 한 걸음씩 두 번. */
function swing(name, phase) {
  const times = [0, 0.5, 1, 1.5, 2];
  const values = [];
  for (const time of times) {
    const angle = Math.sin(((time / 2) * Math.PI * 2) + phase) * 0.6;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0));
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

/** 위아래로 살짝 튀는 몸통 — 걸음마다 한 번. */
const bob = new THREE.VectorKeyframeTrack(
  "몸통.position",
  [0, 0.5, 1, 1.5, 2],
  [0, 1.1, 0, 0, 1.16, 0, 0, 1.1, 0, 0, 1.16, 0, 0, 1.1, 0],
);

const clip = new THREE.AnimationClip("걷기", 2, [
  swing("왼다리", 0),
  swing("오른다리", Math.PI),
  swing("왼팔", Math.PI),
  swing("오른팔", 0),
  bob,
]);

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) =>
  exporter.parse(
    root,
    (result) => resolve(result),
    (error) => reject(error),
    { binary: true, animations: [clip] },
  ),
);

await mkdir(dirname(out), { recursive: true });
await writeFile(out, Buffer.from(glb));
console.log(`만듦: ${out} (${(glb.byteLength / 1024).toFixed(0)} KB · 클립 «걷기» 2초)`);
