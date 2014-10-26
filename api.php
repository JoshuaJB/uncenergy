<?php

$building = $_REQUEST['building'];
$response = file_get_contents('https://itsapps.unc.edu/energy/rest/buildings/' . $building);
header('Content-Type: application/json');
echo json_encode($response);
