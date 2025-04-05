# PDF Extraction Service Setup Guide

This guide will help you set up the Python PDF extraction service alongside your Node.js application.

## Prerequisites

1. Python 3.7+ installed on your system
2. Node.js already installed (which you have since the main application runs)

## Installation Steps

### 1. Install Python Dependencies

Open a command prompt in the `server/python_pdf_service` directory and run:

```bash
pip install -r requirements.txt
```

### 2. Start the Python Service

Run the Python service using one of these methods:

#### Option A: Using the batch file (Windows)

Double-click the `start_service.bat` file or run it from the command line:

```bash
start_service.bat
```

#### Option B: Directly using Python

```bash
python pdf_extract.py
```

#### Option C: Using Gunicorn (Linux/Mac - Production)

```bash
gunicorn -w 4 -b 0.0.0.0:3002 pdf_extract:app
```

### 3. Verify the Service is Running

Open a web browser and navigate to:

```
http://localhost:3002/health
```

You should see a JSON response: `{ "status": "healthy", "message": "PDF extraction service is running" }`

## Using the Service

Once the Python service is running, the Node.js server will automatically use it for PDF extraction. You don't need to change anything in the frontend code - it will simply work better!

## Troubleshooting

### Service Won't Start

- Ensure Python is installed and in your PATH
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Make sure port 3002 is not already in use by another application

### PDF Extraction Fails

- Check the Python service console for error messages
- Ensure the PDF file is valid and not corrupted
- Try with a simpler PDF to see if it's a complexity issue

### Node.js Server Can't Connect to Python Service

- Verify the Python service is running (check the /health endpoint)
- Make sure the URL in the Node.js server matches the Python service address (default: http://localhost:3002)
- Check for any firewall issues that might be blocking the connection 