import tailwindcss from "@tailwindcss/vite";

const tailwindReference = '@reference "~/assets/css/main.css";\n';

function vueStyleTailwindReference() {
  return {
    name: "vue-style-tailwind-reference",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      const idSplit = id.split("?");
      if (!idSplit[0]?.endsWith(".vue")) {
        return;
      }

      const nextCode = code.replace(
        /(<style\b(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/style>)/g,
        (match, openTag, content, closeTag) => {
          if (content.includes("@reference")) {
            return match;
          }

          return `${openTag}\n${tailwindReference}${content.trimStart()}${closeTag}`;
        },
      );

      if (nextCode === code) {
        return;
      }

      return {
        code: nextCode,
        map: null,
      };
    },
  };
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@nuxt/image", "@nuxt/ui"],
  css: ["./app/assets/css/theme.css", "./app/assets/css/main.css"],
  vite: {
    plugins: [vueStyleTailwindReference(), tailwindcss()],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },
});
