import got from "got";
import type {
	PlaylistSourceProvider,
	PlaylistSourceStatus,
	SourcePlaylist,
	SourceTrack,
} from "./types.js";

const APPLE_MUSIC_API = "https://api.music.apple.com/v1";

const getAppleCredentials = () => ({
	developerToken: process.env.APPLE_MUSIC_DEVELOPER_TOKEN?.trim() || "",
	userToken: process.env.APPLE_MUSIC_USER_TOKEN?.trim() || "",
});

const getArtworkUrl = (artwork?: { url?: string }) =>
	artwork?.url?.replace("{w}", "300").replace("{h}", "300");

const appleHeaders = () => {
	const { developerToken, userToken } = getAppleCredentials();
	return {
		Authorization: `Bearer ${developerToken}`,
		"Music-User-Token": userToken,
	};
};

async function getAllApplePages<T>(path: string): Promise<T[]> {
	const data: T[] = [];
	let nextUrl: string | null = `${APPLE_MUSIC_API}${path}`;

	while (nextUrl) {
		const response: any = await got
			.get(nextUrl, {
				headers: appleHeaders(),
				responseType: "json",
			})
			.json();

		if (Array.isArray(response.data)) data.push(...response.data);
		nextUrl = response.next
			? response.next.startsWith("http")
				? response.next
				: `${APPLE_MUSIC_API}${response.next}`
			: null;
	}

	return data;
}

export function createAppleMusicProvider(): PlaylistSourceProvider {
	const status = (): PlaylistSourceStatus => {
		const { developerToken, userToken } = getAppleCredentials();
		const missing: string[] = [];
		if (!developerToken) missing.push("APPLE_MUSIC_DEVELOPER_TOKEN");
		if (!userToken) missing.push("APPLE_MUSIC_USER_TOKEN");

		return {
			id: "appleMusic",
			name: "Apple Music",
			credentials: missing.length
				? {
						configured: false,
						reason: `Missing ${missing.join(" and ")}`,
					}
				: { configured: true },
			capabilities: {
				readPlaylists: true,
				readTracks: true,
				createPlaylists: false,
			},
		};
	};

	return {
		status,
		async listPlaylists() {
			if (!status().credentials.configured) return [];

			const playlists = await getAllApplePages<any>(
				"/me/library/playlists?limit=100"
			);

			return playlists.map(
				(playlist): SourcePlaylist => ({
					source: "appleMusic",
					id: playlist.id,
					title: playlist.attributes?.name || "Untitled playlist",
					description: playlist.attributes?.description?.standard,
					ownerName: playlist.attributes?.curatorName,
					trackCount: playlist.relationships?.tracks?.data?.length,
					artworkUrl: getArtworkUrl(playlist.attributes?.artwork),
				})
			);
		},
		async getPlaylistTracks(playlistId: string) {
			if (!status().credentials.configured) return [];

			const tracks = await getAllApplePages<any>(
				`/me/library/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`
			);

			return tracks.map(
				(track, index): SourceTrack => ({
					source: "appleMusic",
					id: track.id,
					title: track.attributes?.name || "Untitled track",
					artistName: track.attributes?.artistName || "",
					albumTitle: track.attributes?.albumName,
					durationMs: track.attributes?.durationInMillis,
					isrc: track.attributes?.isrc,
					url: track.attributes?.url,
					artworkUrl: getArtworkUrl(track.attributes?.artwork),
					position: index + 1,
				})
			);
		},
	};
}
