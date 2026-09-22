import { assetSrc, loadImageForCanvas } from "@/lib/mediaLibrary";
import { drawImageMarks } from "@/lib/imageMarkDraw";
import { profileLines, type CharacterProfile } from "@/lib/characterProfile";
import type {
  GeneratedImageAsset,
  SheetPlacement,
  SheetSize,
} from "@/lib/projectTypes";

/**
 * 시트를 굽습니다. 기본 6000×6000.
 *
 * # 왜 이렇게 큰가
 *
 * 영상 모델에 이 한 장을 물려서 「이 인물로 연기해」 라고 시킵니다. 얼굴이
 * 작게 들어가면 모델이 이목구비를 못 읽어요. 6000이면 시트 안에 얼굴
 * 클로즈업이 1000px 넘게 들어갑니다.
 *
 * # 규격 = 캔버스의 실제 px, 좌표계 = 그 캔버스의 px
 *
 *
 * 처음에는 배치 좌표를 «긴 변 = 6000» 기준으로 저장하고 굽는 순간에 규격에 맞춰
 * 통째로 줄였습니다. 그러자 4000 시트는 6000 시트를 축소한 같은 그림이 되어
 * 규격을 바꾸는 뜻이 없어졌습니다 — 「이미지는 출력된 사이즈로
 * 들어가야해」. 그래서 이제 칸의 좌표·크기는 규격의 실제 px 이고, 그림을 넣으면
 * 칸이 그 그림의 뽑힌 크기(naturalWidth × naturalHeight)가 됩니다. 4000 시트에는
 * 2048 그림이 반을 차지하고, 12000 시트에는 여섯 장이 나란히 들어갑니다.
 * 옛 배치도(`coords` 없음)는 `layoutToPx` 로 한 번 바꿉니다.
 *
 * # 상자 크기와 글자 크기는 따로입니다
 *
 * 글 상자를 넓혔더니 글씨까지 같이 커져서 배치를 잡을 수 없었던 적이
 * 있습니다. `fontSize` 는 **시트 px 의 절대값**이고 상자 크기와 무관합니다.
 *
 * # 프로필은 표로 찍습니다
 *
 * 이름·나이·키 같은 짧은 값은 두 칸 표로, 성격·말투·버릇처럼 긴 글은
 * 문단으로. 줄바꿈을 직접 계산해서 상자 밖으로 안 넘치게 합니다.
 */

export const SHEET_SIZE = 6000;

/** 긴 변 6000 시트에서 칸 이름(캡션)의 글자 크기. 다른 규격은 긴 변에 비례합니다 */
export const CAPTION_FONT = 44;

/** 규격이 없으면 6000×6000 */
export function normalizeSheetSize(size?: SheetSize | null): SheetSize {
  const width = Math.round(size?.width || SHEET_SIZE);
  const height = Math.round(size?.height || SHEET_SIZE);
  return { width: Math.max(1, width), height: Math.max(1, height) };
}


/**
 * 옛 «긴 변 6000 기준» 배치도·스냅샷을 규격의 실제 px 로 바꿉니다.
 *
 * ratio = 긴 변 / 6000 (규격이 없으면 6000 → 1). x·y·width·height·fontSize 에 곱해
 * 반올림하고 `coords: "px"` 를 찍습니다. 이미 "px" 면 **같은 객체를 그대로** 돌려줍니다 —
 * 부르는 쪽이 «바뀐 것이 있을 때만 저장» 을 객체 동일성으로 판단합니다.
 *
 * 옛 4096 배치도를 열면 화면·굽기 결과가 전과 같은 자리·비율이어야 합니다(ratio 4096/6000).
 * 6000 배치도는 값이 그대로이고 표시만 붙습니다.
 */
export function layoutToPx<
  T extends { placements: SheetPlacement[]; size?: SheetSize; coords?: "px" },
>(layout: T): T {
  if (layout.coords === "px") return layout;
  const { width, height } = normalizeSheetSize(layout.size);
  const ratio = Math.max(width, height) / SHEET_SIZE;
  const placements = layout.placements.map((item) => ({
    ...item,
    x: Math.round(item.x * ratio),
    y: Math.round(item.y * ratio),
    width: Math.round(item.width * ratio),
    height: Math.round(item.height * ratio),
    ...(item.fontSize !== undefined
      ? { fontSize: Math.max(1, Math.round(item.fontSize * ratio)) }
      : {}),
  }));
  return { ...layout, placements, coords: "px" as const };
}

/**
 * 규격을 바꿨을 때 칸을 새 시트 안에 넣습니다. 칸의 px 는 그대로가 원칙입니다
 * — 시트보다 큰 칸만 비율을 지켜 시트에
 * 맞추고, 밖으로 나가는 칸은 x·y 를 안으로 밀어 넣습니다.
 *
 * 바뀐 것이 없으면 **같은 배열** 을 돌려줍니다(불필요한 저장·기록을 막으려고).
 */
export function fitPlacements(
  placements: SheetPlacement[],
  size: SheetSize,
): SheetPlacement[] {
  const sheet = normalizeSheetSize(size);
  let changed = false;
  const next = placements.map((item) => {
    let { width, height } = item;
    if (width > sheet.width || height > sheet.height) {
      const shrink = Math.min(sheet.width / width, sheet.height / height);
      width = Math.max(1, Math.round(width * shrink));
      height = Math.max(1, Math.round(height * shrink));
    }
    const x = Math.round(Math.max(0, Math.min(sheet.width - width, item.x)));
    const y = Math.round(Math.max(0, Math.min(sheet.height - height, item.y)));
    if (
      x === item.x &&
      y === item.y &&
      width === item.width &&
      height === item.height
    )
      return item;
    changed = true;
    return { ...item, x, y, width, height };
  });
  return changed ? next : placements;
}

/**
 * 그림의 뽑힌 크기를 시트에 넣을 칸 크기로. 시트보다 크면 비율을 지켜 줄입니다.
 * `shrunk` 가 true 면 부르는 쪽이 「시트보다 커서 줄였습니다」 를 알립니다.
 */
export function fitImageToSheet(
  natural: { width: number; height: number },
  size: SheetSize,
): { width: number; height: number; shrunk: boolean } {
  const sheet = normalizeSheetSize(size);
  const width = Math.max(1, Math.round(natural.width));
  const height = Math.max(1, Math.round(natural.height));
  if (width <= sheet.width && height <= sheet.height)
    return { width, height, shrunk: false };
  const shrink = Math.min(sheet.width / width, sheet.height / height);
  return {
    width: Math.max(1, Math.round(width * shrink)),
    height: Math.max(1, Math.round(height * shrink)),
    shrunk: true,
  };
}

/** 시트 안의 좌표계. 배치는 0~1 비율이 아니라 이 크기의 픽셀로 저장합니다. */
export interface ComposeOptions {
  /** 굽는 규격. 숫자 하나면 정사각. 없으면 6000×6000 */
  size?: number | SheetSize;
  placements: SheetPlacement[];
  /** imageId → 실제 그림 */
  images: GeneratedImageAsset[];
  profile?: CharacterProfile;
  /** 표 윗줄에 들어갈 기본 정보 */
  basics: { label: string; value: string }[];
  /** 시트 바탕색. 흰 배경이라야 의상·피부 색이 제대로 읽힙니다 */
  background?: string;
  /** 칸 이름을 그림 밑에 굽는가. 기본 true */
  captions?: boolean;
}

/**
 * 프로필 글상자의 «표» 에 들어갈 줄.
 *
 * `profileLines` 하나가 시트·프롬프트 양쪽의 진실입니다 — 캐릭터 페이지가 표 줄을
 * 따로 만들면 프로필 칸이 빠집니다(). 긴 글(성격·말투·버릇·배경·연출 메모)은 표가 아니라
 * 문단으로 찍으니 여기서 뺍니다 — `drawProfileBox` 가 `profile` 에서 직접 읽습니다.
 */
const SECTION_LABELS = new Set(["성격", "말투", "버릇", "배경", "연출 메모"]);
export function sheetProfileBasics(
  profile: Partial<CharacterProfile> | null | undefined,
  basics?: { name?: string; role?: string; heightCm?: number; gender?: string },
): { label: string; value: string }[] {
  return profileLines(profile, basics).filter(
    (line) => !SECTION_LABELS.has(line.label),
  );
}

/** 글자를 상자 너비에 맞춰 줄로 자릅니다. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    // 한국어는 띄어쓰기가 드물어서 단어 단위로만 자르면 넘칩니다.
    // 글자 하나씩 재는 편이 느리지만 확실합니다.
    for (const char of paragraph) {
      const next = line + char;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * 프로필 글상자 하나를 그립니다.
 *
 * 짧은 값은 두 칸 표로 위쪽에, 긴 글은 제목 + 문단으로 아래에.
 * 상자를 넘치면 그리다 멈춥니다 — 잘려도 이상하게 겹치는 것보단 낫습니다.
 *
 * 시트 창의 미리보기도 **이 함수를 축소해 그립니다.** 미리보기를 따로 만들었더니
 * 두 줄만 보여 구운 결과와 달랐습니다 — 화면 = 결과가 되려면 그리는 코드가 하나여야 합니다.
 */
export function drawProfileBox(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  fontSize: number,
  basics: { label: string; value: string }[],
  profile?: CharacterProfile,
) {
  const pad = fontSize * 0.9;
  const lineHeight = fontSize * 1.45;
  const bottom = box.y + box.height - pad;

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(box.x, box.y, box.width, box.height);

  /*
    표에 테두리를 그립니다. (지시 309·311)

    예전에는 두 칸으로 «정렬만» 해 두고 선이 하나도 없었습니다. 그러면
    시트에서 무엇이 어느 항목의 값인지 눈으로 좇기 어렵습니다. 바깥 테두리와
    줄마다 옅은 가로선, 두 칸 사이 세로선을 넣습니다.
  */
  const line = Math.max(2, Math.round(fontSize * 0.06));
  ctx.strokeStyle = "#cfcfd6";
  ctx.lineWidth = line;
  ctx.strokeRect(
    box.x + line / 2,
    box.y + line / 2,
    box.width - line,
    box.height - line,
  );
  const rule = (yy: number) => {
    ctx.beginPath();
    ctx.moveTo(box.x + pad * 0.5, yy);
    ctx.lineTo(box.x + box.width - pad * 0.5, yy);
    ctx.stroke();
  };

  let y = box.y + pad + fontSize;
  const labelX = box.x + pad;
  // 두 칸 표. 왼쪽 칸과 오른쪽 칸에 번갈아 넣습니다.
  const colWidth = (box.width - pad * 2) / 2;
  const valueOffset = fontSize * 5.2;

  /*
    «한 줄 요약» 은 표 칸에 넣기엔 길어서 표 아래에 한 줄 통째로 찍습니다.
    `profileLines` 가 이미 tagline 을 basics 에 넣어 주므로 profile 에서 다시
    읽지 않습니다 — 두 군데서 읽으면 같은 줄이 두 번 찍힙니다.
  */
  const rows = basics.filter((item) => item.label !== "한 줄 요약");
  const tagline =
    basics.find((item) => item.label === "한 줄 요약")?.value ||
    profile?.tagline?.trim() ||
    "";

  ctx.textBaseline = "alphabetic";
  for (let index = 0; index < rows.length; index += 2) {
    if (y > bottom) break;
    for (let column = 0; column < 2; column += 1) {
      const item = rows[index + column];
      if (!item) continue;
      const x = labelX + column * colWidth;
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = "#1a1a22";
      ctx.fillText(item.label, x, y);
      ctx.font = `400 ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = "#333340";
      ctx.fillText(item.value, x + valueOffset, y);
    }
    // 줄 밑에 옅은 선. 두 칸 사이에는 세로선.
    ctx.strokeStyle = "#e4e4ea";
    rule(y + lineHeight * 0.3);
    ctx.beginPath();
    ctx.moveTo(labelX + colWidth - pad * 0.4, y - fontSize);
    ctx.lineTo(labelX + colWidth - pad * 0.4, y + lineHeight * 0.3);
    ctx.stroke();
    y += lineHeight;
  }

  if (tagline) {
    y += lineHeight * 0.3;
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#1a1a22";
    ctx.fillText("한 줄 요약", labelX, y);
    ctx.font = `400 ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#333340";
    const taglineLines = wrap(ctx, tagline, box.width - pad * 2 - valueOffset);
    for (const text of taglineLines) {
      if (y > bottom) break;
      ctx.fillText(text, labelX + valueOffset, y);
      y += lineHeight;
    }
  }

  const sections: { title: string; body?: string }[] = [
    { title: "성격", body: profile?.personality },
    { title: "말투", body: profile?.speech },
    { title: "버릇", body: profile?.habits },
    { title: "배경", body: profile?.background },
    { title: "연출 메모", body: profile?.directing },
  ];

  for (const section of sections) {
    if (!section.body?.trim()) continue;
    if (y > bottom) break;

    y += lineHeight * 0.5;
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#1a1a22";
    ctx.fillText(section.title, labelX, y);
    y += lineHeight;

    ctx.font = `400 ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#333340";
    for (const text of wrap(ctx, section.body, box.width - pad * 2)) {
      if (y > bottom) break;
      ctx.fillText(text, labelX, y);
      y += lineHeight;
    }
  }

  ctx.restore();
}

/**
 * 칸 이름을 그림 **위 바깥**에 굽습니다.
 *
 * → 아래 바깥에 찍었더니 바로 밑 상자와 붙어 어느 칸의
 * 이름인지 헷갈렸습니다(「타이틀이 상단으로 가게」). 그래서 상자 위 바깥. 시트 맨 위라
 * 자리가 없으면 상자 안 위에 반투명 흰 띠를 깔고 찍습니다(시트 창의 이름표와 같은 규칙).
 */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  label: string,
  font: number,
) {
  const text = label.trim();
  if (!text) return;
  ctx.save();
  ctx.font = `700 ${font}px system-ui, sans-serif`;
  ctx.textBaseline = "top";
  const gap = font * 0.35;
  const above = box.y - gap - font;
  const fits = above >= 0;
  const y = fits ? above : box.y + gap;
  if (!fits) {
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillRect(box.x, y - gap, box.width, font + gap * 2);
  }
  ctx.fillStyle = "#1a1a22";
  let shown = text;
  while (shown.length > 1 && ctx.measureText(shown).width > box.width - gap)
    shown = shown.slice(0, -1);
  ctx.fillText(shown, box.x + gap * 0.5, y);
  ctx.restore();
}

/**
 * 칸 **아래**에 컷 정보를 적습니다 — 길이·카메라·대사·연기.
 *
 *
 *
 * 그림 위에 겹쳐 적지 않는 까닭: 스토리보드는 **사람이 읽는 판**입니다(생성기에 넣을 때는 「칸 안의 글자는 그리지 말라」고
 * 못을 박습니다). 그림 위에 얹으면 얼굴을 가리고, 생성기가 그 글씨를 따라 그릴 위험도 커집니다.
 */
/**
 * 칸 **아래 컷 정보를 표로** 그립니다 — 왼쪽에 이름, 오른쪽에 내용.
 *
 * 줄글로 늘어놓으면 「5.0초 · 고정 / 수화안 / 대사·연기: …」 가 한 덩어리로
 * 보여 무엇이 무엇인지 가려지지 않습니다.
 *
 * 칸 너비가 늘 1500 이라 **가로가 고정**입니다. 그래서 내용이 길면 여기서 알아서
 * 접습니다(`wrap`) — 접힌 줄은 이름 칸을 비우고 내용 칸에만 이어 씁니다.
 *
 * 돌려주는 값은 **실제로 쓴 높이**입니다. 자리를 잡는 쪽이 이것으로 칸 사이를 벌립니다.
 */
function drawNoteTable(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  rows: { label: string; value: string }[],
  font: number,
  room: number,
): void {
  const live = rows.filter((row) => row.value.trim());
  if (!live.length || room <= 0) return;
  const top = box.y + box.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, top, box.width, room);
  ctx.clip();

  const pad = Math.round(font * 0.45);
  // 이름 칸은 «대사·연기» 가 안 접힐 만큼만. 나머지는 전부 내용 칸입니다.
  const labelWidth = Math.round(font * 4.6);
  const valueX = box.x + labelWidth + pad;
  const valueWidth = box.width - labelWidth - pad * 2;
  const lineHeight = Math.round(font * 1.35);

  ctx.textBaseline = "top";
  let y = top + pad;
  for (const row of live) {
    const lines = wrap(ctx, row.value.trim(), valueWidth);
    const height = lines.length * lineHeight;
    if (y + height > top + room) break;
    // 줄 사이 실금 — 표라는 것이 한눈에 보이게. 첫 줄 위에는 안 긋습니다.
    if (y > top + pad) {
      ctx.strokeStyle = "#d8d8de";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(box.x, y - Math.round(pad * 0.5));
      ctx.lineTo(box.x + box.width, y - Math.round(pad * 0.5));
      ctx.stroke();
    }
    ctx.font = `700 ${font}px system-ui, sans-serif`;
    ctx.fillStyle = "#6a6a76";
    ctx.textAlign = "left";
    ctx.fillText(row.label, box.x, y);
    ctx.font = `400 ${font}px system-ui, sans-serif`;
    ctx.fillStyle = "#26262e";
    lines.forEach((line, index) => ctx.fillText(line, valueX, y + index * lineHeight));
    y += height + pad;
  }
  ctx.restore();
}

function drawCellNotes(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  notes: string[],
  font: number,
  room: number,
) {
  const lines = notes.map((note) => note.trim()).filter(Boolean);
  if (!lines.length || room <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y + box.height, box.width, room);
  ctx.clip();
  ctx.textBaseline = "top";
  ctx.font = `400 ${font}px system-ui, sans-serif`;
  ctx.fillStyle = "#3a3a46";
  let y = box.y + box.height + font * 0.5;
  const bottom = box.y + box.height + room;
  for (const line of lines) {
    for (const wrapped of wrap(ctx, line, box.width)) {
      if (y + font > bottom) break;
      ctx.fillText(wrapped, box.x, y);
      y += font * 1.32;
    }
  }
  ctx.restore();
}

/**
 * 배치대로 시트를 굽습니다.
 *
 * 그림은 상자를 꽉 채우되 비율을 지킵니다(cover). 잘리는 편이 늘어나는
 * 것보다 낫습니다 — 인물이 홀쭉해지면 체형이 틀어져서요.
 *
 * `placements` 는 **결과 규격 px** 그대로입니다(좌표계가 px 라 환산하지 않습니다 —
 * 옛 6000 기준 값은 부르는 쪽이 `layoutToPx` 로 먼저 바꿔야 합니다). `fontSize` 도 절대 px.
 */
export async function composeSheet(options: ComposeOptions): Promise<Blob> {
  const size =
    typeof options.size === "number"
      ? { width: options.size, height: options.size }
      : normalizeSheetSize(options.size);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들지 못했습니다.");

  ctx.fillStyle = options.background ?? "#ffffff";
  ctx.fillRect(0, 0, size.width, size.height);

  // 캡션 글자는 규격에 비례합니다 — 2K 로 뽑아도 6000 과 같은 비율로 보이게.
  const captionFont = Math.max(
    8,
    Math.round((Math.max(size.width, size.height) / SHEET_SIZE) * CAPTION_FONT),
  );

  for (const placement of options.placements) {
    const box = {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    };

    if (placement.kind === "profile") {
      drawProfileBox(
        ctx,
        box,
        placement.fontSize ?? 46,
        options.basics,
        options.profile,
      );
      continue;
    }

    const image = options.images.find((item) => item.id === placement.imageId);
    if (!image) continue;
    // 파일 경로를 그대로 넘기면 안 됩니다. loadImageForCanvas 가 fetch 하는데
    // "D:\..." 는 URL 이 아니라 상대 경로로 읽혀서 dev 서버를 뒤지다 실패합니다.
    // 그러면 catch 에 삼켜져 그 칸만 조용히 빈칸이 됩니다.
    const source = assetSrc(image.filePath) || image.thumb;
    if (!source) continue;

    // asset:// 를 캔버스에 바로 그리면 캔버스가 오염돼서 toBlob 이 막힙니다.
    const element = await loadImageForCanvas(source).catch(() => null);
    if (!element) continue;

    const scale = Math.max(
      box.width / element.width,
      box.height / element.height,
    );
    const drawWidth = element.width * scale;
    const drawHeight = element.height * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
    const drawX = box.x + (box.width - drawWidth) / 2;
    const drawY = box.y + (box.height - drawHeight) / 2;
    ctx.drawImage(element, drawX, drawY, drawWidth, drawHeight);

    /*
      표시(동선·구역·자리)는 **그림 위에 여기서** 그립니다 — 원본 파일에는 굽지 않습니다.
      표시의 좌표는 그림의 0~1 비율이라, 칸이 아니라 «칸 안에 실제로 그려진 그림» 에 맞춰야
      cover 로 잘린 만큼 어긋나지 않습니다. 칸 밖으로 나가는 부분은 위의 clip 이 잘라 냅니다.
    */
    if (placement.marks?.length) {
      ctx.translate(drawX, drawY);
      drawImageMarks(ctx, placement.marks, drawWidth, drawHeight);
    }
    ctx.restore();

    if (options.captions !== false && placement.label) {
      // 칸이 제 글자 크기를 들고 있으면 그것이 이깁니다(스토리보드가 칸 너비에 맞춰 정합니다).
      drawCaption(ctx, box, placement.label, placement.fontSize ?? captionFont);
    }
    /*
      컷 정보는 칸 **밑자리**(`notesRoom`)에 적습니다. 자리를 계산한 쪽(스토리보드)이 그 높이를 알려 주므로, 여기서는 받은
      만큼만 쓰고 넘치면 자릅니다 — 칸을 침범하면 다음 줄 그림을 가립니다.
    */
    if (placement.notes?.length)
      drawCellNotes(
        ctx,
        box,
        placement.notes,
        placement.notesFont ?? Math.round((placement.fontSize ?? captionFont) * 0.72),
        placement.notesRoom ?? 0,
      );
    // 표가 있으면 줄글 대신 표를 그립니다(스토리보드).
    if (placement.noteRows?.length)
      drawNoteTable(
        ctx,
        box,
        placement.noteRows,
        placement.notesFont ?? Math.round((placement.fontSize ?? captionFont) * 0.72),
        placement.notesRoom ?? 0,
      );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("시트를 굽지 못했습니다.")),
      "image/png",
    );
  });
}
