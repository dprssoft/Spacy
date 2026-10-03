import { ACCEPTED_TYPES } from '../images/importImages';

export type DocFileKind = 'text' | 'markdown' | 'docx';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

const extension = (name: string) => /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';

/** Text, Markdown or Word, by extension first (browsers often report no type for .md). */
export function docFileKind(file: { name: string; type: string }): DocFileKind | null {
	const ext = extension(file.name);
	if (ext === 'md' || ext === 'markdown' || file.type === 'text/markdown') return 'markdown';
	if (ext === 'docx' || file.type === DOCX_TYPE) return 'docx';
	if (ext === 'txt' || file.type === 'text/plain') return 'text';
	return null;
}

export const isImageFile = (file: { type: string }) => ACCEPTED_TYPES.includes(file.type);

/** What the file picker and the drop target accept. */
export const ACCEPTED_FILES = [
	...ACCEPTED_TYPES,
	'.txt',
	'.md',
	'.markdown',
	'.docx',
	'text/plain',
	'text/markdown',
	DOCX_TYPE
];
