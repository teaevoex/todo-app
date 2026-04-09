import nextConfig from 'eslint-config-next'

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['node_modules/', '.next/', '__tests__/', 'coverage/'],
  },
]

export default eslintConfig
