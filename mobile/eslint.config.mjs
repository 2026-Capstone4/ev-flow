import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// 웹 · core와 같은 규칙. 설정 파일(metro · babel · tailwind)은 Node CommonJS라 검사에서 뺌
export default tseslint.config(
  { ignores: ['.expo', 'ios', 'dist', '*.config.js', 'expo-env.d.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022 },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
)
