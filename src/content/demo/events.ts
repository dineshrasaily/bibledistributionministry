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
    location: {
      en: "Kathmandu Valley (sample location)",
      ne: "काठमाडौं उपत्यका (नमूना स्थान)",
    },
    status: "UPCOMING",
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
    isDemo: true,
  },
];
