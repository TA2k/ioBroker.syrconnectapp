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
const Checksum = require('./lib/checksum');
const description = require('./lib/description');
const units = require('./lib/units');

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
    this.checksum = new Checksum('L8KZG4F5DSM6ANBV3CXY7W2ER1T9H0UP', 'KHGK5X29LVNZU56T');
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
    await this.updateDevices();
    await this.getStatistics();

    this.updateInterval = setInterval(async () => {
      await this.updateDevices();
    }, this.config.interval * 60 * 1000);

    this.log.info;
    ('Statistics fetched every 6 hour');
    this.statisticInterval = this.setInterval(async () => {
      await this.getStatistics();
    }, 1000 * 60 * 60 * 6);
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
      url: 'https://syrconnect.de/WebServices/Api/SyrApiService.svc/REST/GetProjects',
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
        const encryptedXml = JSON.parse(convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true }));

        const decrypted = this.decryptPayload(encryptedXml.sc.api._text);
        this.log.debug(decrypted);
        const convertedJson = convert.xml2json('<xml>' + decrypted + '</xml>', {
          compact: true,
          spaces: 2,
          nativeTypeAttributes: true,
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

          await this.extendObject(id, {
            type: 'device',
            common: {
              name: name,
            },
            native: {},
          });

          this.json2iob.parse(id + '.general', project, { forceIndex: true, channelName: 'General Information' });
          await this.getDeviceList(id);
        }
      })
      .catch((error) => {
        this.log.error(error);
        error.response && this.log.error(JSON.stringify(error.response.data));
      });
  }
  async getDeviceList(projectId) {
    let payload = `<?xml version="1.0" encoding="utf-8"?><sc><si v="App-3.7.10-de-DE-iOS-iPhone-15.8.3-de.consoft.syr.connect" /><us ug="${this.session.id}" /><prs><pr pg="${projectId}" /></prs></sc>`;
    this.checksum.resetChecksum();
    this.checksum.addXmlToChecksum(payload);
    const checksum = this.checksum.getChecksum();
    payload = payload.replace('</sc>', `<cs v="${checksum}"/></sc>`);
    await this.requestClient({
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://syrconnect.de/WebServices/SyrControlWebServiceTest2.asmx/GetProjectDeviceCollections',
      headers: {
        Host: 'syrconnect.de',
        'Content-Type': 'application/x-www-form-urlencoded',
        Connection: 'keep-alive',
        Accept: '*/*',
        'User-Agent': 'SYR/400 CFNetwork/1335.0.3.4 Darwin/21.6.0',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      data: {
        xml: payload,
      },
    })
      .then(async (res) => {
        this.log.debug(JSON.stringify(res.data));

        const convertedJson = convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true });
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
        for (let device of deviceArray) {
          device = device.d._attributes;
          const id = device.dclg;

          this.deviceArray.push({ id: device.dclg, pg: projectId });
          const name = device.dfw;

          await this.extendObject(projectId + '.' + id, {
            type: 'device',
            common: {
              name: name,
            },
            native: {},
          });
          await this.extendObject(projectId + '.' + id + '.statistic', {
            type: 'channel',
            common: {
              name: 'Statistic of the device',
            },
            native: {},
          });
          await this.extendObject(projectId + '.' + id + '.remote', {
            type: 'channel',
            common: {
              name: 'Remote Controls',
            },
            native: {},
          });

          const remoteArray = [
            { command: 'Refresh', name: 'True = Refresh' },
            { command: 'setSIR', name: 'Regenerate now' },
            { command: 'setSDR', name: 'Regenerate later' },
            { command: 'setSMR', name: 'Multi regenerate' },
            { command: 'setRST', name: 'Reset device' },
            { command: 'setCFG', name: 'Apply configuration' },
          ];
          remoteArray.forEach((remote) => {
            this.extendObject(projectId + '.' + id + '.remote.' + remote.command, {
              type: 'state',
              common: {
                name: remote.name || '',
                type: remote.type || 'boolean',
                role: remote.role || 'boolean',
                def: remote.def == null ? false : remote.def,
                write: true,
                read: true,
              },
              native: {},
            });
          });
          this.json2iob.parse(projectId + '.' + id + '.info', device, { forceIndex: true, channelName: 'Information' });
        }
      })
      .catch((error) => {
        this.log.error('Failed to get device list');
        this.log.error(error);
        error.response && this.log.error(JSON.stringify(error.response.data));
      });
  }
  async updateDevices() {
    for (const device of this.deviceArray) {
      this.log.debug('Update device: ' + device.id);
      let payload = `<?xml version="1.0" encoding="utf-8"?><sc><si v="App-3.7.10-de-DE-iOS-iPhone-15.8.3-de.consoft.syr.connect" /><us ug="${this.session.id}" /><col><dcl dclg="${device.id}" fref="1" /></col></sc>`;
      this.checksum.resetChecksum();
      this.checksum.addXmlToChecksum(payload);
      const checksum = this.checksum.getChecksum();
      payload = payload.replace('</sc>', `<cs v="${checksum}"/></sc>`);
      await this.requestClient({
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://syrconnect.de/WebServices/SyrControlWebServiceTest2.asmx/GetDeviceCollectionStatus',
        headers: {
          Host: 'syrconnect.de',
          'Content-Type': 'application/x-www-form-urlencoded',
          Connection: 'keep-alive',
          Accept: '*/*',
          'User-Agent': 'SYR/400 CFNetwork/1335.0.3.4 Darwin/21.6.0',
          'Accept-Language': 'de-DE,de;q=0.9',
        },
        data: {
          xml: payload,
        },
      })
        .then(async (res) => {
          this.log.debug(JSON.stringify(res.data));
          try {
            const convertedJson = convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true });
            this.log.debug(convertedJson);
            const jsonParsed = JSON.parse(convertedJson);
            if (jsonParsed.sc.msg) {
              this.log.error(JSON.stringify(jsonParsed.sc.msg));
              return;
            }
            delete jsonParsed.cs;
            delete jsonParsed.sc.cs;
            this.replaceAttributesTagWithChildren(jsonParsed.sc);
            this.json2iob.parse(device.pg + '.' + device.id + '.status', jsonParsed.sc, {
              preferedArrayName: 'n',
              channelName: 'Status',
              write: true,
              descriptions: description,
              units: units,
            });
          } catch (error) {
            this.log.error('Failed to parse response');
            this.log.error(error);
            this.log.error(error.stack);
          }
        })
        .catch((error) => {
          this.log.error('Failed to get device list');
          this.log.error(error);
          error.response && this.log.error(JSON.stringify(error.response.data));
        });
    }
  }
  async getStatistics() {
    for (const device of this.deviceArray) {
      this.log.debug('Get Statistics device: ' + device.id);

      const statisticPayloadArray = [
        { name: 'Salz', payload: '<sh t="2" rtyp="1" lg="de" rg="DE" unit="kg" />' },
        { name: 'Wasser', payload: '<sh t="1" rtyp="1" lg="de" rg="DE" unit="l" />' },
      ];
      for (const statisticPayload of statisticPayloadArray) {
        let payload = `<?xml version="1.0" encoding="utf-8"?><sc><si v="App-3.7.10-de-DE-iOS-iPhone-15.8.3-de.consoft.syr.connect" /><us ug="${this.session.id}" /><col><dcl dclg="${device.id}"></dcl></col></sc>`;
        payload = payload.replace('</dcl>', statisticPayload.payload + '</dcl>');
        this.checksum.resetChecksum();
        this.checksum.addXmlToChecksum(payload);
        const checksum = this.checksum.getChecksum();
        payload = payload.replace('</sc>', `<cs v="${checksum}"/></sc>`);
        await this.requestClient({
          method: 'post',
          maxBodyLength: Infinity,
          url: 'https://syrconnect.de/WebServices/SyrControlWebServiceTest2.asmx/GetLexPlusStatistics',
          headers: {
            Host: 'syrconnect.de',
            'Content-Type': 'application/x-www-form-urlencoded',
            Connection: 'keep-alive',
            Accept: '*/*',
            'User-Agent': 'SYR/400 CFNetwork/1335.0.3.4 Darwin/21.6.0',
            'Accept-Language': 'de-DE,de;q=0.9',
          },
          data: {
            xml: payload,
          },
        })
          .then(async (res) => {
            this.log.debug(JSON.stringify(res.data));
            try {
              const convertedJson = convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true });
              this.log.debug(convertedJson);
              const jsonParsed = JSON.parse(convertedJson);
              if (!jsonParsed.sc) {
                this.log.debug('No statistics found for name: ' + statisticPayload.name);
                return;
              }
              if (jsonParsed.sc.msg) {
                this.log.error(JSON.stringify(jsonParsed.sc.msg));
                return;
              }
              delete jsonParsed.cs;
              delete jsonParsed.sc.cs;
              this.replaceAttributesTagWithChildren(jsonParsed.sc);
              this.json2iob.parse(device.pg + '.' + device.id + '.statistic.' + statisticPayload.name, jsonParsed.sc, {
                preferedArrayName: 'n',
                forceIndex: true,
                channelName: 'Statistic',
                write: true,
                descriptions: description,
                units: units,
              });
            } catch (error) {
              this.log.error('Failed to parse statistics response');
              this.log.error(error);
              this.log.error(error.stack);
            }
          })
          .catch((error) => {
            this.log.error('Failed to get statistics');
            this.log.error(error);
            error.response && this.log.error(JSON.stringify(error.response.data));
          });
      }
    }
  }
  replaceAttributesTagWithChildren(json) {
    //replace attributes tag with children
    for (const key in json) {
      if (key === '_attributes') {
        for (const attribute in json[key]) {
          json[attribute] = json[key][attribute];
        }
        delete json[key];
      } else if (typeof json[key] === 'object') {
        this.replaceAttributesTagWithChildren(json[key]);
      }
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
        const projectId = id.split('.')[2];
        const deviceId = id.split('.')[3];
        let command = id.split('.')[5];
        if (id.split('.')[4] !== 'remote') {
          const length = id.split('.').length;
          command = id.split('.')[length - 1];
        }

        if (command === 'Refresh') {
          this.updateDevices();
          return;
        }
        //n="setAB" v="1"
        let value = state.val;
        if (state.val === true || state.val === false) {
          value = state.val ? 1 : 0;
        }

        command = command.replace('get', 'set');
        let payload = `<?xml version="1.0" encoding="utf-8"?><sc><si v="App-3.7.10-de-DE-iOS-iPhone-15.8.3-de.consoft.syr.connect" /><us ug="${this.session.id}" /><col><dcl dclg="${deviceId}" fref="1"><c n="${command}" v="${value}" /></dcl></col></sc>`;
        this.checksum.resetChecksum();
        this.checksum.addXmlToChecksum(payload);
        const checksum = this.checksum.getChecksum();
        payload = payload.replace('</sc>', `<cs v="${checksum}"/></sc>`);
        this.log.debug('Send command: ' + command + ' with value: ' + value);
        this.log.debug('Payload: ' + payload);
        await this.requestClient({
          method: 'post',
          maxBodyLength: Infinity,
          url: 'https://syrconnect.de/WebServices/SyrControlWebServiceTest2.asmx/SetDeviceCollectionStatus',
          headers: {
            Host: 'syrconnect.de',
            'Content-Type': 'application/x-www-form-urlencoded',
            Connection: 'keep-alive',
            Accept: '*/*',
            'User-Agent': 'SYR/400 CFNetwork/1335.0.3.4 Darwin/21.6.0',
            'Accept-Language': 'de-DE,de;q=0.9',
          },
          data: {
            xml: payload,
          },
        })
          .then(async (res) => {
            this.log.debug(JSON.stringify(res.data));

            const convertedJson = convert.xml2json(res.data, { compact: true, spaces: 2, nativeTypeAttributes: true });
            this.log.debug(convertedJson);
            const jsonParsed = JSON.parse(convertedJson);
            if (jsonParsed.sc.msg) {
              this.log.error(JSON.stringify(jsonParsed.sc.msg));
              return;
            }
            delete jsonParsed.cs;
            delete jsonParsed.sc.cs;
            this.replaceAttributesTagWithChildren(jsonParsed.sc);
            this.json2iob.parse(projectId + '.' + deviceId + '.status', jsonParsed.sc, {
              preferedArrayName: 'n',
              channelName: 'Status',
              write: true,
              descriptions: description,
              units: units,
            });
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
