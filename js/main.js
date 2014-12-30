var currentBuilding = '113';
var historyType = 'daily';
var buildingNameMap = {};
var chartsLoaded = false;
var jsonRequestQueue = [];
var liveTimeout = -1, historyTimeout = -1;

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
			var response = JSON.parse(_this.httpRequest.responseText);
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
	if (liveTimeout != -1)
		clearTimeout(liveTimeout);
	liveTimeout = setTimeout(updateLiveData, 5000);
}
function updateHistoricalData()
{
	updateHistoryGraph(document.querySelectorAll("history-card")[0].shadowRoot, currentBuilding, 'electricity');
	updateHistoryGraph(document.querySelectorAll("history-card")[1].shadowRoot, currentBuilding, 'heating');
	updateHistoryGraph(document.querySelectorAll("history-card")[2].shadowRoot, currentBuilding, 'cooling');
	if (historyTimeout != -1)
		clearTimeout(historyTimeout);
	historyTimeout = setTimeout(updateHistoricalData, 1000*60*60);
}

/*
 * Displays a small error popup
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
	// Validate
	if (jsonResult == null)
	{
		showError("No data avalible.");
		livecard.host.style.display = "none";
		return;
	}
	if (jsonResult == {} || !jsonResult[energyType])
	{
		showError("Invalid live " + energyType + " data");
		livecard.host.style.display = "none";
		return;
	}
	else
	{
		livecard.host.style.display = "block";
	}

	var ctx = livecard.getElementById('livechart').getContext("2d");
	var graph = {};

    // User Specs
	graph.x = 200; // Center X
	graph.y = 200; // Center Y
	graph.d = 250; // Graph Diameter
	graph.val = jsonResult[energyType]['amount'] / jsonResult[energyType]['maxRange']; // Current decimal value (0.0 - 1.0)

    // Autogen
	graph.r = graph.d / 2.0;
	graph.start = 3 * Math.PI / 4.0;
	graph.end = 9 * Math.PI / 4.0;
	graph.valEnd = graph.start + graph.val * 3 * Math.PI / 2.0;

    // Gray
	ctx.beginPath();
	ctx.strokeStyle = "#FFFFFF";
	ctx.fillStyle = "#808080";
	ctx.arc(graph.x, graph.y, graph.r, graph.start, graph.end);
	ctx.arc(graph.x, graph.y, graph.r / 2.0, graph.end, graph.start, true);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	var c = document.getElementById("myCanvas2");

    // Red
	ctx.beginPath();
	ctx.strokeStyle = "#FFFFFF";
	ctx.fillStyle = "#FF0000";
	ctx.arc(graph.x, graph.y, graph.r, graph.start, graph.valEnd);
	ctx.arc(graph.x, graph.y, graph.r / 2.0, graph.valEnd, graph.start, true);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Fill
	livecard.getElementById("amount").innerHTML = jsonResult[energyType]['amount'];
	livecard.getElementById("units").innerHTML = jsonResult[energyType]['nativeUnit'];
	livecard.getElementById("building").innerHTML = buildingName;
	livecard.getElementById("title").innerHTML = "Current " + energyType.capitalize() + " Usage";
}
function drawHistoryGraph(jsonResult, historycard, energyType)
{
	// Validate
	if (jsonResult == null)
	{
		showError("No data avalible.");
		historycard.host.style.display = "none";
		return;
	}
	if (jsonResult == {} || !jsonResult['data'][energyType][historyType]['previous'] || jsonResult['data'][energyType]['live'] == null) {
		showError("Invalid historical " + energyType + " data");
		historycard.host.style.display = "none";
		return;
	}
	else {
		historycard.host.style.display = "block";
	}
	var dataTable = generateHistory;
	var ctx = historycard.getElementById("historygraph").getContext("2d");
	var data = {
		labels: dataTable[0],
		datasets: [
			{
				label: energyType.capitalize(),
				fillColor: "rgba(220,220,220,0.2)",
				strokeColor: "rgba(220,220,220,1)",
				pointColor: "rgba(220,220,220,1)",
				pointStrokeColor: "#fff",
				pointHighlightFill: "#fff",
				pointHighlightStroke: "rgba(220,220,220,1)",
				data: dataTable[1]
			}
		]
	};
	var historyGraph = new Chart(ctx).Line(data);
	historycard.getElementById("title").innerHTML = "Historical " + energyType.capitalize() + " Usage";
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
	var history = [];
	var labels = [];
	var date = new Date();
	switch (historyType) {
		case 'daily': {
			while (labels.length < 24) {
				date.setHours(date.getHours() - 1);
				labels.push(date.getHours());
				history.push(Number(jsonResult['data'][energyType][historyType]['previous'][i]['amount']));
			}
			break;
		}
		case 'weekly': {
			var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
			while (labels.length < 7) {
				date.setDate(date.getDate() - 1);
				labels.push(days[date.getDay()]);
				history.push(Number(jsonResult['data'][energyType][historyType]['previous'][i]['amount']));
			}
			break;
		}
		case 'monthly': {
			while (labels.length < 30) {
				date.setDate(date.getDate() - 1);
				labels.push(date.getDate());
				history.push(Number(jsonResult['data'][energyType][historyType]['previous'][i]['amount']));
			}
			break;
		}
		case 'yearly': {
			while (labels.length < 10) {
				date.setDate(date.getFullYear() - 1);
				labels.push(date.getFullYear());
				history.push(Number(jsonResult['data'][energyType][historyType]['previous'][i]['amount']));
			}
			break;
		}
		default: {
			showError("Invalid historyType.");
		}
	}
	return [history, labels];
}

function changeBuilding(newID) {
	while (jsonRequestQueue.length > 0)
		jsonRequestQueue.pop().httpRequest.abort();
	currentBuilding = newID;
	forceUpdate();
}

