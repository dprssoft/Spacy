<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy · Spacy</title>
</svelte:head>

<main class="mx-auto max-w-2xl p-6 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:font-semibold">
	<a href={resolve('/')} class="text-accent underline underline-offset-2">Back to boards</a>
	<h1 class="mt-4 text-xl font-semibold">Privacy</h1>
	<p class="mt-3">
		Spacy has no accounts and no server that stores your boards. There is no tracking or analytics.
	</p>

	<h2>In your browser</h2>
	<p>
		Boards, the board list, images and settings are stored in this browser's storage (IndexedDB and
		localStorage). They stay on this device unless you use one of the features below.
	</p>

	<h2>Google Drive sync (optional)</h2>
	<p>
		When you connect Google Drive, Spacy stores your boards, the board list and images in a hidden
		app folder of your own Google Drive, so your other devices can get them. Spacy asks only for
		access to that folder (the <code>drive.appdata</code> permission): it can't see or change any other
		file in your Drive. It also reads your account's email address to show which account is connected.
		The sign-in token is kept in memory only and is never sent anywhere but Google.
	</p>
	<p>
		Disconnecting stops syncing; you can also delete Spacy's copy in Drive at that moment. You can
		remove Spacy's access at any time in your Google account settings.
	</p>

	<h2>Live sharing (optional)</h2>
	<p>
		When you share a board live, the browsers that open its link exchange edits directly with each
		other, encrypted. Public Nostr relays (servers run by third parties) only help them find each
		other: they see a scrambled room name and when browsers connect, never the board or the link's
		key. Everyone who opens the link gets a copy of the board.
	</p>

	<h2>Media links</h2>
	<p>YouTube and Vimeo videos on a board load from those sites only when you press play.</p>
</main>
