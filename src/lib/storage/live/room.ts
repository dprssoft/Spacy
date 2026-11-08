import { LIVE_APP_ID, LIVE_RELAY_URLS, LIVE_TURN_CONFIG } from './config';
import type { PeerRoom } from './peerSync';

export interface JoinCallbacks {
	/** WebRTC couldn't connect to someone (a strict network), or the key didn't match. */
	onJoinError?: (message: string) => void;
}

/** Joins a live sharing room (the Trystero strategy loads only now). */
export async function joinLiveRoom(
	roomId: string,
	password: string,
	callbacks: JoinCallbacks = {}
): Promise<PeerRoom> {
	const onJoinError = (d: { error: string }) => callbacks.onJoinError?.(d.error);
	const turnConfig = LIVE_TURN_CONFIG.map((s) => ({ ...s, urls: [...s.urls] }));
	if (LIVE_RELAY_URLS.length > 0) {
		const { joinRoom } = await import('@trystero-p2p/ws-relay');
		const config = {
			appId: LIVE_APP_ID,
			password,
			turnConfig,
			relayConfig: { urls: [...LIVE_RELAY_URLS] }
		};
		return joinRoom(config, roomId, { onJoinError }) as unknown as PeerRoom;
	}
	const { joinRoom } = await import('trystero');
	return joinRoom({ appId: LIVE_APP_ID, password, turnConfig }, roomId, {
		onJoinError
	}) as unknown as PeerRoom;
}
