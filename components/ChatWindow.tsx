"use client";

import { useEffect, useRef, useState } from "react";
import type { PersonaId } from "@/lib/personaConfig";
import { PERSONAS } from "@/lib/personaConfig";
import { useChatHistory, type ErrorKind } from "@/lib/useChatHistory";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

const FRIENDLY_MESSAGES: Record<ErrorKind, string> = {
  "rate-limit": "You're sending messages a little too fast. Give it a moment and try again.",
  exhausted: "I'm a bit overloaded right now — please try again in a minute.",
  generic: "Something went wrong on my end. Please try again.",
};

function classifyError(status: number): ErrorKind {
  if (status === 429) return "rate-limit";
  if (status === 503) return "exhausted";
  return "generic";
}

export default function ChatWindow({ personaId }: { personaId: PersonaId }) {
  const { messages, runningMemory, addMessage, updateMessage, setMemory } =
    useChatHistory(personaId);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const persona = PERSONAS[personaId];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    addMessage({ role: "user", content: trimmed, personaId });
    setInput("");
    setIsSending(true);

    const conversation = [...messages, { role: "user" as const, content: trimmed }].map(
      ({ role, content }) => ({ role, content })
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: personaId, messages: conversation, runningMemory }),
      });

      if (!res.ok || !res.body) {
        let errorText = "";
        try {
          const data = (await res.json()) as { error?: string };
          errorText = data.error ?? "";
        } catch {
          // Non-JSON error body — fall back to the generic friendly message below.
        }
        const kind = classifyError(res.status);
        addMessage({ role: "assistant", content: FRIENDLY_MESSAGES[kind], personaId, error: kind });
        void errorText; // raw error text is never shown to the user, kept only for potential future logging
        setIsSending(false);
        return;
      }

      const newRunningMemoryHeader = res.headers.get("X-Running-Memory");
      const newRunningMemory = newRunningMemoryHeader
        ? decodeURIComponent(newRunningMemoryHeader)
        : runningMemory;

      const assistantId = addMessage({ role: "assistant", content: "", personaId });
      setIsSending(false);
      setIsStreaming(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        updateMessage(assistantId, { content: fullText });
      }

      setMemory(newRunningMemory);
    } catch {
      addMessage({
        role: "assistant",
        content: FRIENDLY_MESSAGES.generic,
        personaId,
        error: "generic",
      });
      setIsSending(false);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 && (
          <div className="glass mx-auto max-w-md rounded-2xl px-5 py-4 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
            Say hi to {persona.displayName} to get started.
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isSending && <TypingIndicator personaId={personaId} />}
        <div ref={scrollRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="border-t px-4 py-3 sm:px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="glass flex items-end gap-2 rounded-2xl p-2">
          <label htmlFor="chat-input" className="sr-only">
            Message {persona.displayName}
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder={`Message ${persona.displayName}…`}
            rows={1}
            disabled={isSending || isStreaming}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:opacity-60 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSending || isStreaming || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition disabled:opacity-40 dark:bg-primary-500 dark:text-black"
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
