import type { DemoMedia } from "./types";

export const demoMedia: readonly DemoMedia[] = [
  {
    id: "media-1",
    kind: "SERMON",
    title: {
      en: "Sample sermon: answering the call",
      ne: "नमूना प्रवचन: बोलावटको जवाफ",
    },
    description: {
      en: "Placeholder sermon description. Recordings will be added in a later phase.",
      ne: "नमूना प्रवचन विवरण। रेकर्डिङहरू पछिल्लो चरणमा थपिनेछन्।",
    },
    durationMinutes: 32,
    publishedAt: "2026-05-10T12:00:00.000Z",
    featured: true,
    thumbnailUrl: null,
    isDemo: true,
  },
  {
    id: "media-2",
    kind: "VIDEO",
    title: {
      en: "Sample video: a short ministry introduction",
      ne: "नमूना भिडियो: सेवकाइको छोटो परिचय",
    },
    description: {
      en: "Placeholder video description. No video is embedded yet.",
      ne: "नमूना भिडियो विवरण। अहिलेसम्म कुनै भिडियो राखिएको छैन।",
    },
    durationMinutes: 6,
    publishedAt: "2026-04-20T12:00:00.000Z",
    featured: true,
    thumbnailUrl: null,
    isDemo: true,
  },
  {
    id: "media-3",
    kind: "SERMON",
    title: {
      en: "Sample sermon: hope that endures",
      ne: "नमूना प्रवचन: टिकिरहने आशा",
    },
    description: {
      en: "Placeholder sermon description for a future recording.",
      ne: "भविष्यको रेकर्डिङका लागि नमूना प्रवचन विवरण।",
    },
    durationMinutes: 28,
    publishedAt: "2026-02-22T12:00:00.000Z",
    thumbnailUrl: null,
    isDemo: true,
  },
];
