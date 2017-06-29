//A library dedicated to Databse functionality

//var Lib = require("pavlism-lib");
var Logger = require("pavlism-logger");

var log = new Logger('DB.js', Logger.level.error);

		DB = {};

		/**
		 * This will take todays date and adjust it based on numDaysMod (posative or negative) and 
		 * then return a SQL formated date string
		 * 
		 * @param numDaysMod {int} The number of days from today to transform
		 * @return {string} Returns SQL formatted date string
		 */
		DB.getSQLFormatedDate = function (numDaysMod) {
			numDaysMod = JS.setDefaultParameter(numDaysMod, 0);
			var date = new Date(new Date().getTime() + 24 * 60 * 60 * 1000 * numDaysMod);
			return date;
		};
		/**
		 * This will take a SQL row and map it to a Reactive Object or normal JS object.  The mapping compare the name of columns in the SQL row
		 * to the properties of the object.  When they match the data is moved over when they don't mtch the data is added as
		 * a new property.  Numbers, Dates, and Boolean values get converted from string to Numbers, Dates, and Booleans.
		 * Null values are turned into empty strings.
		 * 
		 * @param SQLRow {Object} The SQL row
		 * @param reactiveObject {Object} The obejct to recived the SQL data
		 * @return {Object} Returns objectTo with added data
		 */
		DB.mapSQLObject = function (SQLRow, reactiveObject) {
			log.trace("mapObject");
			if (JS.isUndefined(SQLRow)) {
				return {};
			}

			for (var property in SQLRow) {
				if (SQLRow[property] === null) {
					reactiveObject[property] = "";
				} else if ($.isArray(SQLRow[property]) && SQLRow[property].length > 0) {
					log.error("error: Stored Procedure has 2 columns with the same name");
				} else {
					if (typeof SQLRow[property] === "string") {
						reactiveObject[property] = SQLRow[property].toString().trim();
					} else if (typeof SQLRow[property] === "number") {
						reactiveObject[property] = parseInt(SQLRow[property].toString().trim());
					} else if (typeof SQLRow[property] === "boolean") {
						reactiveObject[property] = SQLRow[property];
					} else if ($.type(SQLRow[property]) === "date") {   //if the data is a sql date
						reactiveObject[property] = DB.ConvertSQLDate(SQLRow[property]);
					} else {
						log.error("Data type not handled");
						reactiveObject[property] = "";
					}
				}
			}
			return reactiveObject;
		};
		/**
		 * This will take SQL results with mutliptl row (or 1) and map them to a Reactive Array or noraml array needed.
		 * 
		 * @param SQLResults {array} the SQL results
		 * @param reactiveArray {array} the array to move the results to 
		 */
		DB.mapSQLArrays = function (SQLResults, reactiveArray) {
			log.trace("mapArrays");
			if (typeof SQLResults === 'undefined') {
				reactiveArray = {};
				return true;
			}

			reactiveArray.length = 0;
			var arrayCounter = 0;

			for (arrayCounter = 0; arrayCounter < SQLResults.length; arrayCounter++) {
				var obejct = DB.mapSQLObject(SQLResults[arrayCounter], SQLResults[arrayCounter]);
				reactiveArray.push(obejct);
			}
		};
		/**
		 * This will validte a SQL object.  It checks that the SQL Object exists, and that all it's inputs objects have
		 * a name, type and value and that the types match usable options.
		 * 
		 * @param SQLObject {object} The SQL Object
		 * @param customLog {string} The logging objec to tuse if their is a problem
		 * @param objectName {string} The name of the SQL object used in the logging
		 * @return {Boolean} Returns true if a valid SQL object, false if not
		 */
		DB.validateSQLIO = function (SQLObject, customLog, objectName) {
			log.trace("validateSQLIO");

			if (JS.isUndefined(SQLObject) || Object.keys(SQLObject).length === 0) {
				return true;
			}

			if (JS.isUndefined(SQLObject.inputs)) {
				SQLObject.inputs = [];
				return true;
			}

			if (!$.isArray(SQLObject.inputs)) {
				customLog.error(objectName + ".inputs: is not an array");
				return false;
			}


			var SQLTypeKeys = Object.keys(SQLTypes).map(function (key) {
				return SQLTypes[key];
			});
			var currentInput = {};
			var inputCounter = 0;
			for (inputCounter = 0; inputCounter < SQLObject.inputs.length; inputCounter++) {
				//Format: {name: "", type: SQLTypes.Int, value: currentRecord.ID}
				currentInput = SQLObject.inputs[inputCounter];
				if (JS.isUndefined(currentInput.name)) {
					customLog.error(objectName + ".inputs: missing name property watch case: " + JSON.stringify(currentInput) + "\n must have the following format: {name: '', type: SQLTypes.Somthing, value: ''}");
					return false;
				}
				if (JS.isUndefined(currentInput.type)) {
					customLog.error(objectName + ".inputs: missing type property watch case: " + JSON.stringify(currentInput) + "\n must have the following format: {name: '', type: SQLTypes.Somthing, value: ''}");
					return false;
				}
				if (JS.isUndefined(currentInput.value)) {
					customLog.error(objectName + ".inputs: missing value property watch case: " + JSON.stringify(currentInput) + "\n must have the following format: {name: '', type: SQLTypes.Somthing, value: ''}");
					return false;
				}

				if (SQLTypeKeys.indexOf(currentInput.type) < 0) {
					customLog.error(objectName + ".inputs: type property must use SQLTypes const");
					return false;
				}
			}
			return true;
		};
		/**
		 * This will run a SQL object against the DB.  If checks if the e-mail wrapper is needed and 
		 * then call the SP methods on the server.  The callback is called with the results and error objects.
		 * 
		 * @param SQLObject {object} The SQL Object
		 * @param inputs {array} The Inputs to use for the SP call
		 * @param callback {function} The function to call when SP calling is complete
		 */
		DB.handleSQLObject = function (SQLObject, inputs, callback) {
			log.trace("handleSQLObject");
			log.trace("SQLObject:" + JSON.stringify(SQLObject));
			log.trace("inputs:" + JSON.stringify(inputs));
			log.trace("callback:" + JSON.stringify(callback));
			
			if (SQLObject.sendUserEmail) {
				Meteor.call('AddEmailToSP', SQLObject.SP, inputs, {}, SQLObject.userEmailColName, function (error, result) {
					if(result===false){
						log.error("result came back false for:" + SQLObject.SP + " check the server for errors");
						return false;
					}
					
					if (JS.verifyCallback(callback)) {
						log.debug("Callback exists calling it now");
						callback(error, result);
					}else{
						log.debug("Callback failed");
					}
				});
			} else {
				Meteor.call('callStoredProcedure', SQLObject.SP, inputs, {}, function (error, result) {
					if (JS.verifyCallback(callback)) {
						log.debug("Callback exists calling it now");
						callback(error, result);
					}else{
						log.debug("Callback failed");
					}
				});
			}
		};
		/**
		 * Converts a SQL formatted date into a HH:MM AMPM formated time
		 * 
		 * @param date {date} The SQL date
		 * @return date (date) The formated date (HH:MM AMPM).
		 */
		DB.ExtractTimeFromSQLDate = function (date) {
			log.trace("ExtractTimeFromSQLDate");
			log.debug("date:" + date.toString());
			
			var hours = date.getUTCHours();
			var min = date.getUTCMinutes();
			var AMPM = 'AM';
			if(hours > 12){
				AMPM = 'PM';
				hours = hours -12;
			}else if(hours === 12){
				AMPM = 'PM';
			}
			
			return hours + ":" + min + " " + AMPM;
		};
		/**
		 * Converts a SQL formatted date into a dd/mmm/yyyy formated date
		 * 
		 * @param date {date} The SQL date
		 * @return date (date) The formated date (dd/mmm/yyyy).
		 */
		DB.ConvertSQLDate = function (date) {
			log.trace("GetSQLDate");
			log.debug("date:" + date.toString());

			var monthNum = date.getMonth();
			var day = date.getUTCDate().toString();
			var year = date.getFullYear().toString();
			var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

			var monthStr = months[monthNum];
			var newDate = day + "/" + monthStr + "/" + year;
			return newDate;
		};
		/**
		 * This will validte a set SQL inputs used for SPs.  It checks that the SQL Object exists, and that all it's inputs objects have
		 * a name, type and value and that the types match usable options.
		 * 
		 * @param inputs {array} The SQL Inputs array
		 * @param logger {logger} The logging objec to tuse if their is a problem
		 * @return {Boolean} Returns true if all Inputs are valid, false if not
		 */
		DB.validateSQLInputs = function (inputs, logger) {
			logger.trace("validateSQLInputs");
			//each input should have this structure {name: "ID", type: SQLTypes.Int, value: 36}
			//can't use jquery becasue it's called server side, for now jquery is not on meteor server

			var isPass = true;

			if (_.isEmpty(inputs)) {
				logger.debug("inputs are empty");
				return true;
			}

			var inputCounter = 0;
			for (inputCounter = 0; inputCounter < inputs.length; inputCounter++) {
				if (JS.isUndefined(inputs[inputCounter].name)) {
					logger.error("inputs[" + inputCounter + "] Missing input.name");
					isPass = false;
				}
				if (JS.isUndefined(inputs[inputCounter].type)) {
					logger.error("inputs[" + inputCounter + "]: " + inputs[inputCounter].title + "  - Missing input.type");
					logger.error("inputs.name: " + inputs[inputCounter].name);
					isPass = false;
				}
				if (JS.isUndefined(inputs[inputCounter].value)) {
					logger.error("inputs[" + inputCounter + "]: " + inputs[inputCounter].title + "  - Missing input.value");
					logger.error("inputs.name: " + inputs[inputCounter].name);
					isPass = false;
				}
			}
			return isPass;
		};
		/**
		 * Check if number is an int but works on the server
		 * 
		 * @param number {number} The SQL date
		 * @return boolean - true if the number is an int
		 */
		DB.isInt = function (number) {
			log.trace("isInt");
			log.trace("number:" + number);
			
			log.trace("number === +number" + (number === +number).toString());
			log.trace("number === (number | 0)" + (number === (number | 0)).toString());
			
			if(number === +number && number === (number | 0)){
				log.trace("number is an INT");
				return true;
			}
			log.trace("number is not an INT");
			return false;
		};
		/**
		 * Check if number is an decimal but works on the server
		 * 
		 * @param number {number} The SQL date
		 * @return boolean - true if the number is an int
		 */
		DB.isDecimal = function (number) {
			log.trace("isDecimal");
			log.trace("number:" + number);
			return number === +number && number !== (number | 0);
			;
		};
		/**
		 * This will check if a date value is a valid date, assuming a / delemiter and 3 integers.
		 * 
		 * @param date {date} the date to check
		 * @return {boolean} Returns true if the date is valid, false if not
		 */
		DB.isDate = function (date) {
			log.trace("isDate");
			if (Object.prototype.toString.call(date) === "[object Date]") {
				return true;
			} else {
				if (Object.prototype.toString.call(date) === "[object String]") {
					var newDate = new Date(date);
					if (Object.prototype.toString.call(newDate) === "[object Date]") {
						return true;
					} else {
						return false;
					}
				} else {
					return false;
				}
			}
			return false;
		};
		/**
		 * Check if number is an decimal but with only 2 decimal places or an integer
		 * 
		 * @param number {number} The SQL date
		 * @return boolean - true if the number is an int
		 */
		DB.isMoney = function (number) {
			log.trace("isMoney");
			log.trace("number:" + number);
			log.trace(" typeofnumber:" + (typeof number).toString());
			
			if(DB.isInt(number)){
				return true;
			}
			if(DB.isDecimal(number)){
				if(DB.countDecimals <=2){
					return true;
				}
			}
			return false;
		};

		/**
		 * Check if value is a string
		 * 
		 * @param value {object} The SQL date
		 * @return boolean - true if the number is an string
		 */
		DB.isString = function (value) {
			log.trace("isString");
			log.trace("value:" + value);
			
			if(typeof value ==='string'){
				log.trace("isString = true");
				return true;
			}
			log.trace("isString = false");
			return false;
		};

		/**
		 * Counts the number of decimal places in a number
		 * 
		 * @param number {number} The SQL date
		 * @return boolean - true if the number is an int
		 */
		DB.countDecimals = function(value) {
			if (Math.floor(value) !== value)
				return value.toString().split(".")[1].length || 0;
			return 0;
		}
module.exports = DB;