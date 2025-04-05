# CV Processing Server

This is a server-side application for processing CVs and storing them in Pinecone for semantic search and matching.

## Features

- Secure server-side processing of CV files
- OpenAI-powered embedding generation
- Pinecone storage for vector search
- File upload handling with validation
- Batch processing support

## Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Pinecone account with API key
- OpenAI API key

### Installation

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the server directory with the following variables or ensure they are set in the root `.env` file:
   ```
   VITE_PINECONE_API_KEY=your_pinecone_api_key
   VITE_PINECONE_INDEX=your_pinecone_index_name
   VITE_OPENAI_API_KEY=your_openai_api_key
   SERVER_PORT=3001 # Optional, defaults to 3001
   ```

4. Create an uploads directory (it will be created automatically on first run):
   ```
   mkdir uploads
   ```

### Running the Server

1. Start the development server:
   ```
   npm run dev
   ```

2. Or start in production mode:
   ```
   npm start
   ```

3. The server will be available at http://localhost:3001

## API Endpoints

### Health Check
- `GET /api/health` - Check if the server is running

### Upload Single CV
- `POST /api/store-cv` - Upload and process a single CV
  - Request: Form data with `file` field
  - Response: JSON with status and CV ID

### Upload Multiple CVs
- `POST /api/store-multiple-cvs` - Upload and process multiple CVs
  - Request: Form data with `files` field (accepts up to 10 files)
  - Response: JSON with status and results array

## Integration with Frontend

The frontend React application communicates with this server to upload and process CV files securely. This approach:

1. Keeps API keys secure on the server
2. Processes embeddings more efficiently
3. Handles large files better
4. Provides better error handling and monitoring

## Troubleshooting

- If you see CORS errors, ensure the frontend is using the correct server URL
- Check that your environment variables are set correctly
- Ensure the uploads directory is writable by the Node.js process 