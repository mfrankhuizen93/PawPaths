<script lang="ts" setup>
const route = useRoute();
const slug = String(route.params.slug ?? "");

await navigateTo({
  path: "/",
  query: slug ? { location: slug } : undefined,
});
</script>
