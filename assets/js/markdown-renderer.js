/**
 * Renders markdown text to HTML, stripping any YAML frontmatter.
 *
 * This function first removes the YAML frontmatter (content enclosed by '---' at the start).
 * It then attempts to render the remaining markdown to HTML.
 *
 * For robust rendering, it's recommended to include a dedicated markdown parsing library
 * like 'marked.js' in your project. This script will automatically use `marked.parse()` if
 * it's available in the global scope. If not, it will use a simple, internal fallback parser
 * that supports basic markdown features like headers, bold, italics, and paragraphs.
 *
 * @param {string} rawMarkdown - The raw markdown text, potentially including YAML frontmatter.
 * @returns {string} The rendered HTML content. Returns an error message in HTML format on failure.
 */
function renderMarkdown(rawMarkdown) {
  try {
    // Ensure the input is a string, return empty if not.
    if (typeof rawMarkdown !== 'string') {
      console.error("Error: Input to renderMarkdown must be a string.");
      return '<p style="color: red;">Error: Invalid input.</p>';
    }

    // Regular expression to find and remove YAML frontmatter.
    // It looks for a block of text at the beginning of the file
    // that starts and ends with '---'.
    const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+/;
    const markdownContent = rawMarkdown.replace(frontmatterRegex, '');

    // Check if a global 'marked' library is available
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      // Use the dedicated library for better and safer parsing
      return marked.parse(markdownContent);
    } else {
      // Use a simple fallback renderer if 'marked.js' is not found.
      // This is not as comprehensive or secure as a dedicated library.
      console.warn("Warning: 'marked.js' library not found. Using a basic fallback markdown renderer.");
      return simpleFallbackParser(markdownContent);
    }
  } catch (error) {
    console.error("An unexpected error occurred while rendering markdown:", error);
    return '<p style="color: red;">Error: Could not render markdown content.</p>';
  }
}

/**
 * A simple fallback markdown parser.
 * Supports:
 * - Headers (# to ######)
 * - Bold (**)
 * - Italic (*)
 * - Paragraphs (separated by double newlines)
 * @param {string} text - The markdown text to parse.
 * @returns {string} The resulting HTML.
 */
function simpleFallbackParser(text) {
  let html = text
    // Headers (from h6 to h1 to avoid premature matching)
    .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
    .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Process paragraphs by splitting content into blocks based on double newlines
  return html.split(/\n{2,}/).map(paragraph => {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) {
      return '';
    }
    // Don't wrap already-processed headers in <p> tags
    if (trimmedParagraph.match(/^<h[1-6]>.*<\/h[1-6]>$/)) {
      return trimmedParagraph;
    }
    // Wrap the rest in <p> tags, converting single newlines to <br>
    return `<p>${trimmedParagraph.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

// To make this function available in other scripts, you can export it.
// This example checks for a CommonJS environment (like Node.js).
// In a browser, the function will be available globally if this script is included.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderMarkdown };
}
