let {Api: VscaleApi} = require('./vscale')

let log = {
    info(msg) {
        console.log(msg)
    },
    error(msg) {
        console.dir(msg, {depth: 5})
    }
}

run().catch((err) => {
    console.error(err)
})

async function run() {
    let config = getConfig()

    let serverNames = config.get('servers')
    let token = config.get('token')
    let vscaleApi = new VscaleApi({token})
    let servers  = await vscaleApi.getServers()

    // Create servers list
    let backupServers = new Map()
    for (let server of servers) {
        if (serverNames.includes(server.name) === false) {
            continue
        }
        backupServers.set(server.ctid, {
            id: server.ctid,
            name: server.name,
            backups: []
        })
    }

    // Add automatic backup to servers list
    let backupCheckRe = /_auto_/i;
    let backupDateRe = /.+_(.+)$/;
    let backupTtl = 1 * 24 * 60 * 60 * 1000
    let backups = await vscaleApi.getBackups()
    for (let backup of backups) {
        let {name} = backup
        if (backupCheckRe.test(name) === false) {
            continue
        }
        let serverId = backup.scalet
        if (backupServers.has(serverId) === false) {
            continue
        }
        let dateMatch = name.match(backupDateRe)
        if (dateMatch === null) {
            continue
        }
        let date = new Date(dateMatch[1]).getTime()
        backupServers.get(serverId).backups.push({
            id: backup.id,
            name,
            date,
            isExpired: (Date.now() - backupTtl) > date
        })
    }

    // Create new backup if needed
    for (let server of backupServers.values()) {
        let serverName = server.name
        log.info(`[${serverName}] Create backup`)
        let serverId = server.id
        let hasActiveBackup = false
        for (let backup of server.backups) {
            if (backup.isExpired === false) {
                log.info(`[${serverName}] Active backup "${backup.name}"`)
                hasActiveBackup = true
            }
        }
        if (hasActiveBackup) {
            log.info(`[${serverName}] Backup is not needed, because. there are still outdated`)
            continue
        }

        // Create backup
        let backupDate = new Date().toISOString()
        // The frequency of requests to the server creation and backup endpoints is limited to 12 requests per minute.
        // https://developers.vscale.io/documentation/api/v1/#api-_
        await delay(6000)
        let backupName = `${serverName}_auto_backup_${backupDate}`
        log.info(`[${serverName}] Backup name: "${backupName}"`)
        let backup = null
        try {
            backup = await vscaleApi.createBackup({
                serverId,
                name: backupName
            })
        } catch (origErr) {
            let err = new Error(`[${serverName}] Error to create backup: "${backupName}"`)
            err.server = server
            err.backupName = backupName
            err.originalError = origErr
            log.error(err)
            continue
        }
    }

    // Delete old backups
    for (let server of backupServers.values()) {
        let serverName = server.name
        log.info(`[${serverName}] Delete old backups`)
        for (let backup of server.backups) {
            if (backup.isExpired === false) {
                continue
            }
            log.info(`[${serverName}] Delete backup "${backup.name}"`)
            await vscaleApi.deleteBackup({
                id: backup.id
            })
        }
    }
}

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function getConfig() {
    let nconf = require('nconf')
    let nconfYaml = require('nconf-yaml')

    nconf.env({
        separator: '__'
    }).file({
        file: 'config.yml',
        format: nconfYaml
    })
    return nconf
}
