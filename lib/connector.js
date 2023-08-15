const { AccessTokenRequest } = require('st-schema');
const db = require('./db');
const mapping = require('./mapping');
const deviceService = require('./device-service');
const deviceTypes = require('./device-types');
const { SchemaConnector, DeviceErrorTypes, GlobalErrorTypes} = require('st-schema');

/**
 * ST Schema Connector
 */
const clientId = process.env.ST_CLIENT_ID
const clientSecret = process.env.ST_CLIENT_SECRET
const connector = new SchemaConnector()
	.clientId(clientId)
	.clientSecret(clientSecret)
	.enableEventLogging()

	.discoveryHandler(async (accessToken, response) => {
		for (const device of (await db.getDevicesForToken(accessToken))) {
			const d = response.addDevice(device.externalId, device.displayName, mapping.handlerType(device.handlerType));
			d.manufacturerName('STS');
			d.modelName(device.handlerType);
			if (deviceTypes[device.handlerType].deviceCategory) {
				d.addCategory(deviceTypes[device.handlerType].deviceCategory)
			}
		}
	})

	.stateRefreshHandler(async (accessToken, response, data) => {
		const externalDeviceIds = data.devices.map(it => {
			return it.externalDeviceId
		});
		for (const device of (await db.getDevicesForToken(accessToken))) {
			if (externalDeviceIds.includes(device.externalId)) {
				response.addDevice(device.externalId, mapping.stStatesFor(device.states))
			}
		}
	})

	.commandHandler(async (accessToken, response, devices) => {
		const account = await db.getAccountForToken(accessToken);
		if (account) {
			for (const it of devices) {
				const {externalDeviceId, deviceCookie, commands} = it

				const externalDevice = await db.getDevice(account.username, externalDeviceId)
				if (externalDevice) {
					const externalStates = mapping.externalStatesFor(commands);
					const stStates = mapping.stStatesFor(externalStates, externalDevice.states);
					response.addDevice(externalDeviceId, stStates, deviceCookie);
					await deviceService.updateProactiveState(account.username, externalDeviceId, externalStates, accessToken);
					await db.updateDeviceState(account.username, externalDeviceId, externalStates)
				} else {
					response.addDevice(externalDeviceId, [], deviceCookie)
						.setError('Device not found', DeviceErrorTypes.DEVICE_DELETED)
				}
			}
		} else {
			response.setError('Integration deleted', GlobalErrorTypes.INTEGRATION_DELETED)
		}
	})

	.callbackAccessHandler(async (accessToken, callbackAuthentication, callbackUrls) => {
		console.debug('CALLBACK ACCESS HANDLER CALLED', JSON.stringify({accessToken, callbackAuthentication, callbackUrls}))
		await db.setCallbackInfo(accessToken, callbackAuthentication, callbackUrls);
		console.debug('CALLBACK ACCESS GRANTED')
	})

	.integrationDeletedHandler(async accessToken => {
		await db.removeToken(accessToken)
	});

module.exports = connector;
