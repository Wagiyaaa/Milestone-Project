const { debugErrors } = require("../config/runtime");

function buildErrorBody(req, message, err) {
  const body = {
    message,
    request_id: req?.id,
  };

  if (debugErrors && err) {
    body.debug = {
      error: err.message,
      stack: err.stack,
    };
  }

  return body;
}

function errorResponse(res, req, status, message, err) {
  return res.status(status).json(buildErrorBody(req, message, err));
}

module.exports = { buildErrorBody, errorResponse };
