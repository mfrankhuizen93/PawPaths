export type AuthDrawerIntent = "add" | "profile" | null;

export function useAuthDrawer() {
  const open = useState("auth-drawer:open", () => false);
  const intent = useState<AuthDrawerIntent>("auth-drawer:intent", () => null);

  function show(nextIntent: AuthDrawerIntent = null) {
    intent.value = nextIntent;
    open.value = true;
  }

  function close() {
    open.value = false;
    intent.value = null;
  }

  return {
    open,
    intent,
    show,
    close,
  };
}
