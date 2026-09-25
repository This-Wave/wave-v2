module.exports = {
  plugins: {
    // PostCSS only runs for the web build, which themes through CSS variables.
    tailwindcss: { config: "./tailwind.web.config.js" },
    autoprefixer: {},
  },
};
