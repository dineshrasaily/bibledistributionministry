/**
 * Plain share URLs (no SDKs, scripts or tracking parameters). Pure module.
 */
export type ShareLinks = {
  facebook: string;
  x: string;
  whatsapp: string;
  email: string;
};

export function buildShareLinks(url: string, title: string): ShareLinks {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    x: `https://x.com/intent/post?url=${u}&text=${t}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    email: `mailto:?subject=${t}&body=${u}`,
  };
}
