import { describe, it, expect, vi } from "vitest";

vi.mock("../../server/utils/tokenCrypto", () => ({
  readEncryptionKey: () => Buffer.alloc(32, 9),
}));

const { issueOAuthState, verifyOAuthState, OAUTH_STATE_TTL_MS } =
  await import("../../server/utils/oauthState");

const NOW = 1_800_000_000_000;

describe("OAuth state", () => {
  it("round-trips the user id when the cookie nonce matches", () => {
    const { state, nonce } = issueOAuthState("user-1", NOW);
    expect(verifyOAuthState(state, nonce, NOW + 1000)).toBe("user-1");
  });

  it("issues a different nonce and state each time", () => {
    const first = issueOAuthState("user-1", NOW);
    const second = issueOAuthState("user-1", NOW);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.state).not.toBe(second.state);
  });

  it("rejects a state paired with a different browser's nonce", () => {
    const victim = issueOAuthState("victim", NOW);
    const attacker = issueOAuthState("attacker", NOW);
    expect(verifyOAuthState(attacker.state, victim.nonce, NOW)).toBeNull();
  });

  it("rejects when the cookie is missing", () => {
    const { state } = issueOAuthState("user-1", NOW);
    expect(verifyOAuthState(state, undefined, NOW)).toBeNull();
  });

  it("rejects when the state is missing", () => {
    const { nonce } = issueOAuthState("user-1", NOW);
    expect(verifyOAuthState(undefined, nonce, NOW)).toBeNull();
  });

  it("rejects a tampered payload even when the nonce is kept", () => {
    const { state, nonce } = issueOAuthState("user-1", NOW);
    const [encodedPayload, signature] = state.split(".");
    const payload = JSON.parse(
      Buffer.from(encodedPayload!, "base64url").toString("utf8"),
    );
    payload.userId = "someone-else";
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verifyOAuthState(`${forged}.${signature}`, nonce, NOW)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const { state, nonce } = issueOAuthState("user-1", NOW);
    expect(verifyOAuthState(`${state}x`, nonce, NOW)).toBeNull();
  });

  it("rejects an expired state and accepts one at the edge of its lifetime", () => {
    const { state, nonce } = issueOAuthState("user-1", NOW);
    expect(verifyOAuthState(state, nonce, NOW + OAUTH_STATE_TTL_MS)).toBe(
      "user-1",
    );
    expect(
      verifyOAuthState(state, nonce, NOW + OAUTH_STATE_TTL_MS + 1),
    ).toBeNull();
  });

  it.each(["", "abc", "a.b.c", ".", "a."])(
    "rejects malformed state %j",
    (state) => {
      expect(verifyOAuthState(state, "nonce", NOW)).toBeNull();
    },
  );

  it("rejects a state signed with a different key", async () => {
    const { state, nonce } = issueOAuthState("user-1", NOW);
    vi.resetModules();
    vi.doMock("../../server/utils/tokenCrypto", () => ({
      readEncryptionKey: () => Buffer.alloc(32, 1),
    }));
    const other = await import("../../server/utils/oauthState");
    expect(other.verifyOAuthState(state, nonce, NOW)).toBeNull();
    vi.doUnmock("../../server/utils/tokenCrypto");
  });
});
