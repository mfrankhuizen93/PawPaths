export default defineAppConfig({
  ui: {
    colors: {
      primary: "sage",
      secondary: "sage",
    },
    drawer: {
      slots: {
        title: "font-title text-2xl font-extrabold text-slate-950",
        description: "text-sm text-slate-600",
      },
    },
    input: {
      slots: {
        root: "w-full",
        base: "text-base!",
      },
      defaultVariants: {
        size: "md",
      },
    },
    textarea: {
      slots: {
        root: "w-full",
        base: "text-base!",
      },
      defaultVariants: {
        size: "md",
      },
    },
    select: {
      slots: {
        base: "w-full text-base!",
        value: "text-base!",
      },
      defaultVariants: {
        size: "md",
      },
    },
    selectMenu: {
      slots: {
        base: "w-full text-base!",
        value: "text-base!",
        input: "text-base!",
      },
      defaultVariants: {
        size: "md",
      },
    },
  },
});
