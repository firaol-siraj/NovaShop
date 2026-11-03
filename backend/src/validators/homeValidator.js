import Joi from 'joi';

const linkValidator = (value, helpers) => {
  if (!value) return value;
  const trimmed = String(value).trim();
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return helpers.message('Link cannot contain javascript or unsafe URI schemes');
  }
  // Internal path starting with single /
  if (/^\/(?!\/)[^\s]*$/.test(trimmed)) {
    return trimmed;
  }
  // Valid https URL
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // invalid URL format
  }
  return helpers.message('Link must be an internal path starting with "/" or a valid https URL');
};

const linkSchema = Joi.object({
  label: Joi.string().trim().max(100).allow('', null).default(''),
  link: Joi.string().trim().custom(linkValidator, 'Safe link validation').allow('', null).default(''),
}).allow(null);

export const heroBannerSchema = Joi.object({
  eyebrow: Joi.string().trim().max(100).allow('', null).default(''),
  title: Joi.string().trim().max(200).required().messages({
    'string.empty': 'Hero title is required',
    'any.required': 'Hero title is required',
  }),
  subtitle: Joi.string().trim().max(500).allow('', null).default(''),
  imageUrl: Joi.string().trim().allow('', null).default(''),
  primaryCta: linkSchema.default(() => ({ label: '', link: '' })),
  secondaryCta: linkSchema.default(() => ({ label: '', link: '' })),
  isActive: Joi.boolean().default(true),
});
