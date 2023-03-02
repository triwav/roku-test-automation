module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    env: {
        node: true,
        mocha: true
    },
    parserOptions: {
        project: ['./tsconfig.json'],
        createDefaultProgram: true
    },
    plugins: [
        '@typescript-eslint'
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    rules: {
        'semi': 'error',
        'no-ex-assign': 'off',
        'no-empty': 'off',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/quotes': [
            'error',
            'single',
            {
                'allowTemplateLiterals': true
            }
        ],
        '@typescript-eslint/require-await': 'error',
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/switch-exhaustiveness-check': 'warn',
        '@typescript-eslint/prefer-enum-initializers': 'error',
        '@typescript-eslint/consistent-type-imports': 'error'
    }
};
