const markdownIt = require("markdown-it");

module.exports = function(eleventyConfig) {
  // Initialize markdown-it with HTML support to allow tags in your tables
  const md = new markdownIt({
    html: true,
  });
  eleventyConfig.setLibrary("md", md);

  // Tell Eleventy to copy these folders and files directly to the output
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("pagefind");
  eleventyConfig.addPassthroughCopy("*.html"); // Copies top-level pages like index.html

  // Define the project structure
  return {
    dir: {
      input: ".",           // Use the root folder for input
      includes: "_includes",// Where layouts are located
      output: "_site",      // Where the finished site will be built
    },
    // Specify which file types to process
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
