/**
 * Phase 7 upload fixtures (generated once with sharp; no binary files are
 * committed). Pass them to setInputFiles({ name, mimeType, buffer }).
 */

/** 320x240 PNG: navy background with a gold cross. */
export const PNG_320x240 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAUAAAADwCAMAAABG801ZAAAABlBMVEUbKkq4kkqtnSvVAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABMElEQVR42u3cQQ0AQAgDweLf9DmAB49LyKyDjoAmkiRJkiRJkiRJkiRJkiRprrrwAAQIEKAAAgQIUAABAgQogAABAhRAgAABCiBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAhRAgAABCiBAgAAFECBAgAIIcLnrXgABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgD8B4zsLIECAAAECBCiAAAECFECAAAEKIECAAAUQIECAAggQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAUQIECAAggQIEABBAgQoCRJkiRJkiRJkiRJkiTpXA/mVkSuaxG/fgAAAABJRU5ErkJggg==",
  "base64",
);

/** 64x48 JPEG with the same pattern. */
export const JPEG_SMALL = Buffer.from(
  "/9j/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAwAEADASIAAhEBAxEB/8QAGwAAAgIDAQAAAAAAAAAAAAAAAAQFBgEDBwL/xAAsEAABAwIDBQkBAQAAAAAAAAABAAIDBAUGESESExY1gSQxVHFzk6Ox0TNR/8QAGQEAAgMBAAAAAAAAAAAAAAAAAAQCAwUB/8QAIBEAAQQBBAMAAAAAAAAAAAAAAQACAxESBBMhQSIxgf/aAAwDAQACEQMRAD8A5yhCE+l0LfSUVRXzbmliMsgaXbIIGnVaFP4O5070HfYVUzzHGXDpTjaHOAKiKyhqaCURVURieW7QBIOnRLqw4z5tF6A+yq8iCQyRh57RI0NcQEIQhWqCFfWYWtBjaTTvzIB/q5UJdAZieziNoNZqGgfzd/nks7X73jtX36TWnw5zpY4Vs/h3+65MUNjt9unM9LE5khaW5l5Oh81p4ns3jPjd+JijvVvuE5hpajeSBpdlsEadQsp51OJyyr6nG7V8VaxXWWguUwmqonPe1uyCHkadEtwrZ/Dv91yarbzQW+YRVU+7eW7QGwTp0CX4ns3jPjd+IYdTiMMq+odtXzVrycK2fI9nf7rlQT3ldAOJ7Nke2fG78XPz3lamg3vLdvr2k9RhxhSwhCFpJVCn8Hc6d6DvsKATFHXVNvnM1LJu5C0tzyB0PmqpmGSMtHanG4NcCVM4z5tF6A+yq8mK2vqbhMJaqTePDdkHIDTol1yCMxxhh6RI4OcSEIQhXKC//9k=",
  "base64",
);

/** Not real audio: an ID3 header plus MPEG frame-sync bytes (passes the magic-byte check). */
export const MP3_LIKE = Buffer.concat([
  Buffer.from("ID3", "ascii"),
  Buffer.from([0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0xff, 0xfb, 0x90, 0x64]),
  Buffer.alloc(512),
]);

export const SVG_TEXT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

/** An HTML page pretending to be a PNG. */
export const HTML_AS_PNG = Buffer.from(
  "<!doctype html><script>window.__x=1</script>",
);
