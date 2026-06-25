import { type ApiHandler } from "../../../types.js";
import got from "got";

const path: ApiHandler["path"] = "/getUserSpotifyPlaylists";

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
	const playlists = [];
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
			collaborative: false,
			description: "",
			external_urls: {
				spotify: `https://open.spotify.com/playlist/${id}`,
			},
			followers: { total: 0 },
			id,
			images: imageMatch?.[1] ? [{ url: decodeHtml(imageMatch[1]) }] : [],
			name: title,
			owner: {
				id: username,
				display_name: username,
			},
			public: true,
			snapshot_id: "",
			tracks: {
				total: 0,
				href: `https://open.spotify.com/playlist/${id}/tracks`,
			},
			type: "playlist",
		});
	}

	return playlists;
}

const handler: ApiHandler["handler"] = async (req, res) => {
	let data;
	const deemix = req.app.get("deemix");

	if (deemix.plugins.spotify.enabled) {
		const sp = deemix.plugins.spotify.sp;
		const usernames = req.query.spotifyUser.split(/[\s,]+/);
		data = [];
		let playlistList: any;
		playlistList = [];
		for (let username of usernames) {
			username = username.trim();
			let playlists;
			try {
				playlists = await sp.playlists.getUsersPlaylists(username);
			} catch {
				try {
					const fallbackPlaylists = await getPublicProfilePlaylists(username);
					if (fallbackPlaylists.length) {
						playlistList = playlistList.concat(fallbackPlaylists);
						continue;
					}
				} catch {
					/* empty */
				}
				res.send({ error: "wrongSpotifyUsername", username });
				return;
			}
			playlistList = playlistList.concat(playlists.items);
			while (playlists.next) {
				const regExec = /offset=(\d+)/g.exec(playlists.next);
				const offset = regExec![1];
				// const limit = regExec![2]
				playlists = await sp.playlists.getUsersPlaylists(
					username,
					undefined,
					offset
				);
				playlistList = playlistList.concat(playlists.items);
			}
		}
		playlistList.forEach((playlist: any) => {
			data.push(deemix.plugins.spotify._convertPlaylistStructure(playlist));
		});
	} else {
		data = { error: "spotifyNotEnabled" };
	}
	res.send(data);
};

const apiHandler: ApiHandler = { path, handler };

export default apiHandler;
