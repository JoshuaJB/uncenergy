// Load charts
google.load('visualization', '1', {'packages':['corechart']});
google.setOnLoadCallback(forceUpdate);

var currentBuilding = '113';
var energyType = 'electricity';
var historyType = 'daily';
var buildingNameMap = {};

new JSONHttpRequest('/buildingmap.json',
					function(result) {buildingNameMap = result;},
					function() {showError("Unable to load building list. Please refresh.");}
					);

function JSONHttpRequest(URL, loadCallback, errorCallback)
{
	var _this = this;
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
	this.httpRequest.addEventListener("load", this.onRequestComplete, false);
	this.httpRequest.addEventListener("error", function(){this.errorCallback("Unable to access the server.");}, false);
	this.httpRequest.open('GET', URL);
	this.httpRequest.send();
}

// Everything has to load before we use polymer
document.addEventListener("load", forceUpdate, false);

function forceUpdate()
{
	updateLiveData();
	updateHistoricalData();
}
function updateLiveData()
{
	updateLiveChart(document.querySelector("meter-card").shadowRoot, currentBuilding);
	setTimeout(updateLiveData, 5000);
}
function updateHistoricalData()
{
	updateHistoryGraph(document.querySelector("history-card").shadowRoot, currentBuilding);
	setTimeout(updateHistoricalData, 1000*60*60);
}

/*
 * Displays a 
 */
function showError(message)
{
	try
	{
		var elem = document.querySelector('#ajaxError');
		elem.innerHTML = message;
		elem.show();
	}
	catch (error){;}
}
String.prototype.capitalize = function() {
	return this.charAt(0).toUpperCase() + this.slice(1);
}
function updateLiveChart(livecard, buildingID)
{
	var name = buildingNameMap[buildingID];
	// Request data
	new JSONHttpRequest(
		'api.php?building=' + buildingID + '&live=true',
		function (result) {drawLiveChart(result, livecard, name);},
		showError
	);
}
function updateHistoryGraph(livecard, buildingID)
{
	// Request data
	new JSONHttpRequest(
		'api.php?building=' + buildingID,
		function (result) {drawHistoryGraph(result, livecard);},
		showError
	);
}
function drawLiveChart(jsonResult, livecard, buildingName)
{
	// Helper Functions
	function buildingPowerPercent()
	{
		return 100 * jsonResult[energyType]['amount'] / jsonResult[energyType]['maxRange'];
	}

	// Validate
	if (jsonResult == {} || !jsonResult[energyType])
	{
		loadError();
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
function drawHistoryGraph(jsonResult, historycard)
{
	if (jsonResult == {} || !jsonResult['data'][energyType][historyType])
		return;

	var data = google.visualization.arrayToDataTable(generateHistory(jsonResult));
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
function generateHistory(jsonResult) {
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

