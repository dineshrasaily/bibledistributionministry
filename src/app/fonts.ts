import {
  Inter,
  Lora,
  Noto_Sans_Devanagari,
  Noto_Serif_Devanagari,
} from "next/font/google";

// Shared by the public locale layout and (later) the admin layout.
export const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const notoSansDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  variable: "--font-noto-sans-deva",
  display: "swap",
  preload: false,
});

export const notoSerifDeva = Noto_Serif_Devanagari({
  subsets: ["devanagari", "latin"],
  variable: "--font-noto-serif-deva",
  display: "swap",
  preload: false,
});
