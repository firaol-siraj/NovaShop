const errorMiddleware = (err, req, res, next) => {
  // Handle MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    err.statusCode = 400;
    err.status = 'fail';
    err.message = value
      ? `A record with ${field} "${value}" already exists.`
      : `A record with this ${field} already exists.`;
    err.isOperational = true;
  } else if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    err.statusCode = 400;
    err.status = 'fail';
    err.message = messages.join('. ');
    err.isOperational = true;
  } else if (err.name === 'CastError') {
    err.statusCode = 400;
    err.status = 'fail';
    err.message = `Invalid ${err.path}: ${err.value}`;
    err.isOperational = true;
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const response = {
    status: err.status,
    message: err.message,
    ...(err.code ? { code: err.code } : {}),
  };

  // Development Mode (include error and stack trace)
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
      ...(err.code ? { code: err.code } : {}),
    });
  }

  // Production Mode (hide internal stack traces)
  if (err.isOperational) {
    return res.status(err.statusCode).json(response);
  }

  console.error('UNHANDLED ERROR 💥:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong on the server',
  });
};

export default errorMiddleware;
