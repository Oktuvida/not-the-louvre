INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
	'artworks',
	'artworks',
	false,
	102400,
	ARRAY['image/avif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
	name = EXCLUDED.name,
	public = EXCLUDED.public,
	file_size_limit = EXCLUDED.file_size_limit,
	allowed_mime_types = EXCLUDED.allowed_mime_types;