import { createPlaylistSources } from "@/playlist-sources/index.js";
import { type ApiHandler } from "@/types.js";

const path: ApiHandler["path"] = "/sourcePlaylistTracks";

const handler: ApiHandler["handler"] = async (req, res) => {
	const deemix = req.app.get("deemix");
	const source = createPlaylistSources(deemix).get(
		String(req.query.source || "")
	);
	const playlistId = String(req.query.playlistId || "");

	if (!source) {
		res.status(404).send({ error: "unknownSource" });
		return;
	}
	if (!playlistId) {
		res.status(400).send({ error: "missingPlaylistId" });
		return;
	}

	res.send(await source.getPlaylistTracks(playlistId));
};

const apiHandler: ApiHandler = { path, handler };

export default apiHandler;
