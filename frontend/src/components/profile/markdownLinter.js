// markdownLinter.js (Enhanced Debug Logging)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LinterError = (message, line, lineNumber, context = '') => ({ message, line, lineNumber, context });

function lintMarkdownFile(filePath) {
    console.log(`\n📄 Linting file: ${filePath}...\n`);
    const errors = [];
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split(/\r?\n/);

    let inBlockScalar = false;
    let blockStartIndent = 0;

    for (let i = 0; i < lines.length; i++) {
        const lineNumber = i + 1;
        const line = lines[i];
        const currentIndent = line.search(/\S|$/);

        if (inBlockScalar) {
            if (line.trim() !== '' && currentIndent <= blockStartIndent) {
                console.log(`[DEBUG] ❌ Block ends: Line ${lineNumber} has indent ${currentIndent} <= block start indent ${blockStartIndent}`);
                inBlockScalar = false;
                blockStartIndent = 0;
            } else {
                console.log(`[DEBUG] ✅ Inside block scalar (Line ${lineNumber}) - indent: ${currentIndent}`);
                continue;
            }
        }

        if (line.trim().endsWith('|')) {
            const nextLine = lines[i + 1];
            const nextLineNumber = i + 2;

            if (nextLine) {
                const nextLineIndent = nextLine.search(/\S|$/);
                console.log(`[DEBUG] 📌 Detected block scalar at line ${lineNumber}:`);
                console.log(`        | line content: "${line}"`);
                console.log(`        | indent: ${currentIndent}`);
                console.log(`        ↓ next line: "${nextLine}"`);
                console.log(`        | indent: ${nextLineIndent}`);

                if (nextLine.trim() !== '' && nextLineIndent <= currentIndent) {
                    errors.push(LinterError(
                        'Line after a literal block scalar `|` must be indented.',
                        nextLine,
                        nextLineNumber,
                        `Block starts at line ${lineNumber}, indent: ${currentIndent}, next line indent: ${nextLineIndent}`
                    ));
                }
            } else {
                console.log(`[DEBUG] ⚠️ Block scalar at line ${lineNumber} has no next line.`);
            }

            inBlockScalar = true;
            blockStartIndent = currentIndent;
        }
    }

    if (errors.length > 0) {
        console.error(`\n❌ Found ${errors.length} error(s):`);
        errors.forEach(err => {
            console.error(`  - Line ${err.lineNumber}: ${err.message}`);
            console.error(`    > ${err.line.trim()}`);
            if (err.context) {
                console.error(`    Context: ${err.context}`);
            }
        });
        process.exit(1);
    } else {
        console.log('✅ All good! No YAML block indentation issues found.\n');
    }
}

const markdownFilePath = path.join(__dirname, '..', '..', '..', 'public', 'myProfile.md');
lintMarkdownFile(markdownFilePath);
