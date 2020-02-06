import arg from 'arg'
import isRoot from 'is-root'
import logUpdate from 'log-update'
import renderTable from './lib/render'
import { version } from '../package.json'

function parseArgumentsIntoOptions(rawArgs) {
  const args = arg(
    {
      '--version': Boolean,
      '--live': Boolean,

      '-v': '--version',
      '-l': '--live',
    },
    {
      argv: rawArgs.slice(2),
    },
  )
  return {
    version: args['--version'],
    live: args['--live'],
  }
}

export async function cli(args) {
  let options

  try {
    options = parseArgumentsIntoOptions(args)
  } catch (err) {
    if (err.code === 'ARG_UNKNOWN_OPTION') {
      console.error(err.message)
    } else {
      throw err
    }
    process.exit(1)
  }

  if (options.version) {
    console.log('v' + version)
    process.exit()
  }

  if (!isRoot()) {
    console.log('This program can be run by root only')
    process.exit(1)
  }

  if (options.live) {
    setInterval(async () => {
      logUpdate(await renderTable())
    }, 1500)
  } else {
    console.log(await renderTable())
  }
}
