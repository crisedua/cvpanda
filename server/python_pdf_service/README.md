# Python PDF Extraction Service

This is a microservice that provides robust PDF text extraction using PyMuPDF (fitz) and pdfminer.six.

## Requirements

- Python 3.7+
- Flask
- PyMuPDF
- pdfminer.six

## Installation

1. Install Python 3.7+ if not already installed.

2. Install the required packages:

```bash
pip install -r requirements.txt
```

## Running the Service

### Development Mode

```bash
python pdf_extract.py
```

The service will run on port 3002 by default.

### Production Mode (with Gunicorn)

```bash
gunicorn -w 4 -b 0.0.0.0:3002 pdf_extract:app
```

## API Endpoints

### POST /extract

Extract text from a PDF file.

**Request:**
- Form data with a file field named 'file' containing the PDF file.

**Response:**
- Success (200): `{ "text": "Extracted text from the PDF..." }`
- Error (400): `{ "error": "Error message" }`

### GET /health

Health check endpoint.

**Response:**
- Success (200): `{ "status": "healthy", "message": "PDF extraction service is running" }`

## Environment Variables

- `PORT`: The port for the service to listen on (default: 3002)
- `HOST`: The host for the service to listen on (default: 0.0.0.0)
- `DEBUG`: Set to 'true' to enable debug mode (default: false)

## Integration with Node.js

The service is designed to be called from the Node.js server. See the Node.js server code for details on how to integrate with this service. 