const nextJest = require('next/jest');

const createJestConfig = nextJest({
    dir: './',
});

const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
        }],
    },
    projects: [
        {
            displayName: 'unit',
            testEnvironment: 'jest-environment-jsdom',
            testMatch: ['**/tests/unit/**/*.test.[jt]s?(x)'],
            setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
            moduleNameMapper: {
                '^@/(.*)$': '<rootDir>/$1',
            },
            transform: {
                '^.+\\.(ts|tsx)$': ['ts-jest', {
                    tsconfig: 'tsconfig.json',
                }],
            },
        },
        {
            displayName: 'integration',
            testEnvironment: 'node',
            testMatch: [
                '**/tests/integration/**/*.test.ts',
                '**/tests/performance/**/*.test.ts'
            ],
            moduleNameMapper: {
                '^@/(.*)$': '<rootDir>/$1',
            },
            transform: {
                '^.+\\.(ts|tsx)$': ['ts-jest', {
                    tsconfig: 'tsconfig.json',
                }],
            },
        }
    ]
};

module.exports = createJestConfig(customJestConfig);
