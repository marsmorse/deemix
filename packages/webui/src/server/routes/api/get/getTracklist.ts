import { Deezer, utils as dzUtils } from "deezer-sdk";
import { type ApiHandler } from "../../../types.js";
import { sessionDZ } from "../../../deemixApp.js";
import got from "got";

const path: ApiHandler["path"] = "/getTracklist";

function decodeHtml(value: string) {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#x27;", "'")
		.replaceAll("&#39;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">");
}

async function getSpotifyPlaylistFromPage(plugin: any, listId: string) {
	const playlistUrl = `https://open.spotify.com/playlist/${listId}`;
	const page = await got.get(playlistUrl, {
		https: { rejectUnauthorized: false },
	});
	const html = page.body;
	const titleMatch = /<meta property="og:title" content="([^"]+)"/i.exec(html);
	const imageMatch = /<meta property="og:image" content="([^"]+)"/i.exec(html);
	const creatorMatch = /<meta name="music:creator" content="([^"]+)"/i.exec(
		html
	);
	const descriptionMatch = /<meta name="description" content="([^"]+)"/i.exec(
		html
	);
	const trackIdSet = plugin.extractTrackIdsFromHtml(html);

	try {
		const embedPage = await got.get(
			`https://open.spotify.com/embed/playlist/${listId}`,
			{
				https: { rejectUnauthorized: false },
			}
		);
		for (const trackId of plugin.extractTrackIdsFromHtml(embedPage.body)) {
			trackIdSet.add(trackId);
		}
	} catch {
		/* empty */
	}

	const tracks = [];
	for (const trackId of trackIdSet) {
		try {
			const track = await plugin.sp.tracks.get(trackId);
			track.selected = false;
			tracks.push(track);
		} catch {
			/* empty */
		}
	}

	if (!tracks.length) return null;

	const ownerUrl = creatorMatch?.[1] || "https://open.spotify.com/user/spotify";
	const ownerId = ownerUrl.split("/").pop() || "spotify";

	return {
		collaborative: false,
		description: descriptionMatch?.[1] ? decodeHtml(descriptionMatch[1]) : "",
		external_urls: { spotify: playlistUrl },
		followers: { total: 0 },
		id: listId,
		images: imageMatch?.[1] ? [{ url: decodeHtml(imageMatch[1]) }] : [],
		name: titleMatch?.[1]
			? decodeHtml(titleMatch[1])
			: `Spotify Playlist ${listId}`,
		owner: {
			id: ownerId,
			display_name: ownerId,
			href: ownerUrl,
		},
		public: true,
		tracks,
		type: "playlist",
		uri: `spotify:playlist:${listId}`,
	};
}

const handler: ApiHandler["handler"] = async (req, res) => {
	if (!sessionDZ[req.session.id]) sessionDZ[req.session.id] = new Deezer();
	const dz = sessionDZ[req.session.id];
	const deemix = req.app.get("deemix");

	const list_id = String(req.query.id);
	const list_type = String(req.query.type);
	switch (list_type) {
		case "artist": {
			const artistAPI = await dz.api.get_artist(list_id);
			(artistAPI as any).releases = await dz.gw.get_artist_discography_tabs(
				list_id,
				{
					limit: 100,
				}
			);
			res.send(artistAPI);
			break;
		}
		case "spotifyplaylist":
		case "spotify_playlist": {
			if (!deemix.plugins.spotify.enabled) {
				res.send({
					collaborative: false,
					description: "",
					external_urls: { spotify: null },
					followers: { total: 0, href: null },
					id: null,
					images: [],
					name: "Something went wrong",
					owner: {
						display_name: "Error",
						id: null,
					},
					public: true,
					tracks: [],
					type: "playlist",
					uri: null,
				});
				break;
			}
			const sp = deemix.plugins.spotify.sp;
			let playlist;
			let tracklist;
			try {
				playlist = await sp.playlists.getPlaylist(list_id);
				tracklist = playlist.tracks.items;
				while (playlist.tracks.next) {
					const regExec = /offset=(\d+)&limit=(\d+)/g.exec(
						playlist.tracks.next
					);
					const offset = regExec![1];
					const limit = regExec![2];
					const playlistTracks = await sp.playlists.getPlaylistItems(
						list_id,
						undefined,
						undefined,
						limit,
						offset
					);

					playlist.tracks = playlistTracks;
					tracklist = tracklist.concat(playlist.tracks.items);
				}
				tracklist.forEach((item: any, i: number) => {
					tracklist[i] = item.track;
					tracklist[i].selected = false;
				});
			} catch {
				const webPlaylist =
					await deemix.plugins.spotify.getPlaylistFromWebApi(list_id);
				if (!webPlaylist) {
					const embedPlaylist =
						await deemix.plugins.spotify.getPlaylistFromEmbedPage(list_id);
					if (embedPlaylist) {
						embedPlaylist.tracks.forEach((track: any) => {
							track.selected = false;
						});
						embedPlaylist.playlist.tracks = embedPlaylist.tracks;
						res.send(embedPlaylist.playlist);
						break;
					}
					const pagePlaylist = await getSpotifyPlaylistFromPage(
						deemix.plugins.spotify,
						list_id
					);
					if (pagePlaylist) {
						res.send(pagePlaylist);
						break;
					}
					res.send({
						collaborative: false,
						description: "",
						external_urls: { spotify: null },
						followers: { total: 0, href: null },
						id: list_id,
						images: [],
						name: "Something went wrong",
						owner: {
							display_name: "Error",
							id: null,
						},
						public: true,
						tracks: [],
						type: "playlist",
						uri: null,
					});
					break;
				}
				playlist = webPlaylist.playlist;
				tracklist = webPlaylist.tracks;
				tracklist.forEach((track: any) => {
					track.selected = false;
				});
			}
			playlist.tracks = tracklist;
			res.send(playlist);
			break;
		}
		default: {
			let releaseAPI, releaseTracksAPI;
			try {
				releaseAPI = await dz.api[`get_${list_type}`](list_id);
				releaseTracksAPI = await dz.api[`get_${list_type}_tracks`](list_id);
				releaseTracksAPI = releaseTracksAPI.data;
			} catch {
				if (list_type === "playlist") {
					releaseAPI = dzUtils.map_playlist(
						await (
							await dz.gw.get_playlist_page(list_id)
						).DATA
					);
					releaseTracksAPI = await dz.gw.get_playlist_tracks(list_id);
				} else {
					releaseAPI = {};
					releaseTracksAPI = [];
				}
			}

			const tracks: any[] = [];
			const showdiscs =
				list_type === "album" &&
				releaseTracksAPI.length &&
				releaseTracksAPI[releaseTracksAPI.length - 1].disk_number !== 1;
			let current_disk = 0;

			releaseTracksAPI.forEach((track: any) => {
				if (track.SNG_ID) track = dzUtils.mapGwTrackToDeezer(track);
				if (showdiscs && parseInt(track.disk_number) !== current_disk) {
					current_disk = parseInt(track.disk_number);
					tracks.push({ type: "disc_separator", number: current_disk });
				}
				track.selected = false;
				tracks.push(track);
			});
			releaseAPI.tracks = tracks;
			res.send(releaseAPI);
			break;
		}
	}
};

const apiHandler: ApiHandler = { path, handler };

export default apiHandler;
