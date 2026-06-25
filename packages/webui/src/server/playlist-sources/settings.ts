import * as deemix from "deemix";
import fs from "fs";

export interface PlaylistSourceSettings {
	spotifyUserId?: string;
	appleMusicUserToken?: string;
}

const settingsPath = `${deemix.utils.getConfigFolder()}playlist-sources.json`;

export function getPlaylistSourceSettings(): PlaylistSourceSettings {
	if (!fs.existsSync(settingsPath)) return {};

	try {
		return JSON.parse(fs.readFileSync(settingsPath).toString());
	} catch {
		return {};
	}
}

export function savePlaylistSourceSettings(
	newSettings: PlaylistSourceSettings
) {
	const settings = {
		...getPlaylistSourceSettings(),
		...newSettings,
	};
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
	return settings;
}
