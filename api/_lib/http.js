export function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

export function requireMethod(request, response, allowed) {
  if (allowed.includes(request.method)) return true;
  response.setHeader('Allow', allowed.join(', '));
  json(response, 405, { error: 'method_not_allowed' });
  return false;
}

export function bodyOf(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string' && request.body.length <= 100_000) {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return {};
}

export function bearerToken(request) {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export function publicError(error) {
  const message = String(error?.message || '');
  const allowedMessages = [
    'Enter the parent or guardian name.',
    'Enter a valid email address.',
    'Add between 1 and 6 children.',
    'Choose at least one valid child-date reservation.',
    'Every child needs a valid name.',
    'Child identifiers must be unique.',
    'Every reservation must match a child and date.',
    'The same child cannot be selected twice for one date.',
    'One or more selected dates are unavailable.',
    'One or more children are already booked for a selected date.',
    'This management link is invalid or expired.',
    'Reservation not found.'
  ];
  if (allowedMessages.includes(message)) return message;
  if (/does not have enough open spots/.test(message)) return message;
  if (/is not open for booking/.test(message)) return message;
  return 'Something went wrong. Please try again or contact the school.';
}
