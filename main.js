'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;
const Json2iob = require('json2iob');
const crypto = require('crypto');

const convert = require('xml-js');

class Syrconnectapp extends utils.Adapter {
  /**
   * @param [options]
   */
  constructor(options) {
    super({
      ...options,
      name: 'syrconnectapp',
    });
    this.on('ready', this.onReady.bind(this));
    this.on('stateChange', this.onStateChange.bind(this));
    this.on('unload', this.onUnload.bind(this));
    this.deviceArray = [];
    this.json2iob = new Json2iob(this);
    this.requestClient = axios.create({});
    this.key = Buffer.from('d805a5c409dc354b6ccf03a2c29a5825851cf31979abf526ede72570c52cf954', 'hex');
    this.iv = Buffer.from('408a42beb8a1cefad990098584ed51a5', 'hex');
  }

  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    // Reset the connection indicator during startup
    this.setState('info.connection', false, true);
    if (this.config.interval < 0.5) {
      this.log.info('Set interval to minimum 0.5');
      this.config.interval = 0.5;
    }
    if (!this.config.username || !this.config.password) {
      this.log.error('Please set username and password in the instance settings');
      return;
    }

    this.updateInterval = null;
    this.session = {};
    this.subscribeStates('*');
    this.log.info('Get projects and devices');
    await this.getProjects();
    await this.getDeviceList();
    await this.updateDevices();
    this.updateInterval = setInterval(async () => {
      await this.updateDevices();
    }, this.config.interval * 60 * 1000);
    //every 1 week
    this.refreshTokenInterval = setInterval(async () => {
      await this.getProjects();
    }, 1000 * 60 * 60 * 24 * 7);
  }
  async getProjects() {
    //create timestamp format YYYY-MM-DD HH:MM:SS
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const payload = `<nfo v="SYR Connect" version="3.7.10" osv="15.8.3" os="iOS" dn="iPhone" ts="${timestamp}" tzo="01:00:00" lng="de" reg="DE" /><usr n="${this.config.username}" v="${this.config.password}" />`;
    await this.requestClient({
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://syrconnectapp.de/WebServices/Api/SyrApiService.svc/REST/GetProjects',
      headers: {
        'Content-Type': 'text/xml',
        Connection: 'keep-alive',
        Accept: '*/*',
        'User-Agent': 'SYR/400 CFNetwork/1335.0.3.4 Darwin/21.6.0',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      data: `<?xml version="1.0" encoding="utf-8"?><sc><api version="1.0">${payload}</api></sc>`,
    })
      .then(async (res) => {
        this.log.debug(JSON.stringify(res.data));
        const encryptedXml = JSON.parse(
          convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true, alwaysArray: true }),
        );

        const decrypted = this.decryptPayload(encryptedXml.sc.api._text);
        this.log.debug(decrypted);
        const convertedJson = convert.xml2json('<xml>' + decrypted + '</xml>', {
          compact: true,
          spaces: 2,
          nativeTypeAttributes: true,
          alwaysArray: true,
        });
        const parsedJSON = JSON.parse(convertedJson);
        this.log.debug(parsedJSON);
        this.session = parsedJSON.xml.usr._attributes;
        this.setState('info.connection', true, true);
        // this.log.info(`Found ${json.prs} devices`);
        // if (Array.isArray(json.prs.pre)) {
        // test if pre is an array
        let projectArray = parsedJSON.xml.prs.pre;
        if (!Array.isArray(parsedJSON.xml.prs.pre)) {
          projectArray = [parsedJSON.xml.prs.pre];
        }
        this.log.info(`Found ${projectArray.length} projects`);
        for (let project of projectArray) {
          project = project._attributes;
          const id = project.id;
          const name = project.n;

          await this.setObjectNotExistsAsync(id, {
            type: 'device',
            common: {
              name: name,
            },
            native: {},
          });

          this.json2iob.parse(id, project, { forceIndex: true });
          this.getDeviceList(id);
        }
      })
      .catch((error) => {
        this.log.error(error);
        error.response && this.log.error(JSON.stringify(error.response.data));
      });
  }
  async getDeviceList(projectId) {
    await this.requestClient({
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://syrconnectapp.de/WebServices/SyrControlWebServiceTest2.asmx/GetProjectDeviceCollections',
      headers: {
        Host: 'syrconnectapp.de',
        'Content-Type': 'application/x-www-form-urlencoded',
        Connection: 'keep-alive',
        Accept: '*/*',
        'User-Agent': 'SYR/400 CFNetwork/1335.0.3.4 Darwin/21.6.0',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      data: {
        xml: `<?xml version="1.0" encoding="utf-8"?><sc><si v="App-3.7.10-de-DE-iOS-iPhone-15.8.3-de.consoft.syr.connect" /><us ug="${this.session.id}" /><prs><pr pg="${projectId}" /></prs><cs v="11F2B"/></sc>`,
      },
    })
      .then(async (res) => {
        this.log.debug(JSON.stringify(res.data));

        const convertedJson = convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true, alwaysArray: true });
        this.log.debug(convertedJson);
        const jsonParsed = JSON.parse(convertedJson);
        // this.log.info(`Found ${json.prs} devices`);
        // if (Array.isArray(json.prs.pre)) {
        // test if pre is an array
        let deviceArray = jsonParsed.sc.dvs;
        if (!Array.isArray(jsonParsed.sc.dvs)) {
          deviceArray = [jsonParsed.sc.dvs];
        }
        this.log.info(`Found ${deviceArray.length} devices in project ${projectId}`);
        for (const device of deviceArray) {
          const id = device.sn;

          this.deviceArray.push(id);
          const name = device.dfw;

          await this.setObjectNotExistsAsync(projectId + '.' + id, {
            type: 'device',
            common: {
              name: name,
            },
            native: {},
          });
          await this.setObjectNotExistsAsync(projectId + '.' + id + '.remote', {
            type: 'channel',
            common: {
              name: 'Remote Controls',
            },
            native: {},
          });

          const remoteArray = [{ command: 'Refresh', name: 'True = Refresh' }];
          remoteArray.forEach((remote) => {
            this.setObjectNotExists(id + '.remote.' + remote.command, {
              type: 'state',
              common: {
                name: remote.name || '',
                type: remote.type || 'boolean',
                role: remote.role || 'boolean',
                def: remote.def || false,
                write: true,
                read: true,
              },
              native: {},
            });
          });
          this.json2iob.parse(projectId + '.' + id, device, { forceIndex: true });
        }
      })
      .catch((error) => {
        this.log.error('Failed to get device list');
        this.log.error(error);
        error.response && this.log.error(JSON.stringify(error.response.data));
      });
  }
  async updateDevices() {
    for (const id of this.deviceArray) {
      await this.requestClient({
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://syrconnectapp.de/WebServices/SyrControlWebServiceTest2.asmx/GetDeviceCollectionStatus',
        headers: {
          Host: 'syrconnectapp.de',
          'Content-Type': 'application/x-www-form-urlencoded',
          Connection: 'keep-alive',
          Accept: '*/*',
          'User-Agent': 'SYR/400 CFNetwork/1335.0.3.4 Darwin/21.6.0',
          'Accept-Language': 'de-DE,de;q=0.9',
        },
        data: {
          xml: `<?xml version="1.0" encoding="utf-8"?><sc><si v="App-3.7.10-de-DE-iOS-iPhone-15.8.3-de.consoft.syr.connect" /><us ug="${this.session.id}" /><col><dcl dclg="${id}" fref="1" /></col><cs v="11FA9"/></sc>`,
        },
      })
        .then(async (res) => {
          this.log.debug(JSON.stringify(res.data));

          const convertedJson = convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true, alwaysArray: true });
          this.log.debug(convertedJson);
          const jsonParsed = JSON.parse(convertedJson);
          const projectId = jsonParsed.sc.dcl.dclg;
          this.json2iob.parse(projectId + '.' + id, res.data, { forceIndex: true });
        })
        .catch((error) => {
          this.log.error('Failed to get device list');
          this.log.error(error);
          error.response && this.log.error(JSON.stringify(error.response.data));
        });
    }
  }

  encryptPayload(payload) {
    const cypher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
    return cypher.update(payload, 'utf8', 'base64');
  }
  decryptPayload(payload) {
    const encryptedBuffer = Buffer.from(payload, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   * @param {() => void} callback
   */
  async onUnload(callback) {
    try {
      this.setState('info.connection', false, true);
      this.updateInterval && clearInterval(this.updateInterval);
      callback();
    } catch (e) {
      this.log.error(e);
      callback();
    }
  }

  /**
   * Is called if a subscribed state changes
   * @param {string} id
   * @param {ioBroker.State | null | undefined} state
   */
  async onStateChange(id, state) {
    if (state) {
      if (!state.ack) {
        // const deviceId = id.split('.')[2];
        const command = id.split('.')[4];
        if (id.split('.')[3] !== 'remote') {
          return;
        }

        if (command === 'Refresh') {
          this.updateDevices();
          return;
        }
        //n="setAB" v="1"
        const value = state.val === true ? '1' : '0';
        await this.requestClient({
          method: 'post',
          maxBodyLength: Infinity,
          url: 'https://syrconnectapp.de/WebServices/SyrControlWebServiceTest2.asmx/GetDeviceCollectionStatus',
          headers: {
            Host: 'syrconnectapp.de',
            'Content-Type': 'application/x-www-form-urlencoded',
            Connection: 'keep-alive',
            Accept: '*/*',
            'User-Agent': 'SYR/400 CFNetwork/1335.0.3.4 Darwin/21.6.0',
            'Accept-Language': 'de-DE,de;q=0.9',
          },
          data: {
            xml: `<?xml version="1.0" encoding="utf-8"?><sc><si v="App-3.7.10-de-DE-iOS-iPhone-15.8.3-de.consoft.syr.connect" /><us ug="${this.session.id}" /><col><dcl dclg="${id}" fref="1"><c n="${command}" v="${value}" /></dcl></col><cs v="12025"/></sc>`,
          },
        })
          .then(async (res) => {
            this.log.debug(JSON.stringify(res.data));

            const convertedJson = convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true, alwaysArray: true });
            this.log.debug(convertedJson);
            const jsonParsed = JSON.parse(convertedJson);
            const projectId = jsonParsed.sc.dcl.dclg;
            this.json2iob.parse(projectId + '.' + id, res.data, { forceIndex: true });
          })
          .catch((error) => {
            this.log.error('Failed to set command: ' + command);
            this.log.error(error);
            error.response && this.log.error(JSON.stringify(error.response.data));
          });
      }
    }
  }
}

if (require.main !== module) {
  // Export the constructor in compact mode
  /**
   * @param [options]
   */
  module.exports = (options) => new Syrconnectapp(options);
} else {
  // otherwise start the instance directly
  new Syrconnectapp();
}
