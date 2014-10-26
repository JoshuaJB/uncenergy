<?php

$building = $_REQUEST['building'];
$json = file_get_contents('https://itsapps.unc.edu/energy/rest/buildings/' . $building);
$response = json_decode($json);
header('Content-Type: application/json');
echo json_encode($response);
