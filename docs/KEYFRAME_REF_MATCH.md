# 关键帧生成 - 人物与场景识别与参考图关联说明

## 一、需求与子功能划分

为实现「识别描述中的人物和场景 → 关联资源 → 参考图 base64 + 对应关系写入请求」，拆分为以下 **4 个子功能**：

| 子功能 | 说明 | 实现位置 |
|--------|------|----------|
| **1. 识别匹配描述中的人物和场景** | 从关键帧描述（visualPrompt/actionSummary）中解析出提到的角色名、场景（location/id），并匹配到项目的 Character / Scene | 新增 `services/keyframeRefMatch.ts` |
| **2. 关联人物和场景资源并生成参考图与对应关系** | 根据解析结果或 shot 的 sceneId/characters 解析出参考图 URL 列表，并生成「图1=场景xx、图2=角色yy」的 refMap | 同上 `keyframeRefMatch.ts` 中的 `getKeyframeRefsWithMatch` |
| **3. 参考图以 base64 编码传递** | 将参考图 URL（含 HTTP）统一转为 base64 data URL，再传给图像生成 API | `services/doubaoService.ts` 中 `ensureReferenceImagesBase64` + `generateImage` 内关键帧分支 |
| **4. 将参考图和对应关系加入请求参数** | 请求体中传入 base64 参考图数组，并在 prompt 中写入每张图的角色/场景对应关系 | `services/doubaoService.ts` 中 `generateImage` 的 options.refMap 与 requestBody.images |

---

## 二、各子功能的最佳修改/实现位置

### 子功能 1 & 2：识别 + 关联

- **文件**：`services/keyframeRefMatch.ts`（新建）
- **原因**：纯逻辑、无 UI，与剧本数据结构（ScriptData / Shot）强相关，独立模块便于测试和复用，且不改动现有 `getRefImagesForShot` 的调用方。

### 子功能 3：参考图 base64

- **文件**：`services/doubaoService.ts`
- **位置**：
  - 新增私有方法 `ensureReferenceImagesBase64(urls: string[]): Promise<string[]>`
  - 在 `generateImage` 中，当 `type === 'keyframe'` 且存在参考图时，先调用该方法再赋给 `requestBody.images`
- **原因**：只有关键帧生成需要「全部参考图 base64」；其它类型（character/scene）保持原有 URL 行为，改动集中在同一服务内。

### 子功能 4：请求参数中的参考图与对应关系

- **文件**：`services/doubaoService.ts`
- **位置**：
  - 新增 `GenerateImageOptions` 接口，含可选 `refMap`
  - `generateImage` 增加可选第四参数 `options?: GenerateImageOptions`
  - 当 `referenceImages.length > 0` 时，若有 `options?.refMap`，则用 refMap 生成「图1：场景/角色「xxx」」等说明写入 finalPrompt；否则沿用原有通用说明
  - `requestBody.images` 使用经 base64 处理后的数组（关键帧时）
- **原因**：对应关系通过 prompt 文本表达即可被模型理解；API 仍使用同一 images 数组，仅扩展入参与 prompt 构建逻辑。

### 调用方接入

- **文件**：`components/StageDirector.tsx`
- **位置**：
  - 单镜头生成关键帧：`handleGenerateKeyframe` 内改为调用 `getKeyframeRefsWithMatch(shot, project.scriptData)`，将得到的 `imageUrls`、`refMap` 传入 `generateImage(..., 'keyframe', { refMap })`
  - 批量生成起始帧：同样改为使用 `getKeyframeRefsWithMatch` + `generateImage(..., 'keyframe', { refMap })`
- **原因**：关键帧生成入口集中在此；`getRefImagesForShot` 保留不动，其它展示或未改用新流程的逻辑不受影响。

---

## 三、对现有代码与结构的影响

- **现有结构**：未删除或替换现有函数签名（如 `getRefImagesForShot`、`generateImage` 的前三个参数），仅做增量扩展。
- **兼容性**：
  - `generateImage(prompt, referenceImages, type)` 仍可只传三参，`options` 可选，未传时行为与之前一致。
  - 无 scriptData 或无法从描述解析出人物/场景时，`getKeyframeRefsWithMatch` 回退为与 `getRefImagesForShot` 相同的逻辑（shot.sceneId + shot.characters，场景优先再角色）。
- **影响范围**：仅关键帧生成路径使用「描述识别 + refMap + base64」；角色/场景图生成仍走原有 `generateImage` 用法，StageAssets 等无需修改。

---

## 四、数据流简述

1. 用户点击「生成起始/结束关键帧」或「批量生成起始帧」。
2. **StageDirector** 取当前 shot 的 `visualPrompt` 或 `actionSummary`，与 `project.scriptData` 一起传入 **getKeyframeRefsWithMatch(shot, scriptData)**。
3. **keyframeRefMatch**  
   - 调用 **parseDescriptionForRefs(description, scriptData)**，在描述中匹配角色名、场景 location/id，得到 `sceneId`、`characterIds`。  
   - 若有匹配则按「场景优先 + 角色顺序」组参考图；否则按 shot.sceneId、shot.characters 回退。  
   - 返回 **{ imageUrls, refMap }**（refMap 为 `{ type, label }[]`）。
4. **StageDirector** 调用 **generateImage(prompt, imageUrls, 'keyframe', { refMap })**。
5. **doubaoService.generateImage**  
   - 若存在 refMap，用其生成「图1：场景/角色「xxx」」等说明写入 prompt。  
   - 对 keyframe 类型且 referenceImages.length > 0 时，调用 **ensureReferenceImagesBase64** 得到 base64 数组，赋给 **requestBody.images**。  
   - 发送请求，返回生成图 URL。

---

## 五、文件与导出一览

| 文件 | 新增/修改 | 导出/关键符号 |
|------|-----------|----------------|
| `services/keyframeRefMatch.ts` | 新增 | `parseDescriptionForRefs`, `getKeyframeRefsWithMatch`, `ParsedRefs`, `KeyframeRefsWithMap` |
| `services/doubaoService.ts` | 修改 | `ensureReferenceImagesBase64`（内部）, `GenerateImageOptions`, `generateImage` 增加 options |
| `components/StageDirector.tsx` | 修改 | 引入 `getKeyframeRefsWithMatch`，两处关键帧生成改为使用 imageUrls + refMap |

---

## 六、匹配规则说明（parseDescriptionForRefs）

- **角色**：在描述文本中查找是否包含 `scriptData.characters[].name`（不区分大小写）。  
  例：描述为 "Medium shot of Kael, rain dripping..." 且存在角色 name "Kael" → 匹配到该角色 id。
- **场景**：在描述中查找是否包含 `scriptData.scenes[].location` 或 `scenes[].id`（不区分大小写）。  
  例：描述为 "Wide shot of alley..." 且某场景 location 含 "alley" → 匹配到该场景 id。
- 若描述中未匹配到任何场景/角色，则 **getKeyframeRefsWithMatch** 使用 shot 的 sceneId 与 characters 作为回退，与原有逻辑一致。

以上为实现说明与设计依据，便于后续维护与扩展。
