// TipTap schema helpers for template content. Only imported lazily (templates), so TipTap stays out
// of the home page bundle.
import { getSchema } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import { docExtensions } from '$lib/board/doccards/editorFactory';
import type { DocNode } from '$lib/board/doccards/markdown';

let schema: Schema | null = null;
/** The doc card schema (built once). */
export const docSchema = () =>
	(schema ??= getSchema(docExtensions(new Y.Doc().getXmlFragment('schema'))));

/** Writes editor JSON into a doc card fragment (which must already be in a Y.Doc). */
export function setDocContent(fragment: Y.XmlFragment, json: DocNode): void {
	prosemirrorJSONToYXmlFragment(docSchema(), json, fragment);
}
