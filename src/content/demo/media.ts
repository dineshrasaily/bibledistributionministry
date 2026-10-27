import type { DemoMedia } from "./types";

// Photos are hand-drawn abstract SVGs and the audio is one second of
// silence: no real people, places or recordings are attributed to the
// ministry. Seeded videos keep embedUrl null for the same reason.

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
  {
    id: "media-4",
    kind: "VIDEO",
    category: "WORSHIP",
    title: {
      en: "Sample worship song",
      ne: "नमूना आराधना गीत",
    },
    description: {
      en: "Placeholder worship video. No video is embedded yet.",
      ne: "नमूना आराधना भिडियो। अहिलेसम्म कुनै भिडियो राखिएको छैन।",
    },
    durationMinutes: 5,
    publishedAt: "2026-04-12T12:00:00.000Z",
    thumbnailUrl: null,
    isDemo: true,
  },
  {
    id: "media-5",
    kind: "AUDIO",
    title: {
      en: "Sample podcast episode (silent placeholder audio)",
      ne: "नमूना पोडकास्ट एपिसोड (मौन प्लेसहोल्डर अडियो)",
    },
    description: {
      en: "A one-second silent sample file showing how an audio episode will play.",
      ne: "अडियो एपिसोड कसरी बज्छ भनेर देखाउने एक सेकेन्डको मौन नमूना फाइल।",
    },
    durationMinutes: null,
    publishedAt: "2026-04-05T12:00:00.000Z",
    thumbnailUrl: null,
    url: "/demo/audio/sample-silence.wav",
    isDemo: true,
  },
  ...[1, 2, 3, 4].map((n): DemoMedia => ({
    id: `media-photo-${n}`,
    kind: "IMAGE",
    title: {
      en: `Sample placeholder photo ${n}`,
      ne: `नमूना प्लेसहोल्डर तस्बिर ${n}`,
    },
    description: {
      en: "Abstract placeholder image (not a real photo).",
      ne: "अमूर्त प्लेसहोल्डर तस्बिर (वास्तविक फोटो होइन)।",
    },
    durationMinutes: null,
    publishedAt: `2026-02-1${n}T12:00:00.000Z`,
    thumbnailUrl: null,
    url: `/demo/gallery/sample-${n}.svg`,
    altText: {
      en: `Sample placeholder image ${n}: abstract navy and gold pattern`,
      ne: `नमूना प्लेसहोल्डर तस्बिर ${n}: गाढा नीलो र सुनौलो अमूर्त ढाँचा`,
    },
    ...(n <= 3 ? { eventId: "event-4", sortOrder: n } : {}),
    isDemo: true,
  })),
];
