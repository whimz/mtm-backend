const cheerio = require("cheerio")

// Validate URL format
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (err) {
    return false;
  }
}

// Build CSS selector for an element
function buildSelector(element, $) {
  const id = $(element).attr("id");
  const name = $(element).attr("name");
  const classes = $(element).attr("class");
  const tag = element.name;
  const type = $(element).attr("type");

  // Priority: ID > Name > Classes > Tag+Type
  if (id) {
    return `#${id}`;
  }

  if (name) {
    return `${tag}[name="${name}"]`;
  }

  if (classes) {
    const firstClass = classes.split(" ")[0];
    return `.${firstClass}`;
  }

  if (type) {
    return `${tag}[type="${type}"]`;
  }

  return tag;
}

// Get input type description
function getInputDescription(element, $) {
  const tag = element.name;
  const type = $(element).attr("type") || "text";
  const placeholder = $(element).attr("placeholder");
  const id = $(element).attr("id");
  const name = $(element).attr("name");

  // Try to find associated label
  let label = ""
  if (id) {
    label = $(`label[for="${id}"]`).text().trim();
  }

  // Build description
  let description = ""

  if (label) {
    description = label;
  } else if (placeholder) {
    description = placeholder;
  } else if (name) {
    description = name.replace(/[-_]/g, " ");
  } else {
    description = `${tag} field`;
  }

  // Add type info
  if (tag === "input") {
    description += ` (${type} input)`;
  } else if (tag === "textarea") {
    description += " (textarea)";
  } else if (tag === "select") {
    description += " (dropdown)";
  }

  return description
}

// Main scrape function
async function scrapeForms(req, res) {
  try {
    const { url } = req.body;

    // Validate URL
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Fetch HTML from target URL with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })
      clearTimeout(timeout);
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === "AbortError") {
        return res.status(408).json({ error: "Request timeout" });
      }
      return res.status(500).json({ error: "Failed to fetch URL: " + fetchError.message });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
      });
    }

    const html = await response.text();

    // Parse HTML with cheerio
    const $ = cheerio.load(html);

    const allForms = $("form");

    if (allForms.length === 0) {
      return res.status(404).json({ error: "No forms found on the page" });
    }

    const forms = [];

    allForms.each((formIndex, formElement) => {
      const $form = $(formElement);

      // Get form identifiers
      const formId = $form.attr("id") || null;
      const formName = $form.attr("name") || null;
      const formAction = $form.attr("action") || null;
      const formMethod = $form.attr("method") || "get";
      const formClass = $form.attr("class") || null;

      // Build a selector for the form itself
      let formSelector = "form";
      if (formId) {
        formSelector = `form#${formId}`;
      } else if (formName) {
        formSelector = `form[name="${formName}"]`;
      } else if (formClass) {
        const firstClass = formClass.split(" ")[0];
        formSelector = `form.${firstClass}`;
      } 
      // Extract all input fields from this form
      const fields = [];

      $form.find("input, textarea, select").each((index, element) => {
        const $element = $(element);
        const tag = element.name;
        const type = $element.attr("type") || (tag === "textarea" ? "textarea" : "text");
        const name = $element.attr("name") || "";

        // Skip hidden or unwanted inputs
        if (type === "hidden" || $element.attr("hidden") !== undefined) {
          return;
        }

        if (type === 'checkbox' || type === 'radio') {
          return;
        }

        if (name === 'ref_url' || name === 'id-input' || name === 'gid') {
          return;
        }

        if (name.indexOf('honeypot') !== -1) {
          return;
        }

        // Skip submit, button, and image inputs
        if (type === "submit" || type === "button" || type === "image") {
          return;
        }

        // Skip UTM fields
        const utmPattern = /^utm_/i;
        if (utmPattern.test(name)) {
          return;
        }

        const selector = buildSelector(element, $);
        const description = getInputDescription(element, $);
        const required = $element.attr("required") !== undefined;

        fields.push({
          selector: selector,
          type: type,
          description: description,
          required: required,
          name: name,
          tag: tag,
        })
      })

      // Only add forms that have at least one field
      if (fields.length > 0) {
        forms.push({
          formSelector: formSelector,
          formId: formId,
          formName: formName,
          formAction: formAction,
          formMethod: formMethod.toLowerCase(),
          fieldsCount: fields.length,
          fields: fields,
        })
      }
    })

    if (forms.length === 0) {
      return res.status(404).json({ error: "No forms with fillable fields found on the page" });
    }

    return res.status(200).json({
      success: true,
      url: url,
      formsCount: forms.length,
      forms: forms,
    })
  } catch (error) {
    console.error("Scrape error:", error);
    return res.status(500).json({ error: "Internal server error: " + error.message });
  }
}

module.exports = { scrapeForms }
