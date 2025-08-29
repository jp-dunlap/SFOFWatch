const markdownIt = require("markdown-it");
const htmlmin = require("html-minifier-terser");

module.exports = function(eleventyConfig) {
  // Initialize markdown-it with HTML support
  const md = new markdownIt({
    html: true,
  });
  eleventyConfig.setLibrary("md", md);

  // --- Passthrough Copies ---
  eleventyConfig.addPassthroughCopy("_data");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("network-reports");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("pagefind");

  // Minify HTML
  eleventyConfig.addTransform("htmlmin", function(content) {
    if (this.outputPath && this.outputPath.endsWith(".html")) {
      try {
        let minified = htmlmin.minify(content, {
          useShortDoctype: true,
          removeComments: true,
          collapseWhitespace: true
        });
        return minified;
      } catch (error) {
        console.error(`Error minifying HTML file: ${this.outputPath}`, error);
        return content;
      }
    }
    return content;
  });

  // Define the project structure
  return {
    dir: {
      input: ".",
      includes: "_includes",
      // This is the critical line that fixes the build.
      layouts: "_includes",
      output: "_site",
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};

