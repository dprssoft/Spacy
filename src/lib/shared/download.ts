/** Saves a blob as a file via a temporary link. */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	document.body.append(a);
	a.click();
	a.remove();
	// Revoke after the click has been handled (some browsers read the URL asynchronously).
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
