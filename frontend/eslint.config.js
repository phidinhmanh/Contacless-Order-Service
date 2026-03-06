import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import jest from 'eslint-plugin-jest';
import react from 'eslint-plugin-react';

export default [
    // 1. GLOBAL IGNORES (Must be first)
    // This prevents ESLint from even looking at these folders.
    {
        ignores: [
            '.next/**',
            'out/**',
            'build/**',
            'dist/**',
            'node_modules/**',
            'next-env.d.ts',
            '*.config.js', // Ignore root config files unless you want to lint them
        ],
    },

    // 2. BASE CONFIG FOR ALL JS/TS FILES
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
                // Only enable project for TS files to avoid parsing errors on JS config files
                project: true,
                // Or strictly: project: './tsconfig.json' (but ensure all linted files are in tsconfig)
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
            react,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...typescript.configs.recommended.rules,

            // React specific
            'react/display-name': 'off',
            'react/react-in-jsx-scope': 'off', // Not needed for React 17+
            'react/prop-types': 'off', // We use TypeScript for prop types

            // TypeScript specific
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': 'error',
            'no-undef': 'off', // TypeScript handles this
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },

    // 3. JEST CONFIG (Only for test files)
    {
        files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
        plugins: {
            jest,
        },
        rules: {
            ...jest.configs.recommended.rules,
        },
        languageOptions: {
            globals: {
                // Jest globals
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                jest: 'readonly',
            },
        },
    }
];
