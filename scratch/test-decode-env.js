import OpenAI from 'openai';

const testKey = (val) => {
  const trimmedVal = val.trim();
  let decodedVal = trimmedVal;
  if (trimmedVal.includes('__DOUBLE_DASH__')) {
    decodedVal = trimmedVal.replace(/__DOUBLE_DASH__/g, '--');
  } else if (!trimmedVal.startsWith('sk-')) {
    let decoded = null;
    // 1. Try Hex decoding (Hex consists only of 0-9, a-f, A-F)
    if (/^[0-9a-fA-F]+$/.test(trimmedVal)) {
      try {
        const hexDecoded = Buffer.from(trimmedVal, 'hex').toString('utf8');
        if (hexDecoded.startsWith('sk-')) {
          decoded = hexDecoded;
        }
      } catch (e) {}
    }
    // 2. Try Base64 decoding (Base64 can have padding '=' or not)
    if (!decoded) {
      try {
        const base64Decoded = Buffer.from(trimmedVal, 'base64').toString('utf8');
        if (base64Decoded.startsWith('sk-')) {
          decoded = base64Decoded;
        }
      } catch (e) {}
    }
    if (decoded) {
      decodedVal = decoded;
    }
  }
  return decodedVal.trim();
};

const original = 'REDACTED_API_KEY';
const b1 = 'c2stcHJvai1Pc3FtSjhqMWkwQzZHaGxBdTdVMkMzaUtteC0tVF9QOFg1cDlkRUxJLVFnNzlkY3ZjSHByV1NKQkZYSlVKcDJVeEtJUXppZ2JiZFQzQmxia0ZKU2NkMG16NTNER0ltaHdmRmhrOUx4WXQ4X2g3VXR6cXZiTGlnRmRadUphaFVMV0JFRUxKbU9EbHMxVjVoZE0xMlFyZXBlZ3phd0E=';
const b2 = 'c2stcHJvai1Pc3FtSjhqMWkwQzZHaGxBdTdVMkMzaUtteC0tVF9QOFg1cDlkRUxJLVFnNzlkY3ZjSHByV1NKQkZYSlVKcDJVeEtJUXppZ2JiZFQzQmxia0ZKU2NkMG16NTNER0ltaHdmRmhrOUx4WXQ4X2g3VXR6cXZiTGlnRmRadUphaFVMV0JFRUxKbU9EbHMxVjVoZE0xMlFyZXBlZ3phd0E';

const d1 = testKey(b1);
const d2 = testKey(b2);

console.log('d1 matches:', d1 === original, 'length:', d1.length);
console.log('d2 matches:', d2 === original, 'length:', d2.length);

const client = new OpenAI({ apiKey: d1 });
try {
  const models = await client.models.list();
  console.log('Decoded key test success! Count:', models.data.length);
} catch (error) {
  console.error('Decoded key test failed:', error);
}
