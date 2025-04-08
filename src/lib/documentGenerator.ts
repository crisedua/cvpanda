import { jsPDF } from 'jspdf';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import type { CV, ProfileEnhancementResult } from '../types';

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

// New function to generate a PDF from enhancement results
export async function generateEnhancementPDF(enhancementResult: ProfileEnhancementResult, targetPlatform: string, industryFocus: string) {
  if (!enhancementResult) return null;

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

  // Title and metadata
  addText('Profile Enhancement Report', 24, true);
  addText(`Target Platform: ${targetPlatform}`, 12);
  addText(`Industry Focus: ${industryFocus}`, 12);
  addText(`Generated: ${new Date().toLocaleDateString()}`, 12);
  yPos += 10;

  // Profile Score
  if (enhancementResult.profileScore) {
    addText('Profile Score Summary', 16, true);
    addText(`Current Score: ${enhancementResult.profileScore.current}%`, 12);
    addText(`Potential Score: ${enhancementResult.profileScore.potential}%`, 12);
    
    if (enhancementResult.profileScore.keyFactors && enhancementResult.profileScore.keyFactors.length > 0) {
      addText('Key Factors:', 12, true);
      enhancementResult.profileScore.keyFactors.forEach(factor => {
        addText(`• ${factor}`, 10);
      });
    }
    yPos += 10;
  }

  // Keyword Analysis
  if (enhancementResult.keywordAnalysis && enhancementResult.keywordAnalysis.length > 0) {
    addText('Keyword Analysis', 16, true);
    enhancementResult.keywordAnalysis.forEach(keyword => {
      addText(`${keyword.keyword} (Relevance: ${keyword.relevance}%)`, 14, true);
      addText(`Placement: ${keyword.placement}`, 10);
      addText(`Recommended Usage: ${keyword.recommendedUsage}`, 10);
      yPos += 5;
    });
    yPos += 10;
  }

  // Section Enhancements
  if (enhancementResult.sectionEnhancements && enhancementResult.sectionEnhancements.length > 0) {
    addText('Section Enhancements', 16, true);
    enhancementResult.sectionEnhancements.forEach(section => {
      addText(section.section, 14, true);
      addText('Current Content:', 10, true);
      addText(section.currentContent, 10);
      addText('Enhanced Content:', 10, true);
      addText(section.enhancedContent, 10);
      addText('Rationale:', 10, true);
      addText(section.rationale, 10);
      yPos += 10;
    });
  }

  // Industry Trends
  if (enhancementResult.industryTrends && enhancementResult.industryTrends.length > 0) {
    addText('Industry Trends', 16, true);
    enhancementResult.industryTrends.forEach(trend => {
      addText(`${trend.trend} (Relevance: ${trend.relevance}%)`, 12, true);
      addText(`Implementation: ${trend.implementation}`, 10);
      yPos += 5;
    });
    yPos += 10;
  }

  // ATS Optimization
  if (enhancementResult.atsOptimization) {
    addText('ATS Optimization', 16, true);
    addText(`Current ATS Compatibility Score: ${enhancementResult.atsOptimization.currentScore}%`, 12);
    
    if (enhancementResult.atsOptimization.recommendations && enhancementResult.atsOptimization.recommendations.length > 0) {
      addText('Recommendations:', 12, true);
      enhancementResult.atsOptimization.recommendations.forEach(rec => {
        addText(`• ${rec}`, 10);
      });
    }
    
    if (enhancementResult.atsOptimization.keywordsToAdd && enhancementResult.atsOptimization.keywordsToAdd.length > 0) {
      addText('Keywords to Add:', 12, true);
      addText(enhancementResult.atsOptimization.keywordsToAdd.join(', '), 10);
    }
    yPos += 10;
  }

  // Action Plan
  if (enhancementResult.actionPlan) {
    addText('Action Plan', 16, true);
    
    if (enhancementResult.actionPlan.immediate && enhancementResult.actionPlan.immediate.length > 0) {
      addText('Immediate Actions:', 12, true);
      enhancementResult.actionPlan.immediate.forEach(action => {
        addText(`• ${action}`, 10);
      });
    }
    
    if (enhancementResult.actionPlan.shortTerm && enhancementResult.actionPlan.shortTerm.length > 0) {
      addText('Short-Term Actions (1 month):', 12, true);
      enhancementResult.actionPlan.shortTerm.forEach(action => {
        addText(`• ${action}`, 10);
      });
    }
    
    if (enhancementResult.actionPlan.longTerm && enhancementResult.actionPlan.longTerm.length > 0) {
      addText('Long-Term Actions (3-6 months):', 12, true);
      enhancementResult.actionPlan.longTerm.forEach(action => {
        addText(`• ${action}`, 10);
      });
    }
  }

  // Competitive Advantage
  if (enhancementResult.competitiveAdvantage) {
    addText('Competitive Advantage Strategy', 16, true);
    
    if (enhancementResult.competitiveAdvantage.differentiationStrategy) {
      addText('Differentiation Strategy:', 12, true);
      addText(enhancementResult.competitiveAdvantage.differentiationStrategy, 10);
    }
    
    if (enhancementResult.competitiveAdvantage.uniqueSellingPoints && enhancementResult.competitiveAdvantage.uniqueSellingPoints.length > 0) {
      addText('Unique Selling Points:', 12, true);
      enhancementResult.competitiveAdvantage.uniqueSellingPoints.forEach(point => {
        addText(`• ${point}`, 10);
      });
    }
    
    if (enhancementResult.competitiveAdvantage.emergingOpportunities && enhancementResult.competitiveAdvantage.emergingOpportunities.length > 0) {
      addText('Emerging Opportunities:', 12, true);
      enhancementResult.competitiveAdvantage.emergingOpportunities.forEach(opportunity => {
        addText(`• ${opportunity}`, 10);
      });
    }
  }

  return doc.save('profile-enhancement.pdf');
}