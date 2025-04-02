// This script creates a simple favicon.ico file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a buffer with minimal favicon content (1x1 transparent pixel)
const faviconBuffer = Buffer.from('AAABAAEAEBACAAEAAQCwAAAAFgAAACgAAAAQAAAAIAAAAAEAAQAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'base64');

// Write to the favicon.ico file in the public directory
fs.writeFileSync(
  path.join(__dirname, 'favicon.ico'),
  faviconBuffer
);

console.log('Favicon.ico created successfully!');
