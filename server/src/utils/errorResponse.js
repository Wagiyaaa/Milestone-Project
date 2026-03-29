function errorResponse(res, req, status, message, err) {
  const isDebug = process.env.NODE_ENV !== "production";
 
  const body = {
    message,
    request_id: req.id,
  };
 
  if (isDebug && err) {
    body.debug = {
      error: err.message,
      stack: err.stack,
    };
  }
 
  return res.status(status).json(body);
}
 
module.exports =  errorResponse;