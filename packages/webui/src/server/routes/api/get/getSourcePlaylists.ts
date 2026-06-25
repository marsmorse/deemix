import { createPlaylistSources } from "@/playlist-sources/index.js";
import { type ApiHandler } from "@/types.js";

const path: ApiHandler["path"] = "/sourcePlaylists";

const handler: ApiHandler["handler"] = async (req, res) => {
	const deemix = req.app.get("deemix");
	const source = createPlaylistSources(deemix).get(
		String(req.query.source || "")
	);

	if (!source) {
		res.status(404).send({ error: "unknownSource" });
		return;
	}

	res.send(await source.listPlaylists());
};

const apiHandler: ApiHandler = { path, handler };

export default apiHandler;
