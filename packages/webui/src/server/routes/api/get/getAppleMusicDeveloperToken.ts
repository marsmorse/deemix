import { type ApiHandler } from "@/types.js";

const path: ApiHandler["path"] = "/appleMusicDeveloperToken";

const handler: ApiHandler["handler"] = (_, res) => {
	const developerToken = process.env.APPLE_MUSIC_DEVELOPER_TOKEN?.trim() || "";
	res.send({
		configured: Boolean(developerToken),
		developerToken,
	});
};

const apiHandler: ApiHandler = { path, handler };

export default apiHandler;
