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
  return files
    .reduce((a, f) => a.concat(f), [])
    .filter(f => f.endsWith('.mjs') || f.endsWith('.jsx'))
}

const ext = (path, x) => `${path.slice(0, -4)}.${x}`
const transform = opts => {
  const handler = ({ node }) => {
    if (
      node.source &&
      node.source.value.startsWith('.') &&
      node.source.value.endsWith(opts.from)
    ) {
      node.source.value = ext(node.source.value, opts.to)
    }
  }
  return () => ({
    name: 'transform-rename-ext',
    visitor: {
      ImportDeclaration: handler,
      ExportAllDeclaration: handler,
    },
  })
}

const jsx2mjs = transform({ from: 'jsx', to: 'mjs' })
const mjs2js = transform({ from: 'mjs', to: 'js' })

const config = {
  jsx: { plugins: [jsx2mjs, '@babel/plugin-transform-react-jsx'] },
  mjs: { plugins: [mjs2js, 'transform-es2015-modules-commonjs'] },
}

const blackList = ['node_modules', '.git']

module.exports.transformDir = async (acc, path) => {
  await acc
  const files = await readdir(path)
  await Promise.all(
    files.map(async path => {
      let code = await fs.readFile(path, 'utf8')
      code = core.transform(code, config.jsx).code
      if (path.endsWith('.jsx')) {
        console.log('writing file', ext(path, 'mjs'))
        await fs.writeFile(ext(path, 'mjs'), code + '\n', 'utf8')
      }
      code = core.transform(code, config.mjs).code
        console.log('writing file', ext(path, 'js'))
      return fs.writeFile(ext(path, 'js'), code + '\n', 'utf8')
    }),
  )
}
