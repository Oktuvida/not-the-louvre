/** Who a studio belongs to, and what hangs in it: what the visit's bookplate says. */
export type ArtistStudio = {
	avatarUrl: string | null;
	id: string;
	nickname: string;
	stats: {
		/** When the oldest piece on the wall went up; null with nothing up. */
		hangingSince: Date | string | null;
		pieces: number;
		stars: number;
	};
};
