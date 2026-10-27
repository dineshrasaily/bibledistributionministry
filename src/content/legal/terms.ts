/**
 * Terms of use TEMPLATE; must be reviewed by a qualified professional
 * before launch. `{taxNote}` comes from donationTaxNote() so the tax wording
 * always follows SiteSettings.taxDeductibleVerified. Pure module.
 */
import type { LegalDocument } from "./types";

export const termsOfUse: LegalDocument = {
  lastUpdated: "2026-10-27",
  en: [
    {
      id: "use-of-site",
      heading: "Using this site",
      paragraphs: [
        "This website is run by {name}. By using it you agree to these terms. Please use the site respectfully and lawfully, and do not try to disrupt it or access areas that are not meant for you.",
      ],
    },
    {
      id: "content",
      heading: "Content and Scripture",
      paragraphs: [
        "Bible quotations are from the World English Bible (WEB) or the King James Version (KJV), which are in the public domain. Other text, photos and recordings on this site belong to {name} or are used with permission. You may share links and short quotations with credit; please ask before reusing anything else.",
      ],
    },
    {
      id: "submissions",
      heading: "Prayer requests and messages",
      paragraphs: [
        "When you send a prayer request, testimony or message, please do not include information about other people that they would not want shared. We keep submissions private. We will only share a prayer request or testimony publicly if you gave consent, and only in an edited form without your personal details. We may decline to publish anything.",
      ],
    },
    {
      id: "donations",
      heading: "Donations",
      paragraphs: [
        "Gifts are voluntary and are processed securely by Stripe in US dollars. {taxNote}",
        "If you believe a gift was made in error, contact {email} and we will look into a refund.",
      ],
    },
    {
      id: "external-links",
      heading: "Links to other sites",
      paragraphs: [
        "This site links to other websites and services, such as YouTube and social networks. We are not responsible for their content or their privacy practices.",
      ],
    },
    {
      id: "no-warranty",
      heading: "No warranty",
      paragraphs: [
        "We try to keep the site accurate and available, but it is provided as it is, without guarantees. Content on this site is not professional, legal, medical or financial advice.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      paragraphs: [
        "We may update these terms from time to time. The date at the top of the page shows when they were last updated.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      paragraphs: ["Questions about these terms? Email {email}."],
    },
  ],
  ne: [
    {
      id: "use-of-site",
      heading: "यो साइटको प्रयोग",
      paragraphs: [
        "यो वेबसाइट {name} ले चलाउँछ। यसको प्रयोग गरेर तपाईं यी सर्तहरूमा सहमत हुनुहुन्छ। साइटलाई सम्मानपूर्वक र कानुनसम्मत रूपमा प्रयोग गर्नुहोस्, र यसमा अवरोध पुर्‍याउने वा तपाईंका लागि नबनाइएका क्षेत्रमा पहुँच गर्ने प्रयास नगर्नुहोस्।",
      ],
    },
    {
      id: "content",
      heading: "सामग्री र धर्मशास्त्र",
      paragraphs: [
        "बाइबलका उद्धरणहरू सार्वजनिक क्षेत्र (public domain) मा रहेका World English Bible (WEB) वा King James Version (KJV) बाट लिइएका हुन्। यस साइटका अन्य पाठ, तस्बिर र रेकर्डिङ {name} का हुन् वा अनुमतिसहित प्रयोग गरिएका हुन्। श्रेय दिएर लिङ्क र छोटा उद्धरण बाँड्न सक्नुहुन्छ; अरू कुनै कुरा पुनः प्रयोग गर्नुअघि सोध्नुहोस्।",
      ],
    },
    {
      id: "submissions",
      heading: "प्रार्थना अनुरोध र सन्देश",
      paragraphs: [
        "प्रार्थना अनुरोध, गवाही वा सन्देश पठाउँदा अरूले बाँड्न नचाहने उनीहरूको जानकारी समावेश नगर्नुहोस्। हामी पठाइएका कुरा निजी राख्छौं। तपाईंले सहमति दिनुभएको भए मात्र, र तपाईंको व्यक्तिगत विवरणबिना सम्पादित रूपमा मात्र प्रार्थना अनुरोध वा गवाही सार्वजनिक गर्छौं। हामी कुनै पनि कुरा प्रकाशित नगर्न सक्छौं।",
      ],
    },
    {
      id: "donations",
      heading: "दान",
      paragraphs: [
        "दान स्वैच्छिक हुन्छ र Stripe ले अमेरिकी डलरमा सुरक्षित रूपमा प्रशोधन गर्छ। {taxNote}",
        "कुनै दान गल्तीले भएको लाग्छ भने {email} मा सम्पर्क गर्नुहोस्, हामी फिर्ताबारे हेर्नेछौं।",
      ],
    },
    {
      id: "external-links",
      heading: "अन्य साइटका लिङ्कहरू",
      paragraphs: [
        "यो साइटले YouTube र सामाजिक सञ्जालजस्ता अन्य वेबसाइट र सेवाहरूमा लिङ्क गर्छ। तिनका सामग्री वा गोपनीयता अभ्यासका लागि हामी जिम्मेवार छैनौं।",
      ],
    },
    {
      id: "no-warranty",
      heading: "कुनै ग्यारेन्टी छैन",
      paragraphs: [
        "हामी साइटलाई सही र उपलब्ध राख्ने प्रयास गर्छौं, तर यो जस्तो छ त्यस्तै, कुनै ग्यारेन्टीबिना उपलब्ध गराइन्छ। यस साइटका सामग्री पेशेवर, कानुनी, चिकित्सा वा आर्थिक सल्लाह होइनन्।",
      ],
    },
    {
      id: "changes",
      heading: "यी सर्तहरूमा परिवर्तन",
      paragraphs: [
        "हामी समय-समयमा यी सर्तहरू अद्यावधिक गर्न सक्छौं। पृष्ठको माथि रहेको मितिले यी पछिल्लो पटक कहिले अद्यावधिक भए भनेर देखाउँछ।",
      ],
    },
    {
      id: "contact",
      heading: "सम्पर्क",
      paragraphs: ["यी सर्तहरूबारे प्रश्न छ? {email} मा इमेल गर्नुहोस्।"],
    },
  ],
};
