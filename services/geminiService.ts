
import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import { Message, Role } from "../types";

// Always initialize a fresh GoogleGenAI instance to ensure up-to-date API key
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export interface GenerationOptions {
  useSearch?: boolean;
  useMaps?: boolean;
  useThinking?: boolean;
  location?: { latitude: number; longitude: number };
  imageSize?: "1K" | "2K" | "4K";
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

export const generateGeminiResponse = async (
  prompt: string,
  history: Message[],
  options: GenerationOptions = {}
): Promise<{ text: string; sources: any[] }> => {
  try {
    const ai = getAIClient();
    const { useSearch, useMaps, useThinking, location } = options;

    // Model selection based on feature set
    let model = 'gemini-3-flash-preview';
    if (useThinking) {
      model = 'gemini-3-pro-preview';
    } else if (useMaps) {
      // Maps grounding is specific to 2.5 series
      model = 'gemini-2.5-flash';
    } else if (useSearch) {
      model = 'gemini-3-pro-preview';
    }

    const contents = history.map(msg => ({
      role: msg.role === Role.USER ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    }));

    const tools: any[] = [];
    if (useSearch) tools.push({ googleSearch: {} });
    if (useMaps) tools.push({ googleMaps: {} });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents,
      config: {
        tools: tools.length > 0 ? tools : undefined,
        toolConfig: useMaps && location ? {
          retrievalConfig: { latLng: { latitude: location.latitude, longitude: location.longitude } }
        } : undefined,
        // Set thinking budget for reasoning tasks
        thinkingConfig: useThinking ? { thinkingBudget: 32768 } : { thinkingBudget: 0 }
      },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => {
        if (chunk.web) return { title: chunk.web.title, uri: chunk.web.uri };
        if (chunk.maps) return { title: chunk.maps.title || 'Location', uri: chunk.maps.uri };
        return null;
      })
      .filter(Boolean) || [];

    return { text: response.text || '', sources };
  } catch (error: any) {
    console.error("Gemini Response Error:", error);
    throw error;
  }
};

export const generateImage = async (prompt: string, options: GenerationOptions, inputImage?: { mimeType: string, data: string }): Promise<string> => {
  try {
    const ai = getAIClient();
    // Use Pro model for high resolution or when search is enabled
    const isPro = (options.imageSize && options.imageSize !== '1K') || options.useSearch;
    const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    const parts: any[] = [{ text: prompt }];
    if (inputImage) {
      parts.push({ inlineData: inputImage });
    }

    const config: any = {
      imageConfig: {
        aspectRatio: options.aspectRatio || "1:1",
        imageSize: isPro ? (options.imageSize || "1K") : undefined
      },
    };

    // Google search is exclusive to the Pro image model
    if (options.useSearch && isPro) {
      config.tools = [{ google_search: {} }];
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config,
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        // Correctly iterate to find the inlineData part containing the image
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("EMPTY_RESPONSE");
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};

export const generateVideo = async (prompt: string, options: GenerationOptions, startingImage?: { mimeType: string, data: string }): Promise<string> => {
  try {
    const ai = getAIClient();
    const config = {
      numberOfVideos: 1,
      resolution: '720p' as const,
      aspectRatio: (options.aspectRatio === '9:16' ? '9:16' : '16:9') as '9:16' | '16:9'
    };

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || "Cinematic movement",
      image: startingImage ? { imageBytes: startingImage.data, mimeType: startingImage.mimeType } : undefined,
      config
    });

    // Poll for video generation completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("VIDEO_GEN_FAILED");

    // Fetch MP4 bytes with the injected API key
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Video Generation Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS_FAILED");
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

export const transcribeAudio = async (audioData: string, mimeType: string): Promise<string> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ inlineData: { data: audioData, mimeType } }, { text: "Transcribe this audio exactly." }] }],
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw error;
  }
};
