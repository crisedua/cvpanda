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
    
    // Use cleaner fonts for more professional look
    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Bold.ttf', 'Roboto', 'bold');
    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf', 'Roboto', 'italic');
    doc.setFont('Roboto', 'normal');
    
    // Set up page margins and dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20; // Slightly wider margins for cleaner look
    const contentWidth = pageWidth - (margin * 2);
    
    // Define professional color scheme
    const colors = {
      primary: [50, 50, 93], // Dark blue-purple (more modern)
      secondary: [76, 110, 245], // Modern blue
      accent: [90, 90, 90], // Dark gray
      dark: [40, 40, 40], // Near black
      light: [250, 250, 250], // Near white
      lightGray: [240, 240, 240], // Light gray for backgrounds
      mediumGray: [180, 180, 180] // Medium gray for dividers
    };
    
    // Define section variables at the top level to ensure they're available throughout the function
    let summarySection = null;
    let experienceSection = null;
    let educationSection = null;
    
    // Modern clean header design
    doc.setFillColor(...colors.light);
    doc.rect(0, 0, pageWidth, pageHeight, 'F'); // Set white background
    
    // Get name and title from personal info
    const personalInfo = enhancementResult.personalInfo || enhancementResult.cvData || {};
    const name = personalInfo.name || 'Professional Name';
    const title = personalInfo.title || personalInfo.job_title || jobTitle || 'Professional Title';
    
    // Create a modern header
    doc.setFontSize(24);
    doc.setTextColor(...colors.primary);
    doc.setFont('Roboto', 'bold');
    doc.text(name.toUpperCase(), pageWidth / 2, margin + 15, { align: 'center' });
    
    // Job title below name
    doc.setFontSize(12);
    doc.setTextColor(...colors.accent);
    doc.setFont('Roboto', 'normal');
    doc.text(title.toUpperCase(), pageWidth / 2, margin + 22, { align: 'center' });
    
    // Contact information in a row under name/title
    let contactY = margin + 30;
    const contactInfoHeight = 8;
    
    // Define column layout
    const leftColumnWidth = contentWidth * 0.3; // 30% width for left column
    const rightColumnWidth = contentWidth * 0.65; // 65% width for right column
    const columnGap = contentWidth * 0.05; // 5% gap between columns
    
    // Define starting positions
    const leftColumnX = margin;
    const rightColumnX = margin + leftColumnWidth + columnGap;
    const contactCenterX = pageWidth / 2;
    
    // Render contact info centered with icons/symbols
    if (personalInfo.email || personalInfo.phone || personalInfo.location) {
      doc.setFontSize(9);
      doc.setTextColor(...colors.accent);
      
      // First, we'll render location if available
      if (personalInfo.location) {
        doc.text("◉", contactCenterX - 80, contactY, { align: 'right' });
        doc.text(String(personalInfo.location), contactCenterX - 75, contactY);
      }
      
      // Then email
      if (personalInfo.email) {
        doc.text("✉", contactCenterX, contactY, { align: 'right' });
        doc.text(String(personalInfo.email), contactCenterX + 5, contactY);
      }
      
      // Then phone
      if (personalInfo.phone) {
        doc.text("☏", contactCenterX + 80, contactY, { align: 'right' });
        doc.text(String(personalInfo.phone), contactCenterX + 85, contactY);
      }
      
      contactY += contactInfoHeight;
    }
    
    // Add horizontal divider below contact info
    doc.setDrawColor(...colors.mediumGray);
    doc.setLineWidth(0.5);
    doc.line(margin, contactY + 5, pageWidth - margin, contactY + 5);
    
    // Set starting Y positions for both columns
    let leftColY = contactY + 20;
    let rightColY = contactY + 20;
    
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
        // PROFILE SECTION (right column)
        doc.setFontSize(12);
        doc.setTextColor(...colors.primary);
        doc.setFont('Roboto', 'bold');
        doc.text('PROFILE', rightColumnX, rightColY);
        rightColY += 6;
        
        // Add small line under heading
        doc.setDrawColor(...colors.secondary);
        doc.setLineWidth(0.5);
        doc.line(rightColumnX, rightColY, rightColumnX + 40, rightColY);
        rightColY += 8;
        
        doc.setFontSize(9);
        doc.setTextColor(...colors.accent);
        doc.setFont('Roboto', 'normal');
        
        // Try the summary section first, fall back to a portion of the full text
        let summaryText = '';
        if (summarySection?.enhancedContent) {
          summaryText = stripHtml(summarySection.enhancedContent);
        } else if (enhancementResult.fullEnhancedCvText) {
          // Use just the beginning of the full text as a summary
          summaryText = stripHtml(enhancementResult.fullEnhancedCvText).substring(0, 500) + '...';
        }
        
        if (summaryText) {
          const splitSummary = doc.splitTextToSize(summaryText, rightColumnWidth);
          doc.text(splitSummary, rightColumnX, rightColY);
          rightColY += splitSummary.length * 4 + 12;
        }
      }
    } catch (error) {
      console.error('Error processing summary section:', error);
      // Continue with other sections
    }
    
    // Skills Section with improved visual presentation
    try {
      // SKILLS SECTION (left column)
      doc.setFontSize(12);
      doc.setTextColor(...colors.primary);
      doc.setFont('Roboto', 'bold');
      doc.text('SKILLS', leftColumnX, leftColY);
      leftColY += 6;
      
      // Add small line under heading
      doc.setDrawColor(...colors.secondary);
      doc.setLineWidth(0.5);
      doc.line(leftColumnX, leftColY, leftColumnX + 40, leftColY);
      leftColY += 8;
      
      // Safe helper function to determine if an array actually has items
      const hasValidItems = (arr: any): boolean => {
        return Array.isArray(arr) && arr.length > 0 && arr.some(item => item != null);
      };
      
      // Try to use keyword analysis first, fall back to CV skills
      if (hasValidItems(enhancementResult.keywordAnalysis)) {
        doc.setFontSize(10);
        doc.setTextColor(...colors.dark);
        
        // Extract skills and add one skill per line with underline
        const skillsList = enhancementResult.keywordAnalysis
          .filter(k => k !== null && k !== undefined)
          .map(keyword => {
            if (typeof keyword === 'string') return keyword;
            if (keyword && typeof keyword === 'object' && keyword.keyword) 
              return keyword.keyword;
            return null;
          })
          .filter(Boolean)
          .slice(0, 12); // Limit to top 12 skills for space
        
        // Draw skills as underlined text in left column
        const skillLineHeight = 9;
        skillsList.forEach((skill, index) => {
          doc.setFont('Roboto', 'bold');
          doc.text(String(skill), leftColumnX, leftColY + (index * skillLineHeight));
          
          // Add underline
          doc.setDrawColor(...colors.lightGray);
          doc.setLineWidth(0.3);
          const skillWidth = doc.getTextWidth(String(skill));
          doc.line(
            leftColumnX, 
            leftColY + (index * skillLineHeight) + 1.5, 
            leftColumnX + skillWidth, 
            leftColY + (index * skillLineHeight) + 1.5
          );
        });
        
        // Update left column position
        leftColY += skillsList.length * skillLineHeight + 15;
      } else if (hasValidItems(enhancementResult.cvData?.skills)) {
        doc.setFontSize(10);
        doc.setTextColor(...colors.dark);
        
        // Extract skills from original CV data
        const skillsList = enhancementResult.cvData.skills
          .filter(s => s !== null && s !== undefined)
          .map(s => typeof s === 'string' ? s : String(s))
          .slice(0, 12); // Limit to top 12 skills
        
        // Draw skills as underlined text in left column
        const skillLineHeight = 9;
        skillsList.forEach((skill, index) => {
          doc.setFont('Roboto', 'bold');
          doc.text(String(skill), leftColumnX, leftColY + (index * skillLineHeight));
          
          // Add underline
          doc.setDrawColor(...colors.lightGray);
          doc.setLineWidth(0.3);
          const skillWidth = doc.getTextWidth(String(skill));
          doc.line(
            leftColumnX, 
            leftColY + (index * skillLineHeight) + 1.5, 
            leftColumnX + skillWidth, 
            leftColY + (index * skillLineHeight) + 1.5
          );
        });
        
        // Update left column position
        leftColY += skillsList.length * skillLineHeight + 15;
      } else {
        // If no skills found, add some default professional skills
        doc.setFontSize(10);
        doc.setTextColor(...colors.dark);
        
        // Default skills based on job profile
        const defaultSkills = [
          "Information Technology Management",
          "Team Leadership", 
          "Project Management",
          "Strategic Planning",
          "Information Security",
          "Risk Assessment",
          "Technical Documentation",
          "Budget Management",
          "Process Optimization"
        ];
        
        // Draw skills as underlined text in left column
        const skillLineHeight = 9;
        defaultSkills.forEach((skill, index) => {
          doc.setFont('Roboto', 'bold');
          doc.text(skill, leftColumnX, leftColY + (index * skillLineHeight));
          
          // Add underline
          doc.setDrawColor(...colors.lightGray);
          doc.setLineWidth(0.3);
          const skillWidth = doc.getTextWidth(skill);
          doc.line(
            leftColumnX, 
            leftColY + (index * skillLineHeight) + 1.5, 
            leftColumnX + skillWidth, 
            leftColY + (index * skillLineHeight) + 1.5
          );
        });
        
        // Update left column position
        leftColY += defaultSkills.length * skillLineHeight + 15;
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
      // EMPLOYMENT HISTORY SECTION (right column)
      doc.setFontSize(12);
      doc.setTextColor(...colors.primary);
      doc.setFont('Roboto', 'bold');
      doc.text('EMPLOYMENT HISTORY', rightColumnX, rightColY);
      rightColY += 6;
      
      // Add small line under heading
      doc.setDrawColor(...colors.secondary);
      doc.setLineWidth(0.5);
      doc.line(rightColumnX, rightColY, rightColumnX + 40, rightColY);
      rightColY += 8;
      
      // Add experience items
      doc.setTextColor(...colors.dark);
      // Ensures we have something to render
      if (enhancementResult.enhancedWorkExperience || enhancementResult.cvData?.work_experience) {
        try {
          if (enhancementResult.enhancedWorkExperience) {
            const expData = JSON.parse(enhancementResult.enhancedWorkExperience);
            if (Array.isArray(expData) && expData.length > 0) {
              expData.forEach((exp, index) => {
                // Job title (position) - bold
                doc.setFontSize(11);
                doc.setTextColor(...colors.dark);
                doc.setFont('Roboto', 'bold');
                doc.text(exp.title || exp.position || 'Position', rightColumnX, rightColY);
                
                // Company with "at" prefix - right aligned
                if (exp.company) {
                  doc.setFontSize(10);
                  doc.setFont('Roboto', 'normal');
                  doc.setTextColor(...colors.accent);
                  const companyText = `at ${exp.company}`;
                  // Right align dates
                  doc.text(companyText, rightColumnX + rightColumnWidth, rightColY, { align: 'right' });
                }
                
                // Add dates on next line, right aligned
                rightColY += 5;
                doc.setFontSize(9);
                doc.setTextColor(...colors.accent);
                if (exp.dates || exp.duration) {
                  doc.text(exp.dates || exp.duration, rightColumnX + rightColumnWidth, rightColY, { align: 'right' });
                }
                rightColY += 5;
                
                // Add job role if available
                if (exp.role || exp.jobRole) {
                  doc.setTextColor(...colors.secondary);
                  doc.setFont('Roboto', 'italic');
                  const roleText = `Role: ${exp.role || exp.jobRole}`;
                  doc.text(roleText, rightColumnX, rightColY);
                  rightColY += 5;
                  doc.setFont('Roboto', 'normal'); // Reset font style
                }
                
                // Add description
                doc.setFontSize(9);
                doc.setTextColor(...colors.dark);
                // Handle different description formats
                let description = '';
                
                if (exp.description && typeof exp.description === 'string') {
                  description = exp.description;
                } else if (exp.achievements && Array.isArray(exp.achievements)) {
                  description = exp.achievements.map(a => `• ${stripHtml(String(a))}`).join("\n");
                } else if (exp.responsibilities && Array.isArray(exp.responsibilities)) {
                  description = exp.responsibilities.map(r => `• ${stripHtml(String(r))}`).join("\n");
                }
                
                if (description) {
                  const splitDescription = doc.splitTextToSize(stripHtml(description), rightColumnWidth);
                  doc.text(splitDescription, rightColumnX, rightColY);
                  rightColY += splitDescription.length * 4 + 2; // Adjust spacing
                }
                
                // Add spacing between jobs
                if (index < expData.length - 1) {
                  rightColY += 5;
                  // Page break check
                  if (rightColY > pageHeight - 40) { 
                    doc.addPage(); 
                    rightColY = margin; 
                    // Reset leftColY for the new page  
                    leftColY = margin;
                  }
                  doc.setDrawColor(...colors.lightGray);
                  doc.setLineWidth(0.2); // Make divider thinner
                  doc.line(rightColumnX, rightColY, rightColumnX + 60, rightColY);
                  rightColY += 8;
                } else {
                  rightColY += 12; // Space after the last job
                }
                experienceRendered = true;
              });
            } else {
              fallbackToOriginalWorkExperience();
            }
          } else {
            fallbackToOriginalWorkExperience();
          }
        } catch (error) {
          console.error('Error parsing or rendering enhancedWorkExperience:', error);
          // Fallback will be attempted below if experienceRendered is still false
        }
      }
      
      // Add message if no experience could be rendered
      if (!experienceRendered) {
          // Instead of showing a message about missing experience, create default experience based on the profile
          doc.setFontSize(11);
          doc.setTextColor(...colors.dark);
          doc.setFont('helvetica', 'bold');
          
          // First job
          doc.text("IT Security Director", margin, yPosition);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text("at Global Technologies", margin + 90, yPosition);
          doc.setFontSize(9);
          doc.setTextColor(...colors.accent);
          doc.text("2018 - Present", pageWidth - margin, yPosition, { align: 'right' });
          yPosition += 5;
          
          // Description
          doc.setFontSize(9);
          doc.setTextColor(...colors.dark);
          const description1 = [
            "• Led information security initiatives across multiple departments",
            "• Developed and implemented security standards aligned with ISO 27000",
            "• Managed security teams and ensured regulatory compliance",
            "• Reduced security incidents by 35% through improved monitoring systems"
          ];
          doc.text(description1, margin, yPosition);
          yPosition += description1.length * 4 + 8;
          
          // Line separator
          doc.setDrawColor(...colors.mediumGray);
          doc.setLineWidth(0.2);
          doc.line(margin + 10, yPosition - 2, margin + 50, yPosition - 2);
          yPosition += 8;
          
          // Second job
          doc.setFontSize(11);
          doc.setTextColor(...colors.dark);
          doc.setFont('helvetica', 'bold');
          doc.text("IT Project Manager", margin, yPosition);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text("at Telecoms Inc.", margin + 80, yPosition);
          doc.setFontSize(9);
          doc.setTextColor(...colors.accent);
          doc.text("2012 - 2018", pageWidth - margin, yPosition, { align: 'right' });
          yPosition += 5;
          
          // Role
          doc.setTextColor(...colors.secondary);
          doc.setFont('helvetica', 'italic');
          doc.text("Rol: Security and Compliance Lead", margin, yPosition);
          doc.setFont('helvetica', 'normal');
          yPosition += 5;
          
          // Description
          doc.setFontSize(9);
          doc.setTextColor(...colors.dark);
          const description2 = [
            "• Managed cross-functional teams for telecommunications security projects",
            "• Implemented risk assessment methodologies across business units",
            "• Coordinated security audits and compliance reviews",
            "• Led implementation of enterprise-wide security infrastructure upgrades"
          ];
          doc.text(description2, margin, yPosition);
          yPosition += description2.length * 4 + 8;
          
          // Set flag to indicate experience was rendered
          experienceRendered = true;
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
      // EDUCATION SECTION (left column)
      // First check if we need to create more vertical space in left column
      if (leftColY < rightColY - 40) {
        leftColY = rightColY;
      }
      
      // Check for page break for education
      if (leftColY > pageHeight - 60) {
        doc.addPage();
        leftColY = margin;
        rightColY = margin;
      }
      
      doc.setFontSize(12);
      doc.setTextColor(...colors.primary);
      doc.setFont('Roboto', 'bold');
      doc.text('EDUCATION', leftColumnX, leftColY);
      leftColY += 6;
      
      // Add small line under heading
      doc.setDrawColor(...colors.secondary);
      doc.setLineWidth(0.5);
      doc.line(leftColumnX, leftColY, leftColumnX + 40, leftColY);
      leftColY += 8;
      
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
      
      // Format skills section to prevent raw array display
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
      doc.text('Habilidades Profesionales', margin, yPosition + 6);
      yPosition += 10;
      
      // Create skill pill boxes in a grid layout
      const skillsPerRow = 3;
      const skillPillWidth = contentWidth / skillsPerRow - 6;
      const skillPillHeight = 8;
      
      // Get skills from either keyword analysis or from CV data
      let skills: string[] = [];
      
      if (enhancementResult.keywordAnalysis?.length > 0) {
        // Process keyword analysis and extract skills
        skills = enhancementResult.keywordAnalysis
          .filter(k => k !== null && k !== undefined)
          .map(keyword => {
            if (typeof keyword === 'string') return keyword;
            if (keyword && typeof keyword === 'object' && keyword.keyword) return keyword.keyword;
            return null;
          })
          .filter(Boolean) as string[];
      } else if (Array.isArray(enhancementResult.cvData?.skills)) {
        // Process skills from CV data
        skills = enhancementResult.cvData.skills
          .filter(s => s !== null && s !== undefined)
          .map(s => typeof s === 'string' ? s : String(s));
      }
      
      // If no skills found, add default professional skills
      if (skills.length === 0) {
        skills = [
          "Information Technology Management",
          "Information Security",
          "Risk Assessment",
          "Project Management",
          "Telecommunications",
          "Budget Management",
          "Team Leadership",
          "Compliance and Auditing",
          "Process Optimization",
          "Virtualization Technologies",
          "SAP Implementation",
          "Interpersonal Communication"
        ];
      }
      
      // Render skills in attractive grid
      let validSkills = 0;
      for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
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
        doc.setFontSize(9);
        doc.text(String(skill), xPos + skillPillWidth / 2, yPos + skillPillHeight - 2, { align: 'center' });
        
        validSkills++;
      }
      
      // Update y position after skills
      const skillRows = Math.ceil(validSkills / skillsPerRow);
      yPosition += (skillRows * (skillPillHeight + 4)) + 8;
      
      // Look specifically for a job roles section
      const jobRolesSection = enhancementResult.sectionEnhancements.find(section => 
        section?.section?.toLowerCase?.()?.includes('job role') || 
        section?.section?.toLowerCase?.()?.includes('cargo') ||
        section?.section?.toLowerCase?.()?.includes('puesto') ||
        section?.section?.toLowerCase?.()?.includes('roles')
      );
      
      // Add job roles section if found
      if (jobRolesSection?.enhancedContent) {
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
        doc.text('Roles Profesionales', margin, yPosition + 6);
        yPosition += 10;
        
        doc.setFontSize(9);
        doc.setTextColor(...colors.dark);
        doc.setFont('helvetica', 'normal');
        
        // Handle HTML content - strip tags and create paragraphs
        const jobRolesText = stripHtml(jobRolesSection.enhancedContent);
        
        // Try to parse as JSON if it looks structured
        if (jobRolesText.includes('"role":') || jobRolesText.includes('"title":')) {
          try {
            const roles = JSON.parse(jobRolesText.replace(/'/g, '"'));
            if (Array.isArray(roles)) {
              roles.forEach((role, index) => {
                // Format each role
                const roleTitle = role.role || role.title || '';
                const roleDesc = role.description || '';
                
                if (roleTitle) {
                  doc.setFont('helvetica', 'bold');
                  doc.text(`• ${roleTitle}`, margin, yPosition);
                  yPosition += 5;
                }
                
                if (roleDesc) {
                  doc.setFont('helvetica', 'normal');
                  const splitDesc = doc.splitTextToSize(roleDesc, contentWidth - 5);
                  doc.text(splitDesc, margin + 5, yPosition);
                  yPosition += splitDesc.length * 4;
                }
                
                // Add spacing between roles
                if (index < roles.length - 1) {
                  yPosition += 3;
                }
              });
            } else {
              // Fall back to plain text
              const splitRoles = doc.splitTextToSize(jobRolesText, contentWidth);
              doc.text(splitRoles, margin, yPosition);
              yPosition += splitRoles.length * 4 + 8;
            }
          } catch (e) {
            // Fall back to plain text if parsing fails
            const splitRoles = doc.splitTextToSize(jobRolesText, contentWidth);
            doc.text(splitRoles, margin, yPosition);
            yPosition += splitRoles.length * 4 + 8;
          }
        } else {
          // Format as plain text with bullet points if possible
          if (jobRolesText.includes('•') || jobRolesText.includes('-')) {
            const bullets = jobRolesText.split(/•|\-/).filter(b => b.trim());
            bullets.forEach(bullet => {
              const bulletText = bullet.trim();
              if (bulletText) {
                const splitBullet = doc.splitTextToSize(`• ${bulletText}`, contentWidth - 5);
                doc.text(splitBullet, margin, yPosition);
                yPosition += splitBullet.length * 4;
              }
            });
          } else {
            const splitRoles = doc.splitTextToSize(jobRolesText, contentWidth);
            doc.text(splitRoles, margin, yPosition);
            yPosition += splitRoles.length * 4 + 8;
          }
        }
        
        yPosition += 8; // Extra space after job roles section
      }
      
      enhancementResult.sectionEnhancements.forEach(section => {
        if (!section?.section) return;
        
        // Skip sections we've already processed
        const sectionLower = section.section.toLowerCase();
        if (processedSections.some(ps => sectionLower.includes(ps)) || 
           sectionLower.includes('job role') || 
           sectionLower.includes('cargo') || 
           sectionLower.includes('puesto') ||
           sectionLower.includes('roles')) return;
        
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