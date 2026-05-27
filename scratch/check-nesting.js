import fs from 'fs';
import * as acorn from 'acorn';

function check() {
  const html = fs.readFileSync('/Users/king/Desktop/xiaoluAIRead/index.html', 'utf8');
  const startIdx = html.indexOf('<script>');
  const endIdx = html.indexOf('</script>', startIdx);
  const js = html.slice(startIdx + '<script>'.length, endIdx);

  const ast = acorn.parse(js, { ecmaVersion: 2022, sourceType: 'module' });
  
  let setActiveTabNode = null;
  
  // Custom tree traversal to find the node and its path
  function traverse(node, path) {
    if (!node) return;
    const currentPath = [...path, node.type];
    
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'setActiveTab') {
      setActiveTabNode = { node, path: currentPath };
      return;
    }
    
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => traverse(child, currentPath));
        } else {
          traverse(node[key], currentPath);
        }
      }
    }
  }
  
  traverse(ast, []);
  
  if (setActiveTabNode) {
    console.log('Found setActiveTab. AST Path:', setActiveTabNode.path.join(' -> '));
  } else {
    console.log('setActiveTab NOT found in AST!');
  }
}

check();
