var currentBuilding = '113';
var historyType = 'daily';
var buildingNameMap = {};
var jsonRequestQueue = [];
var liveTimeout = -1, historyTimeout = -1;
var historyGraphs = {'electricity':null, 'heating':null, 'cooling':null};

new JSONHttpRequest('/buildingmap.json',
					function(result) {buildingNameMap = result;populateBuildings();},
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
window.addEventListener("load", function() {
	forceUpdate();
	setTimeout(showError("WARNING: UNC's servers are experiencing problems causing significant historical data innacuracies."), 1000);
	}, false);

function forceUpdate()
{
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
/**
 * WARNING: The history data is notoriously bad. This tries to show data from the previous year
 * and may have significant mislabeling.
 */
function drawHistoryGraph(jsonResult, historycard, energyType)
{
	// Validate
	if (jsonResult == null)
	{
		showError("No data avalible.");
		historycard.host.style.display = "none";
		return;
	}
	try {
		var dataTable = generateHistory(jsonResult, energyType);
		historycard.host.style.display = "block";
	}
	catch (e) {
		showError("Invalid historical " + energyType + " data");
		historycard.host.style.display = "none";
		return;
	}
	var ctx = historycard.getElementById("historygraph").getContext("2d");
	var data = {
		labels: dataTable[1],
		datasets: [
			{
				label: energyType.capitalize(),
				fillColor: "rgba(220,220,220,0.2)",
				strokeColor: "rgba(220,220,220,1)",
				pointColor: "rgba(220,220,220,1)",
				pointStrokeColor: "#fff",
				pointHighlightFill: "#fff",
				pointHighlightStroke: "rgba(220,220,220,1)",
				data: dataTable[0]
			}
		]
	};
	var options = {
		scaleLabel : "<%= value + '" + dataTable[2] + "' %>"
	};

	if (historyGraphs[energyType] == null)
		// Render initial chart
		historyGraphs[energyType] = new Chart(ctx).Line(data, options);
	else if (historyGraphs[energyType].datasets[0].points.length == data.datasets[0].data.length) {
		// Update existing chart
		for (var i = 0; i < data.datasets[0].data.length; i++) {
			historyGraphs[energyType].datasets[0].points[i].value = data.datasets[0].data[i];
			historyGraphs[energyType].update();
		}
	}
	else {
		// Reload existing chart with new data
		while (historyGraphs[energyType].datasets[0].points.length)
			historyGraphs[energyType].removeData();
		for (var i = 0; i < data.datasets[0].data.length; i++)
			historyGraphs[energyType].addData([data.datasets[0].data[i]], data.labels[i]);
	}
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
		return '10 Months';
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
	case '10 Months':
		return 'yearly';
	}
}
function generateHistory(jsonResult, energyType) {
	var history = [];
	var labels = [];
	var date = new Date();
	switch (historyType) {
		case 'daily': {
			date.setHours(0);
			while (labels.length < 24) {
				if (jsonResult['data'][energyType][historyType]['current'].length > labels.length)
					history.push(Math.round(Number(jsonResult['data'][energyType][historyType]['current'][labels.length]['amount'])));
				else
					history.push(0);
				labels.push(date.getHours());
				date.setHours(date.getHours() + 1);
			}
			break;
		}
		case 'weekly': {
			var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
			date.setDate(1);
			while (labels.length < 7) {
				if (jsonResult['data'][energyType][historyType]['current'].length > labels.length)
					history.push(Math.round(Number(jsonResult['data'][energyType][historyType]['current'][labels.length]['amount'])));
				else
					history.push(0);
				labels.push(days[date.getDay()]);
				date.setDate(date.getDate() + 1);
			}
			break;
		}
		case 'monthly': {
			date.setDate(0);
			while (labels.length < 30) {
				if (jsonResult['data'][energyType][historyType]['current'].length > labels.length)
					history.push(Math.round(Number(jsonResult['data'][energyType][historyType]['current'][labels.length]['amount'])));
				else
					history.push(0);
				labels.push(date.getDate());
				date.setDate(date.getDate() + 1);
			}
			break;
		}
		case 'yearly': {
			const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			while (labels.length < 10) {
				history.push(Math.round(Number(jsonResult['data'][energyType][historyType]['previous'][labels.length]['amount'])));
				date.setMonth(date.getMonth() - 1);
				labels.push(months[date.getMonth()]);
			}
			break;
		}
		default: {
			showError("Invalid historyType.");
		}
	}
	var units = jsonResult['data'][energyType][historyType]['previous'][0]['unit'];
	for (var i = 0; i < history.length; i++) {
		switch (energyType) {
			case 'electricity':
				// Default units for electricity are kWh, but there in the possiblity for larger units (eg. MWh, GWh...) So adjust back to Wh first.
				units = "Wh";
				history[i] *= 1000;
			case 'cooling':
				if (history[i] >= 1000) {
					history[i] *= 0.001;
					units = 'k' + units;
				}
				else if (history[i] >= 1000000) {
					history[i] *= 0.000001;
					units = 'M' + units;
				}
				else if (history[i] >= 1000000000) {
					history[i] *= 0.000000001;
					units = 'G' + units;
				}
				else if (history[i] >= 1000000000000) {
					history[i] *= 0.000000000001;
					units = 'T' + units;
				}
				break;
			case 'heating':
				// Not sure about these units
				break;
			default:
				showError("Unknown energy type");
		}
	}
	return [history, labels, units];
}

function changeBuilding(newID) {
	// Reset initial selection on new selection
	if (newID != "113")
		document.getElementById("113").className = "";
	while (jsonRequestQueue.length > 0)
		jsonRequestQueue.pop().httpRequest.abort();
	currentBuilding = newID;
	forceUpdate();
}

function populateBuildings() {
	var currName;
	var buildingList = document.querySelector('core-menu');
	for (var ID in buildingNameMap) {
		// We have a few hand-picked demo buildings at the top, don't include them twice.
		if (ID == "113" || ID == "104" || ID == "083" || ID == "086" || ID == "027")
			continue;
		currName = document.createElement("core-item");
		currName.label = buildingNameMap[ID];
		currName.id = ID;
		buildingList.appendChild(currName);
	}
}

