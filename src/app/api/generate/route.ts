import { NextResponse } from "next/server";
import { GoogleGenAI, type Content, type Part } from "@google/genai";

const apiKey =
  process.env.GOOGLE_API_KEY ??
  process.env.GEMINI_API_KEY ??
  process.env.GOOGLE_GENAI_API_KEY ??
  "AIzaSyCmcrAhT9oCOXugfhJW_PZAsAWknIV3NNg";

const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

type HistoryEntry = {
  role?: string;
  content?: string;
};

const DEFAULT_MODEL = "gemini-2.5-flash-image";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!genAI) {
    return NextResponse.json(
      { error: "Missing GOOGLE_API_KEY environment variable." },
      { status: 500 },
    );
  }

  try {
    const {
      prompt,
      model,
      baseImage,
      baseImageMimeType,
      history,
    }: {
      prompt?: string;
      model?: string;
      baseImage?: string;
      baseImageMimeType?: string;
      history?: HistoryEntry[];
    } = await request.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 },
      );
    }

    const modelName = typeof model === "string" && model.length > 0
      ? model
      : DEFAULT_MODEL;

    const contents: Content[] = [];

    if (Array.isArray(history)) {
      const trimmedHistory = history.slice(-8);
      for (const entry of trimmedHistory) {
        if (!entry) continue;
        const text = typeof entry.content === "string"
          ? entry.content.trim()
          : "";
        if (!text) continue;
        const role = entry.role === "assistant" ? "model" : "user";
        const parts: Part[] = [{ text }];
        contents.push({ role, parts });
      }
    }

    const userParts: Part[] = [{ text: prompt.trim() }];

    if (
      typeof baseImage === "string" &&
      baseImage &&
      typeof baseImageMimeType === "string" &&
      baseImageMimeType
    ) {
      userParts.push({
        inlineData: {
          data: baseImage.replace(/\s/g, ""),
          mimeType: baseImageMimeType,
        },
      });
    }

    contents.push({
      role: "user",
      parts: userParts,
    });

    const response = await genAI.models.generateContent({
      model: modelName,
      contents,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 0.4,
      },
    });

    const candidate = response.candidates?.[0];

    if (!candidate) {
      return NextResponse.json(
        { error: "No response candidates from the model." },
        { status: 422 },
      );
    }

    let aggregatedText = "";
    let imageBase64: string | null = null;
    let imageMimeType = "image/png";

    for (const part of candidate.content?.parts ?? []) {
      if (part.text) {
        aggregatedText += aggregatedText
          ? `\n${part.text}`
          : part.text;
      }
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data.replace(/\s/g, "");
        if (part.inlineData.mimeType) {
          imageMimeType = part.inlineData.mimeType;
        }
      }
    }

    if (!imageBase64) {
      return NextResponse.json(
        {
          error: "The model did not return an image.",
          text: aggregatedText,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      imageBase64,
      mimeType: imageMimeType,
      text: aggregatedText,
      model: modelName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Image generation error:", message);
    return NextResponse.json(
      {
        error: "Failed to generate image. See server logs for details.",
        details: message,
      },
      { status: 500 },
    );
  }
}
