// Which build is running: the git short SHA and the channel (`main`, `dev`, or `local`).
// Run codes will carry the SHA, and saves are namespaced by channel (D-060).
export type Channel = typeof __BUILD_CHANNEL__;

export const BUILD_SHA: string = __BUILD_SHA__;
export const BUILD_CHANNEL: Channel = __BUILD_CHANNEL__;
export const BUILD_LABEL = `${BUILD_CHANNEL} · ${BUILD_SHA}`;
