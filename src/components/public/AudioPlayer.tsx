/** Native audio player; nothing downloads until the visitor presses play. */
export function AudioPlayer({
  src,
  title,
  fallback,
}: {
  /** Safe https URL or site path. */
  src: string;
  title: string;
  /** Text for browsers without <audio> support. */
  fallback: string;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">{title}</figcaption>
      <audio
        controls
        preload="none"
        src={src}
        aria-label={title}
        className="w-full"
      >
        {fallback}
      </audio>
    </figure>
  );
}
