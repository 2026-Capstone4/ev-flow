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
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 글꼴 배율 상한이 들어간 components/Text를 쓰게 함. react-native에서 바로 가져오면 글꼴을 키운 폰에서 화면이 깨짐
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text', 'TextInput'],
              message: '글꼴 배율 상한이 들어간 src/components/Text의 Text · TextInput을 쓰세요',
            },
          ],
        },
      ],
    },
  },
  // 공통 Text 파일만 react-native Text를 직접 감쌈
  {
    files: ['src/components/Text.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
