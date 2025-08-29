const markdownIt = require("markdown-it");
const htmlmin = require("html-minifier-terser");

module.exports = function(eleventyConfig) {
  // Initialize markdown-it with HTML support
  const md = new markdownIt({
    html: true,
  });
  eleventyConfig.setLibrary("md", md);

  // --- Passthrough Copies ---
  // Ensure all necessary assets (JS, JSON, HTML snippets) are copied to the output (_site) directory.

  // Copies the _data directory (if used for global data)
  eleventyConfig.addPassthroughCopy("_data");

  // Copy core assets (Includes JS and JSON Data)
  eleventyConfig.addPassthroughCopy("assets");

  // Copy HTML snippets for network visualization modals
  eleventyConfig.addPassthroughCopy("network-reports");

  // Copy CMS configuration
  eleventyConfig.addPassthroughCopy("admin");

  // Copy Pagefind search index
  eleventyConfig.addPassthroughCopy("pagefind");

  // Minify HTML (Updated syntax for modern Eleventy versions)
  eleventyConfig.addTransform("htmlmin", function(content) {
    // Use this.outputPath instead of the deprecated outputPath argument
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
        return content; // Return original content if minification fails
      }
    }
    return content;
  });

  // Define the project structure
  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    // Ensure HTML is recognized as a template format
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
