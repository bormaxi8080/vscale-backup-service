let axios = require('axios')

class Api {
    constructor({token}) {
        this._baseUrl = 'https://api.vscale.io'
        this._token = token
    }

    async _send({url, method = 'get', params, data}) {
        try {
            return await axios({
                baseURL: this._baseUrl,
                headers: {
                    'X-Token': this._token
                },
                url,
                method,
                params,
                data
            })
        } catch (origErr) {
            let err = new Error(origErr.message)
            err.config = origErr.config
            let origRes = origErr.response
            err.response = {
                status: origRes.status,
                statusText: origRes.statusText,
                headers: origRes.headers,
                data: origRes.data
            }
            throw err
        }
    }

    async _getData(args) {
        let res = await this._send(args)
        return res.data
    }

    getServers() {
        return this._getData({
            url: '/v1/scalets'
        })
    }

    getBackups() {
        return this._getData({
            url: '/v1/backups'
        })
    }

    createBackup({serverId, name}) {
        return this._getData({
            url: `/v1/scalets/${serverId}/backup`,
            method: 'post',
            data: {
                name
            }
        })
    }

    deleteBackup({id}) {
        return this._getData({
            url: `/v1/backups/${id}`,
            method: 'delete'
        })
    }

    async getBackupFromList({id}) {
        let backups = await this.getBackups()
        for (let backup of backups) {
            if (backup.id === id) {
                return backup
            }
        }
        return null
    }
}

module.exports = {
    Api
}
