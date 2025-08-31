const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("admin");

  // Add a filter to format dates
  eleventyConfig.addFilter("postDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
  });

  // Create a collection of reports
  eleventyConfig.addCollection("reports", function (collectionApi) {
    return collectionApi.getFilteredByGlob("reports/*.md");
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
      data: "_data",
    },
    templateFormats: ["html", "md", "njk"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    // passthroughFileCopy: true, // This line has been removed
  };
};