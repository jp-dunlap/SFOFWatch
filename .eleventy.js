const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("admin");

  // **FIX ADDED HERE**
  // Copy the _data directory to the output directory to make JSON files
  // available for client-side JavaScript (e.g., for the atlas map).
  eleventyConfig.addPassthroughCopy("_data");

  // The conflicting addPassthroughCopy for "reports" was removed here.

  // Add a filter to format dates.
  eleventyConfig.addFilter("postDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
  });

  // Add the 'jsonify' filter required by network.html.
  // This allows data to be safely converted to a JSON string for use in scripts.
  eleventyConfig.addFilter("jsonify", (data) => {
    try {
      return JSON.stringify(data);
    } catch (e) {
      console.error("Error stringifying data for jsonify filter:", data);
      return "{}";
    }
  });

  // Create a collection of all reports from the markdown files in the reports directory.
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
  };
};
