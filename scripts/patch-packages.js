/**
 * Post-install script to patch third-party packages.
 *
 * react-native-render-html v6.x and its dependency
 * @native-html/transient-render-engine both set "react-native": "src/"
 * in their package.json which causes Metro to bundle raw TypeScript
 * source instead of the compiled CommonJS build. This breaks module
 * resolution for internal imports.
 *
 * This script disables the "react-native" field so Metro uses "main"
 * (lib/commonjs/index.js) which contains properly compiled JavaScript.
 */

const fs = require('fs');
const path = require('path');

const patches = [
  {
    package: 'react-native-render-html',
    file: 'package.json',
    find: '"react-native": "src/"',
    replace: '"_react-native-DISABLED": "src/"',
  },
  {
    package: '@native-html/transient-render-engine',
    file: 'package.json',
    find: '"react-native": "src/"',
    replace: '"_react-native-DISABLED": "src/"',
  },
  {
    package: '@native-html/css-processor',
    file: 'package.json',
    find: '"react-native": "src/"',
    replace: '"_react-native-DISABLED": "src/"',
  },
];

for (const patch of patches) {
  const filePath = path.join(
    __dirname,
    '..',
    'node_modules',
    patch.package,
    patch.file,
  );

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(patch.find)) {
      content = content.replace(patch.find, patch.replace);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[patch-packages] Patched ${patch.package}/${patch.file}`);
    }
  } catch {
    // Package not installed yet — skip silently
  }
}
