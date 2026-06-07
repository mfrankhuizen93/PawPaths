import type { LocationContribution } from "#shared/types/locations";

type ContributionsResponse = {
  contributions: LocationContribution[];
};

export function usePendingContributions() {
  const count = useState<number | null>(
    "admin:pending-contributions-count",
    () => null,
  );
  const isLoading = useState(
    "admin:pending-contributions-loading",
    () => false,
  );

  async function refresh() {
    const { isMaintainer } = useAuth();

    if (!isMaintainer.value || isLoading.value) return count.value;

    isLoading.value = true;

    try {
      const response =
        await $fetch<ContributionsResponse>("/api/contributions");
      count.value = response.contributions.length;
    } catch {
      count.value = null;
    } finally {
      isLoading.value = false;
    }

    return count.value;
  }

  return {
    count,
    isLoading,
    refresh,
  };
}
