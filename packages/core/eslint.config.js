import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// 웹(frontend/eslint.config.js)과 같은 규칙. 공용 코드라 브라우저 전역(globals.browser)은 넣지 않음
export default tseslint.config({
  files: ['**/*.{ts,tsx}'],
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  languageOptions: { ecmaVersion: 2022 },
  plugins: { 'react-hooks': reactHooks },
  rules: reactHooks.configs.recommended.rules,
})
