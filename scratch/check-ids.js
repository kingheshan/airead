import fs from 'fs';

function checkIds() {
  const html = fs.readFileSync('/Users/king/Desktop/xiaoluAIRead/index.html', 'utf8');
  
  // Extract script content
  const startIdx = html.indexOf('<script>');
  const endIdx = html.indexOf('</script>', startIdx);
  const js = html.slice(startIdx + '<script>'.length, endIdx);
  
  // Regex to find all document.getElementById('...') or document.getElementById("...")
  const regex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
  let match;
  const ids = [];
  while ((match = regex.exec(js)) !== null) {
    ids.push(match[1]);
  }
  
  console.log(`Found ${ids.length} getElementById calls. Checking if they exist in HTML...`);
  
  let missing = 0;
  ids.forEach(id => {
    // Check if the id exists as an attribute in the HTML
    // We search for id="ID" or id='ID' in the entire file
    const idRegex = new RegExp(`id=['"]${id}['"]`, 'i');
    if (!idRegex.test(html)) {
      console.error(`Missing element ID in HTML: "${id}"`);
      missing++;
    }
  });
  
  if (missing === 0) {
    console.log('All elements exist in HTML layout! No missing IDs.');
  } else {
    console.log(`Found ${missing} missing elements.`);
  }
}

checkIds();
