import { toast } from "sonner";
import { saveProjectMediaAsset, type ProjectAssetType } from "@/lib/mediaLibrary";
import { filterImageFiles } from "@/lib/promptWorkflow";
import { uid, type GeneratedImageAsset } from "@/lib/projectTypes";

/**
 * 밖에서 뽑아 온 그림을 카드에 등록합니다.
 *
 * 이 앱은 그림을 만들지 않습니다. 프롬프트를 여기서 만들고, 프리픽·ComfyUI
 * 에서 뽑은 결과를 다시 가져와 붙입니다. **그 «다시 가져오기» 가 이 함수입니다.**
 *
 * 계보 카드에 그냥 끌어다 놓는 것이 가장 짧은 길입니다. 예전에는 카드를 열고
 * 아래로 한참 내려가 「생성 이미지」 칸을 찾아야 했습니다.
 *
 * # 왜 여기 한 곳인가
 *
 * 캐릭터·배경·에셋·변형이 전부 같은 일을 합니다. 예전에 이 코드가 여기저기
 * 흩어져 있어서, 「저장된 이름으로 화면 이름도 바꾸기」 같은 규칙 하나를
 * 고치면 나머지를 빠뜨렸습니다.
 */
export async function attachGeneratedImages(options: {
  files: FileList | File[];
  projectName: string;
  assetType: ProjectAssetType;
  /** 폴더 이름이 되는 값 */
  ownerName: string;
  /** 파일 이름 앞부분. 변형에 떨구면 «인물_변형». 비우면 폴더 이름. */
  stem?: string;
  /**
   * 카드를 고칩니다. **지금 값을 받아 다음 값을 만드는 함수** 여야 합니다.
   *
   * 이 함수가 두 번 부릅니다 — 화면에 먼저 얹고, 폴더 저장이 끝나면 저장된
   * 자리를 적어 넣습니다. 값으로 덮어쓰면 두 번째가 첫 번째를 못 보고
   * 지웁니다.
   */
  patch: (
    updater: (current: { generatedImages: GeneratedImageAsset[] }) => {
      generatedImages: GeneratedImageAsset[];
    },
  ) => void;
}): Promise<void> {
  const picked = filterImageFiles(options.files);
  if (!picked.length) {
    toast.error("이미지 파일만 등록할 수 있습니다.");
    return;
  }

  const added: GeneratedImageAsset[] = picked.map((file) => ({
    id: uid(),
    name: file.name.replace(/\.[^.]+$/, ""),
    thumb: URL.createObjectURL(file),
    file,
  }));

  options.patch((current) => {
    const before = current.generatedImages || [];
    return {
      // 첫 그림이 대표가 됩니다. 목록에서 이 카드를 보여 줄 때 씁니다.
      generatedImages: [
        ...before,
        ...added.map((image, index) => ({
          ...image,
          isPrimary: before.length === 0 && index === 0,
        })),
      ],
    };
  });

  // 제목이 없으면 폴더를 못 정합니다. 그냥 넘어가면 화면에는 그림이 보이는데
  // 폴더에는 아무것도 없고, blob 주소라 앱을 닫으면 통째로 사라집니다.
  if (!options.projectName.trim()) {
    toast.warning("프로젝트 제목을 먼저 정하세요. 그래야 그림이 폴더에 저장됩니다.");
    return;
  }

  const saved = await Promise.all(
    added.map(async (image) => {
      if (!image.file) return null;
      const result = await saveProjectMediaAsset(image.file, {
        projectName: options.projectName,
        assetType: options.assetType,
        ownerName: options.ownerName,
        // 원본 파일 이름은 넘기지 않습니다 — 「인물 이름_001」(변형은 「인물_변형_001」) 로
        // 저장됩니다. 파일 이름이 곧 Magnific 의 @태그라, 생성기가 붙인 긴 이름으로는 태그를 못 겁니다.
        stem: options.stem,
      }).catch(() => null);
      return result ? { id: image.id, path: result.path, name: result.name } : null;
    }),
  );

  const stored = new Map(saved.filter(Boolean).map((item) => [item!.id, item!]));
  if (!stored.size) return;

  options.patch((current) => ({
    generatedImages: (current.generatedImages || []).map((image) => {
      const item = stored.get(image.id);
      return item ? { ...image, filePath: item.path, name: item.name } : image;
    }),
  }));
}
