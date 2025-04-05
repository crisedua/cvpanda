import { createComponentLogger } from './logger';

const logger = createComponentLogger('DocumentParser');

let pdfjsLib: any = null;

// Initialize PDF.js worker
const initializePdfWorker = async () => {
  if (pdfjsLib) {
    return pdfjsLib;
  }

  logger.log('Initializing PDF.js worker');
  try {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).href;
    
    logger.log('PDF.js worker initialized successfully');
    return pdfjsLib;
  } catch (error) {
    logger.error('Failed to initialize PDF.js worker', error);
    throw new Error('PDF.js worker failed to initialize. Please try refreshing the page.');
  }
};

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
        logger.log('Processing PDF file');
        text = await extractTextFromPDF(file);
        break;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        logger.log('Processing Word document');
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

async function extractTextFromPDF(file: File): Promise<string> {
  logger.log('Starting PDF text extraction');
  
  try {
    // First, verify the PDF file
    const fileHeader = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const isPDF = fileHeader[0] === 0x25 && // %
                  fileHeader[1] === 0x50 && // P
                  fileHeader[2] === 0x44 && // D
                  fileHeader[3] === 0x46 && // F
                  fileHeader[4] === 0x2D;   // -
    
    if (!isPDF) {
      logger.error('Invalid PDF file signature');
      throw new Error('The file does not appear to be a valid PDF');
    }

    logger.log('PDF signature verified');
    
    const pdfjsLib = await initializePdfWorker();
    logger.log('PDF.js library loaded');
    
    const arrayBuffer = await file.arrayBuffer();
    logger.log('File loaded into memory', { bufferSize: arrayBuffer.byteLength });
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Empty PDF file');
    }

    // Load document
    logger.log('Creating PDF loading task');
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.269/cmaps/',
      cMapPacked: true
    });

    logger.log('Loading PDF document');
    const pdf = await loadingTask.promise;
    logger.log('PDF document loaded', { numPages: pdf.numPages });

    const numPages = pdf.numPages;
    const textContent: string[] = [];

    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      logger.log(`Processing page ${i}/${numPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      
      textContent.push(pageText);
    }

    const fullText = textContent.join('\n').trim();
    
    if (!fullText) {
      logger.error('No text content found in PDF');
      throw new Error('No text content found in PDF');
    }

    logger.log('PDF text extraction completed successfully', {
      totalPages: numPages,
      totalLength: fullText.length
    });

    return fullText;
  } catch (error) {
    logger.error('PDF extraction failed', error);
    throw error;
  }
}

async function extractTextFromDOCX(file: File): Promise<string> {
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