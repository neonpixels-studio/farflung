/**
 * Tests for the Svix signature verification utility.
 * Uses real Svix round-trips -- no mocks, no network.
 */
import { describe, it, expect } from "vitest";
import { Webhook } from "svix";
import {
  verifySvixSignature,
  SVIX_ID_HEADER,
  SVIX_TIMESTAMP_HEADER,
  SVIX_SIGNATURE_HEADER,
} from "../server/utils/svix";

// A valid whsec_-prefixed secret (base64-encoded string, as Svix expects).
const TEST_SECRET =
  "whsec_" + Buffer.from("test-secret-32-bytes-padding!!").toString("base64");

interface SignedRequest {
  rawBody: string;
  headers: Record<string, string>;
}

const SAMPLE_PAYLOAD = {
  type: "user.created",
  data: {
    id: "user_abc123",
    email_addresses: [{ id: "idn_1", email_address: "test@example.com" }],
    primary_email_address_id: "idn_1",
  },
};

type SvixHeadersParam = Parameters<typeof verifySvixSignature>[1];

function buildSignedRequest(payload: object): SignedRequest {
  const rawBody = JSON.stringify(payload);
  const webhook = new Webhook(TEST_SECRET);
  const messageId = "msg_test_123";
  const timestamp = new Date();
  const signature = webhook.sign(messageId, timestamp, rawBody);

  return {
    rawBody,
    headers: {
      [SVIX_ID_HEADER]: messageId,
      [SVIX_TIMESTAMP_HEADER]: Math.floor(
        timestamp.getTime() / 1000,
      ).toString(),
      [SVIX_SIGNATURE_HEADER]: signature,
    },
  };
}

describe("verifySvixSignature", () => {
  it("returns the parsed payload when the signature is valid", () => {
    const { rawBody, headers } = buildSignedRequest(SAMPLE_PAYLOAD);
    const result = verifySvixSignature(
      rawBody,
      headers as unknown as SvixHeadersParam,
      TEST_SECRET,
    );
    expect((result as typeof SAMPLE_PAYLOAD).type).toBe("user.created");
    expect((result as typeof SAMPLE_PAYLOAD).data.id).toBe("user_abc123");
  });

  it("throws when the signature header is tampered", () => {
    const { rawBody, headers } = buildSignedRequest(SAMPLE_PAYLOAD);
    const tamperedHeaders = {
      ...headers,
      [SVIX_SIGNATURE_HEADER]: "v1,invalidsignature==",
    };
    expect(() =>
      verifySvixSignature(
        rawBody,
        tamperedHeaders as SvixHeadersParam,
        TEST_SECRET,
      ),
    ).toThrow();
  });

  it("throws when the body is altered after signing", () => {
    const { headers } = buildSignedRequest(SAMPLE_PAYLOAD);
    const alteredBody = JSON.stringify({ ...SAMPLE_PAYLOAD, injected: true });
    expect(() =>
      verifySvixSignature(
        alteredBody,
        headers as unknown as SvixHeadersParam,
        TEST_SECRET,
      ),
    ).toThrow();
  });

  it("throws when svix headers are empty strings", () => {
    const { rawBody } = buildSignedRequest(SAMPLE_PAYLOAD);
    expect(() =>
      verifySvixSignature(
        rawBody,
        {
          [SVIX_ID_HEADER]: "",
          [SVIX_TIMESTAMP_HEADER]: "",
          [SVIX_SIGNATURE_HEADER]: "",
        },
        TEST_SECRET,
      ),
    ).toThrow();
  });
});
