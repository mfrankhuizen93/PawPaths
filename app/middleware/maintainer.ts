export default defineNuxtRouteMiddleware(() => {
  const { isMaintainer } = useAuth();

  if (isMaintainer.value) return;

  return navigateTo("/?profile=true", { replace: true });
});
