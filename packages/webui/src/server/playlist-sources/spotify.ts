import got from "got";
import type {
	PlaylistSourceProvider,
	PlaylistSourceStatus,
	SourcePlaylist,
	SourceTrack,
} from "./types.js";

function decodeHtml(value: string) {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#x27;", "'")
		.replaceAll("&#39;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">");
}

function stripTags(value: string) {
	return decodeHtml(value.replace(/<[^>]+>/g, "").trim());
}

async function getPublicProfilePlaylists(username: string) {
	const profileUrl = `https://open.spotify.com/user/${encodeURIComponent(username)}`;
	const html = await got
		.get(profileUrl, {
			https: { rejectUnauthorized: false },
		})
		.text();
	const playlists: SourcePlaylist[] = [];
	const seenIds = new Set<string>();
	const playlistCardRe =
		/<a\b(?=[^>]*\bhref="\/playlist\/([A-Za-z0-9]+)")[^>]*>([\s\S]*?)<\/a>/gi;

	for (const match of html.matchAll(playlistCardRe)) {
		const id = match[1];
		const cardHtml = match[2];
		if (!id || seenIds.has(id)) continue;
		const titleMatch = /<span\b[^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
		const imageMatch = /<img\b[^>]*\bsrc="([^"]+)"/i.exec(cardHtml);
		const title = titleMatch ? stripTags(titleMatch[1]) : "";
		if (!title) continue;
		seenIds.add(id);
		playlists.push({
			source: "spotify",
			id,
			title,
			ownerName: username,
			artworkUrl: imageMatch?.[1] ? decodeHtml(imageMatch[1]) : undefined,
			url: `https://open.spotify.com/playlist/${id}`,
		});
	}

	return playlists;
}

export function createSpotifyProvider(
	spotifyPlugin: any
): PlaylistSourceProvider {
	const status = (): PlaylistSourceStatus => {
		const username = process.env.SPOTIFY_USER_ID?.trim() || "";
		return {
			id: "spotify",
			name: "Spotify",
			credentials:
				spotifyPlugin.enabled && username
					? { configured: true }
					: {
							configured: false,
							reason: !spotifyPlugin.enabled
								? "Spotify client credentials are missing"
								: "SPOTIFY_USER_ID is missing",
						},
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
			const username = process.env.SPOTIFY_USER_ID?.trim() || "";
			if (!spotifyPlugin.enabled || !username) return [];

			try {
				const playlists =
					await spotifyPlugin.sp.playlists.getUsersPlaylists(username);
				const playlistList = [...playlists.items];
				let page = playlists;
				while (page.next) {
					const offset = /offset=(\d+)/g.exec(page.next)?.[1];
					if (!offset) break;
					page = await spotifyPlugin.sp.playlists.getUsersPlaylists(
						username,
						undefined,
						offset
					);
					playlistList.push(...page.items);
				}
				return playlistList.map(
					(playlist): SourcePlaylist => ({
						source: "spotify",
						id: playlist.id,
						title: playlist.name,
						description: playlist.description,
						ownerName: playlist.owner?.display_name,
						trackCount: playlist.tracks?.total,
						artworkUrl: playlist.images?.[0]?.url,
						url: playlist.external_urls?.spotify,
					})
				);
			} catch {
				return getPublicProfilePlaylists(username);
			}
		},
		async getPlaylistTracks(playlistId: string) {
			const webPlaylist =
				(await spotifyPlugin.getPlaylistFromWebApi(playlistId)) ||
				(await spotifyPlugin.getPlaylistFromEmbedPage(playlistId));

			if (!webPlaylist) return [];

			return webPlaylist.tracks.map(
				(track, index): SourceTrack => ({
					source: "spotify",
					id: track.id,
					title: track.name,
					artistName:
						track.artists?.map((artist) => artist.name).join(", ") || "",
					albumTitle: track.album?.name,
					durationMs: track.duration_ms,
					isrc: track.external_ids?.isrc,
					url: track.external_urls?.spotify,
					artworkUrl: track.album?.images?.[0]?.url,
					position: index + 1,
				})
			);
		},
	};
}
