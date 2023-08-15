const path = require('path');
const createError = require('http-errors');
const express = require('express');
const session = require("express-session");
const morgan = require('morgan');
const DynamoDBStore = require("connect-dynamodb")({ session: session });

const indexRouter = require('./routes/index');
const devicesRouter = require('./routes/devices');
const oauthRouter = require('./routes/oauth');

const dynamoSessionTableName = process.env.DYNAMODB_SESSION_TABLE_NAME ? process.env.DYNAMODB_SESSION_TABLE_NAME : 'sts_oauth_example_sessions';
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(morgan("HTTP :method :url :res[location] :status :response-time ms"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
	store: new DynamoDBStore({
		"table": dynamoSessionTableName,
		"hashKey": "sessionId"
	}),
	secret: "oauth example secret",
	resave: false,
	saveUninitialized: true,
	cookie: {secure: false}
}));

app.use('/', indexRouter);
app.use('/devices', devicesRouter);
app.use('/oauth', oauthRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

module.exports = app
