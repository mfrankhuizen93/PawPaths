export default defineNuxtPlugin(async () => {
  const { isLoaded, refreshSession } = useAuth();

  if (!isLoaded.value) {
    await refreshSession();
  }
});
