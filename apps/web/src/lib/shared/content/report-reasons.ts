// The report vocabulary lives here so the drizzle enum, the API validator and
// the report menu cannot drift apart. The order is the order of the
// `app.artwork_report_reason` enum members: drizzle-kit diffs member order, so
// reordering this array emits a spurious ALTER TYPE against production.
export const ARTWORK_REPORT_REASONS = [
	'spam',
	'harassment',
	'hate',
	'sexual_content',
	'violence',
	'misinformation',
	'copyright',
	'other'
] as const;

export type ArtworkReportReason = (typeof ARTWORK_REPORT_REASONS)[number];

export const ARTWORK_REPORT_REASON_LABELS: Record<ArtworkReportReason, string> = {
	copyright: 'Copyright',
	harassment: 'Harassment',
	hate: 'Hate',
	misinformation: 'Misinformation',
	other: 'Other',
	sexual_content: 'Sexual content',
	spam: 'Spam',
	violence: 'Violence'
};

export const isArtworkReportReason = (value: string): value is ArtworkReportReason =>
	(ARTWORK_REPORT_REASONS as readonly string[]).includes(value);

// Same contract for the moderation lifecycle: `app.content_report_status`.
export const CONTENT_REPORT_STATUSES = ['pending', 'reviewed', 'actioned'] as const;

export type ContentReportStatus = (typeof CONTENT_REPORT_STATUSES)[number];
