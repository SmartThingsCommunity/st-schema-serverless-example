const serverlessExpress = require('@vendia/serverless-express')
const app = require('./app')
const connector = require('./lib/connector')
const { websocketConnect, websocketDisconnect } = require('./lib/db')

module.exports.website = serverlessExpress({ app })

module.exports.schema = async (event, context) => {
	try {
		return await connector.handleLambdaCallback(event, context)
	} catch (error) {
		console.error('Error:', error);
		return {
			statusCode: 500,
			body: 'Internal Server Error'
		};
	}
}

module.exports.connect = async (event, context) => {
	const connectionId = event.requestContext.connectionId;
	const username = event.queryStringParameters.username

	try {
		await websocketConnect(connectionId, username)
		return {
			statusCode: 200,
			body: 'Connected.'
		};
	} catch (error) {
		console.error('Error:', error);

		return {
			statusCode: 500,
			body: 'Internal Server Error'
		};
	}
};

module.exports.disconnect = async (event, context) => {
	const connectionId = event.requestContext.connectionId;

	try {
		await websocketDisconnect(connectionId)

		return {
			statusCode: 200,
			body: 'Disconnected.'
		};
	} catch (error) {
		console.error('Error:', error);

		return {
			statusCode: 500,
			body: 'Internal Server Error'
		};
	}
};
