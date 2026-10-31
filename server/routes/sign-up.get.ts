/**
 * GET /sign-up
 *
 * The one place that decides where signup CTAs go. To send visitors somewhere
 * else (e.g. a newsletter form), change the two constants below.
 */

const PRODUCTION_DESTINATION = "https://accounts.farflung.io/sign-up";
const DEVELOPMENT_DESTINATION =
  "https://upward-starfish-91.accounts.dev/sign-up";

// Clerk's hosted page prefills from email_address and ignores email.
const DESTINATION_EMAIL_PARAM = "email_address";

export default defineEventHandler((event) => {
  const destination = new URL(
    import.meta.dev ? DEVELOPMENT_DESTINATION : PRODUCTION_DESTINATION,
  );
  const { email } = getQuery(event);
  if (typeof email === "string" && email) {
    destination.searchParams.set(DESTINATION_EMAIL_PARAM, email);
  }
  return sendRedirect(event, destination.toString(), 302);
});
