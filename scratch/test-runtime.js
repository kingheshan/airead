import fs from 'fs';
import vm from 'vm';

function runTest() {
  const html = fs.readFileSync('/Users/king/Desktop/xiaoluAIRead/index.html', 'utf8');
  const startIdx = html.indexOf('<script>');
  const endIdx = html.indexOf('</script>', startIdx);
  const js = html.slice(startIdx + '<script>'.length, endIdx);

  // Set up mock DOM environment
  const mockWindow = {};
  const mockDocument = {
    getElementById: (id) => {
      // Return a dummy element with standard properties
      return {
        id: id,
        classList: {
          add: () => {},
          remove: () => {},
          toggle: () => {},
          contains: () => false,
        },
        addEventListener: () => {},
        dispatchEvent: () => {},
        style: {},
        value: '',
        files: [],
        click: () => {},
      };
    },
    querySelectorAll: (selector) => {
      // Return a dummy list of elements
      return {
        forEach: (cb) => {
          cb({
            dataset: { view: 'report' },
            classList: {
              toggle: () => {},
            },
            addEventListener: () => {},
          });
        },
      };
    },
    createElement: () => {
      return {
        href: '',
        download: '',
      };
    },
    body: {
      appendChild: () => {},
      style: {},
    },
  };

  const context = {
    window: mockWindow,
    document: mockDocument,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    Event: function() {},
    URL: {
      createObjectURL: () => '',
      revokeObjectURL: () => {},
    },
    console: {
      log: (...args) => console.log('[VM log]:', ...args),
      error: (...args) => console.error('[VM error]:', ...args),
      warn: (...args) => console.warn('[VM warn]:', ...args),
    },
    setTimeout: () => {},
    setInterval: () => {},
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  };

  // Merge window-bound variables to context
  context.self = context;
  
  try {
    vm.createContext(context);
    vm.runInContext(js, context);
    console.log('Runtime execution in mock DOM completed without any errors!');
    
    // Check if setActiveTab is bound or exists in scope
    if (typeof context.setActiveTab === 'function') {
      console.log('setActiveTab is defined in scope as a function.');
    } else {
      console.log('setActiveTab is NOT defined in scope! (Type is: ' + typeof context.setActiveTab + ')');
    }
  } catch (err) {
    console.error('Runtime error in index.html JS execution:', err);
  }
}

runTest();
