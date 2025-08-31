const htmlmin = require("html-minifier-terser");

module.exports = function(eleventyConfig) {
  const md = require("markdown-it")({ html: true });
  eleventyConfig.setLibrary("md", md);

  // Add a custom Nunjucks filter to convert data to JSON
  eleventyConfig.addNunjucksFilter("jsonify", function (value) {
    return JSON.stringify(value);
  });

  // Passthrough Copies for static assets
  eleventyConfig.addPassthroughCopy({
    "assets": "assets",
    "network-reports": "network-reports",
    "admin": "admin",
    "pagefind": "pagefind"
  });

  // Minify HTML output
  eleventyConfig.addTransform("htmlmin", (content, outputPath) => {
    if (outputPath && outputPath.endsWith(".html")) {
      return htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });
    }
    return content;
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      layouts: "_includes",
      output: "_site",
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
