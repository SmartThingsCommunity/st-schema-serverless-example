ST Schema Serverless Example
============================

This reference application includes an ST Schema C2C connector, an OAuth2 server for authenticating
from the SmartThings mobile app, and web UI for creating, deleting and controlling devices.

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
- A [SmartThings Developer account](https://smartthings.developer.samsung.com/workspace/)
- The [SmartThings CLI]() installed (optional)
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

## Register your web application with SmartThings as an ST Schema connector

We currently recommend registering you ST Schema connector using the Developer Workspace. 
You can also use the SmartThings CLI but there's currently no support for installing the connector
if you use the CLI. New tools are coming soon that will allow you to install connectors created with the CLI.

### Using the Developer Workspace

Go to [SmartThings Developer Workspace](https://smartthings.developer.samsung.com/workspace/) and create a new 
ST-Schema cloud connector. Choose the _AWS Lambda_ hosting option.

Enter the ARN of your `schema` Lambda function, the one you just authorized, in the region you 
deployed your connector. Remember to the trailing version number.

Fill in all the required fields on the next page using the corresponding values from your `serverless-env.yml` file
and the serverless framework output. For example:
```
Client ID:                a4a278fd-0ac1-47d9-b93a-987e3f401015
Client Secret:            830c120e-a791-453c-94b7-302fea58a823
Authorization URI:        https://xxxxxxxxxxxxxxxxxxxxxxxx.lambda-url.us-east-1.on.aws/oauth/login
Token URI:                https://xxxxxxxxxxxxxxxxxxxxxxxx.lambda-url.us-east-1.on.aws/oauth/token
Alert Notification Email: youremail@whatever.com
```

After clicking _Next_ you'll be asked to name your connector and upload an icon image.

After you create your connector in the Developer Workspace, copy the client ID and client secret values
it shows you into the `ST_CLIENT_ID` and `ST_CLIENT_SECRET` entries in the `serverless-env.yml` file.

### Using the SmartThings CLI

To create a connector using the SmartThings CLI, first install the CLI and log in to your SmartThings account.
copy the following information into a JSON file, for example `myapp.json`. Replace the values with your own.
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
Enter an email address and password and click _Create New Account_. Once you are signed in click the
_Create your first device_ link to create a device. You can create more devices, delete devices, and log
out using the [...] menu at the top of the page. 

This web application represents a partner device application. The email and password do not need to be the same
as your SmartThings account (and the password should generally not be the same, for best security practices). The
application only interacts with SmartThings after you have installed an ST Schema connector.

## Install your ST Schema Connector

Install the SmartThings mobile app from the [iOS App Store](https://apps.apple.com/us/app/smartthings/id1222822904)
or [Google Play Store](https://play.google.com/store/apps/details?id=com.samsung.android.oneconnect),
log in with the same email address and password used for your developer workspace account, and 
create a location (if you have not already done so)

Put the SmartThings mobile app in [developer mode](https://smartthings.developer.samsung.com/docs/guides/testing/developer-mode.html) and tap the "+" button at the top to
add a device. Select the _Partner devices_ option, and you should see a _My Testing Devices_ menu item. 
Tap on it and you should see your connector name. Tap on it to install your connector, using the same email
and password you used to create your account in the web application.

## Control devices from SmartThings and your web application

After installing your connector, you should see your in the SmartThings mobile app. You can control them from the 
mobile app and from the web application. The status should be updated in both places.

Each device in the mobile app has a button on the dashboard page that controls the main capability of the device. You 
can control switches and trigger sensors using this button. If you tap on the device tile to the left of the button
you will see a device detail page that lets you see and control all capabilities of the device.
