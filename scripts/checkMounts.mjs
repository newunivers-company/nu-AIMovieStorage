/**
 * 방 면에 **붙인 소품**이 제대로 앉는지 봅니다 — 붙이고, 방을 넓히고, 끌어 보고.
 *
 * 이 저장소에는 테스트 러너가 없어 esbuild 로 묶어 node 로 한 번 돌립니다.
 * (방 면 어디에나 붙일 수 있어야 하고, 방 크기를 바꿔도 따라붙는지가 핵심입니다.)
 */
import { build } from "esbuild";
import { writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const entry = "client/src/__mountcheck.ts";
writeFileSync(
  entry,
  `export * from "@/lib/compositionEdit";\nexport * from "@/lib/composition";\n`,
);

const out = "node_modules/.cache/mountcheck.mjs";
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  alias: { "@": "./client/src" },
  logLevel: "error",
});
rmSync(entry);

const m = await import(pathToFileURL(out).href);

let failed = 0;
const eq = (name, got, want, tol = 1e-6) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK " : "FAIL"} ${name}: ${got.toFixed(3)} (기대 ${want.toFixed(3)})`);
};

// 방 하나(가로 6 · 깊이 4 · 높이 3) 를 세우고 박스를 붙입니다.
let state = m.normalizeComposition({});
const made = m.addRoomIn(state, "indoor");
state = made.state;
const roomId = made.id;
state = m.setRoomDimsIn(state, { width: 6, depth: 4, height: 3 }, roomId);

const box = m.addObjectInRoom(state, { id: "box", label: "박스" }, roomId);
state = box.state;
const objectOf = (s) => s.objects.find((item) => item.id === box.id);

// 바닥에 붙이면 밑동이 바닥에 닿습니다 — 상자의 원점은 **밑면 한가운데**입니다
// (3D 화면이 mesh 를 0.5 만큼 올려 세웁니다). 한가운데로 잡으면 반쯤 파묻힙니다.
state = m.mountObjectToFaceIn(state, box.id, roomId, "bottom");
eq("바닥에 붙인 상자 y", objectOf(state).position.y, 0);

// 천장으로 옮기면 꼭대기가 천장에 닿습니다.
state = m.mountObjectToFaceIn(state, box.id, roomId, "top");
eq("천장에 붙인 상자 y", objectOf(state).position.y, 3 - objectOf(state).scale.y);

// 층고를 올리면 **따라 올라가야** 합니다.
state = m.setRoomDimsIn(state, { height: 5 }, roomId);
eq("층고 5 로 올린 뒤 y", objectOf(state).position.y, 5 - objectOf(state).scale.y);

// 왼쪽 벽에 붙이고 방을 넓히면 벽을 따라갑니다.
state = m.mountObjectToFaceIn(state, box.id, roomId, "left");
eq("왼쪽 벽 x", objectOf(state).position.x, -3 + objectOf(state).scale.x / 2);
state = m.setRoomDimsIn(state, { width: 10 }, roomId);
eq("가로 10 으로 넓힌 뒤 x", objectOf(state).position.x, -5 + objectOf(state).scale.x / 2);

// 붙인 채로 끌어도 그 축은 벽에 남고, 나머지 축은 끈 대로 갑니다.
state = m.updateObjectIn(state, box.id, { position: { x: 2, y: 1.5, z: 1 } });
eq("끈 뒤에도 벽에 붙은 x", objectOf(state).position.x, -5 + objectOf(state).scale.x / 2);
eq("끈 대로 간 z", objectOf(state).position.z, 1);

// ── 벽(널판) ────────────────────────────────────────────────────────
// 벽에 붙인 널판이 엉뚱한 쪽을 보고 서던 자리 — 회전은 **라디안**입니다(도가 아닙니다).
const wall = m.addObjectInRoom(state, { id: "wall", label: "벽" }, roomId);
state = wall.state;
const wallOf = (s) => s.objects.find((item) => item.id === wall.id);
state = m.mountObjectToFaceIn(state, wall.id, roomId, "right");
eq("오른쪽 벽에 세운 널판의 yaw(라디안)", wallOf(state).rotation.y, -Math.PI / 2);
eq("오른쪽 벽 x(두께 2 cm 만 안쪽)", wallOf(state).position.x, 5 - 0.01);
state = m.mountObjectToFaceIn(state, wall.id, roomId, "bottom");
eq("바닥에 눕힌 널판의 pitch(라디안)", wallOf(state).rotation.x, -Math.PI / 2);
eq("바닥에 눕힌 널판 y", wallOf(state).position.y, 0.01);

// 인물에 매달았던 것을 벽에 붙이면 **먼저 떼고** 방 한가운데에서 다시 셉니다.
state = m.updateObjectIn(state, wall.id, {
  attach: { targetId: "누군가", bone: "RightHand" },
  position: { x: 0.2, y: -0.1, z: 0.4 },
});
state = m.mountObjectToFaceIn(state, wall.id, roomId, "left");
console.log(
  `${wallOf(state).attach ? "FAIL" : "OK  "} 벽에 붙이면 관절에서 떨어짐`,
);
if (wallOf(state).attach) failed += 1;
eq("관절에서 떼어 벽에 붙인 x", wallOf(state).position.x, -5 + 0.01);
eq("관절에서 떼어 벽에 붙인 y", wallOf(state).position.y, 0);

// 방을 지우면 붙임이 풀립니다(없는 방을 가리키면 안 됩니다).
const gone = m.removeRoomIn(state, roomId);
const mountAfter = gone.objects.find((item) => item.id === box.id).mount;
console.log(`${mountAfter ? "FAIL" : "OK  "} 방을 지우면 붙임도 풀림`);
if (mountAfter) failed += 1;

// 방 안에 세운 소품은 «이 방의 소품» 목록에 잡혀야 합니다.
const listed = m.objectsInRoom(state, roomId).length;
console.log(`${listed === 2 ? "OK  " : "FAIL"} 방 안 소품 ${listed}개`);
if (listed !== 2) failed += 1;

console.log(failed ? `\n${failed}개 어긋남` : "\n모두 통과");
process.exit(failed ? 1 : 0);
