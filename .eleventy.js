const markdownIt = require("markdown-it");
const htmlmin = require("html-minifier-terser");

module.exports = function(eleventyConfig) {
  // Initialize markdown-it with HTML support
  const md = new markdownIt({
    html: true,
  });
  eleventyConfig.setLibrary("md", md);

  // --- THIS IS THE CRUCIAL LINE ---
  // Copies the _data directory to your built site
  eleventyConfig.addPassthroughCopy("_data");
  // --- END OF CRUCIAL LINE ---

  // Copy other assets
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("network-reports"); 
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("pagefind");
  eleventyConfig.addPassthroughCopy("*.html");

  // Minify HTML
  eleventyConfig.addTransform("htmlmin", function(content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true
      });
      return minified;
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
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
