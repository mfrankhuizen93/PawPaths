export function useAddLocationDrawer() {
  return useState("add-location-drawer:open", () => false);
}
