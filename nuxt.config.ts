import tailwindcss from "@tailwindcss/vite";

const tailwindReference = '@reference "~/assets/css/main.css";\n';

function vueStyleTailwindReference() {
  return {
    name: "vue-style-tailwind-reference",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.includes(".vue") || !id.includes("type=style")) {
        return;
      }

      if (code.includes("@reference")) {
        return;
      }

      return {
        code: `${tailwindReference}${code}`,
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
  fonts: {
    families: [
      {
        name: "Nunito",
        provider: "google",
        weights: [400, 600, 800],
        global: true,
      },
    ],
  },
  css: ["./app/assets/css/main.css"],
  vite: {
    plugins: [vueStyleTailwindReference(), tailwindcss()],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },
  head: {
    title: "PawPaths",
    htmlAttrs: {
      lang: "en",
    },
  },
});
