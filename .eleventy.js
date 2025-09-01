const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("admin");

  // Copy raw markdown files from the reports directory for client-side fetching.
  // The contents of `reports/` will be copied to `_site/reports_raw/`.
  eleventyConfig.addPassthroughCopy({ "reports": "reports_raw" });

  // Add a filter to format dates
  eleventyConfig.addFilter("postDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
  });

  // FIX: Add the 'jsonify' filter required by network.html
  // This allows data to be safely converted to a JSON string.
  eleventyConfig.addFilter("jsonify", (data) => {
    return JSON.stringify(data);
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
  };
};
