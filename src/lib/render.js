import { table } from 'table'
import chalk from 'chalk'
import os from 'os'
import stringWidth from 'string-width'
import execa from 'execa'
import util from './util'

String.prototype.padLeft = function (width) {
  return String(' '.repeat(width) + this).slice(-width)
}

export default async function renderTable() {
  let cnts
  try {
    cnts = await execa('vzlist', ['-a', '--json'])
    cnts = JSON.parse(cnts.stdout)
    // cnts = require('../../test-data.json')
  } catch (err) {
    console.log('OpenVZ must be installed')
    process.exit(1)
  }

  const tableConfig = {
    border: {
      bottomBody: chalk.gray('─'), bottomJoin: '', bottomLeft: '', bottomRight: '',
      bodyLeft: '', bodyRight: '', bodyJoin: '',
      joinBody: chalk.gray('─'), joinLeft: '', joinRight: '', joinJoin: '',
    },
    columnDefault: {
      paddingLeft: 2,
      paddingRight: 2,
    },
    drawHorizontalLine: (index) => {
      return index >= 1
    },
    columns: {
      6: { alignment: 'right' },
      11: { alignment: 'right' },
    },
  }

  const n = chalk.redBright('*')
  let data = [['Status', 'CTID', 'Name', 'Load average', 'IP', 'CPU', 'Proc' + n, 'RAM (GB)' + n, 'Swap (GB)' + n, 'HDD (GB)' + n, 'Disk inodes' + n, 'Uptime']]

  const widthRamCurrent = Math.max(...cnts.map(o => util.pages2gb(o.physpages.held).length))
  const widthRamMax = Math.max(...cnts.map(o => util.pages2gb(o.physpages.maxheld).length))
  const widthRamLimit = Math.max(...cnts.map(o => util.pages2gb(o.physpages.limit).length))
  const widthSwapCurrent = Math.max(...cnts.map(o => util.pages2gb(o.swappages.held).length))
  const widthSwapMax = Math.max(...cnts.map(o => util.pages2gb(o.swappages.maxheld).length))
  const widthSwapLimit = Math.max(...cnts.map(o => util.pages2gb(o.swappages.limit).length))
  const widthDiskCurrent = Math.max(...cnts.map(o => util.kb2gb(o.diskspace.usage).length))
  const widthDiskLimit = Math.max(...cnts.map(o => util.kb2gb(o.diskspace.softlimit).length))
  const widthDiskInodesCurrent = Math.max(...cnts.map(o => o.diskinodes.usage.toString().length))
  const widthDiskInodesLimit = Math.max(...cnts.map(o => o.diskinodes.softlimit.toString().length))

  let usedRam = 0
  let limitRam = 0
  let usedDisk = 0
  let limitDisk = 0

  for (const cnt of cnts) {
    if (cnt.status == 'running') {
      usedRam += cnt.physpages.held
      limitRam += cnt.physpages.limit
      usedDisk += cnt.diskspace.usage
      limitDisk += cnt.diskspace.softlimit
    }

    const ramCurrent = util.pages2gb(cnt.physpages.held).padLeft(widthRamCurrent)
    const ramMax = util.pages2gb(cnt.physpages.maxheld).padLeft(widthRamMax)
    const ramLimit = util.pages2gb(cnt.physpages.limit).padLeft(widthRamLimit)
    const swapCurrent = util.pages2gb(cnt.swappages.held).padLeft(widthSwapCurrent)
    const swapMax = util.pages2gb(cnt.swappages.maxheld).padLeft(widthSwapMax)
    const swapLimit = util.pages2gb(cnt.swappages.limit).padLeft(widthSwapLimit)
    const diskCurrent = util.kb2gb(cnt.diskspace.usage).padLeft(widthDiskCurrent)
    const diskLimit = util.kb2gb(cnt.diskspace.softlimit).padLeft(widthDiskLimit)
    const diskInodesCurrent = cnt.diskinodes.usage.toString().padLeft(widthDiskInodesCurrent)
    const diskInodesLimit = cnt.diskinodes.softlimit.toString().padLeft(widthDiskInodesLimit)

    data.push([
      cnt.status == 'running'
        ? chalk.greenBright(cnt.status)
        : cnt.status == 'stopped'
        ? chalk.redBright(cnt.status)
        : cnt.status,
      chalk.yellowBright(cnt.ctid),
      cnt.name,
      cnt.laverage
        ? chalk.white.bold(cnt.laverage[0].toFixed(2)) + ' ' +
          chalk.cyanBright.bold(cnt.laverage[1].toFixed(2)) + ' ' +
          chalk.cyan(cnt.laverage[2].toFixed(2))
        : '',
      cnt.ip.join('\n').split('.').join(chalk.gray('.')),
      cnt.cpuunits,
      chalk.yellowBright.bold(cnt.numproc.held),
      chalk.yellowBright.bold(ramCurrent) + '  ' + chalk.cyan(ramMax) + '  ' + chalk.white.bold(ramLimit),
      chalk.yellowBright.bold(swapCurrent) + '  ' + chalk.cyan(swapMax) + '  ' + chalk.white.bold(swapLimit),
      chalk.yellowBright.bold(diskCurrent) + '  ' + chalk.white.bold(diskLimit),
      chalk.yellowBright.bold(diskInodesCurrent) + '  ' + chalk.white.bold(diskInodesLimit),
      util.uptime2str(cnt.uptime),
    ])
  }

  const totalRam = os.totalmem()
  let overcommitRam = ((limitRam*4096-totalRam)/(1024*1024*1024)).toFixed(1)
  overcommitRam = overcommitRam <= 0 ? chalk.greenBright(overcommitRam + 'GB') : chalk.redBright(overcommitRam + 'GB')

  const renderedTable = table(data, tableConfig)
  const ramTotals = '  Allocated RAM: ' + chalk.yellowBright.bold(util.pages2gb(usedRam)) + chalk.gray(' / ') +
    chalk.white.bold(util.pages2gb(limitRam) + 'GB') + ' (overcommitment: ' + overcommitRam + ')'
  const diskTotals = '  Allocated disk space: ' + chalk.yellowBright.bold(util.kb2gb(usedDisk)) + chalk.gray(' / ') +
    chalk.white.bold(util.kb2gb(limitDisk) + 'GB')
  const legend = n + ' ' + chalk.yellowBright.bold('Current value') + '  ' + chalk.cyan('Maximum registered usage') + '  ' + chalk.white.bold('Limit  ')
  const indent = stringWidth(renderedTable.split('\n')[1]) - stringWidth(ramTotals) - stringWidth(legend)

  return ('\n' + renderedTable + '\n' + ramTotals + ' '.repeat(indent) + legend + '\n' + diskTotals + '\n')
}
