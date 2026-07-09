#!/usr/bin/env node
const fs = require('fs');

const files = process.argv.slice(2);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect: "  return function SomeName(" pattern inside a vi.mock factory
    const match = line.match(/^(\s+)return function (\w+)\s*\(/);
    if (match) {
      const indent = match[1];
      // Check if previous non-empty lines are inside a vi.mock factory
      // Replace "return function" with "return { default: function"
      result.push(line.replace('return function', 'return { default: function'));

      // Now track braces to find the end of this function
      let braceCount = 0;
      for (const ch of line) {
        if (ch === '{') braceCount++;
        if (ch === '}') braceCount--;
      }

      i++;
      // Keep reading until braces balance (function body ends)
      while (i < lines.length && braceCount > 0) {
        const currentLine = lines[i];
        for (const ch of currentLine) {
          if (ch === '{') braceCount++;
          if (ch === '}') braceCount--;
        }

        if (braceCount === 0) {
          // This line closes the function. It should end with ";"
          // We need to add " }" before the ";" to close the { default: } wrapper
          // Typical line: "  };" -- transform to "  } };"
          result.push(currentLine.replace(/;\s*$/, ' };'));
        } else {
          result.push(currentLine);
        }
        i++;
      }
      continue;
    }

    result.push(line);
    i++;
  }

  const newContent = result.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(file, newContent);
    console.log(`Fixed: ${file}`);
  } else {
    console.log(`No changes: ${file}`);
  }
}
