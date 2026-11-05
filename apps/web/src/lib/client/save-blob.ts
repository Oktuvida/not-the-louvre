/** Hands a file made in the browser to the visitor, as a download. */
export const saveBlob = (blob: Blob, name: string) => {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	// Safari reads the file after the click returns, and a video takes a while.
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
