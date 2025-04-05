from flask import Flask, request, jsonify
import os
import tempfile
import traceback

# Import PyMuPDF (fitz) for PDF extraction
try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF not installed. Please install with: pip install PyMuPDF")
    exit(1)

# Import pdfminer for fallback extraction
try:
    from pdfminer.high_level import extract_text as pdfminer_extract
except ImportError:
    print("pdfminer.six not installed. Please install with: pip install pdfminer.six")
    pdfminer_extract = None

app = Flask(__name__)

@app.route('/extract', methods=['POST'])
def extract_pdf_text():
    """
    Extract text from a PDF file.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    pdf_file = request.files['file']
    
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400
    
    # Save to temp file
    temp = tempfile.NamedTemporaryFile(delete=False)
    temp_path = temp.name
    try:
        pdf_file.save(temp_path)
        temp.close()
        
        print(f"Processing PDF: {pdf_file.filename}")
        
        # Try PyMuPDF first (faster and usually good)
        text = ""
        try:
            doc = fitz.open(temp_path)
            print(f"PDF has {len(doc)} pages")
            
            # Extract text with PyMuPDF page by page
            for page_num, page in enumerate(doc):
                print(f"Processing page {page_num+1}")
                page_text = page.get_text()
                text += page_text + "\n\n"
            
            doc.close()
            print(f"PyMuPDF extracted {len(text)} characters")
        except Exception as e:
            print(f"PyMuPDF extraction failed: {e}")
            traceback.print_exc()
            text = ""
            
        # If PyMuPDF returned little text, try PDFMiner (more thorough but slower)
        if len(text.strip()) < 100 and pdfminer_extract:
            try:
                print("PyMuPDF extracted minimal text, trying PDFMiner...")
                text = pdfminer_extract(temp_path)
                print(f"PDFMiner extracted {len(text)} characters")
            except Exception as e:
                print(f"PDFMiner extraction failed: {e}")
                traceback.print_exc()
                # If both failed, return the error
                if not text:
                    return jsonify({"error": "Failed to extract text with both engines"}), 500
        
        # Clean up
        os.unlink(temp_path)
        
        if not text or len(text.strip()) < 10:
            return jsonify({"error": "No text could be extracted from the PDF"}), 500
            
        return jsonify({"text": text})
        
    except Exception as e:
        print(f"Error processing PDF: {e}")
        traceback.print_exc()
        
        # Clean up the temp file if it exists
        try:
            os.unlink(temp_path)
        except:
            pass
            
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "PDF extraction service is running"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3002))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    print(f"Starting PDF extraction service on {host}:{port}")
    app.run(host=host, port=port, debug=debug) 