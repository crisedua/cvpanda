/**
 * CV Table Migration Script
 * 
 * This script migrates data from the 'cvs' table to 'parsed_cvs' table,
 * ensuring a consistent data model going forward.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin privileges
);

// Migration function
async function migrateCVs() {
  console.log('🔄 Starting CV migration from cvs → parsed_cvs table...');
  
  try {
    // 1. Check if both tables exist
    console.log('👀 Checking tables...');
    const tablesInfo = await supabase.rpc('get_tables_info');
    const hasCvsTable = tablesInfo.find(t => t.table_name === 'cvs');
    const hasParsedCvsTable = tablesInfo.find(t => t.table_name === 'parsed_cvs');
    
    if (!hasCvsTable) {
      console.error('❌ Source table "cvs" not found. Aborting migration.');
      return;
    }
    
    if (!hasParsedCvsTable) {
      console.error('❌ Target table "parsed_cvs" not found. Aborting migration.');
      return;
    }
    
    // 2. Get all records from 'cvs' table
    console.log('📋 Fetching records from cvs table...');
    const { data: existingCVs, error: fetchError } = await supabase
      .from('cvs')
      .select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching CVs:', fetchError);
      return;
    }
    
    console.log(`✅ Found ${existingCVs.length} records in cvs table`);
    
    // 3. Check for existing records in parsed_cvs to avoid duplicates
    console.log('🔍 Checking for existing records in parsed_cvs...');
    const { data: existingParsedCVs, error: parsedFetchError } = await supabase
      .from('parsed_cvs')
      .select('id');
    
    if (parsedFetchError) {
      console.error('❌ Error fetching parsed CVs:', parsedFetchError);
      return;
    }
    
    const existingIds = new Set(existingParsedCVs.map(cv => cv.id));
    const cvsToMigrate = existingCVs.filter(cv => !existingIds.has(cv.id));
    
    console.log(`ℹ️ ${existingCVs.length - cvsToMigrate.length} records already exist in parsed_cvs`);
    console.log(`🔄 Will migrate ${cvsToMigrate.length} records`);
    
    if (cvsToMigrate.length === 0) {
      console.log('✅ No new records to migrate. All done!');
      return;
    }
    
    // 4. Transform and prepare data for insertion
    console.log('🔄 Transforming data to parsed_cvs format...');
    const transformedCVs = cvsToMigrate.map(cv => {
      // Extract structured data if available, or use an empty object
      let parsedData = {};
      try {
        if (cv.parsed_data && typeof cv.parsed_data === 'string') {
          parsedData = JSON.parse(cv.parsed_data);
        } else if (cv.parsed_data) {
          parsedData = cv.parsed_data; // Already an object
        }
      } catch (e) {
        console.warn(`⚠️ Could not parse data for CV ${cv.id}:`, e.message);
      }
      
      // Create transformed record
      return {
        id: cv.id, // Preserve the same ID
        user_id: cv.user_id,
        file_name: cv.filename || 'Unnamed CV',
        storage_path: cv.file_path,
        full_text: cv.content,
        
        // Extract fields from parsed_data if available
        name: parsedData.personal?.name || parsedData.name,
        email: parsedData.personal?.email || parsedData.email,
        phone: parsedData.personal?.phone || parsedData.phone,
        linkedin_url: parsedData.personal?.linkedin || parsedData.linkedin,
        github_url: parsedData.personal?.github || parsedData.github,
        website_url: parsedData.personal?.website || parsedData.website,
        location: parsedData.personal?.location || parsedData.location,
        job_title: parsedData.personal?.title || parsedData.job_title,
        summary: parsedData.summary,
        
        // Store complex objects as JSON
        skills: parsedData.skills,
        work_experience: parsedData.work_experience || parsedData.experience,
        education: parsedData.education,
        
        // Metadata
        is_favorite: cv.is_favorite || false,
        created_at: cv.created_at,
        updated_at: cv.updated_at || new Date().toISOString()
      };
    });
    
    // 5. Insert transformed data into parsed_cvs
    console.log('📥 Inserting transformed records into parsed_cvs...');
    const { data: insertedData, error: insertError } = await supabase
      .from('parsed_cvs')
      .insert(transformedCVs)
      .select('id');
    
    if (insertError) {
      console.error('❌ Error inserting data:', insertError);
      return;
    }
    
    console.log(`✅ Successfully migrated ${insertedData.length} records!`);
    
    // 6. Verify migration
    console.log('🔍 Verifying migration...');
    const { count: newCount, error: countError } = await supabase
      .from('parsed_cvs')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error verifying migration:', countError);
    } else {
      console.log(`📊 Total records in parsed_cvs after migration: ${newCount}`);
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error during migration:', error);
  }
}

// Run the migration
migrateCVs().catch(error => {
  console.error('❌ Migration failed:', error);
}); 