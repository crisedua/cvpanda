const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend-url.com';

exports.handler = async function(event, context) {
  try {
    const path = event.path.replace('/.netlify/functions/proxy', '');
    const url = `${BACKEND_URL}${path}`;
    
    const method = event.httpMethod;
    const headers = event.headers;
    const body = event.body ? JSON.parse(event.body) : undefined;
    
    const response = await axios({
      method,
      url,
      headers,
      data: body,
    });
    
    return {
      statusCode: response.status,
      body: JSON.stringify(response.data),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      },
    };
  } catch (error) {
    console.error('Proxy error:', error);
    
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        error: 'An error occurred connecting to the backend service',
        details: error.response?.data || error.message,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
}; 