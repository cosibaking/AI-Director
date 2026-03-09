/**
 * 关键帧参考图匹配模块
 * 从关键帧描述中识别并匹配人物与场景，关联项目资源，输出参考图列表与对应关系。
 * 不影响现有 getRefImagesForShot 等逻辑，仅供关键帧生成流程可选使用。
 */

import { ScriptData, Shot } from "../types";

/** 描述解析结果：识别出的场景 ID 与角色 ID 列表 */
export interface ParsedRefs {
  sceneId?: string;
  characterIds: string[];
}

/** 关键帧参考图与对应关系（供 generateImage 使用） */
export interface KeyframeRefsWithMap {
  imageUrls: string[];
  refMap: { type: "scene" | "character"; label: string }[];
}

/**
 * 从关键帧描述文本中识别并匹配人物与场景。
 * 匹配规则：在描述中出现的角色名（name）对应到 scriptData.characters；场景通过 location 或 id 关键词匹配 scriptData.scenes。
 * 中英文均可（角色名、场景 location 与描述均做大小写不敏感匹配）。
 */
export function parseDescriptionForRefs(
  description: string,
  scriptData: ScriptData | null
): ParsedRefs {
  const result: ParsedRefs = { characterIds: [] };
  if (!description?.trim() || !scriptData) return result;

  const text = description.trim();
  const lower = text.toLowerCase();

  // 匹配角色：按名称在描述中出现
  const characters = scriptData.characters || [];
  for (const char of characters) {
    const name = (char.name || "").trim();
    if (!name) continue;
    const nameLower = name.toLowerCase();
    if (lower.includes(nameLower)) result.characterIds.push(char.id);
  }

  // 匹配场景：优先用 location 关键词，其次用 scene id
  const scenes = scriptData.scenes || [];
  for (const scene of scenes) {
    const location = (scene.location || "").trim();
    const sceneId = String(scene.id || "").trim();
    const locationLower = location.toLowerCase();
    const idLower = sceneId.toLowerCase();
    if (
      (location && lower.includes(locationLower)) ||
      (sceneId && lower.includes(idLower))
    ) {
      result.sceneId = scene.id;
      break;
    }
  }

  return result;
}

/**
 * 根据 shot 的 characterVariations 解析出每个角色使用的参考图 URL（基础或变体）。
 */
function getCharacterRefUrl(
  characterId: string,
  shot: Shot,
  scriptData: ScriptData
): string | undefined {
  const char = scriptData.characters?.find(
    (c) => String(c.id) === String(characterId)
  );
  if (!char) return undefined;
  const varId = shot.characterVariations?.[characterId];
  if (varId) {
    const variation = char.variations?.find((v) => v.id === varId);
    if (variation?.referenceImage) return variation.referenceImage;
  }
  return char.referenceImage;
}

/**
 * 根据 sceneId 获取场景参考图 URL。
 */
function getSceneRefUrl(
  sceneId: string,
  scriptData: ScriptData
): string | undefined {
  const scene = scriptData.scenes?.find(
    (s) => String(s.id) === String(sceneId)
  );
  return scene?.referenceImage;
}

/**
 * 关联人物与场景资源，生成关键帧参考图列表及对应关系。
 * 若描述中识别到人物/场景则按「场景优先、角色按识别顺序」排列；否则回退为 shot.sceneId + shot.characters 的现有逻辑。
 */
export function getKeyframeRefsWithMatch(
  shot: Shot,
  scriptData: ScriptData | null
): KeyframeRefsWithMap {
  const description =
    shot.keyframes?.find((k) => k.type === "start")?.visualPrompt ||
    shot.actionSummary ||
    "";
  const parsed = parseDescriptionForRefs(description, scriptData);

  const imageUrls: string[] = [];
  const refMap: { type: "scene" | "character"; label: string }[] = [];

  if (!scriptData) {
    return { imageUrls, refMap };
  }

  const useParsedScene =
    parsed.sceneId && getSceneRefUrl(parsed.sceneId, scriptData);
  const useParsedCharacters = parsed.characterIds.length > 0;

  if (useParsedScene || useParsedCharacters) {
    if (useParsedScene && parsed.sceneId) {
      const url = getSceneRefUrl(parsed.sceneId, scriptData);
      const scene = scriptData.scenes?.find(
        (s) => String(s.id) === String(parsed.sceneId)
      );
      if (url) {
        imageUrls.push(url);
        refMap.push({
          type: "scene",
          label: scene?.location || parsed.sceneId,
        });
      }
    }
    const charIds = useParsedCharacters
      ? parsed.characterIds
      : shot.characters || [];
    for (const cid of charIds) {
      const url = getCharacterRefUrl(cid, shot, scriptData);
      const char = scriptData.characters?.find(
        (c) => String(c.id) === String(cid)
      );
      if (url) {
        imageUrls.push(url);
        refMap.push({ type: "character", label: char?.name || cid });
      }
    }
  } else {
    // 回退：与现有 getRefImagesForShot 一致（场景优先，再角色）
    const scene = scriptData.scenes?.find(
      (s) => String(s.id) === String(shot.sceneId)
    );
    if (scene?.referenceImage) {
      imageUrls.push(scene.referenceImage);
      refMap.push({ type: "scene", label: scene.location || shot.sceneId });
    }
    if (shot.characters) {
      for (const cid of shot.characters) {
        const url = getCharacterRefUrl(cid, shot, scriptData);
        const char = scriptData.characters?.find(
          (c) => String(c.id) === String(cid)
        );
        if (url) {
          imageUrls.push(url);
          refMap.push({ type: "character", label: char?.name || cid });
        }
      }
    }
  }

  return { imageUrls, refMap };
}
