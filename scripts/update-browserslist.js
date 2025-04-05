import { execSync } from 'node:child_process';

console.log('Updating browserslist database...');

try {
  // Set a timeout of 30 seconds
  const timeout = 30000;
  const start = Date.now();
  
  // Run the update command with a timeout
  execSync('npx update-browserslist-db@latest', {
    timeout,
    stdio: 'inherit'
  });

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`✅ Successfully updated browserslist database in ${duration}s`);
  process.exit(0);
} catch (error) {
  if (error.signal === 'SIGTERM') {
    console.error('❌ Update timed out after 30 seconds');
  } else {
    console.error('❌ Failed to update browserslist database:', error.message);
  }
  // Continue with build even if update fails
  process.exit(0);
}