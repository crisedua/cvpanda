# CVPANDA - AI-Powered CV Analysis and Enhancement

CVPANDA is an application that uses AI to analyze, improve, and match CVs with job descriptions.

## Features

- CV parsing and analysis
- CV improvement suggestions
- Job matching
- Professional development recommendations
- Semantic search using Pinecone

## Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Pinecone account with API key
- OpenAI API key
- Supabase account (optional)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_PINECONE_API_KEY=your_pinecone_api_key
VITE_PINECONE_INDEX=your_pinecone_index_name
VITE_SUPABASE_URL=your_supabase_url (optional)
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key (optional)
```

### Installation

1. Install frontend dependencies:
   ```
   npm install
   ```

2. Install server dependencies:
   ```
   cd server
   npm install
   cd ..
   ```

## Running the Application

### Start the Frontend

```
npm run dev
```

The frontend will be available at http://localhost:3000

### Start the Backend Server

```
cd server
npm run dev
```

The server will be available at http://localhost:3001

## Using the Application

1. Visit http://localhost:3000 to access the frontend
2. Navigate to the "Store CVs in Pinecone" page
3. Upload your CV files via drag-and-drop or file browser
4. The server will process the files and store embeddings in Pinecone
5. Use the Job Matching feature to find matches between jobs and CVs

## Server-Side Architecture

The application uses a client-server architecture for CV processing:

1. Frontend uploads CV files to the server
2. Server handles file processing and embedding generation
3. Embeddings are stored securely in Pinecone
4. Semantic matching is performed via API calls

This architecture ensures:
- API keys remain secure on the server
- Embedding generation is efficient
- Large files are handled properly

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 