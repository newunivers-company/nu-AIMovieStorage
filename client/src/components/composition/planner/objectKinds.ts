import {
  Box,
  Circle,
  Cylinder,
  Lightbulb,
  RectangleHorizontal,
} from "lucide-react";
import type { ObjectKindEntry } from "@/lib/compositionEdit";

/**
 * **세울 수 있는 소품 한 벌.** 배치 탭(캐릭터 소품)과 환경 탭(배경 소품)이 **같은 목록**을 씁니다.
 *
 * 한쪽에만 «벽» 이 있고 다른 쪽엔 없는 일이 생기면 안 되어서 여기 한 군데에 둡니다(CLAUDE.md 규칙 1).
 *
 * **벽이 맨 앞**입니다. 한 컷에 필요한 배경은 대개 «정면 한 장» 이라, 여섯 면을 다 갖춘 방보다
 * 이 길이 빠릅니다.
 */
export const OBJECT_KINDS: (ObjectKindEntry & { icon: typeof Box })[] = [
  { id: "wall", label: "벽", icon: RectangleHorizontal },
  { id: "box", label: "박스", icon: Box },
  { id: "sphere", label: "구", icon: Circle },
  { id: "cylinder", label: "실린더", icon: Cylinder },
  { id: "light", label: "핀 조명", icon: Lightbulb, lightType: "point" },
  { id: "light", label: "LED 조명", icon: Lightbulb, lightType: "area" },
];

/**
 * 에셋 시트로 **바꿔 그릴 수 있는** 소품 갈래.
 *
 *
 * 벽은 그림을 입히는 판이고, 조명은 애초에 그려지는 물건이 아닙니다.
 */
export const SWAPPABLE_KINDS = ["box", "sphere", "cylinder", "table"];
