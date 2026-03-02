export const isRequired = (value) => {
  if (!value || (typeof value === "string" && !value.trim())) {
    return "This field is required";
  }
  return null;
};

export const isEmail = (value) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (value && !emailRegex.test(value)) {
    return "Invalid email address";
  }
  return null;
};

export const isPhone = (value) => {
  const phoneRegex = /^[0-9]{10,15}$/;
  if (value && !phoneRegex.test(value)) {
    return "Invalid phone number";
  }
  return null;
};

export const validateFields = (fields, rules) => {
  const errors = {};
  for (const [key, validators] of Object.entries(rules)) {
    for (const validator of validators) {
      const error = validator(fields[key]);
      if (error) {
        errors[key] = error;
        break;
      }
    }
  }
  return errors;
};
