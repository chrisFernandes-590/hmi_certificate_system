import tsParser from '@typescript-eslint/parser'

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXElement[openingElement.name.name="select"]',
          message: 'Raw <select> is banned. Use @/components/ui/Select instead.',
        },
        {
          selector: 'JSXElement[openingElement.name.name="option"]',
          message: 'Raw <option> is banned. Use @/components/ui/Select instead.',
        },
      ],
    },
  },
]
