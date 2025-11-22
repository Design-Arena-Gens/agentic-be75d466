/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

type ImagePayload = {
  base64: string;
  mimeType: string;
};

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  image?: ImagePayload | null;
};

type HistoryPayload = {
  role: Role;
  content: string;
};

type ModelOption = {
  id: string;
  label: string;
  description: string;
};

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    description: "Fast, iterative 1024px image generation.",
  },
  {
    id: "gemini-3.0-pro-preview",
    label: "Gemini 3.0 Pro Preview",
    description: "High-fidelity visuals with 4K output.",
  },
];

const createDataUrl = (image: ImagePayload) =>
  `data:${image.mimeType || "image/png"};base64,${image.base64}`;

const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(16).slice(2);

const bufferToBase64 = (buffer: ArrayBuffer) => {
  const chunks: string[] = [];
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join(""));
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      createdAt: Date.now(),
      content:
        "Welcome! I’m your image co-designer. Describe what you’d like to see or ask me to tweak the current canvas.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneImage, setSceneImage] = useState<ImagePayload | null>(null);
  const [useReferenceImage, setUseReferenceImage] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const selectedModel = useMemo(
    () => MODEL_OPTIONS.find((item) => item.id === model) ?? MODEL_OPTIONS[0],
    [model],
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  const historyPayload = (items: ChatMessage[]): HistoryPayload[] =>
    items
      .filter(
        (message) => message.role === "assistant" || message.role === "user",
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      event.target.value = "";
      return;
    }

    try {
      setError(null);
      const buffer = await file.arrayBuffer();
      const base64 = bufferToBase64(buffer);
      const payload: ImagePayload = {
        base64,
        mimeType: file.type || "image/png",
      };

      setSceneImage(payload);
      setUseReferenceImage(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: `Loaded "${file.name}" as the live canvas. Tell me what to adjust!`,
          createdAt: Date.now(),
          image: payload,
        },
      ]);
    } catch (uploadError) {
      const uploadMessage =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to process image.";
      setError(uploadMessage);
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const resetSceneImage = () => {
    setSceneImage(null);
    setUseReferenceImage(false);
  };

  const sendPrompt = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    const upcomingHistory = [...messages, userMessage];

    setMessages(upcomingHistory);
    setPrompt("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          model,
          history: historyPayload(upcomingHistory).slice(-10),
          baseImage:
            useReferenceImage && sceneImage ? sceneImage.base64 : undefined,
          baseImageMimeType:
            useReferenceImage && sceneImage ? sceneImage.mimeType : undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const reason =
          typeof payload.error === "string"
            ? payload.error
            : `Request failed with status ${response.status}`;
        throw new Error(reason);
      }

      const assistantImage: ImagePayload | null =
        typeof payload.imageBase64 === "string" && payload.imageBase64.length > 0
          ? {
              base64: payload.imageBase64,
              mimeType: payload.mimeType || "image/png",
            }
          : null;

      const assistantText =
        typeof payload.text === "string" && payload.text.trim().length > 0
          ? payload.text.trim()
          : "Here’s the updated render.";

      const assistantMessage: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: assistantText,
        createdAt: Date.now(),
        image: assistantImage,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (assistantImage) {
        setSceneImage(assistantImage);
        setUseReferenceImage(true);
      }
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Unexpected error during generation.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: `⚠️ ${message}`,
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendPrompt();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt();
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#030712)] text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:py-10">
        <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur">
          <header className="flex flex-col gap-2 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Agentic Image Studio
              </h1>
              <p className="text-sm text-zinc-400">
                Co-create visuals with{" "}
                <span className="font-medium text-zinc-200">
                  {selectedModel.label}
                </span>
                . Describe your changes and I’ll update the canvas.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <span
                className={`h-2 w-2 rounded-full ${
                  isLoading ? "bg-emerald-400 animate-pulse" : "bg-emerald-500"
                }`}
                aria-hidden
              />
              {isLoading ? "Generating..." : "Ready to co-create"}
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`relative flex flex-col gap-3 rounded-2xl border border-white/5 p-4 ${
                  message.role === "user"
                    ? "ml-auto max-w-[85%] bg-emerald-500/10"
                    : "mr-auto max-w-[90%] bg-zinc-800/60"
                }`}
              >
                <header className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {message.role === "user" ? "You" : "Gemini"}
                  </span>
                  <time className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </header>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                  {message.content}
                </p>
                {message.image && (
                  <figure className="overflow-hidden rounded-xl border border-white/10">
                    <img
                      src={createDataUrl(message.image)}
                      alt="Generated visual"
                      className="h-auto w-full"
                    />
                  </figure>
                )}
              </article>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                Refining your image…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form
            className="space-y-4 border-t border-white/10 px-6 py-5"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex flex-col text-xs uppercase tracking-widest text-zinc-400">
                Model
                <select
                  className="mt-2 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-zinc-900/80 px-4 py-2 transition hover:border-emerald-400 hover:text-emerald-300"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload base image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-400"
                    checked={useReferenceImage && !!sceneImage}
                    disabled={!sceneImage}
                    onChange={(event) =>
                      setUseReferenceImage(event.target.checked)
                    }
                  />
                  <span className="text-xs uppercase tracking-wide text-zinc-400">
                    Use current image for edits
                  </span>
                </label>

                {sceneImage && (
                  <button
                    type="button"
                    className="rounded-full border border-red-400/50 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                    onClick={resetSceneImage}
                  >
                    Clear reference
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <textarea
                className="min-h-[120px] w-full resize-y rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400 focus:outline-none"
                placeholder="Describe what you want to create or how to adjust the current image..."
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
              />
              {error && <p className="text-sm text-red-300">{error}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-zinc-500">
                  Press Enter to send, Shift + Enter for a new line.
                </p>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40 disabled:text-emerald-900/60"
                  disabled={isLoading || !prompt.trim()}
                >
                  {isLoading ? "Working..." : "Send to Gemini"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="w-full shrink-0 space-y-6 rounded-3xl border border-white/10 bg-zinc-900/20 p-6 lg:w-[360px] xl:w-[380px]">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Live canvas
            </h2>
            <p className="text-sm text-zinc-400">
              Every new generation updates this preview. Toggle reference mode
              to branch into a new direction.
            </p>
          </div>

          {sceneImage ? (
            <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/60">
              <img
                src={createDataUrl(sceneImage)}
                alt="Current canvas preview"
                className="h-auto w-full"
              />
            </figure>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/30 px-6 text-center text-sm text-zinc-500">
              Upload a base image or generate one to see it here.
            </div>
          )}

          <section className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Quick ideas
            </h3>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li>“Make the lighting moodier with neon accents.”</li>
              <li>“Add a glass of iced coffee on the table.”</li>
              <li>“Switch to an overhead cinematic angle.”</li>
              <li>“Render this scene as a watercolor illustration.”</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
