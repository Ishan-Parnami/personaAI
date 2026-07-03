"use client";

import { useCallback, useEffect, useState } from "react";
import type { PersonaId } from "./personaConfig";

export type ChatRole = "user" | "assistant";

export type ErrorKind = "rate-limit" | "exhausted" | "generic";

export type StoredMessage = {
  id: string;
  role: ChatRole;
  content: string;
  /** Which persona was active when this message was sent/received. */
  personaId: PersonaId;
  error?: ErrorKind;
};

type PersistedState = {
  messages: StoredMessage[];
  runningMemory?: string;
};

const STORAGE_PREFIX = "persona_chat_";

function storageKey(personaId: PersonaId): string {
  // Each persona's conversation is stored separately; a fresh landing pick
  // starts a fresh thread for that persona rather than reusing another's.
  return `${STORAGE_PREFIX}${personaId}`;
}

function load(personaId: PersonaId): PersistedState {
  if (typeof window === "undefined") return { messages: [] };
  try {
    const raw = window.localStorage.getItem(storageKey(personaId));
    if (!raw) return { messages: [] };
    return JSON.parse(raw) as PersistedState;
  } catch {
    return { messages: [] };
  }
}

function save(personaId: PersonaId, state: PersistedState) {
  try {
    window.localStorage.setItem(storageKey(personaId), JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, quota) — fail silently, chat still works in-memory.
  }
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

export function useChatHistory(personaId: PersonaId) {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [runningMemory, setRunningMemory] = useState<string | undefined>(undefined);

  useEffect(() => {
    const persisted = load(personaId);
    setMessages(persisted.messages);
    setRunningMemory(persisted.runningMemory);
  }, [personaId]);

  const persist = useCallback(
    (nextMessages: StoredMessage[], nextRunningMemory?: string) => {
      setMessages(nextMessages);
      setRunningMemory(nextRunningMemory);
      save(personaId, { messages: nextMessages, runningMemory: nextRunningMemory });
    },
    [personaId]
  );

  const addMessage = useCallback(
    (msg: Omit<StoredMessage, "id">) => {
      const withId: StoredMessage = { ...msg, id: nextId() };
      setMessages((prev) => {
        const next = [...prev, withId];
        save(personaId, { messages: next, runningMemory });
        return next;
      });
      return withId.id;
    },
    [personaId, runningMemory]
  );

  const updateMessage = useCallback(
    (id: string, updates: Partial<StoredMessage>) => {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
        save(personaId, { messages: next, runningMemory });
        return next;
      });
    },
    [personaId, runningMemory]
  );

  const setMemory = useCallback(
    (memory?: string) => {
      setRunningMemory(memory);
      setMessages((prev) => {
        save(personaId, { messages: prev, runningMemory: memory });
        return prev;
      });
    },
    [personaId]
  );

  const clearHistory = useCallback(() => {
    persist([], undefined);
  }, [persist]);

  return { messages, runningMemory, addMessage, updateMessage, setMemory, clearHistory };
}
