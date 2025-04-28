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
    
    // Add fonts - use default fonts for compatibility
    doc.setFont('helvetica', 'normal');
    
    // Set up page margins and dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15; // Reduced margin for more content space
    const contentWidth = pageWidth - (margin * 2);
    
    // Define professional color scheme
    const colors = {
      primary: [41, 65, 148], // Dark blue
      secondary: [59, 130, 246], // Medium blue
      accent: [100, 116, 139], // Slate
      dark: [40, 40, 40], // Near black
      light: [250, 250, 250], // Near white
      lightGray: [240, 240, 240], // Light gray for backgrounds
      mediumGray: [180, 180, 180] // Medium gray for dividers
    };
    
    // Define section variables at the top level to ensure they're available throughout the function
    let summarySection = null;
    let experienceSection = null;
    let educationSection = null;
    
    // Add professional header
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 10, 'F');
    
    // Add title with nicer typography
    doc.setFontSize(16);
    doc.setTextColor(...colors.dark);
    doc.setFont('helvetica', 'bold');
    doc.text(targetPlatform === 'linkedin' ? 'Perfil Profesional Optimizado' : 'Currículum Vitae Profesional', margin, margin + 5);
    
    // Add subtitle with job target
    doc.setFontSize(11);
    doc.setTextColor(...colors.accent);
    doc.setFont('helvetica', 'normal');
    const safeJobTitle = typeof jobTitle === 'string' && jobTitle.trim() ? jobTitle : 'Profesional';
    doc.text(`Optimizado para: ${safeJobTitle}`, margin, margin + 12);
    
    // Add horizontal divider
    doc.setDrawColor(...colors.mediumGray);
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 15, pageWidth - margin, margin + 15);
    
    let yPosition = margin + 22;
    
    // Personal Information Section with improved layout
    const personalInfo = enhancementResult.personalInfo || enhancementResult.cvData || {};
    
    if (personalInfo && typeof personalInfo === 'object' && Object.keys(personalInfo).length > 0) {
      // Create a clean personal info header
      doc.setFillColor(...colors.lightGray);
      doc.roundedRect(margin, yPosition - 5, contentWidth, 25 + (personalInfo.name ? 5 : 0) + 
        (personalInfo.email ? 5 : 0) + (personalInfo.phone ? 5 : 0) + 
        (personalInfo.location ? 5 : 0), 3, 3, 'F');
      
      // Name with larger font
      if (personalInfo.name) {
        doc.setFontSize(14);
        doc.setTextColor(...colors.primary);
        doc.setFont('helvetica', 'bold');
        doc.text(String(personalInfo.name), margin + 5, yPosition + 5);
        yPosition += 8;
      }
      
      // Contact details in a more compact format
      doc.setFontSize(9);
      doc.setTextColor(...colors.dark);
      doc.setFont('helvetica', 'normal');
      
      let contactLine = '';
      if (personalInfo.email) contactLine += `Email: ${personalInfo.email}`;
      if (personalInfo.phone) contactLine += contactLine ? '  |  ' : '';
      if (personalInfo.phone) contactLine += `Tel: ${personalInfo.phone}`;
      if (personalInfo.location) contactLine += contactLine ? '  |  ' : '';
      if (personalInfo.location) contactLine += `${personalInfo.location}`;
      
      if (contactLine) {
        doc.text(contactLine, margin + 5, yPosition + 2);
        yPosition += 6;
      }
      
      // Professional links
      let linksLine = '';
      if (personalInfo.linkedin_url) linksLine += `LinkedIn: ${personalInfo.linkedin_url}`;
      if (personalInfo.github_url) linksLine += linksLine ? '  |  ' : '';
      if (personalInfo.github_url) linksLine += `GitHub: ${personalInfo.github_url}`;
      if (personalInfo.website_url) linksLine += linksLine ? '  |  ' : '';
      if (personalInfo.website_url) linksLine += `Web: ${personalInfo.website_url}`;
      
      if (linksLine) {
        doc.text(linksLine, margin + 5, yPosition + 2);
        yPosition += 6;
      }
      
      yPosition += 10; // Space after personal info section
    }
    
    // Profile Summary Section with improved styling
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
        // Section heading with accent bar
        doc.setFillColor(...colors.primary);
        doc.rect(margin, yPosition, 8, 1, 'F');
        
        doc.setFontSize(14);
        doc.setTextColor(...colors.primary);
        doc.setFont('helvetica', 'bold');
        doc.text('Perfil Profesional', margin, yPosition + 6);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(...colors.dark);
        doc.setFont('helvetica', 'normal');
        
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
    
    // Skills Section with improved visual presentation
    try {
      // Section heading with accent bar
      doc.setFillColor(...colors.primary);
      doc.rect(margin, yPosition, 8, 1, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text('Habilidades Clave', margin, yPosition + 6);
      yPosition += 10;
      
      // Safe helper function to determine if an array actually has items
      const hasValidItems = (arr: any): boolean => {
        return Array.isArray(arr) && arr.length > 0 && arr.some(item => item != null);
      };
      
      // Try to use keyword analysis first, fall back to CV skills
      if (hasValidItems(enhancementResult.keywordAnalysis)) {
        doc.setFontSize(9);
        
        // Create skill pill boxes in a more attractive grid
        const skillsPerRow = 3;
        const skillPillWidth = contentWidth / skillsPerRow - 6;
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
          const xPos = margin + (colIndex * (skillPillWidth + 6));
          const yPos = yPosition + (rowIndex * (skillPillHeight + 4));
          
          // Draw skill pill with gradient effect
          doc.setFillColor(240, 249, 255); // Light blue background
          doc.setDrawColor(...colors.secondary);
          doc.roundedRect(xPos, yPos, skillPillWidth, skillPillHeight, 3, 3, 'FD');
          
          // Add skill text
          doc.setTextColor(...colors.primary);
          doc.text(keywordText, xPos + skillPillWidth / 2, yPos + skillPillHeight - 2, { align: 'center' });
          
          validKeywords++;
        }
        
        // Update y position after skills
        const skillRows = Math.ceil(validKeywords / skillsPerRow);
        yPosition += (skillRows * (skillPillHeight + 4)) + 8;
      } else if (hasValidItems(enhancementResult.cvData?.skills)) {
        // Fallback to original CV skills if no keyword analysis is available
        // Similar styling as above
        doc.setFontSize(9);
        
        // Create skill pill boxes
        const skillsPerRow = 3;
        const skillPillWidth = contentWidth / skillsPerRow - 6;
        const skillPillHeight = 8;
        
        let validSkills = 0;
        for (let i = 0; i < enhancementResult.cvData.skills.length; i++) {
          const skill = enhancementResult.cvData.skills[i];
          // Skip empty skills
          if (!skill) continue;
          
          const rowIndex = Math.floor(validSkills / skillsPerRow);
          const colIndex = validSkills % skillsPerRow;
          const xPos = margin + (colIndex * (skillPillWidth + 6));
          const yPos = yPosition + (rowIndex * (skillPillHeight + 4));
          
          // Draw skill pill
          doc.setFillColor(240, 249, 255); // Light blue background
          doc.setDrawColor(...colors.secondary);
          doc.roundedRect(xPos, yPos, skillPillWidth, skillPillHeight, 3, 3, 'FD');
          
          // Add skill text
          doc.setTextColor(...colors.primary);
          doc.text(String(skill), xPos + skillPillWidth / 2, yPos + skillPillHeight - 2, { align: 'center' });
          
          validSkills++;
        }
        
        // Update y position after skills
        const skillRows = Math.ceil(validSkills / skillsPerRow);
        yPosition += (skillRows * (skillPillHeight + 4)) + 8;
      } else {
        // If no skills are available, add a message
        doc.setFontSize(10);
        doc.setTextColor(...colors.accent);
        doc.text("No se encontraron habilidades específicas", margin, yPosition);
        yPosition += 10;
      }
    } catch (error) {
      console.error('Error processing skills section:', error);
      // Continue with other sections
    }
    
    // Experience Section with improved formatting
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
      
      // Section heading with accent bar
      doc.setFillColor(...colors.primary);
      doc.rect(margin, yPosition, 8, 1, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text('Experiencia Profesional', margin, yPosition + 6);
      yPosition += 10;
      
      // First try to use enhanced content if available
      if (experienceSection?.enhancedContent) {
        try {
          // Try to parse experience text to extract structured data
          const experienceText = stripHtml(experienceSection.enhancedContent);
          
          // Check if the content appears to be JSON
          if (experienceText.includes('"title":') && experienceText.includes('"company":')) {
            try {
              // Try to parse it as JSON
              const expEntries = JSON.parse(experienceText.replace(/'/g, '"'));
              if (Array.isArray(expEntries)) {
                expEntries.forEach((exp, index) => {
                  // Format each job with professional styling
                  const title = exp.title || 'Position';
                  const company = exp.company || 'Company';
                  const dates = exp.dates || '';
                  const description = exp.description || '';
                  
                  // Add job title and company
                  doc.setFontSize(11);
                  doc.setTextColor(...colors.dark);
                  doc.setFont('helvetica', 'bold');
                  doc.text(title, margin, yPosition);
                  
                  // Company and dates on the same line
                  doc.setFontSize(10);
                  doc.setFont('helvetica', 'normal');
                  doc.text(company, margin, yPosition + 5);
                  doc.setTextColor(...colors.accent);
                  doc.text(dates, pageWidth - margin, yPosition + 5, { align: 'right' });
                  
                  // Description with bullet points
                  if (description) {
                    yPosition += 8;
                    doc.setFontSize(9);
                    doc.setTextColor(...colors.dark);
                    
                    // Check if description has bullets or is a paragraph
                    if (description.includes('•') || description.includes('-')) {
                      // Already has bullets
                      const bullets = description.split(/•|\-/).filter(b => b.trim());
                      bullets.forEach(bullet => {
                        const bulletText = bullet.trim();
                        if (bulletText) {
                          const splitBullet = doc.splitTextToSize(`• ${bulletText}`, contentWidth - 5);
                          doc.text(splitBullet, margin + 5, yPosition);
                          yPosition += splitBullet.length * 4;
                        }
                      });
                    } else {
                      // Format as paragraph
                      const splitDesc = doc.splitTextToSize(description, contentWidth);
                      doc.text(splitDesc, margin, yPosition);
                      yPosition += splitDesc.length * 4;
                    }
                  }
                  
                  // Add spacing between entries
                  yPosition += 8;
                  
                  // Add a subtle divider between experiences (except for the last one)
                  if (index < expEntries.length - 1) {
                    doc.setDrawColor(...colors.mediumGray);
                    doc.line(margin + 10, yPosition - 4, margin + 50, yPosition - 4);
                    yPosition += 4;
                  }
                });
              } else {
                // Fall back to displaying as text
                const splitExperience = doc.splitTextToSize(experienceText, contentWidth);
                doc.setFontSize(9);
                doc.setTextColor(...colors.dark);
                doc.text(splitExperience, margin, yPosition);
                yPosition += splitExperience.length * 4 + 8;
              }
            } catch (e) {
              // If parsing fails, display as plain text
              const splitExperience = doc.splitTextToSize(experienceText, contentWidth);
              doc.setFontSize(9);
              doc.setTextColor(...colors.dark);
              doc.text(splitExperience, margin, yPosition);
              yPosition += splitExperience.length * 4 + 8;
            }
          } else {
            // Treat as plain text
            const splitExperience = doc.splitTextToSize(experienceText, contentWidth);
            doc.setFontSize(9);
            doc.setTextColor(...colors.dark);
            doc.text(splitExperience, margin, yPosition);
            yPosition += splitExperience.length * 4 + 8;
          }
        } catch (err) {
          console.error("Error parsing experience:", err);
          // Fall back to original CV data if enhanced content fails
          fallbackToOriginalWorkExperience();
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
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'bold');
            doc.text(exp.title || 'Position', margin, yPosition);
            
            // Company on the same line as title
            doc.setFont('helvetica', 'normal');
            const titleWidth = doc.getTextWidth(exp.title || 'Position');
            if (exp.company) {
              doc.setFontSize(10);
              doc.text(`at ${exp.company}`, margin + titleWidth + 5, yPosition);
            }
            
            // Add dates
            doc.setFontSize(9);
            doc.setTextColor(...colors.accent);
            if (exp.dates) {
              doc.text(exp.dates, pageWidth - margin, yPosition, { align: 'right' });
            }
            yPosition += 5;
            
            // Add description if available
            if (exp.description) {
              doc.setFontSize(9);
              doc.setTextColor(...colors.dark);
              const splitDescription = doc.splitTextToSize(exp.description, contentWidth);
              doc.text(splitDescription, margin, yPosition);
              yPosition += splitDescription.length * 4;
            }
            
            // Add spacing and divider between jobs
            if (index < enhancementResult.cvData.work_experience.length - 1) {
              yPosition += 5;
              doc.setDrawColor(...colors.mediumGray);
              doc.line(margin + 10, yPosition - 2, margin + 50, yPosition - 2);
              yPosition += 5;
            } else {
              yPosition += 8;
            }
          });
        }
      }
    }
    
    // Education Section with improved styling
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
      
      // Section heading with accent bar
      doc.setFillColor(...colors.primary);
      doc.rect(margin, yPosition, 8, 1, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text('Educación', margin, yPosition + 6);
      yPosition += 10;
      
      // First try to use enhanced content if available
      if (educationSection?.enhancedContent) {
        try {
          // Extract and format education entries
          const educationText = stripHtml(educationSection.enhancedContent);
          
          // If it looks like JSON data
          if (educationText.includes('"degree":') || educationText.includes('"institution":')) {
            try {
              // Try to parse it as JSON
              const eduEntries = JSON.parse(educationText.replace(/'/g, '"'));
              if (Array.isArray(eduEntries)) {
                eduEntries.forEach((edu, index) => {
                  // Format each education entry
                  doc.setFontSize(11);
                  doc.setTextColor(...colors.dark);
                  doc.setFont('helvetica', 'bold');
                  doc.text(edu.degree || 'Degree', margin, yPosition);
                  
                  // Institution and dates
                  doc.setFontSize(10);
                  doc.setFont('helvetica', 'normal');
                  if (edu.institution) {
                    doc.text(edu.institution, margin, yPosition + 5);
                  }
                  
                  // Date aligned right
                  if (edu.dates) {
                    doc.setTextColor(...colors.accent);
                    doc.text(edu.dates, pageWidth - margin, yPosition + 5, { align: 'right' });
                  }
                  
                  yPosition += 10;
                  
                  // Add spacing and subtle divider between entries
                  if (index < eduEntries.length - 1) {
                    doc.setDrawColor(...colors.mediumGray);
                    doc.line(margin + 10, yPosition - 4, margin + 40, yPosition - 4);
                    yPosition += 4;
                  }
                });
              } else {
                // Display as plain text
                const splitEducation = doc.splitTextToSize(educationText, contentWidth);
                doc.setFontSize(9);
                doc.setTextColor(...colors.dark);
                doc.text(splitEducation, margin, yPosition);
                yPosition += splitEducation.length * 4 + 5;
              }
            } catch (e) {
              // Display as plain text if parsing fails
              const splitEducation = doc.splitTextToSize(educationText, contentWidth);
              doc.setFontSize(9);
              doc.setTextColor(...colors.dark);
              doc.text(splitEducation, margin, yPosition);
              yPosition += splitEducation.length * 4 + 5;
            }
          } else {
            // Format as plain text
            const splitEducation = doc.splitTextToSize(educationText, contentWidth);
            doc.setFontSize(9);
            doc.setTextColor(...colors.dark);
            doc.text(splitEducation, margin, yPosition);
            yPosition += splitEducation.length * 4 + 5;
          }
        } catch (err) {
          // On any error parsing education details, fall back to raw content
          console.error("Error parsing education details:", err);
          // Fall back to original education data
          if (enhancementResult.cvData?.education && enhancementResult.cvData.education.length > 0) {
            renderOriginalEducation();
          } else {
            // If all else fails, display the raw text
            const educationText = stripHtml(educationSection.enhancedContent);
            const splitEducation = doc.splitTextToSize(educationText, contentWidth);
            doc.setFontSize(9);
            doc.setTextColor(...colors.dark);
            doc.text(splitEducation, margin, yPosition);
            yPosition += splitEducation.length * 4 + 5;
          }
        }
      } else {
        // If no enhanced content, use original CV data
        renderOriginalEducation();
      }
      
      function renderOriginalEducation() {
        if (enhancementResult.cvData?.education && enhancementResult.cvData.education.length > 0) {
          enhancementResult.cvData.education.forEach((edu, index) => {
            // Add education details
            doc.setFontSize(11);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'bold');
            doc.text(edu.degree || 'Degree', margin, yPosition);
            
            // Add institution on the next line
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`${edu.institution || 'Institution'}`, margin, yPosition);
            
            // Add dates aligned right
            doc.setFontSize(9);
            doc.setTextColor(...colors.accent);
            if (edu.dates) {
              doc.text(edu.dates, pageWidth - margin, yPosition, { align: 'right' });
            }
            
            // Add spacing and divider between education entries
            if (index < enhancementResult.cvData.education.length - 1) {
              yPosition += 5;
              doc.setDrawColor(...colors.mediumGray);
              doc.line(margin + 10, yPosition, margin + 40, yPosition);
              yPosition += 5;
            } else {
              yPosition += 8;
            }
          });
        }
      }
    }
    
    // Certifications section with improved formatting
    const certificationsSection = enhancementResult.sectionEnhancements?.find(section => 
      section?.section?.toLowerCase?.()?.includes('certif')
    );
    
    if (certificationsSection?.enhancedContent) {
      // Add new page if there's not enough space
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }
      
      // Section heading with accent bar
      doc.setFillColor(...colors.primary);
      doc.rect(margin, yPosition, 8, 1, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text('Certificaciones', margin, yPosition + 6);
      yPosition += 10;
      
      // Format certification content
      doc.setFontSize(9);
      doc.setTextColor(...colors.dark);
      doc.setFont('helvetica', 'normal');
      
      try {
        // Check if certifications content is structured
        const certText = stripHtml(certificationsSection.enhancedContent);
        
        // If it looks like JSON data
        if (certText.includes('"name":') || certText.includes('"title":')) {
          try {
            // Try to parse it as JSON
            const certEntries = JSON.parse(certText.replace(/'/g, '"'));
            if (Array.isArray(certEntries)) {
              certEntries.forEach((cert, index) => {
                // Format each certification
                doc.setFontSize(10);
                doc.setTextColor(...colors.dark);
                doc.setFont('helvetica', 'bold');
                doc.text(cert.name || cert.title || 'Certification', margin, yPosition);
                
                // Issuer and date
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                if (cert.issuer) {
                  doc.text(cert.issuer, margin, yPosition + 4);
                }
                
                // Date aligned right
                if (cert.date) {
                  doc.setTextColor(...colors.accent);
                  doc.text(cert.date, pageWidth - margin, yPosition + 4, { align: 'right' });
                }
                
                yPosition += 8;
                
                // Add subtle divider between entries
                if (index < certEntries.length - 1) {
                  doc.setDrawColor(...colors.mediumGray);
                  doc.setLineWidth(0.2);
                  doc.line(margin + 5, yPosition - 2, margin + 30, yPosition - 2);
                  yPosition += 3;
                }
              });
            } else {
              // Display as plain text
              const splitCerts = doc.splitTextToSize(certText, contentWidth);
              doc.text(splitCerts, margin, yPosition);
              yPosition += splitCerts.length * 4 + 5;
            }
          } catch (e) {
            // Display as plain text if parsing fails
            const splitCerts = doc.splitTextToSize(certText, contentWidth);
            doc.text(splitCerts, margin, yPosition);
            yPosition += splitCerts.length * 4 + 5;
          }
        } else {
          // Format as plain text
          const splitCerts = doc.splitTextToSize(certText, contentWidth);
          doc.text(splitCerts, margin, yPosition);
          yPosition += splitCerts.length * 4 + 5;
        }
      } catch (error) {
        console.error("Error processing certifications:", error);
        
        // Fall back to plain text
        const certText = stripHtml(certificationsSection.enhancedContent);
        const splitCerts = doc.splitTextToSize(certText, contentWidth);
        doc.text(splitCerts, margin, yPosition);
        yPosition += splitCerts.length * 4 + 8;
      }
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
        
        // Section heading with accent bar
        doc.setFillColor(...colors.primary);
        doc.rect(margin, yPosition, 8, 1, 'F');
        
        doc.setFontSize(14);
        doc.setTextColor(...colors.primary);
        doc.setFont('helvetica', 'bold');
        doc.text(section.section, margin, yPosition + 6);
        yPosition += 10;
        
        doc.setFontSize(9);
        doc.setTextColor(...colors.dark);
        doc.setFont('helvetica', 'normal');
        
        // Handle HTML content - strip tags and create paragraphs
        const sectionText = stripHtml(section.enhancedContent);
        const splitSection = doc.splitTextToSize(sectionText, contentWidth);
        doc.text(splitSection, margin, yPosition);
        yPosition += splitSection.length * 4 + 8;
      });
    }
    
    // Use fullEnhancedCvText as a fallback if no sections were found
    if (!summarySection?.enhancedContent && 
        !experienceSection?.enhancedContent && 
        !educationSection?.enhancedContent && 
        enhancementResult.fullEnhancedCvText) {
      
      // Section heading with accent bar
      doc.setFillColor(...colors.primary);
      doc.rect(margin, yPosition, 8, 1, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text('Currículum Vitae Completo', margin, yPosition + 6);
      yPosition += 10;
      
      doc.setFontSize(9);
      doc.setTextColor(...colors.dark);
      doc.setFont('helvetica', 'normal');
      
      const fullText = stripHtml(enhancementResult.fullEnhancedCvText);
      const splitFullText = doc.splitTextToSize(fullText, contentWidth);
      doc.text(splitFullText, margin, yPosition);
    }
    
    // Add professional footer
    doc.setDrawColor(...colors.mediumGray);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    doc.setFontSize(8);
    doc.setTextColor(...colors.accent);
    doc.setFont('helvetica', 'normal');
    const date = new Date().toLocaleDateString();
    doc.text(`Generado: ${date}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    doc.text('CVPANDA - Optimizador de Currículum', margin, pageHeight - 10);
    
    // Add page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...colors.accent);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
    
    // Save the PDF with a professional filename
    const safeFileName = jobTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    doc.save(`CV_Profesional_${safeFileName}.pdf`);
    
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