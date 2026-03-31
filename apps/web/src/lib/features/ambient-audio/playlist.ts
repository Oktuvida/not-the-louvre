export type AmbientTrack = {
	id: string;
	src: string;
	title: string;
};

export const ambientPlaylist: AmbientTrack[] = [
	{
		id: 'ambient-piano',
		src: '/audio/ambient/Ambient_Piano-TuneTank.opus',
		title: 'Ambient Piano'
	},
	{
		id: 'calm-of-the-cosmos',
		src: '/audio/ambient/Calm_of_the_Cosmos-BreakzStudios.opus',
		title: 'Calm of the Cosmos'
	},
	{
		id: 'sunset-serenade',
		src: '/audio/ambient/Sunset_Serenade-Pumpupthemind.opus',
		title: 'Sunset Serenade'
	}
];
