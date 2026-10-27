import type { DemoEvent } from "./types";

// Status is stored (not computed from "now") so builds are deterministic.
export const demoEvents: readonly DemoEvent[] = [
  {
    id: "event-1",
    kind: "MISSION_TRIP",
    slug: "sample-mission-trip",
    title: {
      en: "Sample mission trip to a village community",
      ne: "गाउँको समुदायमा नमूना मिसन यात्रा",
    },
    startsAt: "2027-03-14T08:00:00.000Z",
    endsAt: "2027-03-18T16:00:00.000Z",
    location: {
      en: "Kathmandu Valley (sample location)",
      ne: "काठमाडौं उपत्यका (नमूना स्थान)",
    },
    status: "UPCOMING",
    description: {
      en: "*Sample description.* This text shows how a mission trip will be described: the purpose of the visit, the plan for each day and how the team will serve alongside the local community.",
      ne: "*नमूना विवरण।* यो पाठले मिसन यात्राको विवरण कस्तो देखिन्छ भनेर देखाउँछ: भ्रमणको उद्देश्य, हरेक दिनको योजना र टोलीले स्थानीय समुदायसँगै कसरी सेवा गर्नेछ।",
    },
    volunteerInfo: {
      en: "Sample text: details on how to take part will be written here, such as who can join, how to prepare and how to get in touch.\n\nThe simplest way to take part is to pray for the team and the community.",
      ne: "नमूना पाठ: कसरी सहभागी हुने भन्ने विवरण यहाँ लेखिनेछ, जस्तै को सहभागी हुन सक्छ, कसरी तयारी गर्ने र कसरी सम्पर्क गर्ने।\n\nसहभागी हुने सबैभन्दा सरल तरिका टोली र समुदायका लागि प्रार्थना गर्नु हो।",
    },
    isDemo: true,
  },
  {
    id: "event-2",
    kind: "OUTREACH",
    slug: "sample-community-outreach",
    title: {
      en: "Sample community outreach day",
      ne: "नमूना सामुदायिक आउटरिच दिवस",
    },
    startsAt: "2027-01-23T10:00:00.000Z",
    location: {
      en: "Community hall (sample location)",
      ne: "सामुदायिक भवन (नमूना स्थान)",
    },
    status: "UPCOMING",
    isDemo: true,
  },
  {
    id: "event-3",
    kind: "SERVICE",
    slug: "sample-worship-evening",
    title: {
      en: "Sample worship and prayer evening",
      ne: "नमूना आराधना र प्रार्थना साँझ",
    },
    startsAt: "2027-02-06T17:00:00.000Z",
    location: {
      en: "Online (sample)",
      ne: "अनलाइन (नमूना)",
    },
    status: "UPCOMING",
    isDemo: true,
  },
  {
    id: "event-4",
    kind: "ANNOUNCEMENT",
    slug: "sample-past-gathering",
    title: {
      en: "Sample past gathering",
      ne: "नमूना विगतको भेला",
    },
    startsAt: "2026-02-10T10:00:00.000Z",
    location: {
      en: "Sample location",
      ne: "नमूना स्थान",
    },
    status: "COMPLETED",
    description: {
      en: "*Sample description.* A short paragraph about a past gathering: why it was held and what took place.",
      ne: "*नमूना विवरण।* विगतको भेलाबारे छोटो अनुच्छेद: किन आयोजना गरियो र के भयो।",
    },
    report: {
      en: "*Sample trip report.* After an event, the ministry will share a short report here: what happened, answers to prayer and next steps.\n\nNo real names, places or numbers are shown in this sample.",
      ne: "*नमूना यात्रा प्रतिवेदन।* कार्यक्रमपछि सेवकाइले यहाँ छोटो प्रतिवेदन बाँड्नेछ: के भयो, प्रार्थनाका जवाफ र अर्का कदमहरू।\n\nयो नमूनामा कुनै वास्तविक नाम, ठाउँ वा सङ्ख्या देखाइएको छैन।",
    },
    isDemo: true,
  },
];
