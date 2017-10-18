// Modules
const express   = require("express")
const app       = express()
const axios     = require("axios")

// Data
const MAX_REQS  = 60;
const cities    = require("./city.list.json")
const apiKey    = require("./owm.key.json")

// Make sure we don't overrun our requests
let reqsInLastMinute = 0
function recordRequest() {
    ++reqsInLastMinute;
    // Set timeout for one minute
    setTimeout(() => {
        console.log(reqsInLastMinute);
        --reqsInLastMinute;
    }, 60000);
}

function getRandomCity() {
    return cities[Math.floor(Math.random() * cities.length)];
}

function processResponse(data) {
    return data;
}

app.get("/api/random", (req, res) => {
    // Check we aren't exceeding our limit
    if (reqsInLastMinute < MAX_REQS) {
        recordRequest();
        // Get data!
        let city = getRandomCity();
        const url = "http://api.openweathermap.org/data/2.5/forecast?id=" + city.id + "&APPID=" + apiKey.key;
        // Get the actual data!
        axios.get(url)
                .then(response => {
                    res.json(processResponse(response.data));
                })
                .catch(err => {
                    // Bad gateway: Weather server failed
                    res.status(502).json(err);
                });
    } else {
        res.status(503)
           .json({ error: "Server busy -- too many requests" });
    }
});

app.listen(8080, () => {
    console.log("Listening on port 8080.");
});