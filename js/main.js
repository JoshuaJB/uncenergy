// Load charts
google.load('visualization', '1', {'packages':['corechart']});
google.setOnLoadCallback(function(){chartsLoaded = true;});

var currentBuilding = '113';
var historyType = 'daily';
var buildingNameMap = {};
var chartsLoaded = false;
var jsonRequestQueue = [];

new JSONHttpRequest('/buildingmap.json',
					function(result) {buildingNameMap = result;},
					function() {showError("Unable to load building list. Please refresh.");}
					);

function JSONHttpRequest(URL, loadCallback, errorCallback)
{
	var _this = this;
	this.URL = URL;
	this.loadCallback = loadCallback;
	this.errorCallback = errorCallback;
	this.onRequestComplete = function () {
		try
		{
			response = JSON.parse(_this.httpRequest.responseText);
		}
		catch(SyntaxError)
		{
			_this.errorCallback("Unable to parse server response.");
			return;
		}
		_this.loadCallback(response);
	};
	this.httpRequest = new XMLHttpRequest();
	this.httpRequest.addEventListener("load",
										function() {
											_this.onRequestComplete();
											delete jsonRequestQueue.shift();
										},
										false);
	this.httpRequest.addEventListener("error",
										function() {
											_this.errorCallback("Unable to access the server.");
											delete jsonRequestQueue.shift();
										},
										false);
	this.httpRequest.open('GET', URL);
	this.httpRequest.send();
	jsonRequestQueue.push(this);
}

// Everything has to load before we use polymer
document.addEventListener("load", forceUpdate, false);

function forceUpdate()
{
	if (!chartsLoaded) {
		setTimeout(forceUpdate, 100);
		return;
	}
	updateLiveData();
	updateHistoricalData();
}
function updateLiveData()
{
	updateLiveChart(document.querySelectorAll("meter-card")[0].shadowRoot, currentBuilding, 'electricity');
	updateLiveChart(document.querySelectorAll("meter-card")[1].shadowRoot, currentBuilding, 'heating');
	updateLiveChart(document.querySelectorAll("meter-card")[2].shadowRoot, currentBuilding, 'cooling');
	delete liveTimeout;
	liveTimeout = setTimeout(updateLiveData, 5000);
}
function updateHistoricalData()
{
	updateHistoryGraph(document.querySelectorAll("history-card")[0].shadowRoot, currentBuilding, 'electricity');
	updateHistoryGraph(document.querySelectorAll("history-card")[1].shadowRoot, currentBuilding, 'heating');
	updateHistoryGraph(document.querySelectorAll("history-card")[2].shadowRoot, currentBuilding, 'cooling');
	delete historyTimeout;
	historyTimeout = setTimeout(updateHistoricalData, 1000*60*60);
}

/*
 * Displays a 
 */
function showError(message)
{
	try
	{
		var elem = document.querySelector('#ajaxError');
		elem.text = message;
		elem.show();
	}
	catch (error){;}
}
String.prototype.capitalize = function() {
	return this.charAt(0).toUpperCase() + this.slice(1);
}
function updateLiveChart(livecard, buildingID, energyType)
{
	var name = buildingNameMap[buildingID];
	// Request data
	var request = new JSONHttpRequest(
		'api.php?building=' + buildingID + '&live=true',
		function (result) {drawLiveChart(result, livecard, name, energyType);},
		showError
	);
}
function updateHistoryGraph(livecard, buildingID, energyType)
{
	// Request data
	var request = new JSONHttpRequest(
		'api.php?building=' + buildingID,
		function (result) {drawHistoryGraph(result, livecard, energyType);},
		showError
	);
}
function drawLiveChart(jsonResult, livecard, buildingName, energyType)
{
	// Helper Functions
	function buildingPowerPercent()
	{
		return 100 * jsonResult[energyType]['amount'] / jsonResult[energyType]['maxRange'];
	}

	// Validate
	if (jsonResult == {} || !jsonResult[energyType] || !jsonResult[energyType]['live'])
	{
		showError("Invalid live " + energyType + " data");
		return;
	}

	var data = google.visualization.arrayToDataTable([
		['Amount', 'Percentage'],
		['Use',		0.75 * buildingPowerPercent()],
		['',		0.75 * (100 - buildingPowerPercent())],
		['',		25]
	]);
	var options = {
		legend: 'none',
		pieSliceText: 'none',
		pieHole: 0.5,
		pieStartAngle: -135,
		tooltip: {trigger: 'none'},
		slices: {
			0: {color: 'red'},
			1: {color: 'grey'},
			2: {color: 'transparent'},
		}
	};
	livecard.getElementById("amount").innerHTML = jsonResult[energyType]['amount'];
	livecard.getElementById("units").innerHTML = jsonResult[energyType]['nativeUnit'];
	livecard.getElementById("building").innerHTML = buildingName;
	livecard.getElementById("title").innerHTML = "Current " + energyType.capitalize() + " Usage";
	var chart = new google.visualization.PieChart(livecard.getElementById('livechart'));
	chart.draw(data, options);
}
function drawHistoryGraph(jsonResult, historycard, energyType)
{
	var history;
	if (jsonResult == {} || !jsonResult['data'][energyType][historyType]['previous'] || jsonResult['data'][energyType]['live'] == null)
	{
		showError("Invalid historical " + energyType + " data");
		history = {["",""], [0, 0]};
		historycard.display = "none";
	}
	else
	{
		history = generateHistory(jsonResult, energyType);
		historycard.display = "block";
	}

	var data = google.visualization.arrayToDataTable(history);
	var options = {
		vAxis: {title: jsonResult['data'][energyType]['live']['nativeUnit'], minValue: 0},
		legend: 'none'
	};
	historycard.getElementById("title").innerHTML = "Historical " + energyType.capitalize() + " Usage";
	var chart = new google.visualization.AreaChart(historycard.getElementById("historygraph"));
	chart.draw(data, options);
}
function historyTypeString() {
	switch (historyType)
	{
	case 'daily':
		return '24 Hours';
	case 'monthly':
		return '30 Days';
	case 'weekly':
		return '7 Days';
	case 'yearly':
		return '10 Years';
	}
}
function historyString(input) {
	switch (input)
	{
	case '24 Hours':
		return 'daily';
	case '30 Days':
		return 'monthly';
	case '7 Days':
		return 'weekly';
	case '10 Years':
		return 'yearly';
	}
}
function generateHistory(jsonResult, energyType) {
	var iterations = 0;
	var history = [];

	if (historyType == 'daily')
		iterations = 24;
	else if (historyType == 'weekly')
		iterations = 7;
	else if (historyType == 'monthly')
		iterations = 30;
	else if (historyType == 'yearly')
		iterations = 10;
	history.push(["", jsonResult['data'][energyType]['live']['nativeUnit']]);

	for (var i = 0; i < iterations; i++)
		history.push(['', Number(jsonResult['data'][energyType][historyType]['previous'][i]['amount'])]);

	return history;
}

function changeBuilding(newID) {
	while (jsonRequestQueue.length > 0)
		delete jsonRequestQueue.pop();
	currentBuilding = newID;
	forceUpdate();
}

