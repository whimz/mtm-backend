const cheerio = require('cheerio');
const cssEscape = require('css.escape');

function generateInputSelectorFromHTML(htmlString) {
  if (!htmlString || typeof htmlString !== 'string') return false;

  const $ = cheerio.load(htmlString);
  const input = $('input, textarea').first();

  if (!input.length) return false;

  let selector = '';

  const id = input.attr('id');
  if (id) {
    selector += `#${cssEscape(id)}`;
  }

  const classAttr = input.attr('class');
  if (classAttr) {
    selector += classAttr
      .split(' ')
      .filter(Boolean)
      .map(cls => `.${cssEscape(cls)}`)
      .join('');
  }

  ['name', 'type'].forEach(attr => {
    const val = input.attr(attr);
    if (val) {
      selector += `[${attr}="${val}"]`;
    }
  });

  return selector;
}

exports.generateInputSelectorFromHTML = generateInputSelectorFromHTML;