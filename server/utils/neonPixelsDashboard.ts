/**
 * Isolated client for the Neon Pixels dashboard Feedback API, which collects
 * feedback from every Neon Pixels app in one place. The bearer token is
 * server-only; the browser reaches this through POST /api/feedback.
 */
export const NEON_PIXELS_FEEDBACK_ENDPOINT =
  "https://dashboard.neonpixels.dev/api/feedback";

export interface FeedbackPayload {
  message: string;
  email: string;
  url: string;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function requireNeonPixelsDashboardToken(): string {
  const token =
    process.env.NEON_PIXELS_DASHBOARD_TOKEN ||
    useRuntimeConfig().neonPixelsDashboardToken;
  if (!token) {
    throw new Error("NEON_PIXELS_DASHBOARD_TOKEN is not set");
  }
  return token;
}

export async function sendFeedback(
  payload: FeedbackPayload,
  token: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const response = await fetchImpl(NEON_PIXELS_FEEDBACK_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Feedback submission failed (${response.status})`);
  }
}
