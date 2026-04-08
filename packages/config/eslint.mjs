import { FlatCompat } from "@eslint/eslintrc";

export function createEslintConfig(dirname) {
  const compat = new FlatCompat({ baseDirectory: dirname });

  return [
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    {
      rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        "@next/next/no-img-element": "warn",
      },
    },
  ];
}
