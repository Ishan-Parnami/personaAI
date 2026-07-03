import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StoredMessage } from "@/lib/useChatHistory";
import { PERSONAS } from "@/lib/personaConfig";

const ERROR_STYLES: Record<NonNullable<StoredMessage["error"]>, string> = {
  "rate-limit": "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200",
  exhausted: "border-orange-300/60 bg-orange-50 text-orange-900 dark:border-orange-400/30 dark:bg-orange-950/40 dark:text-orange-200",
  generic: "border-red-300/60 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-200",
};

function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default function MessageBubble({ message }: { message: StoredMessage }) {
  const isUser = message.role === "user";
  const persona = PERSONAS[message.personaId];

  if (message.error) {
    return (
      <div className="flex justify-start" role="alert">
        <div
          className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed sm:max-w-[70%] ${ERROR_STYLES[message.error]}`}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} items-end gap-2`}>
      {!isUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: persona.accent }}
          aria-hidden="true"
        >
          {persona.initial}
        </div>
      )}
      <div
        className={`max-w-[85%] wrap-break-word rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%] ${
          isUser ? "rounded-br-sm" : "rounded-bl-sm border-l-2"
        }`}
        style={
          isUser
            ? { backgroundColor: "var(--user-bubble)", color: "var(--user-bubble-fg)" }
            : {
                backgroundColor: "var(--bg-elevated)",
                borderColor: persona.accent,
                border: "1px solid var(--border)",
                borderLeftWidth: "3px",
                borderLeftColor: persona.accent,
              }
        }
      >
        <MessageMarkdown content={message.content} />
        {message.content.length === 0 && (
          <span className="sr-only">Waiting for response…</span>
        )}
      </div>
    </div>
  );
}
