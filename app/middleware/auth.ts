import { buildLoginPath } from "~/utils/authRedirect";

export default defineNuxtRouteMiddleware((to) => {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded.value) {
    return;
  }

  if (!isSignedIn.value) {
    return navigateTo(buildLoginPath(to.fullPath));
  }
});
