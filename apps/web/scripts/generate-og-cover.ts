import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { createMuseumWallPatternUrl } from '../src/lib/features/home-entry-scene/canvas/museum-canvas';

/*
 * Draws static/og-cover.png, the 1200x630 card every shared link previews with
 * (og:image / twitter:image, wired up in shared-ui/components/SiteMeta.svelte).
 *
 * Run it by hand — `bun run scripts/generate-og-cover.ts` — when the card art
 * changes; the PNG is committed. It is deliberately NOT part of `bun run
 * build`: rasterising needs sharp, and the output is a design asset that
 * should be reviewed by eye rather than regenerated silently on every deploy.
 * The composition uses shapes only, no text, so it renders identically on any
 * machine regardless of which fonts are installed.
 */

const wallSvg = decodeURIComponent(
	createMuseumWallPatternUrl().slice('data:image/svg+xml,'.length)
);
const wallInner = wallSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

const W = 1200;
const H = 630;

const polaroid = (x: number, y: number, w: number, h: number, rot: number, hue: string) => `
	<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
		<rect x="${x + 6}" y="${y + 10}" width="${w}" height="${h}" fill="rgba(12,8,4,0.35)"/>
		<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fbf7f0"/>
		<rect x="${x + 14}" y="${y + 14}" width="${w - 28}" height="${h - 74}" fill="${hue}"/>
		<circle cx="${x + w * 0.36}" cy="${y + h * 0.36}" r="${w * 0.14}" fill="rgba(255,255,255,0.22)"/>
		<circle cx="${x + w * 0.66}" cy="${y + h * 0.52}" r="${w * 0.18}" fill="rgba(47,36,28,0.16)"/>
		<rect x="${x + w * 0.18}" y="${y + h - 44}" width="${w * 0.64}" height="10" rx="5" fill="rgba(47,36,28,0.16)"/>
		<rect x="${x + w / 2 - 34}" y="${y - 14}" width="68" height="30" fill="rgba(255,250,230,0.7)" transform="rotate(-6 ${x + w / 2} ${y})"/>
	</g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
	<defs>
		<pattern id="wall" width="512" height="512" patternUnits="userSpaceOnUse">${wallInner}</pattern>
		<radialGradient id="spot" cx="50%" cy="16%" r="78%">
			<stop offset="0%" stop-color="#fff7d6" stop-opacity="0.30"/>
			<stop offset="45%" stop-color="#fff1c4" stop-opacity="0.05"/>
			<stop offset="100%" stop-color="#0c0907" stop-opacity="0.55"/>
		</radialGradient>
	</defs>
	<rect width="${W}" height="${H}" fill="#252018"/>
	<rect width="${W}" height="${H}" fill="url(#wall)"/>
	<rect width="${W}" height="${H}" fill="url(#spot)"/>
	${polaroid(120, 150, 300, 340, -4, '#d4834a')}
	${polaroid(450, 110, 320, 360, 2.5, '#71917f')}
	${polaroid(800, 165, 290, 330, -2, '#d9b07b')}
	<rect x="0" y="${H - 12}" width="${W}" height="12" fill="rgba(12,9,7,0.35)"/>
</svg>`;

await writeFile(
	resolve(process.cwd(), 'static/og-cover.png'),
	await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
);
process.stdout.write('Wrote static/og-cover.png\n');
