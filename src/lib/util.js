import chalk from 'chalk'

function pages2gb(pages) {
  return ((pages * 4096) / 1024 / 1024 / 1024).toFixed(1)
}

function kb2gb(kb) {
  return (kb / (1024 * 1024)).toFixed(1)
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

export default {
  pages2gb: pages2gb,
  kb2gb: kb2gb,
  uptime2str: uptime2str,
}
