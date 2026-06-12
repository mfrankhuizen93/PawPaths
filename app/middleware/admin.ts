export default defineNuxtRouteMiddleware(() => {
  const { isAdmin, isMaintainer } = useAuth();

  if (isAdmin.value) return;

  return navigateTo(
    isMaintainer.value ? "/admin/submissions" : "/?profile=true",
    {
      replace: true,
    },
  );
});
