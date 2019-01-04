const core = require('@babel/core')
const fs = require('fs').promises
const { resolve } = require('path')

const readdir = async dir => {
  const names = await fs.readdir(dir)
  const files = await Promise.all(
    names
      .filter(name => !blackList.includes(name))
      .map(name => resolve(dir, name))
      .map(async p => ((await fs.stat(p)).isDirectory() ? readdir(p) : p)),
  )
  return files.reduce((a, f) => a.concat(f), []).filter(f => f.endsWith('.mjs'))
}

const renameMjs = path => `${path.slice(0, -4)}.js`
const replaceMjs = ({ node }) => {
  if (
    node.source &&
    node.source.value.endsWith('.mjs') &&
    node.source.value.startsWith('.')
  ) {
    node.source.value = renameMjs(node.source.value)
  }
}

const babelConfig = {
  plugins: [
    () => ({
      name: 'transform-rename-mjs',
      visitor: {
        ImportDeclaration: replaceMjs,
        ExportAllDeclaration: replaceMjs,
      },
    }),
    '@babel/plugin-transform-react-jsx',
    'transform-es2015-modules-commonjs',
  ],
}

const blackList = ['node_modules', '.git']

module.exports.transformDir = async (acc, path) => {
  await acc
  const files = await readdir(path)
  await Promise.all(
    files.map(async path => {
      const code = await fs.readFile(path, 'utf8')
      return fs.writeFile(
        renameMjs(path),
        core.transform(code, babelConfig).code + '\n',
        'utf8',
      )
    }),
  )
}
