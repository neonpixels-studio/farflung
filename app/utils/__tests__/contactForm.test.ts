import { describe, expect, it, vi } from "vitest";
import {
  CONTACT_FORM_ENDPOINT,
  encodeContactForm,
  submitContactForm,
  type ContactFormFields,
} from "../contactForm";

const fields: ContactFormFields = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Hello & welcome",
  "bot-field": "",
};

describe("encodeContactForm", () => {
  it("url-encodes the fields with the Netlify form-name", () => {
    const params = new URLSearchParams(encodeContactForm(fields));
    expect(params.get("form-name")).toBe("contact");
    expect(params.get("name")).toBe("Ada Lovelace");
    expect(params.get("email")).toBe("ada@example.com");
    expect(params.get("message")).toBe("Hello & welcome");
    expect(params.get("bot-field")).toBe("");
  });
});

describe("submitContactForm", () => {
  it("POSTs url-encoded data to the static forms blueprint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

    await submitContactForm(fields, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(CONTACT_FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeContactForm(fields),
    });
  });

  it("throws when Netlify rejects the submission", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));

    await expect(submitContactForm(fields, fetchImpl)).rejects.toThrow("404");
  });
});
