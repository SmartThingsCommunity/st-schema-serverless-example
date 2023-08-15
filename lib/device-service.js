const db = require('./db');
const mapping = require('./mapping');
const websockets = require('./websockets');
const { DeviceErrorTypes, DiscoveryRequest, StateUpdateRequest } = require("st-schema");
const clientId = process.env.ST_CLIENT_ID;
const clientSecret = process.env.ST_CLIENT_SECRET;

module.exports = {

	/**
	 * Queries for installations of connectors for the specified username and sends state updates to each of them
	 *
	 * @param username Username of account to send updates to
	 * @param externalDeviceId Third-party ID of the device being updated
	 * @param externalStates States being updated
	 * @param skipThisToken Options access token to skip. Specifed when udates are from a command in that account, to
	 * avoid race conditions updating the same account
	 */
	async updateProactiveState(username, externalDeviceId, externalStates, skipThisToken) {

		// Construct update message
		const externalDevice = await db.getDevice(username, externalDeviceId)
		const deviceState = [
			{
				externalDeviceId: externalDeviceId,
				states: mapping.stStatesFor(externalStates, externalDevice.states)
			}
		];

		// Update web page
		await websockets.send(username, deviceState)

		// Update connector instances
		const stateUpdateRequest = new StateUpdateRequest(
			process.env.ST_CLIENT_ID,
			process.env.ST_CLIENT_SECRET
		);

		const callbacks = await db.getCallbacks(username);
		console.debug(`${callbacks.length} CALLBACKS FOUND`);
		for (const it of callbacks) {
			if (it.access_token !== skipThisToken && it.callbackAuth && it.callbackUrls) {
				try {
					await stateUpdateRequest.updateState(it.callbackUrls, it.callbackAuth, deviceState, refreshedAuth => {
						db.refreshCallbackToken(it.access_token, refreshedAuth);
					});
				} catch (error) {
					console.log(`Error updating state: "${error}" ${it.callbackUrls.stateCallback} ${it.access_token} ${it.username}`)
				}
			}
		}
	},

	/**
	 * Calls connectors when a new device has been added
	 * @param username
	 * @param device
	 * @returns {Promise<void>}
	 */
	async addDevice(username, device) {
		const callbacks = await db.getCallbacks(username);
		console.log(`addDevice ${callbacks.length} CALLBACKS FOUND`);
		for (const it of callbacks) {
			if (it.callbackAuth && it.callbackUrls) {
				try {
					const discoveryRequest = new DiscoveryRequest(clientId, clientSecret);
					discoveryRequest.addDevice(device)

					await discoveryRequest.sendDiscovery(it.callbackUrls, it.callbackAuth, refreshedAuth => {
						db.refreshCallbackToken(it.access_token, refreshedAuth);
					});
					console.log(`Device added successfully ${it.callbackUrls.stateCallback}`)
				} catch (err) {
					console.log(`Error adding device: "${err}" ${it.callbackUrls.stateCallback} ${it.access_token}`)
				}
			}
		}
	},

	async deleteDevice(username, externalDeviceId) {
		const callbacks = await db.getCallbacks(username);
		console.log(`deleteDevice ${callbacks.length} CALLBACKS FOUND`);
		const deviceState = [
			{
				externalDeviceId: externalDeviceId,
				deviceError: [
					{
						errorEnum: DeviceErrorTypes.DEVICE_DELETED,
						detail: 'Device deleted'
					}
				]
			}
		]
		for (const it of callbacks) {
			if (it.callbackAuth && it.callbackUrls) {
				try {
					const stateUpdateRequest = new StateUpdateRequest(
						clientId,
						clientSecret,
						username
					)
					await stateUpdateRequest.updateState(it.callbackUrls, it.callbackAuth, deviceState, refreshedAuth => {
						db.refreshCallbackToken(it.access_token, refreshedAuth)
					})
					console.log(`Device deleted successfully ${it.callbackUrls.stateCallback}`)
				} catch (err) {
					console.log(`Error deleting device: "${err}" ${it.callbackUrls.stateCallback} ${it.access_token}`)
				}
			}
		}
	}
};
