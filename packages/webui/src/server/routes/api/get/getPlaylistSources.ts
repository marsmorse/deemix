import { createPlaylistSources } from "@/playlist-sources/index.js";
import { type ApiHandler } from "@/types.js";

const path: ApiHandler["path"] = "/playlistSources";

const handler: ApiHandler["handler"] = async (req, res) => {
	const deemix = req.app.get("deemix");
	const sources = createPlaylistSources(deemix);

	res.send(sources.all().map((source) => source.status()));
};

const apiHandler: ApiHandler = { path, handler };

export default apiHandler;
