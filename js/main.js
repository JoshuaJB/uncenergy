var currentBuilding = '113';
var historyTypes = { "electricity": "daily", "heating": "daily", "cooling": "daily" };
var buildingNameMap = {};
var jsonRequestQueue = [];
var liveTimeout = -1, historyTimeout = -1;
var historyGraphs = { 'electricity': null, 'heating': null, 'cooling': null };

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
document.addEventListener("polymer-ready", init, false);

function  init() {
	// Start data load
	forceUpdate();
	// Setup dropdown callbacks
	var elecInter = document.querySelectorAll("history-card")[0].shadowRoot.querySelector('paper-dropdown-menu');
	elecInter.addEventListener('core-select', function() {
		historyTypes["electricity"] = historyString(this.selected);
		updateHistoricalData();
	});
	var elecInter = document.querySelectorAll("history-card")[1].shadowRoot.querySelector('paper-dropdown-menu');
	elecInter.addEventListener('core-select', function() {
		historyTypes["heating"] = historyString(this.selected);
		updateHistoricalData();
	});
	var elecInter = document.querySelectorAll("history-card")[2].shadowRoot.querySelector('paper-dropdown-menu');
	elecInter.addEventListener('core-select', function() {
		historyTypes["cooling"] = historyString(this.selected);
		updateHistoricalData();
	});
	// Warn about data accuracy
	setTimeout(showError("WARNING: UNC's servers are experiencing problems causing data innacuracies."), 1000);
}

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
	// Continue to update the live data every 10s
	liveTimeout = setTimeout(updateLiveData, 10*1000);
}
function updateHistoricalData()
{
	updateHistoryGraph(document.querySelectorAll("history-card")[0].shadowRoot, currentBuilding, 'electricity');
	updateHistoryGraph(document.querySelectorAll("history-card")[1].shadowRoot, currentBuilding, 'heating');
	updateHistoryGraph(document.querySelectorAll("history-card")[2].shadowRoot, currentBuilding, 'cooling');
	if (historyTimeout != -1)
		clearTimeout(historyTimeout);
	// Continue to update the historical data every 15m
	historyTimeout = setTimeout(updateHistoricalData, 1000*60*15);
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
	if (!livecard)
		return;
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
 * WARNING: The histroy data labeling is broken
 */
function drawHistoryGraph(jsonResult, historycard, energyType)
{
	if (!historycard)
		return;
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
		scaleLabel: "<%= value + '" + dataTable[2] + "' %>",
		animationSteps: 20,
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
		// Update scale labels
		historyGraphs[energyType].scale.templateString = options.scaleLabel;
		// Due to some odd issues with Chart.js, we have to add and remove superfluous data.
		historyGraphs[energyType].addData([0], ""); 
		historyGraphs[energyType].addData([0], "");
		for (var i = 0; i < data.datasets[0].data.length; i++)
			historyGraphs[energyType].addData([data.datasets[0].data[i]], data.labels[i]);
		historyGraphs[energyType].removeData();
		historyGraphs[energyType].removeData();
	}
	historycard.getElementById("title").innerHTML = "Historical " + energyType.capitalize() + " Usage";
}
function historyString(input) {
	switch (input)
	{
	case 'Today':
		return 'daily';
	case 'This Month':
		return 'monthly';
	case 'This Week':
		return 'weekly';
	case 'This Year':
		return 'yearly';
	}
}
function generateHistory(jsonResult, energyType) {
	var history = [];
	var labels = [];
	var date = new Date();
	switch (historyTypes[energyType]) {
		case 'daily': {
			date.setHours(0);
			while (labels.length < 24) {
				if (jsonResult['data'][energyType][historyTypes[energyType]]['current'].length > labels.length)
					history.push(Math.round(Number(jsonResult['data'][energyType][historyTypes[energyType]]['current'][labels.length]['amount'])));
				else
					history.push(0);
				var hour;
				if (date.getHours() == 0 || date.getHours() == 12)
					hour = "12";
				else
					hour = String(date.getHours() % 12);
				if (date.getHours() < 12)
					hour += "am";
				else
					hour += "pm";
				labels.push(hour);
				date.setHours(date.getHours() + 1);
			}
			break;
		}
		case 'weekly': {
			var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
			date.setDate(1);
			while (labels.length < 7) {
				if (jsonResult['data'][energyType][historyTypes[energyType]]['current'].length > labels.length)
					history.push(Math.round(Number(jsonResult['data'][energyType][historyTypes[energyType]]['current'][labels.length]['amount'])));
				else
					history.push(0);
				labels.push(days[date.getDay()]);
				date.setDate(date.getDate() + 1);
			}
			break;
		}
		case 'monthly': {
			date.setDate(1);
			while (true) {
				if (jsonResult['data'][energyType][historyTypes[energyType]]['current'].length > labels.length)
					history.push(Math.round(Number(jsonResult['data'][energyType][historyTypes[energyType]]['current'][labels.length]['amount'])));
				else
					history.push(0);
				labels.push(date.getDate());
				date.setDate(date.getDate() + 1);
				if (date.getDate() == 1)
					break;
			}
			break;
		}
		case 'yearly': {
			var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			date.setMonth(0);
			while (labels.length < 12) {
				if (jsonResult['data'][energyType][historyTypes[energyType]]['current'].length > labels.length)
					history.push(Math.round(Number(jsonResult['data'][energyType][historyTypes[energyType]]['current'][labels.length]['amount'])));
				else
					history.push(0);
				labels.push(months[date.getMonth()]);
				date.setMonth(date.getMonth() + 1);
			}
			break;
		}
		default: {
			showError("Invalid historyType.");
		}
	}
	// Find units and the appropriate multiplier
	var units = jsonResult['data'][energyType][historyTypes[energyType]]['previous'][0]['nativeUnit'];
	var prefix = "";
	var multiplier = 1;
	// Remove default K prefix on electricity
	if (energyType == "electricity")
		units = "Wh";
	else if (energyType == "heating")
		units = "BTU/h";
	for (var i = 0; i < history.length; i++) {
		// Apply earlier prefix change
		if (energyType == "electricity")
			history[i] *= 1e3;
		else if (energyType == "heating")
			history[i] *= 1e6;
		if (history[i] >= 1e12) {
			multiplier = 1e-12;
			prefix = 'T';
		}
		else if (history[i] >= 1e9 && multiplier > 1e-9) {
			multiplier = 1e-9;
			prefix = 'G';
		}
		else if (history[i] >= 1e6 && multiplier > 1e-6) {
			multiplier = 1e-6;
			prefix = 'M';
		}
		else if (history[i] >= 1e3 && multiplier > 1e-3) {
			multiplier = 1e-3;
			prefix = 'k';
		}
	}
	// Apply prefix
	units = prefix + units;
	// Apply multiplier
	for (var i = 0; i < history.length; i++)
		history[i] *= multiplier;
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

