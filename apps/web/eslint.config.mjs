import { dirname } from "path";
import { fileURLToPath } from "url";
import { createEslintConfig } from "@kodhom/config/eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default createEslintConfig(__dirname);
