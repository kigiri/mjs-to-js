const core = require('@babel/core')
const fs = require('fs').promises
const { resolve } = require('path')

const isDirectory = async path => (await fs.stat(path)).isDirectory()
const blackListTester = arr => name => !arr.includes(name)
const readdir = async (dir, test) => {
  const names = await fs.readdir(dir)
  const files = await Promise.all(
    names
      .filter(test)
      .map(name => resolve(dir, name))
      .map(async p => ((await isDirectory(p)) ? readdir(p, test) : p)),
  )
  return files.reduce((a, f) => a.concat(f), [])
}

const ext = (path, x) => `${path.slice(0, -3)}.${x}`
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
      ImportNamespaceSpecifier: handler,
      ExportAllDeclaration: handler,
      ExportNamedDeclaration: handler,
    },
  })
}

// const jsx2mjs = transform({ from: 'jsx', to: 'mjs' })
// const mjs2js = transform({ from: 'mjs', to: 'js' })

const conf = {
  plugins: [
    transform({ from: 'js', to: 'build.js' }),
    '@babel/plugin-transform-react-jsx',
    '@babel/plugin-syntax-dynamic-import',
    'transform-es2015-modules-commonjs',
  ],
}
// const config = {
//   jsx: { plugins: [jsx2mjs, '@babel/plugin-transform-react-jsx'] },
//   mjs: { plugins: [mjs2js, 'transform-es2015-modules-commonjs'] },
// }

readdir.blackList = (dir, arr) => readdir(dir, blackListTester(arr))
module.exports.readdir = readdir

const transformFile = (module.exports.transformFile = async path => {
  let code = await fs.readFile(path, 'utf8')
  // code = core.transform(code, config.jsx).code
  // if (path.endsWith('.jsx')) {
  //   console.log('writing file', ext(path, 'mjs'))
  //   await fs.writeFile(ext(path, 'mjs'), code + '\n', 'utf8')
  // }
  code = core.transform(code, conf).code
  console.log('writing file', ext(path, 'build.js'))
  return fs.writeFile(ext(path, 'build.js'), code + '\n', 'utf8')
})

const defaultExclude = blackListTester(['node_modules', '.git'])
const transformDir = (module.exports.transformDir = async (path, test) => {
  const files = (await readdir(path, test)).filter(
    f => f.endsWith('.js') && !f.endsWith('.build.js'),
  )

  return Promise.all(files.map(transformFile))
})

const transformAll = (module.exports.transformAll = async (acc, path, test) => {
  await acc

  if (Array.isArray(test)) {
    test = blackListTester(test)
  } else if (typeof test !== 'function') {
    test = defaultExclude
  }

  return (await isDirectory(path))
    ? transformDir(path, test)
    : transformFile(path)
})
