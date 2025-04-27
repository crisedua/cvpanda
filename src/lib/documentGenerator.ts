import { jsPDF } from 'jspdf';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import type { CV, ProfileEnhancementResult } from '../types';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';

export async function generatePDF(cv: CV, language: 'original' | 'english' = 'original') {
  const data = language === 'english' ? cv.parsed_data_english : cv.parsed_data;
  if (!data) return null;

  const doc = new jsPDF();
  let yPos = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;

  // Helper function to add text and handle overflow
  const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    if (isBold) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');
    
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    doc.text(lines, margin, yPos);
    yPos += (lines.length * fontSize * 0.5) + 5;

    // Add new page if needed
    if (yPos > doc.internal.pageSize.height - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  // Personal Information
  if (data.personal) {
    addText(data.personal.name, 24, true);
    if (data.personal.title) addText(data.personal.title, 16);
    if (data.personal.email || data.personal.phone) {
      addText(`${data.personal.email || ''} ${data.personal.phone ? '| ' + data.personal.phone : ''}`, 10);
    }
    yPos += 10;
  }

  // Summary
  if (data.summary) {
    addText('Professional Summary', 16, true);
    addText(data.summary);
    yPos += 10;
  }

  // Experience
  if (data.experience?.length) {
    addText('Experience', 16, true);
    data.experience.forEach(exp => {
      addText(`${exp.position} at ${exp.company}`, 14, true);
      addText(`${exp.location || ''} ${exp.duration ? '| ' + exp.duration : ''}`, 10);
      if (exp.responsibilities) {
        exp.responsibilities.forEach(resp => addText(`• ${resp}`, 10));
      }
      if (exp.achievements) {
        addText('Key Achievements:', 10, true);
        exp.achievements.forEach(achievement => addText(`• ${achievement}`, 10));
      }
      yPos += 5;
    });
  }

  // Education
  if (data.education?.length) {
    addText('Education', 16, true);
    data.education.forEach(edu => {
      addText(`${edu.degree}`, 14, true);
      addText(`${edu.institution} | ${edu.year}`, 10);
      if (edu.honors) {
        edu.honors.forEach(honor => addText(`• ${honor}`, 10));
      }
      yPos += 5;
    });
  }

  // Skills
  if (data.skills) {
    addText('Skills & Expertise', 16, true);
    if (data.skills.technical?.length) {
      addText('Technical Skills:', 12, true);
      addText(data.skills.technical.join(', '), 10);
    }
    if (data.skills.soft?.length) {
      addText('Soft Skills:', 12, true);
      addText(data.skills.soft.join(', '), 10);
    }
    if (data.skills.industry?.length) {
      addText('Industry Knowledge:', 12, true);
      addText(data.skills.industry.join(', '), 10);
    }
  }

  return doc.save('cv.pdf');
}

export async function generateWord(cv: CV, language: 'original' | 'english' = 'original') {
  const data = language === 'english' ? cv.parsed_data_english : cv.parsed_data;
  if (!data) return null;

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Personal Information
        new Paragraph({
          children: [
            new TextRun({
              text: data.personal?.name || '',
              size: 32,
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: data.personal?.title || '',
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `${data.personal?.email || ''} ${data.personal?.phone ? '| ' + data.personal.phone : ''}`,
              size: 20,
            }),
          ],
          spacing: {
            after: 400,
          },
        }),

        // Summary
        ...(data.summary ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Professional Summary', bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.summary })],
            spacing: { after: 400 },
          }),
        ] : []),

        // Experience
        ...(data.experience?.length ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Experience', bold: true })],
          }),
          ...data.experience.flatMap(exp => [
            new Paragraph({
              children: [
                new TextRun({ text: `${exp.position} at ${exp.company}`, bold: true, size: 24 }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `${exp.location || ''} ${exp.duration ? '| ' + exp.duration : ''}` }),
              ],
              spacing: { after: 200 },
            }),
            ...(exp.responsibilities?.map(resp => 
              new Paragraph({
                children: [new TextRun({ text: `• ${resp}` })],
              })
            ) || []),
            ...(exp.achievements ? [
              new Paragraph({
                children: [new TextRun({ text: 'Key Achievements:', bold: true })],
              }),
              ...exp.achievements.map(achievement => 
                new Paragraph({
                  children: [new TextRun({ text: `• ${achievement}` })],
                })
              ),
            ] : []),
          ]),
        ] : []),

        // Education
        ...(data.education?.length ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Education', bold: true })],
            spacing: { before: 400 },
          }),
          ...data.education.flatMap(edu => [
            new Paragraph({
              children: [new TextRun({ text: edu.degree, bold: true, size: 24 })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `${edu.institution} | ${edu.year}` })],
            }),
            ...(edu.honors?.map(honor => 
              new Paragraph({
                children: [new TextRun({ text: `• ${honor}` })],
              })
            ) || []),
          ]),
        ] : []),

        // Skills
        ...(data.skills ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Skills & Expertise', bold: true })],
            spacing: { before: 400 },
          }),
          ...(data.skills.technical?.length ? [
            new Paragraph({
              children: [new TextRun({ text: 'Technical Skills:', bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: data.skills.technical.join(', ') })],
              spacing: { after: 200 },
            }),
          ] : []),
          ...(data.skills.soft?.length ? [
            new Paragraph({
              children: [new TextRun({ text: 'Soft Skills:', bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: data.skills.soft.join(', ') })],
              spacing: { after: 200 },
            }),
          ] : []),
          ...(data.skills.industry?.length ? [
            new Paragraph({
              children: [new TextRun({ text: 'Industry Knowledge:', bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: data.skills.industry.join(', ') })],
            }),
          ] : []),
        ] : []),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cv.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper function to strip HTML tags
function stripHtml(html: string | undefined | null): string {
  // If input is undefined or null, return an empty string
  if (html === undefined || html === null) {
    return '';
  }
  
  // Handle non-string inputs
  if (typeof html !== 'string') {
    try {
      // Try to convert to string if possible
      if (typeof html === 'object') {
        return JSON.stringify(html);
      }
      return String(html);
    } catch (error) {
      console.error('Error converting HTML to string:', error);
      return '';
    }
  }
  
  try {
    // Replace HTML tags with nothing, and common entities with their characters
    return html
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  } catch (error) {
    console.error('Error stripping HTML:', error);
    return html; // Return the original if replace fails
  }
}

// Improved PDF generation for enhanced profile
export const generateEnhancementPDF = async (
  enhancementResult: ProfileEnhancementResult,
  targetPlatform: string,
  jobTitle: string
): Promise<void> => {
  try {
    // Validate input parameters
    if (!enhancementResult) {
      throw new Error('Enhancement result is required');
    }
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add fonts
    doc.setFont('helvetica', 'normal');
    
    // Set up page margins and dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Add title and subheader
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text('Currículum Optimizado', pageWidth / 2, margin, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139); // Slate gray
    const safeJobTitle = typeof jobTitle === 'string' && jobTitle.trim() ? jobTitle : 'Profesional';
    doc.text(`Para: ${safeJobTitle}`, pageWidth / 2, margin + 8, { align: 'center' });
    
    // Add horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, margin + 12, pageWidth - margin, margin + 12);
    
    let yPosition = margin + 20;
    
    // Define section variables at the top level to ensure they're available throughout the function
    let summarySection = null;
    let experienceSection = null;
    let educationSection = null;
    
    // Personal Information Section - Improved with additional safeguards
    const personalInfo = enhancementResult.personalInfo || enhancementResult.cvData || {};
    
    if (personalInfo && typeof personalInfo === 'object' && Object.keys(personalInfo).length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Información Personal', margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      // Add name if available, with explicit string conversion
      if (personalInfo.name) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Nombre: `, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(String(personalInfo.name), margin + 15, yPosition);
        yPosition += 5;
      }
      
      // Add contact information if available, with explicit string conversion
      if (personalInfo.email) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Email: `, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(String(personalInfo.email), margin + 15, yPosition);
        yPosition += 5;
      }
      
      if (personalInfo.phone) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Teléfono: `, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(String(personalInfo.phone), margin + 15, yPosition);
        yPosition += 5;
      }
      
      if (personalInfo.location) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Ubicación: `, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(String(personalInfo.location), margin + 15, yPosition);
        yPosition += 5;
      }
      
      // Add links if available, with explicit string conversion
      if (personalInfo.linkedin_url) {
        doc.setFont('helvetica', 'bold');
        doc.text(`LinkedIn: `, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(String(personalInfo.linkedin_url), margin + 15, yPosition);
        yPosition += 5;
      }
      
      if (personalInfo.github_url) {
        doc.setFont('helvetica', 'bold');
        doc.text(`GitHub: `, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(String(personalInfo.github_url), margin + 15, yPosition);
        yPosition += 5;
      }
      
      if (personalInfo.website_url) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Sitio Web: `, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(String(personalInfo.website_url), margin + 15, yPosition);
        yPosition += 5;
      }
      
      yPosition += 5; // Add some spacing after personal info
    }
    
    // Profile Summary Section with improved error handling
    try {
      summarySection = enhancementResult.sectionEnhancements?.find(section => 
        section && section.section && typeof section.section === 'string' && (
          section.section.toLowerCase().includes('summary') || 
          section.section.toLowerCase().includes('perfil') || 
          section.section.toLowerCase().includes('resumen')
        )
      );
      
      // First try enhanced content, then fall back to full text if available
      const hasSummaryContent = summarySection?.enhancedContent || enhancementResult.fullEnhancedCvText;
      
      if (hasSummaryContent) {
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175); // Indigo
        doc.text('Perfil Profesional', margin, yPosition);
        yPosition += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        
        // Try the summary section first, fall back to a portion of the full text
        let summaryText = '';
        if (summarySection?.enhancedContent) {
          summaryText = stripHtml(summarySection.enhancedContent);
        } else if (enhancementResult.fullEnhancedCvText) {
          // Use just the beginning of the full text as a summary
          summaryText = stripHtml(enhancementResult.fullEnhancedCvText).substring(0, 500) + '...';
        }
        
        if (summaryText) {
          const splitSummary = doc.splitTextToSize(summaryText, contentWidth);
          doc.text(splitSummary, margin, yPosition);
          yPosition += splitSummary.length * 5 + 8;
        }
      }
    } catch (error) {
      console.error('Error processing summary section:', error);
      // Continue with other sections
    }
    
    // Skills Section with improved error handling
    try {
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Habilidades Clave', margin, yPosition);
      yPosition += 6;
      
      // Safe helper function to determine if an array actually has items
      const hasValidItems = (arr: any): boolean => {
        return Array.isArray(arr) && arr.length > 0 && arr.some(item => item != null);
      };
      
      // Try to use keyword analysis first, fall back to CV skills
      if (hasValidItems(enhancementResult.keywordAnalysis)) {
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        
        // Create skill pill boxes
        const skillsPerRow = 3;
        const skillPillWidth = contentWidth / skillsPerRow - 5;
        const skillPillHeight = 8;
        
        let validKeywords = 0;
        for (let i = 0; i < enhancementResult.keywordAnalysis.length; i++) {
          const keyword = enhancementResult.keywordAnalysis[i];
          // Skip invalid keywords
          if (!keyword || (typeof keyword === 'object' && !keyword.keyword)) continue;
          
          // Extract the keyword text safely
          let keywordText = '';
          if (typeof keyword === 'string') {
            keywordText = keyword;
          } else if (typeof keyword === 'object' && keyword.keyword) {
            keywordText = String(keyword.keyword);
          } else {
            continue; // Skip this item if we can't determine the keyword
          }
          
          const rowIndex = Math.floor(validKeywords / skillsPerRow);
          const colIndex = validKeywords % skillsPerRow;
          const xPos = margin + (colIndex * (skillPillWidth + 5));
          const yPos = yPosition + (rowIndex * (skillPillHeight + 4));
          
          // Draw skill pill
          doc.setFillColor(240, 249, 255); // Light blue background
          doc.setDrawColor(210, 227, 252); // Blue border
          doc.roundedRect(xPos, yPos, skillPillWidth, skillPillHeight, 2, 2, 'FD');
          
          // Add skill text
          doc.setTextColor(30, 64, 175); // Indigo
          doc.text(keywordText, xPos + skillPillWidth / 2, yPos + skillPillHeight - 2, { align: 'center' });
          
          validKeywords++;
        }
        
        // Update y position after skills
        const skillRows = Math.ceil(validKeywords / skillsPerRow);
        yPosition += (skillRows * (skillPillHeight + 4)) + 8;
      } else if (hasValidItems(enhancementResult.cvData?.skills)) {
        // Fallback to original CV skills if no keyword analysis is available
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        
        // Create skill pill boxes
        const skillsPerRow = 3;
        const skillPillWidth = contentWidth / skillsPerRow - 5;
        const skillPillHeight = 8;
        
        let validSkills = 0;
        for (let i = 0; i < enhancementResult.cvData.skills.length; i++) {
          const skill = enhancementResult.cvData.skills[i];
          // Skip empty skills
          if (!skill) continue;
          
          const rowIndex = Math.floor(validSkills / skillsPerRow);
          const colIndex = validSkills % skillsPerRow;
          const xPos = margin + (colIndex * (skillPillWidth + 5));
          const yPos = yPosition + (rowIndex * (skillPillHeight + 4));
          
          // Draw skill pill
          doc.setFillColor(240, 249, 255); // Light blue background
          doc.setDrawColor(210, 227, 252); // Blue border
          doc.roundedRect(xPos, yPos, skillPillWidth, skillPillHeight, 2, 2, 'FD');
          
          // Add skill text
          doc.setTextColor(30, 64, 175); // Indigo
          doc.text(String(skill), xPos + skillPillWidth / 2, yPos + skillPillHeight - 2, { align: 'center' });
          
          validSkills++;
        }
        
        // Update y position after skills
        const skillRows = Math.ceil(validSkills / skillsPerRow);
        yPosition += (skillRows * (skillPillHeight + 4)) + 8;
      } else {
        // If no skills are available, add a message
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("No se encontraron habilidades específicas", margin, yPosition);
        yPosition += 10;
      }
    } catch (error) {
      console.error('Error processing skills section:', error);
      // Continue with other sections
    }
    
    // Experience Section
    experienceSection = enhancementResult.sectionEnhancements?.find(section => 
      section?.section?.toLowerCase?.()?.includes('experience') || 
      section?.section?.toLowerCase?.()?.includes('experiencia')
    );
    
    // Check if we have work experience data
    const hasWorkExperience = experienceSection?.enhancedContent || 
                            (enhancementResult.cvData?.work_experience && 
                             enhancementResult.cvData.work_experience.length > 0);
    
    if (hasWorkExperience) {
      // Add new page if there's not enough space
      if (yPosition > pageHeight - 100) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Experiencia Profesional', margin, yPosition);
      yPosition += 6;
      
      // First try to use enhanced content if available
      if (experienceSection?.enhancedContent) {
        // Try to extract individual job positions if they exist in the fullEnhancedCvText
        const hasFullText = enhancementResult.fullEnhancedCvText && typeof enhancementResult.fullEnhancedCvText === 'string';
        const containsJobKeywords = hasFullText && (
          enhancementResult.fullEnhancedCvText.includes("CIO") || 
          enhancementResult.fullEnhancedCvText.includes("Executive") ||
          enhancementResult.fullEnhancedCvText.includes("Manager")
        );
        
        if (hasFullText && containsJobKeywords) {
          try {
            // First, create an array of possible job positions by looking for patterns
            const experienceText = String(enhancementResult.fullEnhancedCvText || '');
            
            // Match patterns like "Position at Company (Date - Date)"
            const jobMatches = experienceText.match(/([A-Za-z\s,]+)(at|,)\s([A-Za-z\s,\.]+)(\(|\s)([0-9]{4}\s*[-–]\s*(?:[0-9]{4}|Present|\d{4}))/gi);
            
            if (jobMatches && jobMatches.length > 0) {
              for (let i = 0; i < jobMatches.length; i++) {
                const jobText = jobMatches[i];
                
                // Extract job components
                const titleMatch = jobText.match(/^([^,]+)(,|\sat)/i);
                const companyMatch = jobText.match(/(at|,)\s([^(]+)/i);
                const dateMatch = jobText.match(/([0-9]{4}\s*[-–]\s*(?:[0-9]{4}|Present|\d{4}))/i);
                
                const title = titleMatch ? titleMatch[1].trim() : '';
                const company = companyMatch ? companyMatch[2].trim() : '';
                const dates = dateMatch ? dateMatch[1].trim() : '';
                
                // Add job position details
                doc.setFontSize(11);
                doc.setTextColor(40, 40, 40);
                doc.setFont('helvetica', 'bold');
                doc.text(title || 'Position', margin, yPosition);
                
                // Add company alongside the title, aligned right
                doc.setFont('helvetica', 'normal');
                const titleWidth = doc.getTextWidth(title || 'Position');
                doc.text(company || 'Company', margin + titleWidth + 2, yPosition);
                
                yPosition += 5;
                
                // Add dates
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text(dates || '', margin, yPosition);
                yPosition += 7;
                
                // If we've covered multiple positions, add a small divider
                if (i < jobMatches.length - 1) {
                  doc.setDrawColor(220, 220, 220);
                  doc.line(margin, yPosition - 2, margin + 40, yPosition - 2);
                  yPosition += 5;
                }
              }
            } else {
              // If no job positions found, fall back to using the raw enhanced content
              doc.setFontSize(10);
              doc.setTextColor(60, 60, 60);
              const experienceText = stripHtml(experienceSection.enhancedContent);
              const splitExperience = doc.splitTextToSize(experienceText, contentWidth);
              doc.text(splitExperience, margin, yPosition);
              yPosition += splitExperience.length * 5 + 8;
            }
          } catch (err) {
            // On any error parsing the experience, fall back to raw content
            console.error("Error parsing experience details:", err);
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            
            try {
              const experienceText = stripHtml(experienceSection.enhancedContent);
              const splitExperience = doc.splitTextToSize(experienceText, contentWidth);
              doc.text(splitExperience, margin, yPosition);
              yPosition += splitExperience.length * 5 + 8;
            } catch (textError) {
              console.error("Error processing experience text:", textError);
              // Fall back to original CV data if enhanced content fails
              fallbackToOriginalWorkExperience();
            }
          }
        } else {
          // Fall back to using the raw enhanced content if no detailed positions found
          try {
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            // Ensure we're working with a string
            let experienceText;
            if (typeof experienceSection.enhancedContent === 'object') {
              // If it's an object, try to extract meaningful properties
              const obj = experienceSection.enhancedContent as any;
              const parts = [];
              if (obj.title) parts.push(`${obj.title}`);
              if (obj.company) parts.push(`at ${obj.company}`);
              if (obj.dates) parts.push(`(${obj.dates})`);
              if (obj.description) parts.push(`\n${obj.description}`);
              experienceText = parts.join(' ') || JSON.stringify(obj, null, 2);
            } else {
              experienceText = stripHtml(experienceSection.enhancedContent);
            }
            
            const splitExperience = doc.splitTextToSize(experienceText, contentWidth);
            doc.text(splitExperience, margin, yPosition);
            yPosition += splitExperience.length * 5 + 8;
          } catch (error) {
            console.error("Error processing experience text:", error);
            // Fall back to original CV data if enhanced content fails
            fallbackToOriginalWorkExperience();
          }
        }
      } else {
        // If no enhanced content, use original CV data
        fallbackToOriginalWorkExperience();
      }
      
      // Helper function to use original work experience data
      function fallbackToOriginalWorkExperience() {
        if (enhancementResult.cvData?.work_experience && enhancementResult.cvData.work_experience.length > 0) {
          enhancementResult.cvData.work_experience.forEach((exp, index) => {
            // Add job position details
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text(exp.title || 'Position', margin, yPosition);
            
            // Add company on the next line
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
            doc.text(`${exp.company || 'Company'}`, margin, yPosition);
            
            // Add dates
            yPosition += 5;
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(exp.dates || '', margin, yPosition);
            
            // Add description if available
            if (exp.description) {
              yPosition += 5;
              doc.setFontSize(10);
              doc.setTextColor(60, 60, 60);
              const splitDescription = doc.splitTextToSize(exp.description, contentWidth);
              doc.text(splitDescription, margin, yPosition);
              yPosition += splitDescription.length * 5;
            }
            
            // Add spacing and divider between jobs
            if (index < enhancementResult.cvData.work_experience.length - 1) {
              yPosition += 5;
              doc.setDrawColor(220, 220, 220);
              doc.line(margin, yPosition, margin + 40, yPosition);
              yPosition += 8;
            } else {
              yPosition += 8;
            }
          });
        }
      }
    }
    
    // Education Section
    educationSection = enhancementResult.sectionEnhancements?.find(section => 
      section?.section?.toLowerCase?.()?.includes('education') || 
      section?.section?.toLowerCase?.()?.includes('educación') ||
      section?.section?.toLowerCase?.()?.includes('formación')
    );
    
    // Check if we have education data
    const hasEducation = educationSection?.enhancedContent || 
                      (enhancementResult.cvData?.education && 
                       enhancementResult.cvData.education.length > 0);
    
    if (hasEducation) {
      // Add new page if there's not enough space
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Educación', margin, yPosition);
      yPosition += 6;
      
      // First try to use enhanced content if available
      if (educationSection?.enhancedContent) {
        // Try to extract individual education entries if they exist in the fullEnhancedCvText
        if (enhancementResult.fullEnhancedCvText && 
            (enhancementResult.fullEnhancedCvText.includes("Master") || 
             enhancementResult.fullEnhancedCvText.includes("Bachelor") ||
             enhancementResult.fullEnhancedCvText.includes("Degree") ||
             enhancementResult.fullEnhancedCvText.includes("Universidad"))) {
          
          try {
            // Try to extract degrees and institutions
            const educationText = enhancementResult.fullEnhancedCvText || '';
            
            // Look for degree patterns
            const degreeMatches = educationText.match(/([A-Za-z\']+(?:\s+[A-Za-z\']+)*\s+(?:Degree|in|Bachelor|Master|Engineer|Diploma|Certificate))(?:\s+in\s+|\s+)([A-Za-z\s,]+)(?:[,]\s+|\s+at\s+|\s+-)?\s+([A-Za-z\s]+University|[A-Za-z\s]+Institute|[A-Za-z\s]+College|Universidad\s+[A-Za-z\s]+)(?:\s+\(|\s+|\()([0-9]{4})/gi);
            
            if (degreeMatches && degreeMatches.length > 0) {
              for (const degreeText of degreeMatches) {
                // Extract degree components (approximate - this is complex pattern matching)
                const degree = degreeText.match(/[A-Za-z\']+(?:\s+[A-Za-z\']+)*\s+(?:Degree|in|Bachelor|Master|Engineer|Diploma|Certificate)(?:\s+in\s+|\s+)[A-Za-z\s,]+/i)?.[0] || '';
                const institution = degreeText.match(/([A-Za-z\s]+University|[A-Za-z\s]+Institute|[A-Za-z\s]+College|Universidad\s+[A-Za-z\s]+)/i)?.[0] || '';
                const year = degreeText.match(/([0-9]{4})/)?.[0] || '';
                
                // Add education details
                doc.setFontSize(11);
                doc.setTextColor(40, 40, 40);
                doc.setFont('helvetica', 'bold');
                doc.text(degree.trim() || 'Degree', margin, yPosition);
                yPosition += 5;
                
                // Add institution
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(institution.trim() || 'Institution', margin, yPosition);
                
                // Add year on the same line, aligned right
                if (year) {
                  doc.text(year, pageWidth - margin, yPosition, { align: 'right' });
                }
                
                yPosition += 8;
              }
            } else {
              // Fall back to raw content
              doc.setFontSize(10);
              doc.setTextColor(60, 60, 60);
              const educationText = stripHtml(educationSection.enhancedContent);
              const splitEducation = doc.splitTextToSize(educationText, contentWidth);
              doc.text(splitEducation, margin, yPosition);
              yPosition += splitEducation.length * 5 + 8;
            }
          } catch (err) {
            // On any error parsing education details, fall back to raw content
            console.error("Error parsing education details:", err);
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            const educationText = stripHtml(educationSection.enhancedContent);
            const splitEducation = doc.splitTextToSize(educationText, contentWidth);
            doc.text(splitEducation, margin, yPosition);
            yPosition += splitEducation.length * 5 + 8;
          }
        } else {
          // Fall back to using the raw enhanced content
          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          
          // Ensure we're working with a string
          let educationText;
          if (typeof educationSection.enhancedContent === 'object') {
            // If it's an object, try to extract meaningful properties
            const obj = educationSection.enhancedContent as any;
            const parts = [];
            if (obj.degree) parts.push(`${obj.degree}`);
            if (obj.institution) parts.push(`at ${obj.institution}`);
            if (obj.dates) parts.push(`(${obj.dates})`);
            educationText = parts.join(' ') || JSON.stringify(obj, null, 2);
          } else {
            educationText = stripHtml(educationSection.enhancedContent);
          }
          
          const splitEducation = doc.splitTextToSize(educationText, contentWidth);
          doc.text(splitEducation, margin, yPosition);
          yPosition += splitEducation.length * 5 + 8;
        }
      } else {
        // If no enhanced content, use original CV data
        if (enhancementResult.cvData?.education && enhancementResult.cvData.education.length > 0) {
          enhancementResult.cvData.education.forEach((edu, index) => {
            // Add education details
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text(edu.degree || 'Degree', margin, yPosition);
            
            // Add institution on the next line
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
            doc.text(`${edu.institution || 'Institution'}`, margin, yPosition);
            
            // Add dates aligned right
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            if (edu.dates) {
              doc.text(edu.dates, pageWidth - margin, yPosition, { align: 'right' });
            }
            
            // Add spacing and divider between education entries
            if (index < enhancementResult.cvData.education.length - 1) {
              yPosition += 5;
              doc.setDrawColor(220, 220, 220);
              doc.line(margin, yPosition, margin + 40, yPosition);
              yPosition += 8;
            } else {
              yPosition += 8;
            }
          });
        }
      }
    }
    
    // Certifications Section
    const certificationsSection = enhancementResult.sectionEnhancements?.find(section => 
      section?.section?.toLowerCase?.()?.includes('certif')
    );
    
    if (certificationsSection?.enhancedContent) {
      // Add new page if there's not enough space
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Certificaciones', margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      // Handle HTML content - strip tags and create paragraphs
      const certificationsText = stripHtml(certificationsSection.enhancedContent);
      const splitCertifications = doc.splitTextToSize(certificationsText, contentWidth);
      doc.text(splitCertifications, margin, yPosition);
      yPosition += splitCertifications.length * 5 + 8;
    }
    
    // Languages Section - New Addition
    const languagesSection = enhancementResult.sectionEnhancements?.find(section => 
      section?.section?.toLowerCase?.()?.includes('language') || 
      section?.section?.toLowerCase?.()?.includes('idioma')
    );
    
    if (languagesSection?.enhancedContent) {
      // Add new page if there's not enough space
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Idiomas', margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      // Handle HTML content - strip tags and create paragraphs
      const languagesText = stripHtml(languagesSection.enhancedContent);
      const splitLanguages = doc.splitTextToSize(languagesText, contentWidth);
      doc.text(splitLanguages, margin, yPosition);
      yPosition += splitLanguages.length * 5 + 8;
    }
    
    // Projects Section - New Addition
    const projectsSection = enhancementResult.sectionEnhancements?.find(section => 
      section?.section?.toLowerCase?.()?.includes('project') || 
      section?.section?.toLowerCase?.()?.includes('proyecto')
    );
    
    if (projectsSection?.enhancedContent) {
      // Add new page if there's not enough space
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Proyectos', margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      // Handle HTML content - strip tags and create paragraphs
      const projectsText = stripHtml(projectsSection.enhancedContent);
      const splitProjects = doc.splitTextToSize(projectsText, contentWidth);
      doc.text(splitProjects, margin, yPosition);
      yPosition += splitProjects.length * 5 + 8;
    }
    
    // References Section - New Addition
    const referencesSection = enhancementResult.sectionEnhancements?.find(section => 
      section?.section?.toLowerCase?.()?.includes('reference') || 
      section?.section?.toLowerCase?.()?.includes('referencia')
    );
    
    if (referencesSection?.enhancedContent) {
      // Add new page if there's not enough space
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Referencias', margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      // Handle HTML content - strip tags and create paragraphs
      const referencesText = stripHtml(referencesSection.enhancedContent);
      const splitReferences = doc.splitTextToSize(referencesText, contentWidth);
      doc.text(splitReferences, margin, yPosition);
      yPosition += splitReferences.length * 5 + 8;
    }
    
    // Add any other sections from enhancement result
    if (enhancementResult.sectionEnhancements && Array.isArray(enhancementResult.sectionEnhancements)) {
      const processedSections = ['summary', 'profile', 'resumen', 'perfil', 'experience', 'experiencia', 
                                'education', 'educación', 'formación', 'certif', 'language', 'idioma', 
                                'project', 'proyecto', 'reference', 'referencia'];
      
      enhancementResult.sectionEnhancements.forEach(section => {
        if (!section?.section) return;
        
        // Skip sections we've already processed
        const sectionLower = section.section.toLowerCase();
        if (processedSections.some(ps => sectionLower.includes(ps))) return;
        
        // Add new page if there's not enough space
        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = margin;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175); // Indigo
        doc.text(section.section, margin, yPosition);
        yPosition += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        
        // Handle HTML content - strip tags and create paragraphs
        const sectionText = stripHtml(section.enhancedContent);
        const splitSection = doc.splitTextToSize(sectionText, contentWidth);
        doc.text(splitSection, margin, yPosition);
        yPosition += splitSection.length * 5 + 8;
      });
    }
    
    // Use fullEnhancedCvText as a fallback if no sections were found
    if (!summarySection?.enhancedContent && 
        !experienceSection?.enhancedContent && 
        !educationSection?.enhancedContent && 
        enhancementResult.fullEnhancedCvText) {
      
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175); // Indigo
      doc.text('Currículum Vitae Completo', margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      const fullText = stripHtml(enhancementResult.fullEnhancedCvText);
      const splitFullText = doc.splitTextToSize(fullText, contentWidth);
      doc.text(splitFullText, margin, yPosition);
    }
    
    // Add footer with date
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const date = new Date().toLocaleDateString();
    doc.text(`Generado: ${date}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    
    // Save the PDF
    doc.save(`CV_Optimizado_${jobTitle.replace(/\s+/g, '_')}.pdf`);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

// Generate PDF from CV data
export const generateCVPDF = async (cv: CV): Promise<void> => {
  try {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Currículum Vitae', 105, 15, { align: 'center' });
    
    // Add personal info
    if (cv.parsed_data) {
      doc.setFontSize(16);
      doc.text(cv.parsed_data.name || 'Name not found', 105, 25, { align: 'center' });
      
      doc.setFontSize(10);
      const contactInfo = [
        cv.parsed_data.email,
        cv.parsed_data.phone,
        cv.parsed_data.location
      ].filter(Boolean).join(' | ');
      
      doc.text(contactInfo, 105, 30, { align: 'center' });
      
      // Add summary if available
      if (cv.parsed_data.summary) {
        doc.setFontSize(12);
        doc.text('Resumen Profesional', 20, 40);
        doc.setFontSize(10);
        
        const splitSummary = doc.splitTextToSize(cv.parsed_data.summary, 170);
        doc.text(splitSummary, 20, 45);
      }
      
      let yPosition = 50 + (cv.parsed_data.summary ? 15 : 0);
      
      // Add skills
      if (cv.parsed_data.skills && cv.parsed_data.skills.length > 0) {
        doc.setFontSize(12);
        doc.text('Habilidades', 20, yPosition);
        doc.setFontSize(10);
        
        const skillsText = cv.parsed_data.skills.join(', ');
        const splitSkills = doc.splitTextToSize(skillsText, 170);
        doc.text(splitSkills, 20, yPosition + 5);
        
        yPosition += 10 + splitSkills.length * 5;
      }
      
      // Add work experience
      if (cv.parsed_data.work_experience && cv.parsed_data.work_experience.length > 0) {
        doc.setFontSize(12);
        doc.text('Experiencia Laboral', 20, yPosition);
        
        // Add a new page if needed
        if (yPosition > 220) {
          doc.addPage();
          yPosition = 20;
        } else {
          yPosition += 5;
        }
        
        // Add each work experience
        cv.parsed_data.work_experience.forEach((experience, index) => {
          if (yPosition > 260) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFontSize(11);
          doc.text(`${experience.title || 'Position'} at ${experience.company || 'Company'}`, 20, yPosition + 5);
          
          doc.setFontSize(10);
          doc.text(experience.dates || '', 20, yPosition + 10);
          
          if (experience.description) {
            const splitDescription = doc.splitTextToSize(experience.description, 170);
            doc.text(splitDescription, 20, yPosition + 15);
            yPosition += 20 + splitDescription.length * 5;
          } else {
            yPosition += 15;
          }
        });
      }
      
      // Add education
      if (cv.parsed_data.education && cv.parsed_data.education.length > 0) {
        if (yPosition > 220) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(12);
        doc.text('Educación', 20, yPosition);
        yPosition += 5;
        
        // Add each education entry
        cv.parsed_data.education.forEach((education, index) => {
          if (yPosition > 260) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFontSize(11);
          doc.text(`${education.degree || 'Degree'} - ${education.institution || 'Institution'}`, 20, yPosition + 5);
          
          doc.setFontSize(10);
          doc.text(education.dates || '', 20, yPosition + 10);
          
          yPosition += 15;
        });
      }
    }
    
    // Save the PDF
    doc.save(`${cv.filename || 'cv'}.pdf`);
    
  } catch (error) {
    console.error('Error generating CV PDF:', error);
    throw error;
  }
};