import { z } from 'zod';

// The app ships with a Content-Security-Policy that forbids `eval`. Zod's compiled fast path needs
// it and would probe for it (reported as a CSP violation), so use the interpreter everywhere.
z.config({ jitless: true });

export { z };
