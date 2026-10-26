import type { DemoPost } from "./types";

export const demoPosts: readonly DemoPost[] = [
  {
    id: "post-1",
    type: "MINISTRY_UPDATE",
    slug: "sample-update-community-outreach",
    title: {
      en: "Sample update: preparing for a community outreach",
      ne: "नमूना अपडेट: सामुदायिक आउटरिचको तयारी",
    },
    excerpt: {
      en: "Demonstration text showing how a short ministry update will read, with a few lines about plans and prayer needs.",
      ne: "छोटो सेवकाइ अपडेट कस्तो देखिन्छ भनेर देखाउने नमूना पाठ, योजना र प्रार्थनाका आवश्यकताबारे केही पङ्क्तिसहित।",
    },
    scriptureRefs: ["Matthew 9:37-38"],
    publishedAt: "2026-05-12T09:00:00.000Z",
    isDemo: true,
  },
  {
    id: "post-2",
    type: "MINISTRY_UPDATE",
    slug: "sample-update-bible-distribution",
    title: {
      en: "Sample update: a weekend of Scripture reading",
      ne: "नमूना अपडेट: धर्मशास्त्र पढाइको एक सप्ताहान्त",
    },
    excerpt: {
      en: "Placeholder copy for a ministry update about gathering to read and discuss Scripture together.",
      ne: "धर्मशास्त्र सँगै पढ्न र छलफल गर्न भेला हुनेबारे सेवकाइ अपडेटको नमूना पाठ।",
    },
    scriptureRefs: ["Psalm 119:105"],
    publishedAt: "2026-04-28T09:00:00.000Z",
    isDemo: true,
  },
  {
    id: "post-3",
    type: "MINISTRY_UPDATE",
    slug: "sample-update-prayer-gathering",
    title: {
      en: "Sample update: an evening of prayer",
      ne: "नमूना अपडेट: प्रार्थनाको एक साँझ",
    },
    excerpt: {
      en: "Example text for an update about a small prayer gathering in a sample location.",
      ne: "नमूना स्थानमा भएको सानो प्रार्थना सभाबारे अपडेटको उदाहरण पाठ।",
    },
    scriptureRefs: ["Philippians 4:6"],
    publishedAt: "2026-04-02T09:00:00.000Z",
    isDemo: true,
  },
  {
    id: "post-4",
    type: "DEVOTIONAL",
    slug: "sample-devotional-here-i-am",
    title: {
      en: "Sample devotional: “Here I am. Send me!”",
      ne: "नमूना भक्ति चिन्तन: यशैया ६:८ मा परमेश्वरको बोलावट",
    },
    excerpt: {
      en: "A demonstration devotional reflecting on Isaiah's response to God's call.",
      ne: "परमेश्वरको बोलावटप्रति यशैयाको प्रतिक्रियामाथि मनन गर्ने नमूना भक्ति चिन्तन।",
    },
    scriptureRefs: ["Isaiah 6:8"],
    publishedAt: "2026-05-05T06:00:00.000Z",
    featured: true,
    isDemo: true,
  },
  {
    id: "post-5",
    type: "DEVOTIONAL",
    slug: "sample-devotional-shepherd",
    title: {
      en: "Sample devotional: the Lord is my shepherd",
      ne: "नमूना भक्ति चिन्तन: भजनसंग्रह २३ मा भरोसा",
    },
    excerpt: {
      en: "Placeholder devotional text on trust and provision from Psalm 23.",
      ne: "भजनसंग्रह २३ बाट भरोसा र प्रबन्धबारे नमूना भक्ति चिन्तन।",
    },
    scriptureRefs: ["Psalm 23:1"],
    publishedAt: "2026-03-18T06:00:00.000Z",
    isDemo: true,
  },
  {
    id: "post-6",
    type: "BIBLE_STUDY",
    slug: "sample-bible-study-john-3",
    title: {
      en: "Sample Bible study: John chapter 3",
      ne: "नमूना बाइबल अध्ययन: यूहन्ना अध्याय ३",
    },
    excerpt: {
      en: "An outline showing how a multi-part Bible study will be presented.",
      ne: "बहु-भागको बाइबल अध्ययन कसरी प्रस्तुत हुन्छ भनेर देखाउने रूपरेखा।",
    },
    scriptureRefs: ["John 3:1-21"],
    publishedAt: "2026-03-01T06:00:00.000Z",
    isDemo: true,
  },
];
