import { savePlaylistSourceSettings } from "@/playlist-sources/settings.js";
import { type ApiHandler } from "@/types.js";

const path: ApiHandler["path"] = "/playlistSourceConnection";

const handler: ApiHandler["handler"] = (req, res) => {
	const source = String(req.body?.source || "");

	if (source === "spotify") {
		const spotifyUserId = String(req.body?.spotifyUserId || "").trim();
		savePlaylistSourceSettings({ spotifyUserId });
		res.send({ result: true });
		return;
	}

	if (source === "appleMusic") {
		const appleMusicUserToken = String(
			req.body?.appleMusicUserToken || ""
		).trim();
		savePlaylistSourceSettings({ appleMusicUserToken });
		res.send({ result: true });
		return;
	}

	res.status(400).send({ error: "unknownSource" });
};

const apiHandler = { path, handler };

export default apiHandler;
