import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const MAX_COMMITS = 5

function getLastCommits() {
  const format = '%H|%s|%ai|%an'
  const raw = execSync(`git log --format="${format}" -${MAX_COMMITS}`, {
    cwd: root,
    encoding: 'utf-8',
  }).trim()

  if (!raw) return []

  return raw.split('\n').map((line) => {
    const [hash, ...rest] = line.split('|')
    const message = rest.slice(0, -2).join('|')
    const date = rest[rest.length - 2]
    const author = rest[rest.length - 1]
    return {
      hash,
      shortHash: hash.slice(0, 7),
      message,
      date,
      author,
    }
  })
}

const commits = getLastCommits()

const changelog = {
  commits,
  generatedAt: new Date().toISOString(),
  latestTimestamp: commits.length > 0 ? commits[0].date : null,
}

const dataDir = join(root, 'data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

writeFileSync(join(dataDir, 'changelog.json'), JSON.stringify(changelog, null, 2))
writeFileSync(join(root, 'public', 'changelog.json'), JSON.stringify(changelog, null, 2))

console.log(`Changelog generated: ${commits.length} commits`)
