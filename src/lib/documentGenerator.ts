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
    
    // ONLY use built-in fonts that are guaranteed to work
    doc.setFont('helvetica', 'normal');
    
    // Set up page margins and dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20; // Slightly wider margins for a cleaner look
    const contentWidth = pageWidth - (margin * 2);
    
    // Define professional color scheme
    const colors = {
      primary: [41, 65, 148], // Dark blue - using simpler RGB values
      secondary: [59, 130, 246], // Medium blue
      accent: [80, 80, 80], // Dark gray
      dark: [40, 40, 40], // Near black
      light: [250, 250, 250], // Near white
      lightGray: [240, 240, 240], // Light gray for backgrounds
      mediumGray: [180, 180, 180] // Medium gray for dividers
    };
    
    // Define section variables at the top level to ensure they're available throughout the function
    let summarySection = null;
    let experienceSection = null;
    let educationSection = null;
    
    // Simple header with solid color bar
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 12, 'F');
    
    // Get personal info for the header
    const personalInfo = enhancementResult.personalInfo || enhancementResult.cvData?.personal || {};
    const name = personalInfo.name || enhancementResult.cvData?.name || 'Professional Name';
    const title = personalInfo.title || personalInfo.job_title || jobTitle || 'Professional Title';
    
    // Set up tracking for vertical position
    let yPos = margin + 8;
    
    // Name in large font with all caps
    doc.setFontSize(20);
    doc.setTextColor(...colors.primary);
    doc.setFont('helvetica', 'bold');
    doc.text(name.toUpperCase(), margin, yPos);
    yPos += 10;
    
    // Title/position
    doc.setFontSize(12);
    doc.setTextColor(...colors.accent);
    doc.setFont('helvetica', 'normal');
    doc.text(title, margin, yPos);
    yPos += 6;
    
    // Contact information in a single line with separators
    // Extract contact information from multiple possible sources
    const email = personalInfo.email || enhancementResult.cvData?.email;
    const phone = personalInfo.phone || enhancementResult.cvData?.phone;
    const location = personalInfo.location || enhancementResult.cvData?.location;
    const linkedin = personalInfo.linkedin || enhancementResult.cvData?.linkedin;
    
    if (email || phone || location || linkedin) {
      let contactLine = '';
      
      if (email) {
        contactLine += `Email: ${email}`;
      }
      
      if (phone) {
        if (contactLine) contactLine += ' | ';
        contactLine += `Tel: ${phone}`;
      }
      
      if (location) {
        if (contactLine) contactLine += ' | ';
        contactLine += `${location}`;
      }
      
      doc.setFontSize(9);
      doc.setTextColor(...colors.dark);
      doc.text(contactLine, margin, yPos);
      yPos += 12;
    } else {
      yPos += 6;
    }
    
    // Add horizontal divider after header
    doc.setDrawColor(...colors.mediumGray);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos - 4, pageWidth - margin, yPos - 4);
    
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
        // PROFILE SECTION with uppercase heading for consistency
        doc.setFontSize(14);
        doc.setTextColor(...colors.primary);
        doc.setFont('helvetica', 'bold');
        doc.text('PERFIL PROFESIONAL', margin, yPos);
        yPos += 6;
        
        // Add small line under heading
        doc.setDrawColor(...colors.secondary);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, margin + 40, yPos);
        yPos += 8;
        
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
          doc.text(splitSummary, margin, yPos);
          yPos += splitSummary.length * 4 + 8;
        }
      }
    } catch (error) {
      console.error('Error processing summary section:', error);
      // Continue with other sections
    }
    
    // Skills Section with improved visual presentation
    try {
      // Check for page break before skills section
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = margin;
      }
      
      // SKILLS SECTION
      doc.setFontSize(14);
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text('HABILIDADES PROFESIONALES', margin, yPos);
      yPos += 6;
      
      // Add small line under heading
      doc.setDrawColor(...colors.secondary);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, margin + 40, yPos);
      yPos += 8;
      
      // Safe helper function to determine if an array actually has items
      const hasValidItems = (arr: any): boolean => {
        return Array.isArray(arr) && arr.length > 0 && arr.some(item => item != null);
      };
      
      // Try to use keyword analysis first, fall back to CV skills
      if (hasValidItems(enhancementResult.keywordAnalysis)) {
        doc.setFontSize(10);
        doc.setTextColor(...colors.dark);
        
        // Process skills - extract text properly from objects
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
        
        // Create a reliable 3-column grid layout for skills
        const skillsPerRow = 3;
        const skillBoxWidth = (contentWidth / skillsPerRow) - 5;
        const skillBoxHeight = 10;
        const skillBoxGap = 5;
        
        skillsList.forEach((skill, index) => {
          const row = Math.floor(index / skillsPerRow);
          const col = index % skillsPerRow;
          
          const boxX = margin + (col * (skillBoxWidth + skillBoxGap));
          const boxY = yPos + (row * (skillBoxHeight + skillBoxGap));
          
          // Draw a simple pill/capsule for each skill
          doc.setFillColor(240, 245, 255); // Light blue background
          doc.setDrawColor(...colors.secondary);
          doc.roundedRect(boxX, boxY, skillBoxWidth, skillBoxHeight, 2, 2, 'FD');
          
          // Skill text centered in box
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...colors.primary);
          doc.text(String(skill), boxX + (skillBoxWidth/2), boxY + 6.5, { align: 'center' });
        });
        
        // Update position after skill grid
        const skillRows = Math.ceil(skillsList.length / skillsPerRow);
        yPos += (skillRows * (skillBoxHeight + skillBoxGap)) + 8;
      } else if (hasValidItems(enhancementResult.cvData?.skills)) {
        doc.setFontSize(10);
        doc.setTextColor(...colors.dark);
        
        // Extract skills from original CV data
        const skillsList = enhancementResult.cvData.skills
          .filter(s => s !== null && s !== undefined)
          .map(s => typeof s === 'string' ? s : String(s))
          .slice(0, 12); // Limit to top 12 skills
        
        // Create a grid layout for skills - 3 columns
        const skillsPerRow = 3;
        const skillBoxWidth = (contentWidth / skillsPerRow) - 5;
        const skillBoxHeight = 10;
        const skillBoxGap = 5;
        
        skillsList.forEach((skill, index) => {
          const row = Math.floor(index / skillsPerRow);
          const col = index % skillsPerRow;
          
          const boxX = margin + (col * (skillBoxWidth + skillBoxGap));
          const boxY = yPos + (row * (skillBoxHeight + skillBoxGap));
          
          // Draw a simple pill/capsule for each skill
          doc.setFillColor(240, 245, 255); // Light blue background
          doc.setDrawColor(...colors.secondary);
          doc.roundedRect(boxX, boxY, skillBoxWidth, skillBoxHeight, 2, 2, 'FD');
          
          // Skill text centered in box
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...colors.primary);
          doc.text(String(skill), boxX + (skillBoxWidth/2), boxY + 6.5, { align: 'center' });
        });
        
        // Update position after skill grid
        const skillRows = Math.ceil(skillsList.length / skillsPerRow);
        yPos += (skillRows * (skillBoxHeight + skillBoxGap)) + 8;
      } else {
        // If no skills found, check if we have skill data in the cvData.parsed_data
        const parsedSkills = enhancementResult.cvData?.parsed_data?.skills;
        if (parsedSkills) {
          // Combine all skill types
          const allSkills = [];
          if (parsedSkills.technical) allSkills.push(...parsedSkills.technical);
          if (parsedSkills.soft) allSkills.push(...parsedSkills.soft);
          if (parsedSkills.industry) allSkills.push(...parsedSkills.industry);
          
          if (allSkills.length > 0) {
            // Create a grid layout for skills - 3 columns
            const skillsPerRow = 3;
            const skillBoxWidth = (contentWidth / skillsPerRow) - 5;
            const skillBoxHeight = 10;
            const skillBoxGap = 5;
            
            allSkills.forEach((skill, index) => {
              const row = Math.floor(index / skillsPerRow);
              const col = index % skillsPerRow;
              
              const boxX = margin + (col * (skillBoxWidth + skillBoxGap));
              const boxY = yPos + (row * (skillBoxHeight + skillBoxGap));
              
              // Draw a simple pill/capsule for each skill
              doc.setFillColor(240, 245, 255); // Light blue background
              doc.setDrawColor(...colors.secondary);
              doc.roundedRect(boxX, boxY, skillBoxWidth, skillBoxHeight, 2, 2, 'FD');
              
              // Skill text centered in box
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(...colors.primary);
              doc.text(String(skill), boxX + (skillBoxWidth/2), boxY + 6.5, { align: 'center' });
            });
            
            // Update position after skill grid
            const skillRows = Math.ceil(allSkills.length / skillsPerRow);
            yPos += (skillRows * (skillBoxHeight + skillBoxGap)) + 8;
          }
        }
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
    
    // Check for work experience data from multiple possible sources
    const workExperienceData = enhancementResult.cvData?.work_experience || 
                              enhancementResult.cvData?.parsed_data?.experience ||
                              enhancementResult.cvData?.experience;
                              
    const hasWorkExperience = experienceSection?.enhancedContent || 
                            (workExperienceData && Array.isArray(workExperienceData) && workExperienceData.length > 0);
    
    if (hasWorkExperience) {
      // EMPLOYMENT HISTORY SECTION with consistent uppercase formatting
      doc.setFontSize(14);
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text('EXPERIENCIA PROFESIONAL', margin, yPos);
      yPos += 6;
      
      // Add small line under heading
      doc.setDrawColor(...colors.secondary);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, margin + 40, yPos);
      yPos += 8;
      
      // Variable to track if experience was rendered successfully
      let experienceRendered = false;
      
      // First try using enhanced work experience
      if (enhancementResult.enhancedWorkExperience) {
        try {
          const expData = JSON.parse(enhancementResult.enhancedWorkExperience);
          if (Array.isArray(expData) && expData.length > 0) {
            renderWorkExperience(expData);
            experienceRendered = true;
          }
        } catch (error) {
          console.error('Error parsing enhancedWorkExperience:', error);
        }
      }
      
      // If enhanced work experience failed, try using the experience section content
      if (!experienceRendered && experienceSection?.enhancedContent) {
        try {
          const expContent = experienceSection.enhancedContent;
          if (expContent.includes('{') && expContent.includes('}')) {
            try {
              // Try to parse as JSON if it looks like JSON
              const expData = JSON.parse(expContent.replace(/'/g, '"'));
              if (Array.isArray(expData) && expData.length > 0) {
                renderWorkExperience(expData);
                experienceRendered = true;
              }
            } catch (e) {
              console.error('Failed to parse experience section as JSON:', e);
            }
          }
        } catch (error) {
          console.error('Error processing experience section content:', error);
        }
      }
      
      // If still no experience rendered, try using the original CV data
      if (!experienceRendered && workExperienceData && Array.isArray(workExperienceData)) {
        renderWorkExperience(workExperienceData);
        experienceRendered = true;
      }
      
      // Helper function to render work experience entries
      function renderWorkExperience(experiences) {
        experiences.forEach((exp, index) => {
          // Check for page break if needed
          if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = margin;
          }
          
          // Job title/position - in bold
          doc.setFontSize(11);
          doc.setTextColor(...colors.dark);
          doc.setFont('helvetica', 'bold');
          const title = exp.title || exp.position || 'Position';
          doc.text(title, margin, yPos);
          
          // Company with "at" prefix
          if (exp.company) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colors.accent);
            const companyText = `at ${exp.company}`;
            // Right align dates
            const titleWidth = doc.getTextWidth(title);
            doc.text(companyText, margin + titleWidth + 3, yPos);
          }
          
          // Add dates on next line, right aligned
          yPos += 5;
          doc.setFontSize(9);
          doc.setTextColor(...colors.accent);
          const dates = exp.dates || exp.duration || exp.date || (exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` : '');
          if (dates) {
            doc.text(dates, pageWidth - margin, yPos, { align: 'right' });
          }
          yPos += 5;
          
          // Add job role if available
          if (exp.role || exp.jobRole) {
            doc.setTextColor(...colors.secondary);
            doc.setFont('helvetica', 'italic');
            const roleText = `Rol: ${exp.role || exp.jobRole}`;
            doc.text(roleText, margin, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal'); // Reset font style
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
            const splitDescription = doc.splitTextToSize(stripHtml(description), contentWidth);
            doc.text(splitDescription, margin, yPos);
            yPos += splitDescription.length * 4 + 2; // Adjust spacing
          }
          
          // Add spacing between jobs
          if (index < experiences.length - 1) {
            yPos += 5;
            // Page break check
            if (yPos > pageHeight - 40) { 
              doc.addPage(); 
              yPos = margin; 
            }
            doc.setDrawColor(...colors.lightGray);
            doc.setLineWidth(0.2); // Make divider thinner
            doc.line(margin, yPos, margin + 60, yPos);
            yPos += 8;
          } else {
            yPos += 12; // Space after the last job
          }
        });
      }
      
      // Add message if no experience could be rendered
      if (!experienceRendered) {
        // If all attempts failed, display a message
        doc.setFontSize(10);
        doc.setTextColor(...colors.accent);
        doc.setFont('helvetica', 'italic');
        doc.text("No work experience information available.", margin, yPos);
        yPos += 10;
      }
    }
    
    // Education Section with improved styling
    educationSection = enhancementResult.sectionEnhancements?.find(section => 
      section?.section?.toLowerCase?.()?.includes('education') || 
      section?.section?.toLowerCase?.()?.includes('educación') ||
      section?.section?.toLowerCase?.()?.includes('formación')
    );
    
    // Check for education data from multiple possible sources
    const educationData = enhancementResult.cvData?.education || 
                        enhancementResult.cvData?.parsed_data?.education;
    
    const hasEducation = educationSection?.enhancedContent || 
                      (educationData && Array.isArray(educationData) && educationData.length > 0);
    
    if (hasEducation) {
      // Check for page break before education section
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = margin;
      }
      
      // EDUCATION SECTION with consistent formatting
      doc.setFontSize(14);
      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text('EDUCACIÓN', margin, yPos);
      yPos += 6;
      
      // Add small line under heading
      doc.setDrawColor(...colors.secondary);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, margin + 40, yPos);
      yPos += 8;
      
      let educationRendered = false;
      
      // First try to use enhanced education content if available
      if (educationSection?.enhancedContent) {
        try {
          // Extract and format education entries
          const educationText = stripHtml(educationSection.enhancedContent);
          
          // If it looks like JSON data
          if (educationText.includes('"degree":') || educationText.includes('"institution":')) {
            try {
              // Try to parse it as JSON
              const eduEntries = JSON.parse(educationText.replace(/'/g, '"'));
              if (Array.isArray(eduEntries) && eduEntries.length > 0) {
                renderEducation(eduEntries);
                educationRendered = true;
              }
            } catch (e) {
              console.error('Failed to parse education section as JSON:', e);
            }
          }
        } catch (err) {
          console.error("Error parsing education details:", err);
        }
      }
      
      // If enhanced education failed, try using the original CV data
      if (!educationRendered && educationData && Array.isArray(educationData)) {
        renderEducation(educationData);
        educationRendered = true;
      }
      
      // Helper function to render education entries
      function renderEducation(eduEntries) {
        eduEntries.forEach((edu, index) => {
          // Format each education entry
          doc.setFontSize(11);
          doc.setTextColor(...colors.dark);
          doc.setFont('helvetica', 'bold');
          doc.text(edu.degree || 'Degree', margin, yPos);
          
          // Institution and dates
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          if (edu.institution) {
            doc.text(edu.institution, margin, yPos + 5);
          }
          
          // Date aligned right
          const year = edu.year || edu.dates || edu.date || '';
          if (year) {
            doc.setTextColor(...colors.accent);
            doc.text(year, pageWidth - margin, yPos + 5, { align: 'right' });
          }
          
          yPos += 10;
          
          // Add spacing and subtle divider between entries
          if (index < eduEntries.length - 1) {
            doc.setDrawColor(...colors.mediumGray);
            doc.line(margin + 10, yPos - 4, margin + 40, yPos - 4);
            yPos += 4;
          }
        });
      }
      
      // Add message if no education could be rendered
      if (!educationRendered) {
        // If all attempts failed, display a message
        doc.setFontSize(10);
        doc.setTextColor(...colors.accent);
        doc.setFont('helvetica', 'italic');
        doc.text("No education information available.", margin, yPos);
        yPos += 10;
      }
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