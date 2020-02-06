import { table } from 'table'
import chalk from 'chalk'
import os from 'os'
import stringWidth from 'string-width'
import execa from 'execa'
import util from './util'

export default async function renderTable() {
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
    cnts = await execa('vzlist', ['-a', '--json'])
    cnts = JSON.parse(cnts.stdout)
  } catch (err) {
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
      chalk.yellowBright.bold(util.pages2gb(cnt.physpages.held)) +
        chalk.gray('/') +
        chalk.cyan(util.pages2gb(cnt.physpages.maxheld)) +
        chalk.gray('/') +
        chalk.white.bold(util.pages2gb(cnt.physpages.limit)),
      chalk.yellowBright.bold(util.pages2gb(cnt.swappages.held)) +
        chalk.gray('/') +
        chalk.cyan(util.pages2gb(cnt.swappages.maxheld)) +
        chalk.gray('/') +
        chalk.white.bold(util.pages2gb(cnt.swappages.limit)),
      chalk.yellowBright.bold(util.kb2gb(cnt.diskspace.usage)) +
        chalk.gray('/') +
        chalk.white.bold(util.kb2gb(cnt.diskspace.softlimit)),
      chalk.yellowBright.bold(cnt.diskinodes.usage) +
        chalk.gray('/') +
        chalk.white.bold(cnt.diskinodes.softlimit),
      util.uptime2str(cnt.uptime),
    ])
  }

  const totalRam = os.totalmem()
  let overcommitRam = (
    (limitRam * 4096 - totalRam) /
    (1024 * 1024 * 1024)
  ).toFixed(1)
  overcommitRam =
    overcommitRam <= 0
      ? chalk.greenBright(overcommitRam + 'GB')
      : chalk.redBright(overcommitRam + 'GB')

  const renderedTable = table(data, config)
  const ramTotals =
    '  Allocated RAM: ' +
    chalk.yellowBright.bold(util.pages2gb(usedRam)) +
    chalk.gray('/') +
    chalk.white.bold(util.pages2gb(limitRam) + 'GB') +
    ' (overcommitment: ' +
    overcommitRam +
    ')'
  const diskTotals =
    '  Allocated disk space: ' +
    chalk.yellowBright.bold(util.kb2gb(usedDisk)) +
    chalk.gray('/') +
    chalk.white.bold(util.kb2gb(limitDisk) + 'GB')
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

  return (
    '\n' +
    renderedTable +
    '\n' +
    ramTotals +
    ' '.repeat(indent) +
    legend +
    '\n' +
    diskTotals +
    '\n'
  )
}
