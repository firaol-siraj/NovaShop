import ApiError from '../utils/ApiError.js';

// Higher-order function that validates req.body, req.query, or req.params
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove extra fields not defined in schema
    });

    if (error) {
      // Combine all validation error messages into a readable format
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      return next(new ApiError(400, errorMessage));
    }

    // Replace req[source] with sanitized and cast data from Joi
    if (source === 'query') {
      // Express 5: req.query is a prototype getter that re-parses the URL on
      // every access, so mutating the returned object is silently lost. Define
      // an own property on the request to shadow the getter instead.
      Object.defineProperty(req, 'query', {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      req[source] = value;
    }
    next();
  };
};

export default validate;