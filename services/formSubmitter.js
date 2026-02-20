const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class MissingFormElementsError extends Error {
  constructor(selectors) {
    super(`The following form elements were not found: ${selectors.join(', ')}`);
    this.name = 'MissingFormElementsError';
    this.missingSelectors = selectors;
  }
}

async function fillFormInputs(page, inputs) {


  const debugInfo = await page.evaluate((inputs) => {
    const forms = document.querySelectorAll("form")
    const targetForm = forms[inputs.formIndex]

    if (!targetForm) {
      return { error: `Form at index ${inputs.formIndex} not found. Total forms: ${forms.length}` }
    }

    return {
      totalForms: forms.length,
      targetFormIndex: inputs.formIndex,
      targetFormHTML: targetForm.outerHTML.substring(0, 500), // First 500 chars
      allInputsInForm: Array.from(targetForm.querySelectorAll("input")).map((inp) => ({
        name: inp.name,
        type: inp.type,
        selector: `input[name="${inp.name}"]`,
      })),
    }
  }, inputs)

  console.log("[v0] Debug Info:", JSON.stringify(debugInfo, null, 2))

  const missingSelectors = await page.evaluate((inputs) => {
    const missing = [];

    const targetForm = document.querySelectorAll('form')[inputs.formIndex];
    console.log('targetForm - ', targetForm);

    for (const [_, { value, selector }] of Object.entries(inputs.fields)) {
      const element = targetForm.querySelector(selector);
      if (element) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        missing.push(selector); // record missing selectors
      }
    }

    const checkboxes = targetForm.querySelectorAll('input[type="checkbox"]')
    checkboxes.forEach((checkbox) => {
      if (!checkbox.checked) {
        checkbox.checked = true
        checkbox.dispatchEvent(new Event("change", { bubbles: true }))
      }
    })

    // Check one radio button per group
    const radioGroupsChecked = new Set()
    const radios = targetForm.querySelectorAll('input[type="radio"]')
    radios.forEach((radio) => {
      const radioName = radio.name
      if (radioName && !radioGroupsChecked.has(radioName)) {
        radio.checked = true
        radio.dispatchEvent(new Event("change", { bubbles: true }))
        radioGroupsChecked.add(radioName)
      }
    })

    return missing;
  }, inputs);

  if (missingSelectors.length > 0) {
    throw new MissingFormElementsError(missingSelectors);
  }
}

const settings = {
  headless: true,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]
};

async function submitFormWithPuppeteer(url, inputs){
  const browser = await puppeteer.launch(settings);
  const page = await browser.newPage();

  // Hide automation flags
  await page.evaluateOnNewDocument(() => {
    delete navigator.__proto__.webdriver;
  });

  // Set realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  page.on('console', msg => {
    console.log('[Browser log]:', msg.text());
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    // Fill form inputs
    try {
      await fillFormInputs(page, inputs);
    } catch (err) {
      if (err instanceof MissingFormElementsError) {
        console.error('🔴 Required form elements were not found:');
        console.error('Missing Selectors:', err.missingSelectors);
      } else {
        console.error('⚠️ An unexpected error occurred:', err.message);
      }
      throw err; // or handle accordingly
    }

    // Submit the form and handle multiple possible outcomes
    try {
      await Promise.all([
        page.waitForSelector('.popup', { visible: true }).catch(() => null), // optional popup
        page.click('input[type="submit"]'),
      ]);
    } catch (err) {
      console.warn('No navigation occurred after form submission.');
    }

    // Wait for UI to update
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try detecting success message
    const result = await page.evaluate(() => {
      const possibleSelectors = [
        '.thank-you',
        '.wpcf7-mail-sent-ok',
        '.modal',
        '.success',
      ];

      for (const sel of possibleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          return `Success element found: ${sel}`;
        }
      }

      return 'No obvious success message detected.';
    });

    console.log(`Form submitted on page: ${url}. \nResult: ${result}`);

  } catch (err) {
    console.error('Error during form submission:', err.message);
    if (err instanceof MissingFormElementsError) {
      console.error('Missing selectors:', err.missingSelectors);
    }
    throw err;
  } finally {
    await browser.close();
  }
}

exports.submitFormWithPuppeteer = submitFormWithPuppeteer;