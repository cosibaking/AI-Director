import { ScriptData, Shot, Character, Scene } from "../types";
import { logger } from "../utils/logger";
import { saveFileToServer, generateFilename } from "./fileService";

// Module-level variable to store the key at runtime
let runtimeApiKey: string = process.env.API_KEY || "";

export const setGlobalApiKey = (key: string) => {
  runtimeApiKey = key;
  logger.info('CONFIG', 'API Key 已更新', { hasKey: !!key });
};

// 火山云API基础配置
// 注意：火山云API需要使用Endpoint ID（ep-开头），而不是模型名称
// 请在火山云控制台创建endpoint后，将对应的endpoint ID填入下方
const DOUBAO_API_BASE = "https://ark.cn-beijing.volces.com/api/v3";

// 从环境变量或全局变量读取endpoint ID
// 在浏览器环境中，可以通过window对象设置这些值
declare global {
  var DOUBAO_CHAT_ENDPOINT: string | undefined;
  var DOUBAO_IMAGE_ENDPOINT: string | undefined;
  var DOUBAO_VIDEO_ENDPOINT: string | undefined;
}

const CHAT_MODEL = (typeof process !== 'undefined' && process.env?.DOUBAO_CHAT_ENDPOINT) 
  || (typeof globalThis !== 'undefined' && (globalThis as any).DOUBAO_CHAT_ENDPOINT)
  || "doubao-seed-1-8-251228"; // 默认值，需要在控制台配置endpoint后替换

const IMAGE_MODEL = (typeof process !== 'undefined' && process.env?.DOUBAO_IMAGE_ENDPOINT)
  || (typeof globalThis !== 'undefined' && (globalThis as any).DOUBAO_IMAGE_ENDPOINT)
  || "doubao-seedream-4-5-251128"; // 默认值，需要在控制台配置endpoint后替换

const VIDEO_MODEL = (typeof process !== 'undefined' && process.env?.DOUBAO_VIDEO_ENDPOINT)
  || (typeof globalThis !== 'undefined' && (globalThis as any).DOUBAO_VIDEO_ENDPOINT)
  || "doubao-seedance-1-5-pro-251215"; // 默认值，需要在控制台配置endpoint后替换

// 获取视频模型显示名称
export const getVideoModelName = (): string => {
  const model = VIDEO_MODEL.toLowerCase();
  // 将模型名称格式化为更友好的显示格式
  // 例如: "doubao-seedance-1-5-pro-251215" -> "Doubao-Seedance1.5-pro"
  if (model.includes('seedance')) {
    // 提取版本号并格式化
    const versionMatch = model.match(/seedance-?(\d+)-?(\d+)?/);
    if (versionMatch) {
      const major = versionMatch[1];
      const minor = versionMatch[2] || '';
      const version = minor ? `${major}.${minor}` : major;
      return `Doubao-Seedance${version}-pro`;
    }
    return 'Doubao-Seedance1.5-pro'; // 默认格式
  }
  // 如果无法识别，返回原始模型名称（首字母大写）
  return model.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-');
};

// Helper to check API key
const checkApiKey = () => {
  // 如果 runtimeApiKey 为空，尝试从 localStorage 读取
  if (!runtimeApiKey) {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedKey = localStorage.getItem('cinegen_doubao_api_key');
      if (storedKey) {
        runtimeApiKey = storedKey;
        logger.info('CONFIG', '从 localStorage 恢复 API Key');
      }
    }
  }
  
  if (!runtimeApiKey) {
    logger.error('CONFIG', 'API Key 缺失');
    throw new Error("API Key missing. Please configure your 火山云 API Key.");
  }
};

// Helper for retry logic on 429 errors
const retryOperation = async <T>(operation: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 2000): Promise<T> => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (e: any) {
      lastError = e;
      // Check for quota/rate limit errors (429)
      if (e.status === 429 || e.code === 429 || e.message?.includes('429') || e.message?.includes('quota') || e.message?.includes('限流')) {
        const delay = baseDelay * Math.pow(2, i);
        logger.warn('API', `遇到限流，${delay}ms 后重试 (尝试 ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw e; // Throw other errors immediately
    }
  }
  logger.error('API', `重试失败，已尝试 ${maxRetries} 次`, lastError);
  throw lastError;
};

// Helper to clean JSON string from Markdown fences or accidental text
const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  // Remove ```json ... ``` or ``` ... ```
  let cleaned = str.replace(/```json\n?/g, '').replace(/```/g, '');
  return cleaned.trim();
};

/**
 * 调用火山云Chat API
 * 根据火山引擎文档：https://www.volcengine.com/docs/82379/1399009?lang=zh
 */
const callChatAPI = async (prompt: string, options: {
  responseFormat?: { type: 'json_object' | 'text' };
  temperature?: number;
} = {}): Promise<string> => {
  checkApiKey();

  const startTime = Date.now();
  logger.apiCall('Chat API', 'POST', `${DOUBAO_API_BASE}/chat/completions`, {
    model: CHAT_MODEL,
    temperature: options.temperature,
    responseFormat: options.responseFormat
  });

  const body = JSON.stringify({
    model: CHAT_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: options.temperature || 0.7,
    ...(options.responseFormat && { response_format: options.responseFormat })
  });
  logger.info('chat body', body);
  logger.info('chat body length', body.length.toString());
  // 根据火山引擎文档，Chat API使用标准的OpenAI兼容格式
  const response = await fetch(`${DOUBAO_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${runtimeApiKey}`
    },
    body: body
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let error: any;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { message: errorText || `HTTP ${response.status}` };
    }
    logger.apiError('Chat API', {
      status: response.status,
      statusText: response.statusText,
      error
    });
    throw new Error(error.message || error.error?.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  const duration = Date.now() - startTime;
  logger.apiSuccess('Chat API', duration);
  return data.choices?.[0]?.message?.content || "";
};

/**
 * Agent 1 & 2: Script Structuring & Breakdown
 * Uses Doubao-Seed-1.8 for fast, structured text generation.
 */
export const parseScriptToData = async (rawText: string, language: string = '中文'): Promise<ScriptData> => {
  logger.info('SCRIPT', '开始解析剧本', { language, textLength: rawText.length });
  const startTime = Date.now();
  
  const prompt = `
    Analyze the text and output a JSON object in the language: ${language}.
    
    Tasks:
    1. Extract title, genre, logline (in ${language}).
    2. Extract characters (id, name, gender, age, personality).
    3. Extract scenes (id, location, time, atmosphere).
    4. Break down the story into paragraphs linked to scenes.
    
    Input:
    "${rawText.slice(0, 30000)}" // Limit input context if needed
    
    Output a valid JSON object with this structure:
    {
      "title": "...",
      "genre": "...",
      "logline": "...",
      "characters": [{"id": "...", "name": "...", "gender": "...", "age": "...", "personality": "..."}],
      "scenes": [{"id": "...", "location": "...", "time": "...", "atmosphere": "..."}],
      "storyParagraphs": [{"id": 1, "text": "...", "sceneRefId": "..."}]
    }
  `;

  const responseText = await retryOperation(() => callChatAPI(prompt, {
    responseFormat: { type: 'json_object' }
  }));

  let parsed: any = {};
  try {
    const text = cleanJsonString(responseText);
    parsed = JSON.parse(text);
    logger.dataOperation('解析剧本JSON', { hasTitle: !!parsed.title, hasCharacters: !!parsed.characters, hasScenes: !!parsed.scenes });
  } catch (e) {
    logger.dataError('解析剧本JSON', e);
    parsed = {};
  }
  
  // Enforce String IDs for consistency and init variations
  const characters = Array.isArray(parsed.characters) ? parsed.characters.map((c: any) => ({
    ...c, 
    id: String(c.id),
    variations: [] // Initialize empty variations
  })) : [];
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.map((s: any) => ({...s, id: String(s.id)})) : [];
  const storyParagraphs = Array.isArray(parsed.storyParagraphs) ? parsed.storyParagraphs.map((p: any) => ({...p, sceneRefId: String(p.sceneRefId)})) : [];

  const duration = Date.now() - startTime;
  logger.info('SCRIPT', '剧本解析完成', { 
    duration: `${duration}ms`,
    title: parsed.title || "未命名剧本",
    charactersCount: characters.length,
    scenesCount: scenes.length,
    paragraphsCount: storyParagraphs.length
  });

  return {
    title: parsed.title || "未命名剧本",
    genre: parsed.genre || "通用",
    logline: parsed.logline || "",
    language: language,
    characters,
    scenes,
    storyParagraphs
  };
};

export const generateShotList = async (scriptData: ScriptData): Promise<Shot[]> => {
  logger.info('SHOTS', '开始生成分镜列表', { scenesCount: scriptData.scenes?.length || 0 });
  const startTime = Date.now();
  
  if (!scriptData.scenes || scriptData.scenes.length === 0) {
    logger.warn('SHOTS', '没有场景数据，返回空分镜列表');
    return [];
  }

  const lang = scriptData.language || '中文';
  
  // Helper to process a single scene
  // We process per-scene to avoid token limits and parsing errors with large JSONs
  const processScene = async (scene: Scene, index: number): Promise<Shot[]> => {
    logger.debug('SHOTS', `处理场景 ${index + 1}`, { sceneId: scene.id, location: scene.location });
    const paragraphs = scriptData.storyParagraphs
      .filter(p => String(p.sceneRefId) === String(scene.id))
      .map(p => p.text)
      .join('\n');

    if (!paragraphs.trim()) return [];

    const prompt = `
      Act as a professional cinematographer. Generate a detailed shot list (Camera blocking) for Scene ${index + 1}.
      Language for Text Output: ${lang}.
      
      Scene Details:
      Location: ${scene.location}
      Time: ${scene.time}
      Atmosphere: ${scene.atmosphere}
      
      Scene Action:
      "${paragraphs.slice(0, 5000)}"
      
      Context:
      Genre: ${scriptData.genre}
      Target Duration (Whole Script): ${scriptData.targetDuration || 'Standard'}
      
      Characters:
      ${JSON.stringify(scriptData.characters.map(c => ({ id: c.id, name: c.name, desc: c.visualPrompt || c.personality })))}

      Instructions:
      1. Create a sequence of shots covering the action.
      2. IMPORTANT: Limit to maximum 6-8 shots per scene to prevent JSON truncation errors. If the scene is long, summarize the less critical actions.
      3. 'cameraMovement': Use professional terms (e.g., Dolly In, Pan Right, Static, Handheld, Tracking).
      4. 'shotSize': Specify the field of view (e.g., Extreme Close-up, Medium Shot, Wide Shot).
      5. 'actionSummary': Detailed description of what happens in the shot (in ${lang}).
      6. 'visualPrompt': Detailed English description for image generation. Keep it under 40 words to save tokens.
      
      Output a valid JSON array with this structure:
      [
        {
          "id": "...",
          "sceneId": "${scene.id}",
          "actionSummary": "...",
          "dialogue": "...",
          "cameraMovement": "...",
          "shotSize": "...",
          "characters": ["..."],
          "keyframes": [
            {
              "id": "...",
              "type": "start",
              "visualPrompt": "..."
            },
            {
              "id": "...",
              "type": "end",
              "visualPrompt": "..."
            }
          ]
        }
      ]
    `;

    try {
      const responseText = await retryOperation(() => callChatAPI(prompt, {
        responseFormat: { type: 'json_object' }
      }));

      // Parse the response - it might be wrapped in a JSON object
      let parsed: any;
      try {
        const cleaned = cleanJsonString(responseText);
        parsed = JSON.parse(cleaned);
        // If the response is wrapped in an object, try to extract the array
        if (parsed && !Array.isArray(parsed)) {
          // Try common wrapper keys
          if (parsed.shots && Array.isArray(parsed.shots)) {
            parsed = parsed.shots;
          } else if (parsed.data && Array.isArray(parsed.data)) {
            parsed = parsed.data;
          } else if (parsed.result && Array.isArray(parsed.result)) {
            parsed = parsed.result;
          } else {
            // Try to find first array value
            const arrayValue = Object.values(parsed).find(v => Array.isArray(v));
            if (arrayValue) {
              parsed = arrayValue;
            }
          }
        }
      } catch (e) {
        // Try to extract JSON array from text
        const arrayMatch = responseText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          try {
            parsed = JSON.parse(arrayMatch[0]);
          } catch (parseError) {
            console.error("Failed to parse extracted array:", parseError);
            throw new Error("Failed to parse shots array");
          }
        } else {
          throw new Error("Failed to parse shots array");
        }
      }

      const shots = Array.isArray(parsed) ? parsed : [];
      
      // FIX: Explicitly override the sceneId to match the source scene
      // This prevents the AI from hallucinating incorrect scene IDs
      return shots.map((s: any) => ({
        ...s,
        sceneId: String(scene.id) // Force String
      }));

    } catch (e) {
      logger.error('SHOTS', `场景 ${scene.id} 分镜生成失败`, e);
      return [];
    }
  };

  // Process scenes sequentially (Batch Size 1) to strictly minimize rate limits
  const BATCH_SIZE = 1;
  const allShots: Shot[] = [];
  
  for (let i = 0; i < scriptData.scenes.length; i += BATCH_SIZE) {
    // Add delay between batches
    if (i > 0) {
      logger.debug('SHOTS', `批次间延迟 1500ms`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    const batch = scriptData.scenes.slice(i, i + BATCH_SIZE);
    logger.debug('SHOTS', `处理批次 ${Math.floor(i / BATCH_SIZE) + 1}`, { batchSize: batch.length });
    const batchResults = await Promise.all(
      batch.map((scene, idx) => processScene(scene, i + idx))
    );
    batchResults.forEach(shots => allShots.push(...shots));
  }

  // Re-index shots to be sequential globally and set initial status
  const result = allShots.map((s, idx) => ({
    ...s,
    id: `shot-${idx + 1}`,
    keyframes: Array.isArray(s.keyframes) ? s.keyframes.map(k => ({ 
      ...k, 
      id: `kf-${idx + 1}-${k.type}`, // Normalized ID
      status: 'pending' as const
    })) : []
  }));

  const duration = Date.now() - startTime;
  logger.info('SHOTS', '分镜列表生成完成', { 
    duration: `${duration}ms`,
    totalShots: result.length,
    scenesProcessed: scriptData.scenes.length
  });

  return result;
};

/**
 * Agent 3: Visual Design (Prompt Generation)
 */
export const generateVisualPrompts = async (type: 'character' | 'scene', data: Character | Scene, genre: string): Promise<string> => {
   logger.info('VISUAL', `生成${type === 'character' ? '角色' : '场景'}视觉提示词`, { type, genre });
   const startTime = Date.now();
   
   const prompt = `Generate a high-fidelity visual prompt for a ${type} in a ${genre} movie. 
   Data: ${JSON.stringify(data)}. 
   Output only the prompt in English, comma-separated, focused on visual details (lighting, texture, appearance).`;

   const responseText = await retryOperation(() => callChatAPI(prompt));
   
   const duration = Date.now() - startTime;
   logger.info('VISUAL', `${type === 'character' ? '角色' : '场景'}视觉提示词生成完成`, { 
     duration: `${duration}ms`,
     promptLength: responseText.length 
   });
   
   return responseText || "";
};

/**
 * Agent 4 & 6: Image Generation
 * 根据火山引擎文档：https://www.volcengine.com/docs/82379/1541523?lang=zh
 */
export const generateImage = async (prompt: string, referenceImages: string[] = []): Promise<string> => {
  checkApiKey();
  logger.info('IMAGE', '开始生成图片', { 
    promptLength: prompt.length,
    hasReference: referenceImages.length > 0,
    referenceCount: referenceImages.length
  });
  const startTime = Date.now();

  // If we have reference images, instruct the model to use them for consistency
  let finalPrompt = prompt;
  if (referenceImages.length > 0) {
    finalPrompt = `
      Reference Images Information:
      - The FIRST image provided is the Scene/Environment reference.
      - Any subsequent images are Character references (e.g. Base Look, or specific Variation).
      
      Task:
      Generate a cinematic shot matching this prompt: "${prompt}".
      
      Requirements:
      - STRICTLY maintain the visual style, lighting, and environment from the scene reference.
      - If characters are present, they MUST resemble the character reference images provided.
    `;
  }

  // 根据火山引擎文档，图片生成API使用prompt字段
  // 如果支持参考图片，需要将图片转换为base64格式或URL
  // 注意：火山引擎API可能支持base64格式的图片URL
  const requestBody: any = {
    model: IMAGE_MODEL,
    prompt: finalPrompt
  };

  // 如果提供了参考图片，添加到请求中
  // 根据文档，可能需要使用images字段或content字段
  if (referenceImages.length > 0) {
    // 准备图片数据 - 火山引擎可能支持data URL格式
    const imageUrls = referenceImages.map((imgUrl) => {
      // 如果已经是data URL格式，直接使用
      if (imgUrl.startsWith('data:')) {
        return imgUrl;
      }
      // 否则转换为data URL
      return imgUrl;
    });
    
    // 根据火山引擎文档，可能需要使用images字段
    requestBody.images = imageUrls;
  }

  logger.apiCall('Image API', 'POST', `${DOUBAO_API_BASE}/images/generations`, {
    model: IMAGE_MODEL,
    hasReference: referenceImages.length > 0
  });

  const response = await retryOperation(async () => {
    const res = await fetch(`${DOUBAO_API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runtimeApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let error: any;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || `HTTP ${res.status}` };
      }
      logger.apiError('Image API', {
        status: res.status,
        statusText: res.statusText,
        model: IMAGE_MODEL,
        error
      });
      throw new Error(error.error?.message || error.message || `Image generation failed: ${res.status}`);
    }

    return res.json();
  });

  const apiDuration = Date.now() - startTime;
  logger.apiSuccess('Image API', apiDuration);

  // 根据火山引擎文档，响应格式可能为：
  // { data: [{ url: "...", b64_json: "..." }] }
  // 或 { data: [{ image_url: "..." }] }
  if (response.data && Array.isArray(response.data) && response.data.length > 0) {
    const imageData = response.data[0];
    const imageUrl = imageData.url || imageData.image_url || imageData.b64_json;
    
    if (imageUrl) {
      logger.debug('IMAGE', '获取图片数据', { 
        isHttpUrl: imageUrl.startsWith('http'),
        isDataUrl: imageUrl.startsWith('data:')
      });
      
      // Helper function to save image to server
      const saveImageToServer = async (dataUrl: string, contentType: string = 'image/png'): Promise<string> => {
        try {
          const filename = generateFilename('image', '.png');
          const serverUrl = await saveFileToServer('images', filename, dataUrl, contentType);
          logger.info('IMAGE', '图片已保存到服务器', { serverUrl });
          // 返回服务器 URL，如果保存失败则返回原始 data URL
          return serverUrl || dataUrl;
        } catch (saveError: any) {
          logger.warn('IMAGE', '图片保存到服务器失败，使用原始 data URL', { error: saveError });
          return dataUrl;
        }
      };

      // If it's a URL, fetch it and convert to base64 data URL
      if (imageUrl.startsWith('http')) {
        const imgResponse = await fetch(imageUrl);
        // Use Buffer in Node.js, Blob in browser
        let dataUrl: string;
        if (typeof Buffer !== 'undefined') {
          // Node.js environment
          const arrayBuffer = await imgResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString('base64');
          // Try to detect content type from response
          const contentType = imgResponse.headers.get('content-type') || 'image/png';
          dataUrl = `data:${contentType};base64,${base64}`;
        } else {
          // Browser environment
          const blob = await imgResponse.blob();
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
        
        // 保存到服务器
        const detectedContentType = dataUrl.match(/data:([^;]+)/)?.[1] || 'image/png';
        return await saveImageToServer(dataUrl, detectedContentType);
      }
      
      // If it's already base64 data URL, save it
      if (imageUrl.startsWith('data:')) {
        const totalDuration = Date.now() - startTime;
        logger.info('IMAGE', '图片生成完成', { 
          totalDuration: `${totalDuration}ms`,
          resultType: 'dataUrl'
        });
        const contentType = imageUrl.match(/data:([^;]+)/)?.[1] || 'image/png';
        return await saveImageToServer(imageUrl, contentType);
      }
      
      // If it's base64 string without data: prefix, add it and save
      const result = `data:image/png;base64,${imageUrl}`;
      const totalDuration = Date.now() - startTime;
      logger.info('IMAGE', '图片生成完成', { 
        totalDuration: `${totalDuration}ms`,
        resultType: 'base64'
      });
      return await saveImageToServer(result, 'image/png');
    }
  }

  logger.error('IMAGE', '图片生成失败：响应中没有图片数据', response);
  throw new Error("图片生成失败 (No image data returned)");
};

/**
 * 将图片URL转换为base64格式
 * 如果URL包含localhost，则下载并转换为base64
 */
const convertImageUrlToBase64 = async (imageUrl: string | undefined): Promise<string | undefined> => {
  if (!imageUrl) return undefined;
  
  // 如果已经是base64格式，直接返回
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // 如果URL包含localhost，则转换为base64
  if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
    try {
      logger.info('VIDEO', '检测到localhost图片URL，转换为base64', { imageUrl });
      const imgResponse = await fetch(imageUrl);
      
      if (!imgResponse.ok) {
        throw new Error(`Failed to fetch image: ${imgResponse.status}`);
      }
      
      // 使用Buffer在Node.js环境，Blob在浏览器环境
      let dataUrl: string;
      if (typeof Buffer !== 'undefined') {
        // Node.js环境
        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const contentType = imgResponse.headers.get('content-type') || 'image/png';
        dataUrl = `data:${contentType};base64,${base64}`;
      } else {
        // 浏览器环境
        const blob = await imgResponse.blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      
      logger.info('VIDEO', '图片URL已转换为base64', { 
        originalUrl: imageUrl,
        dataUrlLength: dataUrl.length 
      });
      return dataUrl;
    } catch (error: any) {
      logger.error('VIDEO', '转换localhost图片URL失败', { imageUrl, error });
      throw new Error(`Failed to convert localhost image to base64: ${error.message}`);
    }
  }
  
  // 如果不是localhost，直接返回原始URL
  return imageUrl;
};

/**
 * Agent 8: Video Generation
 * 根据火山引擎文档：
 * - 创建任务：https://www.volcengine.com/docs/82379/1520757?lang=zh
 * - 查询任务：https://www.volcengine.com/docs/82379/1521309?lang=zh
 * Supports Start Image -> Video OR Start Image + End Image -> Video
 */
export const generateVideo = async (prompt: string, startImageBase64?: string, endImageBase64?: string, duration?: number): Promise<string> => {
  checkApiKey();
  logger.info('VIDEO', '开始生成视频', { 
    promptLength: prompt.length,
    hasStartImage: !!startImageBase64,
    hasEndImage: !!endImageBase64
  });
  const startTime = Date.now();
  
  // 如果传入的图片URL包含localhost，则转换为base64格式
  const processedStartImage = await convertImageUrlToBase64(startImageBase64);
  const processedEndImage = await convertImageUrlToBase64(endImageBase64);
  
  // 根据火山引擎文档，content字段应该是数组格式，包含文本和图片
  // 图片可以使用base64格式的data URL
  const contentArray: any[] = [
    { type: 'text', text: prompt }
  ];
  
  // 添加起始图片（如果提供）
  if (processedStartImage) {
    // 火山引擎API支持data URL格式的图片
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: processedStartImage  // 使用完整的data URL
      },
      role: 'first_frame'
    });
  }
  
  // 添加结束图片（如果提供）
  if (processedEndImage) {
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: processedEndImage  // 使用完整的data URL
      },
      role: 'last_frame'
    });
  }

  // 根据火山引擎文档，请求体格式
  const requestBody: any = {
    model: VIDEO_MODEL,
    content: contentArray,  // content必须是数组格式，包含文本和图片
    resolution: '720p',
    ratio: '16:9',
    duration: duration ?? 4
  };

  // 根据火山引擎文档，创建视频生成任务
  // 端点：POST /contents/generations/tasks
  logger.apiCall('Video API', 'POST', `${DOUBAO_API_BASE}/contents/generations/tasks`, {
    model: VIDEO_MODEL,
    params: requestBody
  });

  const createResponse = await retryOperation(async () => {
    const res = await fetch(`${DOUBAO_API_BASE}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runtimeApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let error: any;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || `HTTP ${res.status}` };
      }
      logger.apiError('Video API (创建任务)', {
        status: res.status,
        statusText: res.statusText,
        model: VIDEO_MODEL,
        error
      });
      throw new Error(error.error?.message || error.message || `Video generation failed: ${res.status}`);
    }

    return res.json();
  });

  const createDuration = Date.now() - startTime;
  logger.apiSuccess('Video API (创建任务)', createDuration);
  logger.debug('VIDEO', '视频任务创建响应', createResponse);
  
  // 根据文档，响应中应包含task_id字段
  const taskId = createResponse.task_id || createResponse.id || createResponse.data?.task_id;
  if (!taskId) {
    logger.error('VIDEO', '视频任务创建失败：响应中没有 task_id', createResponse);
    throw new Error("视频生成失败 (No task ID returned)");
  }
  
  logger.info('VIDEO', '视频任务已创建', { taskId });

  // 根据火山引擎文档，查询视频生成任务状态
  // 端点：GET /contents/generations/tasks/{task_id}
  let attempts = 0;
  const maxAttempts = 240; // 20 minutes max (5s * 240) - 视频生成可能需要更长时间
  const pollInterval = 5000; // Poll every 5s
  
  logger.info('VIDEO', `开始轮询视频生成任务状态`, { taskId, maxAttempts, pollInterval });
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const statusResponse = await retryOperation(async () => {
      const res = await fetch(`${DOUBAO_API_BASE}/contents/generations/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${runtimeApiKey}`
        }
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(error.message || error.error?.message || `Status check failed: ${res.status}`);
      }

      return res.json();
    });

    // 根据文档，状态字段可能为：status 或 state
    // 可能的值：pending, processing, completed, success, succeeded, failed, error
    const status = statusResponse.status || statusResponse.state || statusResponse.data?.status;
    
    // 添加调试日志（每10次轮询输出一次，避免日志过多）
    if (attempts % 10 === 0 || (status && status !== 'pending' && status !== 'processing' && status !== 'running')) {
      logger.debug('VIDEO', `轮询状态`, { 
        attempt: `${attempts + 1}/${maxAttempts}`,
        status: status || 'unknown',
        progress: statusResponse.progress
      });
      // 输出完整响应以便调试（仅在非pending/processing状态时）
      if (status && status !== 'pending' && status !== 'processing' && status !== 'running') {
        logger.debug('VIDEO', '轮询响应详情', statusResponse);
      }
    }
    
    if (status === 'completed' || status === 'success' || status === 'succeeded') {
      // 根据文档和实际响应，视频URL可能在以下字段中：
      // content.video_url (实际响应格式)
      // video_url, result.video_url, data.video_url, output.video_url
      const videoUrl = statusResponse.content?.video_url
        || statusResponse.video_url 
        || statusResponse.result?.video_url 
        || statusResponse.data?.video_url
        || statusResponse.output?.video_url
        || statusResponse.data?.result?.video_url
        || statusResponse.result?.url
        || statusResponse.data?.url
        || statusResponse.content?.url;
        
      if (videoUrl) {
        const totalDuration = Date.now() - startTime;
        logger.info('VIDEO', '视频生成成功', { 
          taskId,
          totalDuration: `${totalDuration}ms`,
          pollingAttempts: attempts + 1,
          videoUrlType: videoUrl.startsWith('http') ? 'HTTP URL' : 'Other'
        });
        
        // 如果返回的是 HTTP URL，下载并保存到服务器
        if (videoUrl.startsWith('http')) {
          try {
            // 下载视频
            const videoResponse = await fetch(videoUrl);
            const videoBlob = await videoResponse.blob();
            const videoDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(videoBlob);
            });
            
            // 保存到服务器
            const filename = generateFilename('video', '.mp4');
            const serverUrl = await saveFileToServer('videos', filename, videoDataUrl, 'video/mp4');
            logger.info('VIDEO', '视频已保存到服务器', { serverUrl });
            return serverUrl;
          } catch (saveError: any) {
            logger.warn('VIDEO', '视频保存到服务器失败，使用原始 URL', { error: saveError });
            return videoUrl;
          }
        }
        
        // 如果已经是 base64 data URL，直接保存
        if (videoUrl.startsWith('data:')) {
          try {
            const filename = generateFilename('video', '.mp4');
            const serverUrl = await saveFileToServer('videos', filename, videoUrl, 'video/mp4');
            logger.info('VIDEO', '视频已保存到服务器', { serverUrl });
            return serverUrl;
          } catch (saveError: any) {
            logger.warn('VIDEO', '视频保存到服务器失败，使用原始 data URL', { error: saveError });
            return videoUrl;
          }
        }
        
        return videoUrl;
      }
      logger.error('VIDEO', '视频生成完成但未找到URL', statusResponse);
      throw new Error("视频生成失败 (No video URL in response)");
    }

    if (status === 'failed' || status === 'error') {
      const errorMsg = statusResponse.error 
        || statusResponse.message 
        || statusResponse.data?.error
        || statusResponse.data?.message
        || statusResponse.error?.message
        || 'Unknown error';
      logger.error('VIDEO', '视频生成失败', { 
        taskId,
        error: errorMsg,
        fullResponse: statusResponse
      });
      throw new Error(`视频生成失败: ${errorMsg}`);
    }

    // 如果状态是pending或processing，继续轮询
    // 如果状态未知，也继续轮询（可能是API响应格式不同）
    if (!status || status === 'pending' || status === 'processing' || status === 'running') {
      attempts++;
      continue;
    }
    
    // 如果遇到未知状态，输出详细信息并继续
    if (attempts % 20 === 0) {
      logger.warn('VIDEO', '未知状态，继续轮询', { 
        taskId,
        status,
        attempts: attempts + 1,
        response: statusResponse
      });
    }
    attempts++;
  }

  const totalDuration = Date.now() - startTime;
  logger.error('VIDEO', '视频生成超时', { 
    taskId,
    attempts,
    duration: `${(attempts * pollInterval / 1000 / 60).toFixed(1)} 分钟`,
    totalDuration: `${totalDuration}ms`
  });
  throw new Error("视频生成超时 (Video generation timeout)");
};
