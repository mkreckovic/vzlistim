import arg from 'arg'
import execa from 'execa'
import isRoot from 'is-root'
import { table } from 'table'
import chalk from 'chalk'
import os from 'os'
import stringWidth from 'string-width'
import { version } from '../package.json'

function parseArgumentsIntoOptions(rawArgs) {
  const args = arg(
    {
      '--version': Boolean,
    },
    {
      argv: rawArgs.slice(2),
    },
  )
  return {
    version: args['--version'],
  }
}

function pages2gb(pages) {
  return ((pages * 4096) / 1024 / 1024 / 1024).toFixed(1)
}

function uptime2str(uptime) {
  let days = Math.trunc(uptime / (60 * 60 * 24))
  let mins = Math.trunc(uptime / 60)
  let hours = mins / 60

  days = days >= 1 ? days + 'd' + chalk.gray(':') : ''
  hours = Math.trunc(hours % 24)
  mins = Math.trunc(mins % 60)
  hours = hours < 10 ? '0' + hours : hours
  mins = mins < 10 ? '0' + mins : mins

  return days + hours + 'h' + chalk.gray(':') + mins + 'm'
}

function kb2gb(kb) {
  return (kb / (1024 * 1024)).toFixed(1)
}

export async function cli(args) {
  let options
  let cnts
  let usedRam = 0
  let limitRam = 0
  let usedDisk = 0
  let limitDisk = 0
  let data = []
  let config = {
    border: {
      bottomBody: chalk.gray('─'),
      bottomJoin: '',
      bottomLeft: ' ',
      bottomRight: ' ',
      bodyLeft: ' ',
      bodyRight: ' ',
      bodyJoin: '',
      joinBody: chalk.gray('─'),
      joinLeft: ' ',
      joinRight: ' ',
      joinJoin: '',
    },
    columnDefault: {
      paddingLeft: 1,
      paddingRight: 1,
    },
    drawHorizontalLine: (index, size) => {
      return index === 1 || index === size - 1
    },
    columns: {
      11: {
        alignment: 'right',
      },
    },
  }

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

  try {
    cnts = await execa('vzlist', ['-a', '--json'])
    cnts = JSON.parse(cnts.stdout)
  } catch(err) {
    console.log('OpenVZ must be installed')
    process.exit(1)
  }

  data.push([
    'Status',
    'CTID',
    'Name',
    'Load Average',
    'IP',
    'CPU Units',
    'Processes' + chalk.redBright('*'),
    'RAM (GB)' + chalk.redBright('*'),
    'Swap (GB)' + chalk.redBright('*'),
    'HDD (GB)' + chalk.redBright('*'),
    'Disk inodes' + chalk.redBright('*'),
    'Uptime',
  ])

  for (const cnt of cnts) {
    if (cnt.status == 'running') {
      usedRam += cnt.physpages.held
      limitRam += cnt.physpages.limit
      usedDisk += cnt.diskspace.usage
      limitDisk += cnt.diskspace.softlimit
    }
    data.push([
      cnt.status == 'running' ? chalk.greenBright(cnt.status) : cnt.status,
      chalk.yellowBright(cnt.ctid),
      cnt.name,
      chalk.white.bold(cnt.laverage[0]) +
        ' ' +
        chalk.cyanBright.bold(cnt.laverage[1]) +
        ' ' +
        chalk.cyan(cnt.laverage[2]),
      cnt.ip
        .join('\n')
        .split('.')
        .join(chalk.gray('.')),
      cnt.cpuunits,
      chalk.yellowBright.bold(cnt.numproc.held) +
        chalk.gray('/') +
        chalk.cyan(cnt.numproc.maxheld),
      chalk.yellowBright.bold(pages2gb(cnt.physpages.held)) +
        chalk.gray('/') +
        chalk.cyan(pages2gb(cnt.physpages.maxheld)) +
        chalk.gray('/') +
        chalk.white.bold(pages2gb(cnt.physpages.limit)),
      chalk.yellowBright.bold(pages2gb(cnt.swappages.held)) +
        chalk.gray('/') +
        chalk.cyan(pages2gb(cnt.swappages.maxheld)) +
        chalk.gray('/') +
        chalk.white.bold(pages2gb(cnt.swappages.limit)),
      chalk.yellowBright.bold(kb2gb(cnt.diskspace.usage)) +
        chalk.gray('/') +
        chalk.white.bold(kb2gb(cnt.diskspace.softlimit)),
      chalk.yellowBright.bold(cnt.diskinodes.usage) +
        chalk.gray('/') +
        chalk.white.bold(cnt.diskinodes.softlimit),
      uptime2str(cnt.uptime),
    ])
  }

  const totalRam = os.totalmem()
  let overcommitRam = ((limitRam * 4096 - totalRam) / (1024 * 1024 * 1024)).toFixed(1)
  overcommitRam = overcommitRam <= 0 ? chalk.greenBright(overcommitRam + 'GB') : chalk.redBright(overcommitRam + 'GB')

  const renderedTable = table(data, config)
  const ramTotals =
    '  Allocated RAM: ' +
    chalk.yellowBright.bold(pages2gb(usedRam)) +
    chalk.gray('/') +
    chalk.white.bold(pages2gb(limitRam) + 'GB') +
    ' (overcommitment: ' +
    overcommitRam +
    ')'
  const diskTotals =
    '  Allocated disk space: ' +
    chalk.yellowBright.bold(kb2gb(usedDisk)) +
    chalk.gray('/') +
    chalk.white.bold(kb2gb(limitDisk) + 'GB')
  const legend =
    chalk.redBright('* ') +
    chalk.yellowBright.bold('Current value') +
    chalk.gray('/') +
    chalk.cyan('Maximum registered usage') +
    chalk.gray('/') +
    chalk.white.bold('Limit  ')
  const indent =
    stringWidth(renderedTable.split('\n')[1]) -
    stringWidth(ramTotals) -
    stringWidth(legend)

  console.log('\n' + renderedTable)
  console.log(ramTotals + ' '.repeat(indent) + legend + '\n' + diskTotals + '\n')
}
