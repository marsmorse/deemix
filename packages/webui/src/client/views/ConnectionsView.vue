<script setup lang="ts">
import { fetchData, postToServer } from "@/utils/api-utils";
import { toast } from "@/utils/toasts";
import { onMounted, ref } from "vue";

declare global {
	interface Window {
		MusicKit?: any;
	}
}

interface SourceStatus {
	id: string;
	name: string;
	credentials: {
		configured: boolean;
		reason?: string;
	};
	capabilities: {
		readPlaylists: boolean;
		readTracks: boolean;
		createPlaylists: boolean;
	};
}

const sources = ref<SourceStatus[]>([]);
const spotifyUserId = ref(localStorage.getItem("spotifyUser") || "");
const isConnectingAppleMusic = ref(false);

async function refreshSources() {
	sources.value = await fetchData("playlistSources");
}

function normalizeSpotifyUser(input: string) {
	const trimmed = input.trim();
	const profileMatch = /open\.spotify\.com\/user\/([^/?#]+)/i.exec(trimmed);
	return profileMatch?.[1] || trimmed;
}

async function connectSpotifyPublicProfile() {
	const normalizedUserId = normalizeSpotifyUser(spotifyUserId.value);
	if (!normalizedUserId) {
		toast("Enter a Spotify username or public profile URL.", "warning");
		return;
	}

	await postToServer("playlistSourceConnection", {
		source: "spotify",
		spotifyUserId: normalizedUserId,
	});
	localStorage.setItem("spotifyUser", normalizedUserId);
	spotifyUserId.value = normalizedUserId;
	await refreshSources();
	toast("Spotify public profile connected.", "done");
}

async function loadMusicKit() {
	if (window.MusicKit) return;

	await new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Could not load MusicKit."));
		document.head.appendChild(script);
	});
}

async function connectAppleMusic() {
	isConnectingAppleMusic.value = true;
	try {
		const config = await fetchData("appleMusicDeveloperToken");
		if (!config.configured) {
			toast(
				"Set APPLE_MUSIC_DEVELOPER_TOKEN before connecting Apple Music.",
				"warning"
			);
			return;
		}

		await loadMusicKit();
		window.MusicKit.configure({
			developerToken: config.developerToken,
			app: {
				name: "Deemix Playlist Organizer",
				build: "local",
			},
		});

		const music = window.MusicKit.getInstance();
		const userToken = await music.authorize();
		await postToServer("playlistSourceConnection", {
			source: "appleMusic",
			appleMusicUserToken: userToken,
		});
		await refreshSources();
		toast("Apple Music connected.", "done");
	} catch (error) {
		console.error(error);
		toast("Apple Music connection failed.", "error");
	} finally {
		isConnectingAppleMusic.value = false;
	}
}

onMounted(refreshSources);
</script>

<template>
	<div class="max-w-5xl">
		<h1 class="mb-8 text-5xl">Connections</h1>

		<div class="grid gap-6 md:grid-cols-2">
			<section class="bg-panels-bg p-5">
				<div class="mb-4 flex items-center gap-3">
					<i class="material-icons text-3xl">library_music</i>
					<div>
						<h2 class="text-2xl">Spotify</h2>
						<p class="secondary-text">Read public profile playlists.</p>
					</div>
				</div>

				<label class="mb-2 block">Spotify username or public profile URL</label>
				<input
					v-model="spotifyUserId"
					class="mb-4 w-full"
					placeholder="1212255698 or https://open.spotify.com/user/..."
					type="text"
				/>
				<button class="btn btn-primary" @click="connectSpotifyPublicProfile">
					CONNECT PUBLIC PROFILE
				</button>

				<p class="secondary-text mt-4">
					Private Spotify library login can be added later with OAuth PKCE, but
					Spotify still requires an app client ID.
				</p>
			</section>

			<section class="bg-panels-bg p-5">
				<div class="mb-4 flex items-center gap-3">
					<i class="material-icons text-3xl">album</i>
					<div>
						<h2 class="text-2xl">Apple Music</h2>
						<p class="secondary-text">
							Read playlists from your Apple Music library.
						</p>
					</div>
				</div>

				<button
					class="btn btn-primary"
					:disabled="isConnectingAppleMusic"
					@click="connectAppleMusic"
				>
					{{ isConnectingAppleMusic ? "CONNECTING..." : "CONNECT APPLE MUSIC" }}
				</button>

				<p class="secondary-text mt-4">
					Requires APPLE_MUSIC_DEVELOPER_TOKEN. Sign-in stores only the local
					Music User Token in your ignored config folder.
				</p>
			</section>
		</div>

		<section class="mt-8">
			<h2 class="mb-4 text-3xl">Source Status</h2>
			<div class="grid gap-4 md:grid-cols-2">
				<div
					v-for="source in sources"
					:key="source.id"
					class="bg-panels-bg flex items-start justify-between p-4"
				>
					<div>
						<h3 class="text-xl">{{ source.name }}</h3>
						<p class="secondary-text">
							Read playlists:
							{{ source.capabilities.readPlaylists ? "yes" : "no" }}
						</p>
						<p v-if="source.credentials.reason" class="secondary-text">
							{{ source.credentials.reason }}
						</p>
					</div>
					<i
						class="material-icons text-3xl"
						:class="
							source.credentials.configured
								? 'text-green-500'
								: 'text-yellow-500'
						"
					>
						{{ source.credentials.configured ? "check_circle" : "warning" }}
					</i>
				</div>
			</div>
		</section>
	</div>
</template>
