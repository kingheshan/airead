import fs from 'fs';
import vm from 'vm';

function main() {
  const filePath = '/Users/king/Desktop/xiaoluAIRead/v2/index.html';
  if (!fs.existsSync(filePath)) {
    console.error('v2/index.html not found');
    process.exit(1);
  }
  
  const html = fs.readFileSync(filePath, 'utf8');
  // Find the LAST script block since it contains all controllers
  const startIdx = html.lastIndexOf('<script>');
  const endIdx = html.indexOf('</script>', startIdx);
  
  if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find script block');
    process.exit(1);
  }
  
  const js = html.slice(startIdx + '<script>'.length, endIdx);
  
  try {
    new vm.Script(js);
    console.log('V2 client-side JavaScript syntax is 100% VALID!');
  } catch (err) {
    console.error('Syntax error in v2/index.html script block:', err.message);
    // Print lines around the error if possible
    console.error(err.stack);
    process.exit(1);
  }
}

main();
