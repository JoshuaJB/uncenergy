<?php

// Empty fallthrough response
$response = json_encode("{}");

switch(array_keys($_REQUEST)[0])
{
	case 'building':
		if ($_REQUEST['building'] > 0 && $_REQUEST['building'] < 1000)
		{
			if (array_key_exists('live', $_REQUEST) && $_REQUEST['live'] == true)
				// Only live data
				$response = file_get_contents('https://itsapps.unc.edu/energy/rest/buildings/' . $_REQUEST['building'] . '/live');
			else
				// Live and historical data
				$response = file_get_contents('https://itsapps.unc.edu/energy/rest/buildings/' . $_REQUEST['building']);
		}
		break;
	case 'campus':
		// Aggregate data
		$response = file_get_contents('https://itsapps.unc.edu/energy/rest/campus');
		break;
}
// Return
header('Content-Type: application/json');
echo($response);

?>
