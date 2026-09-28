import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

// jsdom's Blob/File don't survive Node's structuredClone (used by fake-indexeddb): they come
// back as empty objects. Browsers store Blobs natively, so use Node's implementations in tests.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;
