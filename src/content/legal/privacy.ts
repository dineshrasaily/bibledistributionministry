/**
 * Privacy policy TEMPLATE. It describes the data handling this site is
 * built to do; it must be reviewed by a qualified professional before
 * launch and re-checked after Phases 6 (forms) and 8 (donations).
 * Pure module.
 */
import type { LegalDocument } from "./types";

export const privacyPolicy: LegalDocument = {
  lastUpdated: "2026-10-27",
  en: [
    {
      id: "who-we-are",
      heading: "Who we are",
      paragraphs: [
        "This website is run by {name}, a personal Christian ministry. You can reach us at {email} with any question about your personal information.",
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      paragraphs: [
        "We only collect what we need to answer you, pray with you and run the site.",
      ],
      bullets: [
        "Prayer requests: the request itself and, only if you choose to give them, your name and email address. You can submit anonymously, and then no name or email is stored.",
        "Contact messages: your name, email address, the kind of message, the subject and your message.",
        "Donations: gifts are processed by Stripe. We receive the amount, currency, frequency, payment status, Stripe reference numbers and, if you provide it, your email address. We never receive or store card numbers.",
        "Spam protection: when you send a form, a one-way hash of your IP address is kept for a short time to limit abuse. We never store your raw IP address.",
        "Administrator accounts: the people who manage the site have an account with a name, email address, a securely hashed password and two-step verification.",
      ],
    },
    {
      id: "how-we-use",
      heading: "How we use it",
      paragraphs: [
        "We use your information to pray for you, to reply to your message, to process your gift and to keep the site secure. We do not sell, rent or trade your information, and we do not use it for advertising.",
      ],
    },
    {
      id: "who-can-see",
      heading: "Who can see it",
      paragraphs: [
        "Prayer requests and contact messages are private. Only the site owner and a small number of approved editors can read them, after signing in with a password and two-step verification.",
        "A prayer request or testimony is shown publicly only if you gave your consent when you sent it, and only as a version edited by us that leaves out your personal details.",
      ],
    },
    {
      id: "service-providers",
      heading: "Service providers",
      paragraphs: [
        "We use a small number of providers to run the site. They process data only on our behalf:",
      ],
      bullets: [
        "Vercel (website hosting) and Vercel Blob (storage for photos and audio).",
        "Neon (the database).",
        "Resend (email notifications to administrators; these contain only a link to the admin area, never the text of your request).",
        "Cloudflare Turnstile (checks that a form was sent by a person, not a bot).",
        "Stripe (donations and receipts).",
        "YouTube in privacy-enhanced mode (youtube-nocookie.com). Videos load only after you press play, so YouTube receives nothing from you before that.",
      ],
    },
    {
      id: "cookies",
      heading: "Cookies and analytics",
      paragraphs: [
        "The public site does not use analytics, advertising or tracking cookies. It sets one small preference cookie (NEXT_LOCALE) that remembers whether you chose English or Nepali; it holds only the language code and is deleted when you close your browser. The admin area uses one strictly necessary sign-in cookie for administrators.",
        "If you press play on a video, YouTube's privacy-enhanced player may store data under its own policy.",
      ],
    },
    {
      id: "retention",
      heading: "How long we keep it",
      paragraphs: [
        "Prayer requests and contact messages are kept only as long as they are useful and are deleted after a retention period set by the site owner. Hashed IP records used for spam protection are deleted after a short time. Donation records are kept as long as needed for accounting.",
      ],
    },
    {
      id: "your-choices",
      heading: "Your choices",
      paragraphs: [
        "You can ask us to see, correct or delete the personal information we hold about you, or to withdraw your consent to share a prayer request or testimony. Email {email} and we will respond as soon as we can.",
      ],
    },
    {
      id: "children",
      heading: "Children",
      paragraphs: [
        "This site is not directed at children. If you are under 16, please ask a parent or guardian before sending us personal information.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      paragraphs: [
        "We may update this policy as the site changes. The date at the top of the page shows when it was last updated.",
      ],
    },
  ],
  ne: [
    {
      id: "who-we-are",
      heading: "हामी को हौं",
      paragraphs: [
        "यो वेबसाइट {name}, एउटा व्यक्तिगत ख्रीष्टियन सेवकाइले चलाउँछ। तपाईंको व्यक्तिगत जानकारीबारे कुनै प्रश्न भए {email} मा सम्पर्क गर्नुहोस्।",
      ],
    },
    {
      id: "what-we-collect",
      heading: "हामी के सङ्कलन गर्छौं",
      paragraphs: [
        "तपाईंलाई जवाफ दिन, तपाईंसँग प्रार्थना गर्न र साइट चलाउन चाहिने कुरा मात्र हामी सङ्कलन गर्छौं।",
      ],
      bullets: [
        "प्रार्थना अनुरोध: अनुरोध आफैँ, र तपाईंले दिन रोज्नुभयो भने मात्र तपाईंको नाम र इमेल ठेगाना। तपाईं गुमनाम रूपमा पठाउन सक्नुहुन्छ, त्यसो गर्दा कुनै नाम वा इमेल राखिँदैन।",
        "सम्पर्क सन्देश: तपाईंको नाम, इमेल ठेगाना, सन्देशको प्रकार, विषय र तपाईंको सन्देश।",
        "दान: दानहरू Stripe मार्फत प्रशोधन हुन्छन्। हामीले रकम, मुद्रा, आवृत्ति, भुक्तानीको स्थिति, Stripe सन्दर्भ नम्बर र तपाईंले दिनुभयो भने इमेल ठेगाना पाउँछौं। कार्ड नम्बर हामी कहिल्यै पाउँदैनौं र राख्दैनौं।",
        "स्प्याम सुरक्षा: फारम पठाउँदा दुरुपयोग रोक्न तपाईंको IP ठेगानाको एकतर्फी ह्यास (hashed) केही समयका लागि राखिन्छ। तपाईंको वास्तविक IP ठेगाना कहिल्यै राखिँदैन।",
        "प्रशासक खाता: साइट व्यवस्थापन गर्नेहरूको नाम, इमेल ठेगाना, सुरक्षित रूपमा ह्यास गरिएको पासवर्ड र दुई-चरण प्रमाणीकरणसहितको खाता हुन्छ।",
      ],
    },
    {
      id: "how-we-use",
      heading: "हामी यसलाई कसरी प्रयोग गर्छौं",
      paragraphs: [
        "हामी तपाईंको जानकारी तपाईंका लागि प्रार्थना गर्न, सन्देशको जवाफ दिन, दान प्रशोधन गर्न र साइट सुरक्षित राख्न प्रयोग गर्छौं। हामी तपाईंको जानकारी बेच्दैनौं, भाडामा दिँदैनौं वा साटफेर गर्दैनौं, र विज्ञापनका लागि प्रयोग गर्दैनौं।",
      ],
    },
    {
      id: "who-can-see",
      heading: "यो कसले हेर्न सक्छ",
      paragraphs: [
        "प्रार्थना अनुरोध र सम्पर्क सन्देशहरू निजी हुन्छन्। पासवर्ड र दुई-चरण प्रमाणीकरणसहित साइन इन गरेपछि साइटका मालिक र थोरै स्वीकृत सम्पादकहरूले मात्र पढ्न सक्छन्।",
        "प्रार्थना अनुरोध वा गवाही तपाईंले पठाउँदा सहमति (consent) दिनुभएको भए मात्र, र तपाईंको व्यक्तिगत विवरण हटाएर हामीले सम्पादन गरेको संस्करणमा मात्र सार्वजनिक रूपमा देखाइन्छ।",
      ],
    },
    {
      id: "service-providers",
      heading: "सेवा प्रदायकहरू",
      paragraphs: [
        "साइट चलाउन हामी केही प्रदायकहरू प्रयोग गर्छौं। उनीहरूले हाम्रो तर्फबाट मात्र डेटा प्रशोधन गर्छन्:",
      ],
      bullets: [
        "Vercel (वेबसाइट होस्टिङ) र Vercel Blob (तस्बिर र अडियो भण्डारण)।",
        "Neon (डाटाबेस)।",
        "Resend (प्रशासकहरूलाई इमेल सूचना; यसमा प्रशासन क्षेत्रको लिङ्क मात्र हुन्छ, तपाईंको अनुरोधको पाठ कहिल्यै हुँदैन)।",
        "Cloudflare Turnstile (फारम बटले होइन, मानिसले पठाएको जाँच्छ)।",
        "Stripe (दान र रसिद)।",
        "गोपनीयता-संवर्धित मोडमा YouTube (youtube-nocookie.com)। भिडियो तपाईंले बजाउनुहोस् थिचेपछि मात्र लोड हुन्छ, त्यसअघि YouTube ले तपाईंबाट केही पाउँदैन।",
      ],
    },
    {
      id: "cookies",
      heading: "कुकी र एनालिटिक्स",
      paragraphs: [
        "सार्वजनिक साइटले एनालिटिक्स, विज्ञापन वा ट्र्याकिङ कुकी प्रयोग गर्दैन। तपाईंले अंग्रेजी वा नेपाली कुन भाषा रोज्नुभयो भनेर सम्झन यसले एउटा सानो प्राथमिकता कुकी (NEXT_LOCALE) राख्छ; यसमा भाषाको कोड मात्र हुन्छ र ब्राउजर बन्द गर्दा मेटिन्छ। प्रशासन क्षेत्रले प्रशासकहरूका लागि एउटा अत्यावश्यक साइन-इन कुकी प्रयोग गर्छ।",
        "तपाईंले भिडियो बजाउनुभयो भने YouTube को गोपनीयता-संवर्धित प्लेयरले आफ्नै नीतिअनुसार डेटा राख्न सक्छ।",
      ],
    },
    {
      id: "retention",
      heading: "हामी कति समय राख्छौं",
      paragraphs: [
        "प्रार्थना अनुरोध र सम्पर्क सन्देशहरू उपयोगी रहुन्जेल मात्र राखिन्छन् र साइटका मालिकले तोकेको अवधिपछि मेटाइन्छन्। स्प्याम सुरक्षाका लागि राखिएका ह्यास गरिएका IP रेकर्ड छोटो समयपछि मेटाइन्छन्। दानका रेकर्ड लेखाका लागि आवश्यक अवधिसम्म राखिन्छन्।",
      ],
    },
    {
      id: "your-choices",
      heading: "तपाईंका विकल्पहरू",
      paragraphs: [
        "हामीसँग भएको तपाईंको व्यक्तिगत जानकारी हेर्न, सच्याउन वा मेटाउन, वा प्रार्थना अनुरोध वा गवाही बाँड्ने सहमति फिर्ता लिन तपाईं अनुरोध गर्न सक्नुहुन्छ। {email} मा इमेल गर्नुहोस्, हामी सकेसम्म छिटो जवाफ दिनेछौं।",
      ],
    },
    {
      id: "children",
      heading: "बालबालिका",
      paragraphs: [
        "यो साइट बालबालिकाका लागि बनाइएको होइन। तपाईं १६ वर्षभन्दा कम उमेरको हुनुहुन्छ भने व्यक्तिगत जानकारी पठाउनुअघि अभिभावकसँग सोध्नुहोस्।",
      ],
    },
    {
      id: "changes",
      heading: "यो नीतिमा परिवर्तन",
      paragraphs: [
        "साइट परिवर्तन हुँदै जाँदा हामी यो नीति अद्यावधिक गर्न सक्छौं। पृष्ठको माथि रहेको मितिले यो पछिल्लो पटक कहिले अद्यावधिक भयो भनेर देखाउँछ।",
      ],
    },
  ],
};
