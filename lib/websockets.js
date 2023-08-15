const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi")
const { websocketConnections, websocketDisconnect } = require('./db')
const API_GATEWAY_ENDPOINT = process.env.API_GATEWAY_ENDPOINT
const apiGatewayManagementApi = new ApiGatewayManagementApiClient({
	endpoint: `https://${API_GATEWAY_ENDPOINT}`
})

module.exports.url = (username) => {
	return `wss://${API_GATEWAY_ENDPOINT}?username=${encodeURIComponent(username)}`
}

module.exports.send = async (username, data) => {
	const connections = await websocketConnections(username)
	console.debug(`WSS ${connections.length} connections found`)
	for (const connectionId of connections) {
		try {
			const params ={
				ConnectionId: connectionId,
				Data: JSON.stringify(data)
			}
			const command = new PostToConnectionCommand(params)
			await apiGatewayManagementApi.send(command)
			console.debug(`WSS ${connectionId} ${JSON.stringify(data)}`)
		} catch (err) {
			console.warn(`WSS ERROR SENDING TO ${connectionId} '${err}'`)
			if (err.code === 'PayloadTooLargeException') {
				try {
					await apiGatewayManagementApi.postToConnection({
						ConnectionId: connectionId,
						Data: JSON.stringify({
							...data, response: {
								...data.response,
								payload: {
									headers: data.response.payload.headers,
									loggingError: 'Payload to large to show'
								}
							}
						})
					}).promise()
				} catch (e) {
					console.error(`WSS ERROR SENDING TO ${connectionId} ${e}`)
				}
			} else if (err.code === 'GoneException') {
				try {
					await websocketDisconnect(connectionId)
				} catch (e) {
					console.error(`WSS ERROR DISCONNECTING FROM ${connectionId} ${e}`)
				}
			}
		}
	}
}
