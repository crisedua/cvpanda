#!/usr/bin/env python3
"""
Enhanced PDF text extraction using multiple libraries for maximum compatibility
"""

import sys
import json
import argparse
import re
import os
import traceback
from io import BytesIO
import base64

# Primary extraction library
from pypdf import PdfReader

# Backup extraction libraries (if available)
HAVE_PDFMINER = False
try:
    from pdfminer.high_level import extract_text
    from pdfminer.layout import LAParams
    HAVE_PDFMINER = True
except ImportError:
    pass

def extract_from_pdf(pdf_path=None, pdf_data=None):
    """Extract text from a PDF file using multiple methods for reliability."""
    try:
        print(f"Starting PDF extraction from {'file' if pdf_path else 'data'}")
        
        if pdf_path:
            print(f"PDF path: {pdf_path}")
            # Check if file exists
            if not os.path.exists(pdf_path):
                return {
                    "error": f"PDF file does not exist at path: {pdf_path}",
                    "full_text": "",
                    "sections": {},
                    "structured_data": {}
                }
            
            # Check if file is readable
            try:
                with open(pdf_path, 'rb') as f:
                    # Just checking if we can read
                    file_data = f.read(10)
            except Exception as e:
                return {
                    "error": f"Cannot read PDF file: {str(e)}",
                    "full_text": "",
                    "sections": {},
                    "structured_data": {}
                }
        
        # Store all extracted texts for comparison
        extraction_results = {}
        
        # METHOD 1: PyPDF extraction (most reliable for modern PDFs)
        try:
            print("Attempting extraction with PyPDF...")
            
            if pdf_path:
                reader = PdfReader(pdf_path)
            else:
                # Decode base64 if needed
                if isinstance(pdf_data, str):
                    try:
                        pdf_data = base64.b64decode(pdf_data)
                    except Exception as e:
                        print(f"Failed to decode base64 data: {e}")
                        pdf_data = pdf_data.encode('utf-8')
                
                reader = PdfReader(BytesIO(pdf_data))
            
            # Get total number of pages
            num_pages = len(reader.pages)
            print(f"PDF has {num_pages} pages")
            
            # Extract text from each page
            all_text = []
            page_texts = []
            
            for i, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        all_text.append(page_text)
                        page_texts.append(page_text)
                        print(f"Page {i+1}: Extracted {len(page_text)} characters")
                    else:
                        print(f"Page {i+1}: No text extracted")
                except Exception as e:
                    print(f"Error extracting text from page {i+1}: {str(e)}")
            
            pypdf_text = '\n\n'.join(all_text)
            print(f"PyPDF extracted {len(pypdf_text)} characters total")
            
            extraction_results['pypdf'] = {
                'text': pypdf_text,
                'pages': page_texts,
                'length': len(pypdf_text)
            }
        except Exception as e:
            print(f"PyPDF extraction failed: {str(e)}")
            extraction_results['pypdf'] = {
                'text': '',
                'error': str(e),
                'length': 0
            }
        
        # METHOD 2: PDFMiner extraction (if available)
        if HAVE_PDFMINER:
            try:
                print("Attempting extraction with PDFMiner...")
                
                if pdf_path:
                    pdfminer_text = extract_text(pdf_path)
                else:
                    # For data, we need to create a BytesIO object
                    if isinstance(pdf_data, str):
                        try:
                            pdf_data = base64.b64decode(pdf_data)
                        except:
                            pdf_data = pdf_data.encode('utf-8')
                    
                    pdf_stream = BytesIO(pdf_data)
                    pdfminer_text = extract_text(pdf_stream)
                
                print(f"PDFMiner extracted {len(pdfminer_text)} characters")
                
                extraction_results['pdfminer'] = {
                    'text': pdfminer_text,
                    'length': len(pdfminer_text)
                }
            except Exception as e:
                print(f"PDFMiner extraction failed: {str(e)}")
                extraction_results['pdfminer'] = {
                    'text': '',
                    'error': str(e),
                    'length': 0
                }
        
        # If we got valid text from any extractor, choose the best one
        valid_extractions = {k: v for k, v in extraction_results.items() 
                           if v.get('length', 0) > 0 and 'text' in v}
        
        if not valid_extractions:
            return {
                "error": "All extraction methods failed",
                "full_text": "",
                "sections": {},
                "structured_data": {}
            }
        
        # Select the extraction with the most text
        best_method = max(valid_extractions.items(), key=lambda x: x[1]['length'])
        method_name, extraction = best_method
        
        text = extraction['text']
        print(f"Selected {method_name} extraction with {len(text)} characters")
        
        # Extract structured information
        structured_data = extract_structured_info(text)
        
        # For PyPDF extraction, we already have page-based sections
        sections = {"content": text}
        if method_name == 'pypdf' and 'pages' in extraction:
            for i, page_text in enumerate(extraction['pages']):
                sections[f"page_{i+1}"] = page_text
        
        # Try to identify proper sections
        identified_sections = identify_sections(text)
        sections.update(identified_sections)
        
        result = {
            "full_text": text,
            "sections": sections,
            "structured_data": structured_data
        }
        
        return result
    
    except Exception as e:
        traceback_str = traceback.format_exc()
        print(f"Extraction error: {str(e)}\n{traceback_str}", file=sys.stderr)
        return {
            "error": f"Extraction failed: {str(e)}\n{traceback_str}",
            "full_text": "",
            "sections": {},
            "structured_data": {}
        }

def identify_sections(text):
    """Identify different sections in the CV."""
    sections = {}
    
    # Define section patterns (case insensitive)
    section_patterns = {
        'summary': r'(?:Summary|Profile|About|Objective|Professional\s+Summary|Resumen|Perfil|Objetivo|Acerca\s+de)(?:\s+[A-Za-z]+){0,3}',
        'experience': r'(?:Experience|Work\s+Experience|Employment|Employment\s+History|Professional\s+Experience|Career|Experiencia|Experiencia\s+Laboral|Empleo|Historial\s+de\s+Empleo|Experiencia\s+Profesional|Trayectoria|Trabajo)',
        'education': r'(?:Education|Educational\s+Background|Academic|Academics|Qualifications|Degrees|Educación|Formación\s+Académica|Estudios|Títulos)',
        'skills': r'(?:Skills|Abilities|Competencies|Technical\s+Skills|Core\s+Competencies|Qualifications|Habilidades|Competencias|Capacidades|Aptitudes|Conocimientos)',
        'certifications': r'(?:Certifications|Certificates|Credentials|Certificaciones|Certificados|Credenciales)',
        'languages': r'(?:Languages|Language\s+Skills|Idiomas|Competencias\s+Lingüísticas)',
        'projects': r'(?:Projects|Key\s+Projects|Significant\s+Projects|Project\s+Experience|Proyectos|Proyectos\s+Clave|Proyectos\s+Significativos)',
        'interests': r'(?:Interests|Hobbies|Activities|Personal\s+Interests|Intereses|Pasatiempos|Actividades|Intereses\s+Personales)',
        'references': r'(?:References|Referees|Professional\s+References|Referencias|Árbitros|Referencias\s+Profesionales)',
        'publications': r'(?:Publications|Published\s+Works|Papers|Publicaciones|Trabajos\s+Publicados|Artículos)',
        'awards': r'(?:Awards|Honors|Achievements|Recognitions|Premios|Honores|Logros|Reconocimientos)',
        'volunteering': r'(?:Volunteering|Volunteer\s+Experience|Community\s+Service|Voluntariado|Experiencia\s+de\s+Voluntariado|Servicio\s+Comunitario)',
    }
    
    # Get all section matches and their start positions
    section_positions = []
    
    for section_type, pattern in section_patterns.items():
        # Look for the pattern at the start of a line or after a clear break
        full_pattern = r'(?:^|\n\s*|\n\n)(' + pattern + r')(?:\s*:|\s*\n)'
        for match in re.finditer(full_pattern, text, re.IGNORECASE):
            # Get position of the end of the match (where content starts)
            section_title = match.group(1).strip()
            start_pos = match.end()
            section_positions.append((start_pos, section_type, section_title))
    
    # Sort by position
    section_positions.sort()
    
    # Extract text between sections
    for i, (start_pos, section_type, section_title) in enumerate(section_positions):
        end_pos = len(text)
        if i < len(section_positions) - 1:
            end_pos = section_positions[i + 1][0]
        
        section_text = text[start_pos:end_pos].strip()
        sections[section_type] = section_text
        
    return sections

def extract_work_experiences_v2(text):
    """Extract work experiences by identifying date ranges as primary indicators of job entries
    within the content between Experience and Education sections."""
    work_experiences = []
    
    # First, find the Experience section
    experience_section = None
    
    # Try to find the section boundaries (Experience to Education)
    experience_pattern = r'(?:^|\n\s*|\n\n)(?:Experience|Work\s+Experience|Employment|Professional\s+Experience|Experiencia|Trayectoria)(?:\s*:|\s*\n)'
    education_pattern = r'(?:^|\n\s*|\n\n)(?:Education|Educational|Academic|Academics|Qualifications|Degrees|Educación|Formación\s+Académica)(?:\s*:|\s*\n)'
    
    experience_match = re.search(experience_pattern, text, re.IGNORECASE)
    education_match = re.search(education_pattern, text, re.IGNORECASE)
    
    if experience_match:
        start_idx = experience_match.end()
        end_idx = len(text)
        
        if education_match:
            end_idx = education_match.start()
            
        experience_section = text[start_idx:end_idx].strip()
    
    if not experience_section:
        # Fallback: use identify_sections if direct search fails
        sections = identify_sections(text)
        if 'experience' in sections:
            experience_section = sections['experience']
        else:
            return []  # Return empty list if no experience section found
    
    print(f"Found experience section with {len(experience_section)} characters")
    
    # Define comprehensive date patterns to detect all job entries
    date_patterns = [
        # Month Year to Month Year or Present (various formats)
        r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*[-–—a]+\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}',
        r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*[-–—a]+\s*(?:Present|Current)',
        r'(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}\s*[-–—a]+\s*(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}',
        r'(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}\s*[-–—a]+\s*(?:Presente|Actual|Actualidad)',
        
        # Abbreviated month names
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-–—a]+\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}',
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-–—a]+\s*(?:Present|Current)',
        r'(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)[a-z]*\s+\d{4}\s*[-–—a]+\s*(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)[a-z]*\s+\d{4}',
        r'(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)[a-z]*\s+\d{4}\s*[-–—a]+\s*(?:Presente|Actual|Actualidad)',
        
        # Just years
        r'(?<!\d)(19|20)\d{2}\s*[-–—a]+\s*((?:19|20)\d{2}|Present|Current|Presente|Actual|Actualidad)(?!\d)',
    ]
    
    # Convert the experience section text to lines for easier processing
    lines = experience_section.split('\n')
    
    # Find all date range occurrences - each indicates a job entry
    date_positions = []
    for i, line in enumerate(lines):
        for pattern in date_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                date_positions.append((i, match.group(0)))
                break
    
    # If no date ranges were found, return empty list
    if not date_positions:
        return []
    
    print(f"Found {len(date_positions)} date ranges in the experience section")
    
    # Process each job entry (from date to next date, or end)
    for j, (date_line_idx, date_text) in enumerate(date_positions):
        start_idx = date_line_idx
        
        # Find the line index where the next job starts or section ends
        if j < len(date_positions) - 1:
            end_idx = date_positions[j + 1][0]
        else:
            end_idx = len(lines)
        
        # Get job text (including date line)
        job_lines = lines[start_idx:end_idx]
        job_text = '\n'.join(job_lines)
        
        # Extract company name (typically directly above or in the same line as the date)
        company = "Unknown"
        title = "Unknown"
        
        # Look for company name - typically on the line before the date or same line
        if start_idx > 0:  # Check if there's a line before the date line
            company_line = lines[start_idx - 1].strip()
            if company_line and company_line[0].isupper():  # Likely company name (capitalized)
                company = company_line
        
        # If company wasn't found above, look for it in the job text using capitalized lines
        if company == "Unknown":
            for line in job_lines[:2]:  # Check first couple of lines in this job block
                if line.strip() and line.strip()[0].isupper() and len(line.strip().split()) <= 5:
                    company = line.strip()
                    break
        
        # Look for job title - typically directly above the date or above company
        if start_idx > 0:
            title_candidates = []
            
            # Check if line before date might be a title
            if start_idx > 0 and company != lines[start_idx - 1].strip():
                title_candidates.append(lines[start_idx - 1].strip())
            
            # Check if line before company might be a title
            if start_idx > 1 and company == lines[start_idx - 1].strip():
                title_candidates.append(lines[start_idx - 2].strip())
                
            # Check the first line of job text that's not a date or company
            for line in job_lines:
                if line != company and date_text not in line:
                    title_candidates.append(line.strip())
                    break
            
            # Pick the best candidate (prioritize job title keywords)
            title_keywords = ['Director', 'CIO', 'Chief', 'Manager', 'Lead', 'Engineer', 'Developer', 
                             'Architect', 'Analyst', 'Consultant', 'Specialist', 'Asesor', 'Jefe', 
                             'Gerente', 'Ingeniero']
            
            for candidate in title_candidates:
                if any(keyword in candidate for keyword in title_keywords):
                    title = candidate
                    break
            
            # If no keyword matches, take the first candidate
            if title == "Unknown" and title_candidates:
                title = title_candidates[0]
        
        # Create a description by excluding the company and title lines
        description_lines = []
        for line in job_lines:
            # Exclude empty lines at the beginning
            if not line.strip() and not description_lines:
                continue
            # Keep all other lines, including the date line
            if line.strip() != company and line.strip() != title:
                description_lines.append(line)
        
        description = '\n'.join(description_lines).strip()
        
        # Add this job experience
        work_experiences.append({
            'company': company,
            'title': title,
            'date': date_text,
            'description': description
        })
    
    # Sort by date (newest first)
    def extract_year(date_str):
        if not date_str or date_str == "Unknown":
            return 0
        years = re.findall(r'(19|20)\d{2}', date_str)
        if years:
            return max(int(y) for y in years)
        return 0
    
    work_experiences.sort(key=lambda x: extract_year(x['date']), reverse=True)
    
    print(f"Extracted {len(work_experiences)} job experiences")
    return work_experiences

def extract_structured_info(text):
    """Extract structured information from the text."""
    data = {
        'email': None,
        'phone': None,
        'linkedin': None,
        'github': None,
        'website': None,
        'name': None,
        'location': None,
        'job_title': None,
        'skills': [],
        'education': [],
        'work_experiences': [],
        'sections': {}
    }
    
    # Extract sections first
    sections = identify_sections(text)
    data['sections'] = {k: v for k, v in sections.items()} # Store raw sections if needed
    
    # Extract work experiences using the refined v2 function
    data['work_experiences'] = extract_work_experiences_v2(text)
    
    # Call other extraction functions
    data['email'] = extract_email(text)
    data['phone'] = extract_phone(text)
    data['linkedin'] = extract_linkedin(text)
    data['github'] = extract_github(text)
    data['website'] = extract_website(text)
    data['name'] = extract_name(text)
    data['location'] = extract_location(text)
    # Extract overall job title (often near name) - might differ from specific experience titles
    data['job_title'] = extract_job_title(text) 
    data['skills'] = extract_skills(sections.get('skills', text)) # Extract from skills section or full text
    data['education'] = extract_education(sections.get('education', text)) # Extract from education section or full text
    
    return data

def extract_job_entries(text):
    """Extract job entries from text even without section headers."""
    job_entries = []
    
    # Common job title patterns (including Spanish)
    job_title_patterns = [
        r'\b(?:Senior|Lead|Principal|Junior|Staff|Director[a]?|Jefe[a]?|Gerente)\b',
        r'\b(?:Software|Data|Full Stack|Frontend|Backend|Web|Mobile|UI|UX|DevOps|Cloud|Machine Learning|AI|QA|CIO|CTO|CEO|VP|Manager)\b',
        r'\b(?:Engineer|Developer|Scientist|Analyst|Designer|Architect|Manager|Director|Consultant|Specialist|Ingeniero|Desarrollador|Analista|Consultor[a]?)\b'
    ]
    
    # Date patterns
    date_patterns = [
        r'\b(19|20)\d{2}\s*[-–—a]*\s*((?:19|20)\d{2}|[Pp]resent|[Cc]urrent|[Aa]ctual|[Aa]ctualidad|[Pp]resente)\b',
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\w*\s+\d{4}\b'
    ]
    
    # Company patterns
    company_patterns = [
        r'\b(?:[A-Z][a-z]*){2,}\s+(?:Inc|LLC|Ltd|SA|SPA|SL|GmbH|Corp|Corporation|Company|Consulting|Systems|Technologies|Solutions)\b',
        r'(?<=•|@|at)\s*([A-Z][a-zA-Z0-9\s&]+?)(?=\s*[•\n])'
    ]
    
    # Split text into paragraphs or chunks
    paragraphs = re.split(r'\n\s*\n', text)
    
    for para in paragraphs:
        # Check if paragraph looks like a job entry
        has_job_title = any(re.search(pattern, para) for pattern in job_title_patterns)
        has_date = any(re.search(pattern, para) for pattern in date_patterns)
        
        if has_job_title and has_date:
            job_entries.append(para)
        
    return job_entries

def extract_work_experiences(text):
    """Extract work experiences in a more structured format."""
    work_experiences = []
    
    # First, try to find the experience section
    experience_section = None
    sections = identify_sections(text)
    if 'experience' in sections:
        experience_section = sections['experience']
    else:
        # Try harder to find the experience section with exact keywords
        experience_patterns = [
            r'Experience\s*(?:\n|:)',
            r'Work Experience\s*(?:\n|:)',
            r'Professional Experience\s*(?:\n|:)',
            r'Employment History\s*(?:\n|:)',
            r'Experiencia Laboral\s*(?:\n|:)',
            r'Experiencia Profesional\s*(?:\n|:)',
            r'Experiencia\s*(?:\n|:)',
            r'Trayectoria\s*(?:\n|:)'
        ]
        
        for pattern in experience_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                start_idx = match.end()
                next_major_section = re.search(r'\n\s*(?:Education|Skills|Certifications|Projects|Languages|Educación|Habilidades|Certificaciones|Proyectos|Idiomas)\s*(?:\n|:)', text[start_idx:], re.IGNORECASE)
                if next_major_section:
                    end_idx = start_idx + next_major_section.start()
                    experience_section = text[start_idx:end_idx].strip()
                else:
                    experience_section = text[start_idx:].strip()
                break
    
    # Define company patterns as seen in the image
    company_names = [
        r'QwerTI Consultores',
        r'Quantum Discoveries',
        r'Instituto Nacional de Estadísticas',
        r'Ministerio de Vivienda',
        r'Servel Chile',
        r'Independiente',
        # Generic company patterns
        r'([A-Z][a-zA-Z0-9\s&\.]+(?:S\.?p\.?A\.?|S\.?A\.?|Ltd\.?|Inc\.?|LLC|GmbH|Corp\.?|Chile))',
        r'(?<=\n)([A-Z][a-zA-Z0-9\s&\.\-]+)(?=\s*\n)',
    ]
    
    # Job title patterns specifically seen in the CV
    job_titles = [
        r'Director\s*\(owner\)',
        r'CIO',
        r'CISO',
        r'IT Security',
        r'Asesor Datacenter y Seguridad',
        r'(?:CIO|Jefe|Director[a]?)\s+(?:División|Informática)',
        r'Asesor (?:Arquitectura )?Datacenter y Seguridad',
        r'Asesor (?:en la gestión|externo|independiente)'
    ]
    
    # Date patterns specifically seen in the CV
    date_patterns = [
        r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*[-–—a]+\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}',
        r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*[-–—a]+\s*Present',
        r'(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}\s*[-–—a]+\s*(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}',
        r'(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}\s*[-–—a]+\s*Presente',
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[-–—a]+\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}',
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[-–—a]+\s*Present',
        r'(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+\d{4}\s*[-–—a]+\s*(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+\d{4}',
        r'(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+\d{4}\s*[-–—a]+\s*Presente',
    ]
    
    # If we have an experience section, use that; otherwise use the full text
    process_text = experience_section if experience_section else text
    
    # Split by potential job entries
    # Look for patterns that indicate a new job entry, like a company name followed by a job title and date
    potential_entries = re.split(r'\n\s*\n', process_text)
    
    # Process each potential job entry
    for entry in potential_entries:
        entry = entry.strip()
        if not entry:
            continue
            
        # Skip if too short to be a job entry
        if len(entry) < 20:
            continue
            
        # Check for company name
        company = None
        for pattern in company_names:
            match = re.search(pattern, entry)
            if match:
                company = match.group(0) if match.group(0) else match.group(1) if len(match.groups()) > 0 else None
                if company:
                    break
                    
        # Check for job title
        title = None
        for pattern in job_titles:
            match = re.search(pattern, entry)
            if match:
                title = match.group(0)
                break
                
        # If we didn't find a specific title, try generic patterns
        if not title:
            generic_title_pattern = r'\b(?:Director[a]?|CIO|CTO|CEO|VP|Senior|Lead|Principal|Gerente|Manager|Jefe|Engineer|Developer|Analyst|Consultant|Specialist|Ingeniero|Desarrollador|Analista|Consultor|Arquitecto)(?:\w*\s+\w+)?\b'
            match = re.search(generic_title_pattern, entry)
            if match:
                title = match.group(0)
                
        # Check for date range
        date = None
        for pattern in date_patterns:
            match = re.search(pattern, entry)
            if match:
                date = match.group(0)
                break
        
        # If we didn't find a specific date format, try year ranges
        if not date:
            year_pattern = r'(19|20)\d{2}\s*[-–—a]+\s*((?:19|20)\d{2}|[Pp]resent|[Cc]urrent|[Aa]ctual|[Aa]ctualidad|[Pp]resente)'
            match = re.search(year_pattern, entry)
            if match:
                date = match.group(0)
                
        # If we have at least a company or title, and a date, consider it a job entry
        if (company or title) and date:
            # Clean up company name if needed
            if company and len(company) > 50:  # Probably got too much text
                company = company.split('\n')[0]  # Take just the first line
                
            work_experiences.append({
                'company': company or "Unknown",
                'title': title or "Unknown",
                'date': date,
                'description': entry
            })
        elif company and title:
            # If we have both company and title but no date, it might still be a job entry
            work_experiences.append({
                'company': company,
                'title': title,
                'date': "Unknown",
                'description': entry
            })
    
    # Direct extraction for specific companies we know should be in the CV
    if len(work_experiences) < 3:  # If we didn't get enough job entries, try direct extraction
        for company in ["QwerTI Consultores", "Quantum Discoveries", "Instituto Nacional", "Ministerio de Vivienda", "Servel Chile"]:
            company_section = None
            # Find the section for this company
            for i, line in enumerate(text.split('\n')):
                if company in line:
                    # Extract from this line until we find another potential company or section header
                    start_idx = i
                    end_idx = len(text.split('\n'))
                    
                    for j in range(i + 1, len(text.split('\n'))):
                        line_j = text.split('\n')[j]
                        # Check if this might be another company or section
                        if any(c in line_j for c in ["QwerTI", "Quantum", "Instituto", "Ministerio", "Servel", "Independiente"]) or \
                           re.search(r'\b(?:Education|Skills|Educación|Habilidades)\b', line_j, re.IGNORECASE):
                            end_idx = j
                            break
                    
                    company_section = '\n'.join(text.split('\n')[start_idx:end_idx])
                    
                    # Try to extract job details from this section
                    title_match = None
                    date_match = None
                    
                    for pattern in job_titles:
                        match = re.search(pattern, company_section)
                        if match:
                            title_match = match.group(0)
                            break
                            
                    for pattern in date_patterns:
                        match = re.search(pattern, company_section)
                        if match:
                            date_match = match.group(0)
                            break
                            
                    if not date_match:
                        year_pattern = r'(19|20)\d{2}\s*[-–—a]+\s*((?:19|20)\d{2}|[Pp]resent|[Cc]urrent|[Aa]ctual|[Aa]ctualidad|[Pp]resente)'
                        match = re.search(year_pattern, company_section)
                        if match:
                            date_match = match.group(0)
                    
                    # If we found enough information, add it as a job entry
                    if company_section:
                        # Check if this company is already in our results
                        company_exists = any(job['company'] == company for job in work_experiences)
                        if not company_exists:
                            work_experiences.append({
                                'company': company,
                                'title': title_match or "Unknown",
                                'date': date_match or "Unknown",
                                'description': company_section.strip()
                            })
                    break
    
    # Sort jobs by date (recent first)
    def extract_year(date_str):
        if not date_str or date_str == "Unknown":
            return 0
        match = re.search(r'(19|20)\d{2}', date_str)
        if match:
            return int(match.group(0))
        return 0
        
    work_experiences.sort(key=lambda x: extract_year(x['date']), reverse=True)
    
    return work_experiences

def extract_email(text):
    """Extract email addresses from text."""
    # Match common email patterns
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = re.findall(email_pattern, text)
    if emails:
        return emails[0]  # Return the first email found
    return None

def extract_phone(text):
    """Extract phone numbers from text."""
    # Match various phone number formats
    phone_patterns = [
        r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',  # US/CA: (123) 456-7890
        r'\+?\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{3}[-.\s]?\d{4}',  # International: +12 3456 7890
        r'\d{3}[-.\s]?\d{3}[-.\s]?\d{4}',  # Simple: 123-456-7890
        r'\+?\d{1,3}[-.\s]?\d{6,12}'  # International compact: +123456789012
    ]
    
    for pattern in phone_patterns:
        phones = re.findall(pattern, text)
        if phones:
            return phones[0]  # Return the first phone number found
    
    return None

def extract_linkedin(text):
    """Extract LinkedIn URLs from text."""
    # Match LinkedIn profile URLs
    linkedin_patterns = [
        r'linkedin\.com/in/[a-zA-Z0-9_-]+/?',
        r'linkedin\.com/profile/[a-zA-Z0-9_-]+/?',
        r'www\.linkedin\.com/in/[a-zA-Z0-9_-]+/?'
    ]
    
    for pattern in linkedin_patterns:
        linkedin = re.findall(pattern, text, re.IGNORECASE)
        if linkedin:
            return linkedin[0]
    
    return None

def extract_github(text):
    """Extract GitHub URLs from text."""
    # Match GitHub profile URLs
    github_patterns = [
        r'github\.com/[a-zA-Z0-9_-]+/?',
        r'www\.github\.com/[a-zA-Z0-9_-]+/?'
    ]
    
    for pattern in github_patterns:
        github = re.findall(pattern, text, re.IGNORECASE)
        if github:
            return github[0]
    
    return None

def extract_website(text):
    """Extract personal websites from text."""
    # Match website URLs (excluding common platforms like LinkedIn, GitHub)
    website_pattern = r'https?://(?!(?:www\.)?(?:linkedin|github|facebook|twitter|instagram)\.com)(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)'
    
    websites = re.findall(website_pattern, text, re.IGNORECASE)
    if websites:
        return websites[0]
    
    return None

def extract_name(text):
    """Extract name from CV."""
    # Try to find name at the beginning of the CV (usually first line)
    lines = text.split('\n')
    for line in lines[:3]:  # Check first 3 lines
        if line and len(line.strip().split()) <= 4 and len(line.strip()) > 3:
            # Names typically have 1-4 words and more than 3 characters
            return line.strip()
    
    return None

def extract_location(text):
    """Extract location/address from CV."""
    # Common location patterns
    location_patterns = [
        r'\b(?:[A-Z][a-z]+ ?){1,2}(?:,)? [A-Z]{2} \d{5}\b',  # City, STATE ZIP
        r'\b(?:[A-Z][a-z]+ ?){1,2}(?:,)? [A-Z]{2}\b',  # City, STATE
        r'(?:Chile|Santiago|España|Mexico|Colombia|Argentina)(?:,\s*[A-Za-z\s]+)?',  # Common Spanish locations
        r'(?:Region|Región) (?:Metropolitana|del Bio-?Bío|de Valparaíso)',  # Chilean regions
    ]
    
    for pattern in location_patterns:
        locations = re.findall(pattern, text)
        if locations:
            return locations[0]
    
    return None

def extract_job_title(text):
    """Extract current job title from CV."""
    # Common job title patterns
    title_patterns = [
        r'\b(?:Senior|Lead|Principal|Junior|Staff)?\s?(?:Software|Data|Full Stack|Frontend|Backend|Web|Mobile|UI|UX|DevOps|Cloud|Machine Learning|AI|QA)?\s?(?:Engineer|Developer|Scientist|Analyst|Designer|Architect|Manager|Director|Consultant|Specialist)\b',
        r'\b(?:CIO|CTO|CEO|VP|Director(?:a)?|Gerente|Jefe(?:a)?)\b',
        r'\b(?:Ingeniero|Desarrollador|Analista|Consultor|Arquitecto|Especialista)(?:a)?\b',
    ]
    
    for pattern in title_patterns:
        titles = re.findall(pattern, text)
        if titles:
            return titles[0]
    
    return None

def extract_skills(text):
    """Extract skills from CV."""
    # Common skill patterns
    skill_patterns = [
        # Programming languages
        r'\b(?:Python|Java|JavaScript|TypeScript|C\+\+|C#|PHP|Ruby|Swift|Kotlin|Go|Rust|SQL|HTML|CSS|R|Matlab|Scala|Perl|Shell|Bash)\b',
        # Frameworks and libraries
        r'\b(?:React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Laravel|Rails|TensorFlow|PyTorch|Scikit-learn|Pandas)\b',
        # Tools and platforms
        r'\b(?:Git|Docker|Kubernetes|AWS|Azure|GCP|Jenkins|Jira|Confluence|Tableau|PowerBI|Excel|Word|PowerPoint|Photoshop|Illustrator)\b',
        # Soft skills (including Spanish)
        r'\b(?:Leadership|Communication|Teamwork|Problem-solving|Critical thinking|Time management|Project management|Agile|Scrum|Liderazgo|Comunicación|Trabajo en equipo|Resolución de problemas|Gestión de tiempo|Gestión de proyectos)\b',
        # Security related (given the CV content)
        r'\b(?:ISO 27001|ISO 27000|Information Security|Cybersecurity|Security|SOX|Seguridad Informática|Ciberseguridad)\b',
    ]
    
    skills = set()
    for pattern in skill_patterns:
        skill_matches = re.findall(pattern, text, re.IGNORECASE)
        skills.update(skill_matches)
    
    return list(skills) if skills else []

def extract_education(text):
    """Extract education information from CV."""
    education = []
    
    # Try to find the education section
    sections = identify_sections(text)
    education_section = sections.get('education', '')
    
    # If we have an education section, parse it
    if education_section:
        # Extract degree information from the education section
        degree_patterns = [
            r'(?:Bachelor|BA|BS|B\.A\.|B\.S\.|Licenciatura|Grado|Licenciado|Graduado)(?:\sof\s(?:Science|Arts|Business|Engineering)|(?:\sen\s[A-Za-z\s]+))?',
            r'(?:Master|MA|MS|M\.A\.|M\.S\.|MBA|M\.B\.A\.|Máster|Maestría)(?:\sof\s(?:Science|Arts|Business|Engineering)|(?:\sen\s[A-Za-z\s]+))?',
            r'(?:Doctor|PhD|Ph\.D\.|Doctorate|Doctorado)(?:\sof\s(?:Science|Arts|Philosophy|Engineering)|(?:\sen\s[A-Za-z\s]+))?',
        ]
        
        # Extract institution names
        institution_pattern = r'([A-Z][a-zA-Z\s&]+(?:University|College|School|Institute|Universidad|Escuela|Instituto))'
        
        # Split the education section into paragraphs
        paragraphs = re.split(r'\n\s*\n', education_section)
        
        for paragraph in paragraphs:
            if not paragraph.strip():
                continue
                
            # Try to extract degree, institution, date
            degree = None
            for pattern in degree_patterns:
                matches = re.findall(pattern, paragraph, re.IGNORECASE)
                if matches:
                    degree = matches[0]
                    break
                    
            institutions = re.findall(institution_pattern, paragraph)
            institution = institutions[0] if institutions else None
            
            # Look for dates
            dates = re.findall(r'(19|20)\d{2}\s*[-–—a]+\s*((?:19|20)\d{2}|[Pp]resent|[Cc]urrent|[Aa]ctual)', paragraph)
            date = f"{dates[0][0]}-{dates[0][1]}" if dates else None
            
            if degree or institution:
                education.append({
                    'degree': degree or "Unspecified Degree",
                    'institution': institution or "Unspecified Institution",
                    'date': date or "Unknown Date"
                })
    
    return education

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract text from PDF file with improved reliability')
    parser.add_argument('--file', help='PDF file path')
    parser.add_argument('--data', help='Base64-encoded PDF data')
    parser.add_argument('--output', help='Output file (if not specified, prints to stdout)')
    
    args = parser.parse_args()
    
    if not args.file and not args.data:
        print("Error: Either --file or --data must be specified", file=sys.stderr)
        sys.exit(1)
    
    try:
        print(f"Starting extraction from file: {args.file}" if args.file else "Starting extraction from base64 data")
        result = extract_from_pdf(pdf_path=args.file, pdf_data=args.data)
        
        if args.output:
            try:
                print(f"Writing output to: {args.output}")
                with open(args.output, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                print(f"Output successfully written to {args.output}")
            except Exception as e:
                print(f"Error writing output file: {str(e)}", file=sys.stderr)
                traceback_str = traceback.format_exc()
                print(traceback_str, file=sys.stderr)
                sys.exit(1)
        else:
            # Print as JSON to stdout
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        # Check if there was an error
        if "error" in result and result["error"]:
            print(f"WARNING: Extraction completed with error: {result['error']}", file=sys.stderr)
            sys.exit(1)
            
        sys.exit(0)
    except Exception as e:
        print(f"Critical error: {str(e)}", file=sys.stderr)
        traceback_str = traceback.format_exc()
        print(traceback_str, file=sys.stderr)
        sys.exit(1) 