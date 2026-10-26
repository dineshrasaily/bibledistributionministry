import type { DemoVerse } from "./types";

// World English Bible (WEB), public domain. Text is quoted verbatim.
export const demoVerses: readonly DemoVerse[] = [
  {
    id: "isaiah-6-8",
    reference: "Isaiah 6:8",
    translation: "WEB",
    text: "I heard the Lord’s voice, saying, “Whom shall I send, and who will go for us?” Then I said, “Here I am. Send me!”",
    isDemo: true,
  },
  {
    id: "john-3-16",
    reference: "John 3:16",
    translation: "WEB",
    text: "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.",
    isDemo: true,
  },
  {
    id: "psalm-23-1",
    reference: "Psalm 23:1",
    translation: "WEB",
    text: "Yahweh is my shepherd: I shall lack nothing.",
    isDemo: true,
  },
];

export const FEATURED_VERSE_ID = "isaiah-6-8";
