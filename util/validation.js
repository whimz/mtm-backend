const yup = require('yup');

const validateSelectors = (inputs, context) => {
  const errors = {};

  if (!inputs || typeof inputs !== 'object') {
    return context.createError({
      message: 'Inputs must be a valid object',
      path: 'inputs'
    });
  }

  if (!inputs.fields || typeof inputs.fields !== 'object') {
    return context.createError({
      message: 'Inputs must be a valid object',
      path: 'inputs.fields'
    });
  }


  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[0-9\s\-()]{7,}$/;

  for (const [key, field] of Object.entries(inputs.fields)) {
    const selector = field?.selector;
    const value = field?.value;

    if (
      !selector ||
      typeof selector !== 'string' ||
      (!selector.includes('input') && !selector.includes('textarea'))
    ) {
      errors[key] = `Invalid selector for "${key}": "${selector}"`;
      continue;
    }

    console.log(`selector = ${selector} '\n value = ${value}`);

    if (key === 'email' && (!value || !emailRegex.test(value))) {
      errors[key] = `Invalid email value: "${value}"`;
    }

    if (key === 'tel' && (!value || !phoneRegex.test(value))) {
      errors[key] = `Invalid phone number: "${value}"`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return context.createError({
      message: JSON.stringify(errors),
      path: 'inputs'
    });
  }

  return true;
};

const taskSchema = yup.object().shape({
  title: yup.string().required('Title is required'),
  description: yup.string().nullable().notRequired(),
  url: yup.string().url('Must be a valid URL').required('URL is required'),
  cronExpression: yup.string().nullable().notRequired(),
  createdOn: yup.string().nullable().notRequired(),
  changedOn: yup.string().nullable().notRequired(),
  inputs: yup
    .object()
    .test('valid-selectors', 'Invalid selectors', function (inputs) {
      return validateSelectors(inputs, this);
    }),
  // Email monitoring fields
  emailAccountId: yup.number().nullable().notRequired(),
  emailCheckTimeout: yup
    .number()
    .nullable()
    .notRequired()
    .min(1, 'Timeout must be at least 1 minute')
    .max(120, 'Timeout cannot exceed 120 minutes')
});


const validateTaskInput = async (data) => {
  try {
    await taskSchema.validate(data, { abortEarly: false });
    return { valid: true, errors: {} };
  } catch (err) {
    const errors = {};
    err.inner.forEach(e => {
      if (e.path === 'inputs' && e.message.startsWith('{')) {
        Object.assign(errors, JSON.parse(e.message));
      } else if (e.path === 'inputs.fields' && e.message.startsWith('{')) {
        Object.assign(errors, JSON.parse(e.message));
      } else {
        errors[e.path] = e.message;
      }
    });

    return { valid: false, errors };
  }
};

exports.validateTaskInput = validateTaskInput;