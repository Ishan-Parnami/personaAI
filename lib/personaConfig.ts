export type PersonaId = "hitesh" | "piyush";

export type PersonaConfig = {
  id: PersonaId;
  displayName: string;
  tagline: string;
  initial: string;
  accent: string; // CSS color used for avatar/accent per persona
};

export const PERSONAS: Record<PersonaId, PersonaConfig> = {
  hitesh: {
    id: "hitesh",
    displayName: "Hitesh Choudhary",
    tagline: "Chai aur Code — warm, Hinglish, build-first mentor",
    initial: "H",
    accent: "#a855f7",
  },
  piyush: {
    id: "piyush",
    displayName: "Piyush Garg",
    tagline: "Sharp, fast-paced, project-first practitioner",
    initial: "P",
    accent: "#7e22ce",
  },
};

export function isPersonaId(value: string | null): value is PersonaId {
  return value === "hitesh" || value === "piyush";
}
