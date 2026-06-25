import { createAppleMusicProvider } from "./appleMusic.js";
import { createSpotifyProvider } from "./spotify.js";
import type { PlaylistSourceId, PlaylistSourceProvider } from "./types.js";

export function createPlaylistSources(deemix: any) {
	const providers: Record<PlaylistSourceId, PlaylistSourceProvider> = {
		spotify: createSpotifyProvider(deemix.plugins.spotify),
		appleMusic: createAppleMusicProvider(),
	};

	return {
		all: () => Object.values(providers),
		get: (source: string) => providers[source as PlaylistSourceId],
	};
}
