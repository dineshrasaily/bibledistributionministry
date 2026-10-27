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
    categoryIds: ["category-scripture-study"],
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
    categoryIds: ["category-faith-and-prayer"],
    body: {
      en: "*Sample ministry update for demonstration.*\n\nThis text shows how a short report about a prayer gathering will look: who gathered (in general terms), what was prayed for, and how readers can keep praying.",
      ne: "*प्रदर्शनका लागि नमूना सेवकाइ अपडेट।*\n\nयो पाठले प्रार्थना सभाबारे छोटो विवरण कस्तो देखिन्छ भनेर देखाउँछ: को भेला भए (सामान्य रूपमा), केका लागि प्रार्थना गरियो, र पाठकहरूले कसरी प्रार्थना जारी राख्न सक्छन्।",
    },
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
    categoryIds: ["category-faith-and-prayer"],
    body: {
      en: "*Sample devotional text. The ministry's own reflection will replace it.*\n\n> I heard the Lord’s voice, saying, “Whom shall I send, and who will go for us?” Then I said, “Here I am. Send me!” (Isaiah 6:8, WEB)\n\n## A willing answer\n\nThis paragraph shows how a short reflection will read: a few sentences on listening for God's call and answering with a willing heart.\n\n## For prayer\n\n- Ask for a heart that listens.\n- Pray for those who are being sent.\n- Give thanks for every small step of obedience.",
      ne: "*नमूना भक्ति चिन्तन पाठ। सेवकाइको आफ्नै चिन्तनले यसलाई प्रतिस्थापन गर्नेछ।*\n\n## इच्छुक जवाफ\n\nयो अनुच्छेदले छोटो चिन्तन कस्तो देखिन्छ भनेर देखाउँछ: परमेश्वरको बोलावट सुन्ने र इच्छुक हृदयले जवाफ दिनेबारे केही वाक्य।\n\n## प्रार्थनाका लागि\n\n- सुन्ने हृदयका लागि माग्नुहोस्।\n- पठाइँदै गरेकाहरूका लागि प्रार्थना गर्नुहोस्।\n- आज्ञाकारिताको हरेक सानो कदमका लागि धन्यवाद दिनुहोस्।",
    },
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
    categoryIds: ["category-faith-and-prayer"],
    body: {
      en: "*Sample devotional text for demonstration.*\n\n> Yahweh is my shepherd: I shall lack nothing. (Psalm 23:1, WEB)\n\nA short sample reflection on trust and provision will appear here, followed by a question for personal reflection.\n\n**Reflect:** where do you need to trust God's care this week?",
      ne: "*प्रदर्शनका लागि नमूना भक्ति चिन्तन पाठ।*\n\nभरोसा र प्रबन्धबारे छोटो नमूना चिन्तन यहाँ देखिनेछ, त्यसपछि व्यक्तिगत मननका लागि एउटा प्रश्न।\n\n**मनन गर्नुहोस्:** यस हप्ता तपाईंलाई परमेश्वरको हेरचाहमा कहाँ भरोसा गर्नु आवश्यक छ?",
    },
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
    scriptureRefs: ["John 3:1-21", "John 3:16"],
    publishedAt: "2026-03-01T06:00:00.000Z",
    categoryIds: ["category-scripture-study"],
    body: {
      en: "*Sample Bible study outline for demonstration.*\n\n## Part 1: A night-time conversation (verses 1-8)\n\nSample notes on the setting and the question being asked.\n\n## Part 2: God's love for the world (verses 9-21)\n\n> For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life. (John 3:16, WEB)\n\n## Questions for discussion\n\n1. What stands out to you in this passage?\n2. How would you explain it to a friend?",
      ne: "*प्रदर्शनका लागि नमूना बाइबल अध्ययन रूपरेखा।*\n\n## भाग १: रातको कुराकानी (पद १-८)\n\nपृष्ठभूमि र सोधिएको प्रश्नबारे नमूना टिपोट।\n\n## भाग २: संसारप्रति परमेश्वरको प्रेम (पद ९-२१)\n\nयस भागबारे नमूना टिपोट यहाँ देखिनेछ। पदको पाठ अंग्रेजी WEB मा माथि उल्लेखित सन्दर्भमा पढ्न सकिन्छ।\n\n## छलफलका प्रश्नहरू\n\n1. यो खण्डमा तपाईंलाई के कुराले छोयो?\n2. यसलाई साथीलाई कसरी बुझाउनुहुन्छ?",
    },
    isDemo: true,
  },
];
