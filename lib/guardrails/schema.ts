import { z } from "zod";

const MAX_CONTENT_LENGTH = 4000;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Message content cannot be empty.").max(
    MAX_CONTENT_LENGTH,
    `Message content must be ${MAX_CONTENT_LENGTH} characters or fewer.`
  ),
});

export const chatRequestSchema = z.object({
  persona: z.enum(["hitesh", "piyush"]),
  messages: z.array(chatMessageSchema).min(1, '"messages" must be a non-empty array.'),
  runningMemory: z.string().optional(),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

export type ValidationResult =
  | { success: true; data: ChatRequestBody }
  | { success: false; error: string };

/** Validates the raw parsed JSON body of an /api/chat request. */
export function validateChatRequest(body: unknown): ValidationResult {
  const result = chatRequestSchema.safeParse(body);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid request." };
  }
  return { success: true, data: result.data };
}
