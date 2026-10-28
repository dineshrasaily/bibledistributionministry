import { z } from "zod";

/**
 * Zod 4 probes `new Function("")` to decide whether it may JIT-compile
 * object parsers. Under this site's CSP (no 'unsafe-eval') the probe fails
 * harmlessly, but browsers still report it as a CSP violation. `jitless`
 * skips the probe; parsing results are identical (JIT is only a speed-up).
 * Imported for its side effect by the validation modules that reach the
 * browser (common, public-forms, donations).
 */
z.config({ jitless: true });
