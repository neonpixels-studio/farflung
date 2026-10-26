/**
 * Netlify Forms submission for the /contact page. Netlify only accepts
 * url-encoded POSTs to a path that serves static HTML, which is why this
 * targets the public/__forms.html blueprint rather than /contact itself.
 */
export const CONTACT_FORM_NAME = "contact";
export const CONTACT_FORM_ENDPOINT = "/__forms.html";

export interface ContactFormFields {
  name: string;
  email: string;
  message: string;
  /** Honeypot: real visitors never see or fill this. */
  "bot-field": string;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function encodeContactForm(fields: ContactFormFields): string {
  return new URLSearchParams({
    "form-name": CONTACT_FORM_NAME,
    ...fields,
  }).toString();
}

export async function submitContactForm(
  fields: ContactFormFields,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const response = await fetchImpl(CONTACT_FORM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: encodeContactForm(fields),
  });

  if (!response.ok) {
    throw new Error(`Contact form submission failed (${response.status})`);
  }
}
