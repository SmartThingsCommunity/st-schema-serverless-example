ST Schema Serverless Example
============================

This reference application includes an ST Schema Cloud-to-Cloud (C2C) connector, an OAuth2 server for authenticating
from the SmartThings mobile app, and a web UI for creating, deleting and controlling devices.

The app uses the [st-schema SDK](https://www.npmjs.com/package/st-schema), the [express](https://www.npmjs.com/package/express) web server, [EJS](https://ejs.co/), and the [Knockout](https://knockoutjs.com/documentation/introduction.html) UI library.
It's configured to be deployed to Amazon Web Services using the [Serverless](https://www.serverless.com/) framework.
Deploying the app will create the necessary AWS resources including a DynamoDB table for storing devices, Lambda
functions for the web server and ST Schema connector, and an API Gateway endpoint updating the Web UI using
a web socket connection.

The app allows users to create a number of virtual devices including switches,
dimmers, tunable white bulbs, color bulbs, motions sensors, and open/close 
sensors.

### Prerequisites

- NodeJS 18.x or later installed
- An [Amazon Web Services account](https://aws.amazon.com/)
- The [AWS CLI](https://aws.amazon.com/cli/) installed and configured
- The [Serverless](https://www.serverless.com/) framework installed
- A [Samsung account](https://v3.account.samsung.com/dashboard/intro)
- The [SmartThings CLI](https://github.com/SmartThingsCommunity/smartthings-cli) installed
- The SmartThings mobile app (available from the [iOS App Store](https://apps.apple.com/us/app/smartthings/id1222822904) or [Google Play Store](https://play.google.com/store/apps/details?id=com.samsung.android.oneconnect))


# File Structure

* lib -- Example third party app classes
  * Account.js -- Account domain object and password management
  * connector.js -- The ST Schema connector
  * db.js -- Reading and writing of devices and access tokens to DynamoDB
  * device-service.js -- Proactive state callbacks
  * mapping.js -- Mappings between ST Schema and the external representation of devices
  * websockets.js -- Functions for sending device updates to the web UI
* public -- Static web server files
  * images -- images for use in web pages
  * javascript
    * devices.js -- View model object for a device
    * devices.js -- Initializes the devices page and view model
    * devicesviewmodel.js -- Top level view model for the page
    * oauth.js -- Initializes the OAuth page
    * property.js -- View model object for a device property
  * stylesheets
* routes -- Web application controllers
  * devices.js -- Handles web-based device CRUD and control operations
  * index.js -- Home page and web UI login
  * oauth -- Handles login and OAuth authorization for ST mobile app
  * schema -- ST Schema endpoint
* views
  * devices
    * index.ejs -- The devices page
  * oauth
    * invalidauth.js -- Invalid authorization error page
    * login.js -- The OAuth login page rendered in the SmartThings app
  * error.ejs -- Web app error page
  * index.ejs -- Web app landing page with a link to the devices web page
  * login.ejs -- Web app login page
* handler.js -- Defines the Lambda functions
* package.json -- NPM package definition
* serverless.yml -- Serverless framework configuration
* serverless-env.js -- Customized serverless environment variables
* serverless-env-example.yml -- Example serverless environment variables

# Setup

## Configure and deploy the web application

Clone this repository and change to the root directory of the project.
```bash
git clone xxx
cd xxx
```

Copy the `serverless-env-example.yml` file to `serverless-env.yml`.
```bash
cp serverless-env-example.yml serverless-env.yml
```

Install the NPM modules.
```bash
npm install
```

Install the serverless framework if you have not already done so.
```bash
npm install -g serverless
```

Deploy the application to AWS with the verbose option set to see the output from the serverless framework.
You only need to use the verbose option the first time you deploy the application, 
so that you can see the ARN of the schema connector Lambda function.
```bash
serverless deploy
```

The serverless framework will print out the websocket endpoint and the URL of the deployed application and
the ARNs of the Lambda functions. For example:
```
endpoints:
  wss://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
  website: https://xxxxxxxxxxxxxxxxxxxxxxxx.lambda-url.us-east-1.on.aws/
functions:
  connect: st-schema-serverless-example-dev-connect (7 MB)
  disconnect: st-schema-serverless-example-dev-disconnect (7 MB)
  schema: st-schema-serverless-example-dev-schema (7 MB)
  website: st-schema-serverless-example-dev-website (7 MB)

Stack Outputs:
  SchemaLambdaFunctionQualifiedArn: arn:aws:lambda:us-east-1:000000000000:function:st-schema-serverless-example-dev-schema:5
  WebsiteLambdaFunctionUrl: https://xxxxxxxxxxxxxxxxxxxxxxxx.lambda-url.us-east-1.on.aws/
  DisconnectLambdaFunctionQualifiedArn: arn:aws:lambda:us-east-1:000000000000:function:st-schema-serverless-example-dev-disconnect:36
  ConnectLambdaFunctionQualifiedArn: arn:aws:lambda:us-east-1:000000000000:function:st-schema-serverless-example-dev-connect:36
  WebsiteLambdaFunctionQualifiedArn: arn:aws:lambda:us-east-1:000000000000:function:st-schema-serverless-example-dev-website:36
  ServiceEndpointWebsocket: wss://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
  ServerlessDeploymentBucketName: st-schema-serverless-exa-serverlessdeploymentbuck-xxxxxxxxxxxx
```

Edit your `serverless-env.yml` file and set the `API_GATEWAY_ENDPOINT` values from the wss endpoint printed out
by the serverless framework (without the `wss://`). For example:
```
API_GATEWAY_ENDPOINT:
  dev: "xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev"
```

Give SmartThings permission to invoke your `schema` Lambda function using the ARN from the serverless
framework output, minus the trailing version number. You can do this with the SmartThings CLI:
```bash
smartthings schema:authorize arn:aws:lambda:us-east-1:000000000000:function:st-schema-serverless-example-dev-schema
```

Or you can do it with the AWS CLI:
```bash
aws lambda add-permission \
--function-name arn:aws:lambda:us-east-1:000000000000:function:st-schema-serverless-example-dev-schema \
--statement-id smartthings \
--action lambda:InvokeFunction \
--principal 906037444270 
```

## Create your Connector with the SmartThings CLI

To create a connector using the SmartThings CLI, first install the CLI. If you have not yet logged into your 
Samsung account in the CLI, you will be prompted to do so when running the CLI commands below.
Copy the following information into a JSON file, for example `myapp.json`. Replace the values with your own.
```json
{
  "appName": "ST Schema Serverless Example",
  "partnerName": "ST Schema Serverless Example",
  "schemaType": "st-schema",
  "oAuthClientId": "a4a278fd-0ac1-47d9-b93a-987e3f401015",
  "oAuthClientSecret": "830c120e-a791-453c-94b7-302fea58a823",
  "oAuthAuthorizationUrl": "https://xxxxxxxxxxxxxxxxxxxxxxxx.lambda-url.us-east-1.on.aws/oauth/login",
  "oAuthTokenUrl": "https://xxxxxxxxxxxxxxxxxxxxxxxx.lambda-url.us-east-1.on.aws/oauth/token",
  "hostingType": "lambda",
  "lambdaArn": "arn:aws:lambda:us-east-1:000000000000:function:st-schema-serverless-example-dev-schema",
  "userEmail": "youremail@whatever.com"
}

```

Then create the connector using the CLI:
```bash
smartthings schema:create -i myapp.json
```

The CLI will print out the client ID and client secret values. Copy these into the `ST_CLIENT_ID` and `ST_CLIENT_SECRET` 
entries in the `serverless-env.yml` file.

## Deploy your web application again

```bash
serverless deploy
```

## Create an account in your application

Visit the website URL (`https://xxxxxxxxxxxxxxxxxxxxxxxx.lambda-url.xxxxxxxxx.on.aws/`) and click the _Get Started_ link.
Enter an email address and password and click _Create New Account_. Once you are signed in, click the
_Create your first device_ link to create a device. You can create more devices, delete devices, and log
out using the [...] menu at the top of the page. 

This web application represents a partner device application. The email and password do not need to be the same
as your Samsung account (and the password should generally not be the same, for best security practices). The
application only interacts with SmartThings after you have installed an ST Schema connector.

## Install your ST Schema Connector

Install the SmartThings mobile app from the [iOS App Store](https://apps.apple.com/us/app/smartthings/id1222822904)
or [Google Play Store](https://play.google.com/store/apps/details?id=com.samsung.android.oneconnect),
log in with the same email address and password used for your developer workspace account, and 
create a location if you have not already done so.

Next, use the CLI to create a [SmartThings Schema invitation](https://developer.smartthings.com/docs/devices/cloud-connected/st-schema-invites) 
for your new integration: 

`$ smartthings invites:schema:create`

The CLI will step you through the invitation creation process and generate an `Accept URL`. Visit the `Accept URL` 
to install your integration to a location associated with your Samsung account. After completing the invitation 
acceptance process, your integration should now be visible from the SmartThings app when logged in with your Samsung account. 

### (Optional) Invite others to install and test your Connector 

[SmartThings Schema invitations](https://developer.smartthings.com/docs/devices/cloud-connected/st-schema-invites) allow you 
to invite other users to test your Schema integration.  
When you are ready to distribute your Connector to internal testers, 
you can use invitations to test and iterate your Connector with other users without 
needing to publish to the SmartThings catalog. 
Learn more about invitations on our [developer documentation portal](https://developer.smartthings.com/docs/devices/cloud-connected/st-schema-invites).

## Control devices from SmartThings and your web application

After installing your connector, you should see your in the SmartThings mobile app. You can control them from the 
mobile app and from the web application. The status should be updated in both places.

Each device in the mobile app has a button on the dashboard page that controls the main capability of the device. You 
can control switches and trigger sensors using this button. If you tap on the device tile to the left of the button
you will see a device detail page that lets you see and control all capabilities of the device.
