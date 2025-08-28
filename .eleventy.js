const markdownIt = require("markdown-it");
const htmlmin = require("html-minifier-terser");

module.exports = function(eleventyConfig) {
  // Initialize markdown-it with HTML support to allow tags in your tables
  const md = new markdownIt({
    html: true,
  });
  eleventyConfig.setLibrary("md", md);

  // --- THIS IS THE NEW LINE ---
  // It tells Eleventy to copy our network data to the final site.
  eleventyConfig.addPassthroughCopy("_data");
  // --- END OF NEW LINE ---

  // Tell Eleventy to copy these folders and files directly to the output
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("pagefind");
  eleventyConfig.addPassthroughCopy("*.html"); // Copies top-level pages like index.html

  // Add a transform to minify HTML
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
      input: ".",          // Use the root folder for input
      includes: "_includes", // Where layouts are located
      output: "_site",     // Where the finished site will be built
    },
    // Specify which file types to process
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
