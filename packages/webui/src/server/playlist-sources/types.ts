export type PlaylistSourceId = "spotify" | "appleMusic";

export interface SourceCredentialsStatus {
	configured: boolean;
	reason?: string;
}

export interface PlaylistSourceStatus {
	id: PlaylistSourceId;
	name: string;
	credentials: SourceCredentialsStatus;
	capabilities: {
		readPlaylists: boolean;
		readTracks: boolean;
		createPlaylists: boolean;
	};
}

export interface SourcePlaylist {
	source: PlaylistSourceId;
	id: string;
	title: string;
	description?: string;
	ownerName?: string;
	trackCount?: number;
	artworkUrl?: string;
	url?: string;
}

export interface SourceTrack {
	source: PlaylistSourceId;
	id: string;
	title: string;
	artistName: string;
	albumTitle?: string;
	durationMs?: number;
	isrc?: string;
	url?: string;
	artworkUrl?: string;
	position: number;
}

export interface PlaylistSourceProvider {
	status(): PlaylistSourceStatus;
	listPlaylists(): Promise<SourcePlaylist[]>;
	getPlaylistTracks(playlistId: string): Promise<SourceTrack[]>;
}
