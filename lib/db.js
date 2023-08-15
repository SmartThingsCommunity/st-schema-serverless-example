const {v4: uuid} = require('uuid');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
	BatchWriteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	DeleteCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const dynamoClient = new DynamoDBClient()
const docClient = DynamoDBDocumentClient.from(dynamoClient)

const Account = require('./account');
const randtoken = require('rand-token');

const dynamoTableName = process.env.DYNAMODB_TABLE_NAME ? process.env.DYNAMODB_TABLE_NAME : 'sts_oauth_example';

/**
 * Methods for reading and writing of devices and access tokens to DynamoDB
 */
const db = {

	addAccount(account) {
		const params = {
			TableName: dynamoTableName,
			Item: {
				pk: account.username,
				sk: 'account',
				username: account.username,
				password: account.password,
				salt: account.salt
			}
		};

		const command = new PutCommand(params)
		return docClient.send(command)
	},

	addToken(username, expiresIn) {
		const code = randtoken.generate(16);
		const params = {
			TableName: dynamoTableName,
			Item: {
				pk: code,
				sk: 'code',
				username: username,
				access_token: randtoken.generate(24),
				refresh_token: randtoken.generate(24),
				expires_in: expiresIn, 					// expiration of the token, not this code
				expires: expirationDate(300),  // expiration of this code
				token_type: 'Bearer'
			}
		};

		const command = new PutCommand(params)
		return docClient.send(command).then(data => {
			return code
		})
	},

	refreshToken(refreshToken) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: refreshToken,
				sk: 'refresh_token'
			},
			ProjectionExpression: "username, access_token, refresh_token, expires_in, token_type, callbackAuth, callbackUrls"
		};

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			const item = data.Item;
			const newAccessToken = randtoken.generate(24);
			const newRefreshToken = randtoken.generate(24);

			const newAccessItem = {
				pk: newAccessToken,
				sk: 'token',
				username: item.username,
				access_token: newAccessToken,
				refresh_token: newRefreshToken,
				expires_in: item.expires_in,
				expires: expirationDate(item.expires_in),
				token_type: item.token_type,
				callbackAuth: item.callbackAuth,
				callbackUrls: item.callbackUrls
			};
			if (item.callbackAuth) {
				newAccessItem.callbackAuth = item.callbackAuth;
				newAccessItem.callbackUrls = item.callbackUrls;
			}

			const newRefreshItem = {
				pk: newRefreshToken,
				sk: 'refresh_token',
				username: item.username,
				access_token: newAccessToken,
				refresh_token: newRefreshToken,
				expires_in: item.expires_in,
				token_type: item.token_type,
				callbackAuth: item.callbackAuth,
				callbackUrls: item.callbackUrls
			};
			if (item.callbackAuth) {
				newRefreshItem.callbackAuth = item.callbackAuth;
				newRefreshItem.callbackUrls = item.callbackUrls;
			}

			const params = {
				RequestItems: {
					[dynamoTableName]: [
						{
							PutRequest: {
								Item: newAccessItem
							}
						},
						{
							PutRequest: {
								Item: newRefreshItem
							}
						},
						{
							DeleteRequest: {
								Key: {
									pk: item.access_token,
									sk: 'token'
								}
							}
						},
						{
							DeleteRequest: {
								Key: {
									pk: item.refresh_token,
									sk: 'refresh_token'
								}
							}
						}
					]
				}
			};

			const batchCommand = new BatchWriteCommand(params)
			return docClient.send(batchCommand).promise().then(data => {
				item.access_token = newAccessToken;
				item.refresh_token = newRefreshToken;
				return item
			})
		})
	},

	redeemCode(code) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: code,
				sk: 'code'
			},
			ProjectionExpression: "username, access_token, refresh_token, expires_in, token_type"
		};

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			const item = data.Item

			const params = {
				RequestItems: {
					[dynamoTableName]: [
						{
							PutRequest: {
								Item: {
									pk: item.access_token,
									sk: 'token',
									username: item.username,
									access_token: item.access_token,
									refresh_token: item.refresh_token,
									expires_in: item.expires_in,
									token_type: item.token_type
								}
							}
						},
						{
							PutRequest: {
								Item: {
									pk: item.refresh_token,
									sk: 'refresh_token',
									username: item.username,
									access_token: item.access_token,
									refresh_token: item.refresh_token,
									expires_in: item.expires_in,
									token_type: item.token_type
								}
							}
						},
						{
							DeleteRequest: {
								Key: {
									pk: code,
									sk: 'code'
								}
							}
						}
					]
				}
			};

			const batchCommand = new BatchWriteCommand(params)
			return docClient.send(batchCommand).then(data => {
				return item
			})
		})
	},

	getToken(accessToken) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: accessToken,
				sk: 'token'
			},
			ProjectionExpression: "username, access_token, refresh_token, expires_in, token_type, callbackAuth, callbackUrls"
		}

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			return data.Item
		})
	},

	getCallbacks(username) {
		const params = {
			TableName: dynamoTableName,
			IndexName: "username-sk-index",
			KeyConditionExpression: "username = :username and sk = :sk",
			ExpressionAttributeValues: {
				":username": username,
				":sk": "token"
			},
			ProjectionExpression: "access_token, callbackAuth, callbackUrls, callbackError, username"
		}

		console.debug(`Getting callbacks for ${username}`, JSON.stringify(params))
		const command = new QueryCommand(params)
		return docClient.send(command).then(data => {
			console.debug(`Got callbacks for ${username}`, JSON.stringify(data))
			return data.Items
		})
	},

	getCallbacksForToken(accessToken) {
		return this.getToken(accessToken).then(token => {
			return this.getCallbacks(token.username)
		})
	},

	removeToken(accessToken) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: accessToken,
				sk: 'token'
			}
		}

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			const item = data.Item

			const params = {
				RequestItems: {
					[dynamoTableName]: [
						{
							DeleteRequest: {
								Key: {
									pk: item.access_token,
									sk: 'token'
								}
							}
						},
						{
							DeleteRequest: {
								Key: {
									pk: item.refresh_token,
									sk: 'refresh_token'
								}
							}
						}
					]
				}
			}

			const batchCommand = new BatchWriteCommand(params)
			return docClient.send(batchCommand)
		})
	},

	setCallbackInfo(accessToken, auth, urls) {

		if (auth.expiresIn) {
			auth.expires = expirationDate(auth.expiresIn)
		}

		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: accessToken,
				sk: 'token'
			}
		};

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			const item = data.Item;
			const params = {
				RequestItems: {
					[dynamoTableName]: [
						{
							PutRequest: {
								Item: {
									pk: item.access_token,
									sk: 'token',
									username: item.username,
									access_token: item.access_token,
									refresh_token: item.refresh_token,
									expires_in: item.expires_in,
									token_type: item.token_type,
									callbackAuth: auth,
									callbackUrls: urls
								}
							}
						},
						{
							PutRequest: {
								Item: {
									pk: item.refresh_token,
									sk: 'refresh_token',
									username: item.username,
									access_token: item.access_token,
									refresh_token: item.refresh_token,
									expires_in: item.expires_in,
									token_type: item.token_type,
									callbackAuth: auth,
									callbackUrls: urls
								}
							}
						}
					]
				}
			};

			const batchCommand = new BatchWriteCommand(params)
			return docClient.send(batchCommand)
		});
	},

	refreshCallbackToken(accessToken, auth) {

		if (auth.expiresIn) {
			auth.expires = expirationDate(auth.expiresIn)
		}

		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: accessToken,
				sk: 'token'
			}
		};

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			const item = data.Item;
			const params = {
				RequestItems: {
					[dynamoTableName]: [
						{
							PutRequest: {
								Item: {
									pk: item.access_token,
									sk: 'token',
									username: item.username,
									access_token: item.access_token,
									refresh_token: item.refresh_token,
									expires_in: item.expires_in,
									token_type: item.token_type,
									callbackAuth: auth,
									callbackUrls: item.callbackUrls
								}
							}
						},
						{
							PutRequest: {
								Item: {
									pk: item.refresh_token,
									sk: 'refresh_token',
									username: item.username,
									access_token: item.access_token,
									refresh_token: item.refresh_token,
									expires_in: item.expires_in,
									token_type: item.token_type,
									callbackAuth: auth,
									callbackUrls: item.callbackUrls
								}
							}
						}
					]
				}
			};

			const batchCommand = new BatchWriteCommand(params)
			return docClient.send(batchCommand)
		});
	},

	getAccount(username) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: username,
				sk: 'account'
			}
		};

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			return data.Item ? new Account().fromDb(data.Item) : null
		})
	},

	getAccountForToken(accessToken) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: accessToken,
				sk: 'token'
			}
		};

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			return data.Item ? this.getAccount(data.Item.username) : null
		})
	},

	getAccountForCode(code) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: code,
				sk: 'code'
			}
		};

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			return this.getAccount(data.Item.username)
		})
	},

	addDevice(username, type, name, deviceStates) {
		const externalId = uuid();
		const handlerType = type;
		const displayName = name;
		const states = deviceStates;
		const params = {
			TableName: dynamoTableName,
			Item: {
				pk: username,
				sk: `device-${externalId}`,
				externalId: externalId,
				handlerType: handlerType,
				displayName: displayName,
				states: states
			}
		};

		const command = new PutCommand(params)
		return docClient.send(command).then(data => {
			return {
				externalId,
				handlerType,
				displayName,
				states
			}
		})
	},

	getDevice(username, externalId) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: username,
				sk: `device-${externalId}`
			},
			ProjectionExpression: "externalId, handlerType, displayName, states"
		};

		const command = new GetCommand(params)
		return docClient.send(command).then(data => {
			return data.Item
		})
	},

	deleteDevice(username, externalId) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: username,
				sk: `device-${externalId}`
			}
		};

		const command = new DeleteCommand(params)
		return docClient.send(command).then(data => {
			return data.Item
		})
	},

	getDeviceForToken(accessToken, externalId) {
		return this.getAccountForToken(accessToken).then(account => {
			return this.getDevice(account.username, externalId)
		})
	},

	getDevices(username) {
		const params = {
			TableName: dynamoTableName,
			KeyConditionExpression: "pk = :pk and begins_with(sk, :sk)",
			ExpressionAttributeValues: {
				":pk": username,
				":sk": "device-"
			},
			ProjectionExpression: "externalId, handlerType, displayName, states"
		};

		const command = new QueryCommand(params)
		return docClient.send(command).then(data => {
			return data.Items
		})
	},

	getDevicesForToken(accessToken) {
		return this.getAccountForToken(accessToken).then(account => {
			return account ? this.getDevices(account.username) : []
		})
	},

	updateDeviceName(username, externalId, displayName) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: username,
				sk: `device-${externalId}`
			},
			UpdateExpression: 'SET displayName = :displayName',
			ExpressionAttributeValues: {
				":displayName": displayName
			}
		};

		const command = new UpdateCommand(params)
		return docClient.send(command)
	},

	updateHandlerType(username, externalId, handlerType) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: username,
				sk: `device-${externalId}`
			},
			UpdateExpression: 'SET handlerType = :handlerType',
			ExpressionAttributeValues: {
				":handlerType": handlerType
			}
		};

		const command = new UpdateCommand(params)
		return docClient.send(command)
	},

	updateDeviceState(username, externalId, states) {
		const attributeNames = {};
		const attributeValues = {};
		const attributeExpressions = [];
		for (const key of Object.keys(states)) {
			attributeNames[`#${key}`] = key;
			attributeValues[`:${key}`] = states[key];
			attributeExpressions.push(`states.#${key} = :${key}`)
		}

		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: username,
				sk: `device-${externalId}`
			},
			UpdateExpression: 'SET ' + attributeExpressions.join(', '),
			ExpressionAttributeNames: attributeNames,
			ExpressionAttributeValues: attributeValues
		};

		console.debug(`Update device state: ${JSON.stringify(params)}`)
		const command = new UpdateCommand(params)
		return docClient.send(command)
	},

	updateDeviceStateForToken(accessToken, externalId, states) {
		return this.getAccountForToken(accessToken).then(account => {
			return this.updateDeviceState(account.username, externalId, states)
		})
	},

	removeDeviceStates(username, externalId, stateKeys) {
		const attributeNames = {};
		const attributeValues = {};
		const attributeExpressions = [];
		for (const key of stateKeys) {
			attributeNames[`#${key}`] = key;
			attributeExpressions.push(`states.#${key}`)
		}

		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: username,
				sk: `device-${externalId}`
			},
			UpdateExpression: 'REMOVE ' + attributeExpressions.join(', '),
			ExpressionAttributeNames: attributeNames
		};

		const command = new UpdateCommand(params)
		return docClient.send(command)
	},

	websocketConnect(connectionId, username) {
		const params = {
			TableName: dynamoTableName,
			Item: {
				pk: `ws:${connectionId}`,
				sk: 'websocket',
				username: username,
				connectionId: connectionId
			}
		}

		const command = new PutCommand(params)
		return docClient.send(command)
	},

	websocketConnections(username) {
		const params = {
			TableName: dynamoTableName,
			IndexName: 'username-sk-index',
			KeyConditionExpression: 'username = :username and sk = :sk',
			ExpressionAttributeValues: {
				':username': username,
				':sk': 'websocket'
			}
		}

		const command = new QueryCommand(params)
		return docClient.send(command).then(data => {
			return data.Items ? data.Items.map(it => {
				return it.connectionId
			}) : []
		}).catch(reason => {
			console.error(`Error in websocketConnections(${username})`, reason)
			return []
		})
	},

	websocketDisconnect(connectionId) {
		const params = {
			TableName: dynamoTableName,
			Key: {
				pk: `ws:${connectionId}`,
				sk: 'websocket'
			}
		}

		const command = new DeleteCommand(params)
		return docClient.send(command)
	}
};

function expirationDate(expiresIn) {
	return Math.round(new Date().getTime() / 1000) + expiresIn
}

module.exports = db;
