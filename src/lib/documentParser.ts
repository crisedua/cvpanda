import { createComponentLogger } from './logger';
import { extractPdfTextServer } from './api'; // Import the correct API function

const logger = createComponentLogger('DocumentParser');

// Keep DOCX extraction client-side as it seems reliable
export async function extractTextFromDOCX(file: File): Promise<string> {
  logger.log('Starting Word document text extraction');
  
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Empty document buffer');
    }

    // For DOCX files, check the file signature
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const header = new Uint8Array(arrayBuffer.slice(0, 4));
      const isValidDocx = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
      
      if (!isValidDocx) {
        logger.error('Invalid DOCX file signature');
        throw new Error('Invalid DOCX file format');
      }
    }

    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (result.messages.length > 0) {
      logger.log('Document processing warnings', result.messages);
    }

    const extractedText = result.value.trim();
    
    if (!extractedText) {
      throw new Error('No text content could be extracted from the document');
    }

    logger.log('Word document extraction successful', { textLength: extractedText.length });
    return extractedText;
  } catch (error) {
    logger.error('Word document extraction failed', error);

    if (error instanceof Error) {
      if (error.message.includes('Invalid DOCX')) {
        throw new Error('The file appears to be corrupted or is not a valid Word document');
      }
      if (error.message.includes('No text content')) {
        throw new Error('The document appears to be empty');
      }
      throw error;
    }

    throw new Error('Failed to extract text from Word document. Please ensure the file is not corrupted and is in a supported format.');
  }
}

// Function to call the server for PDF extraction - Renamed to match API call
async function callServerForPdfExtraction(file: File): Promise<string> {
  logger.log('Starting server-side PDF text extraction request');
  try {
    // Use the imported API function directly
    const text = await extractPdfTextServer(file);
    
    if (!text) { // Add a check for empty string potentially returned
      logger.error('Server returned empty text for PDF');
      throw new Error('Server extracted no text content from the PDF.');
    }

    logger.log('Server-side PDF extraction successful', { textLength: text.length });
    return text;

  } catch (error: any) {
    logger.error('Error during server-side PDF extraction request', error);
    // Rethrow the error to be handled by the main function
    throw error;
  }
}

// Main function to decide extraction method based on file type
export async function extractTextFromFile(file: File): Promise<string> {
  if (!file) {
    logger.error('No file provided');
    throw new Error('No file provided');
  }

  logger.log('Starting text extraction', {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    lastModified: new Date(file.lastModified).toISOString()
  });

  if (!file.size) {
    logger.error('Empty file provided');
    throw new Error('The file appears to be empty');
  }

  try {
    let text: string;
    
    switch (file.type) {
      case 'application/pdf':
        logger.log('Processing PDF file (using server-side extraction)');
        text = await callServerForPdfExtraction(file); // Use the wrapper function
        break;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword': // Keep handling .doc client-side if mammoth supports it
        logger.log('Processing Word document (client-side)');
        text = await extractTextFromDOCX(file);
        break;
      
      default:
        logger.error('Unsupported file type', { fileType: file.type });
        throw new Error(`Unsupported file type: ${file.type}`);
    }

    if (!text || text.trim().length === 0) {
      logger.error('No text content extracted');
      throw new Error('No text content could be extracted from the file');
    }

    logger.log('Text extraction successful', {
      textLength: text.length,
      previewStart: text.substring(0, 100),
      containsText: text.trim().length > 0
    });
    return text;
  } catch (error) {
    logger.error('Text extraction failed', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to extract text from file');
  }
}