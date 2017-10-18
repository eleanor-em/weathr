// Modules
const express   = require("express");
const app       = express();
const axios     = require("axios");
const dtFormat  = require("dateformat");
const cnames    = require("countrynames");

// Data
const MAX_REQS  = 60;
const cities    = require("./city.list.json");
const apiKey    = require("./owm.key.json");
const RESPONSE  = require("./response.json");

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

function processResponse(response) {
    // Only look at today's weather
    let date = dtFormat(new Date(), "yyyy-mm-dd");
    let data = response.list.filter(w => w.dt_txt.includes(date));

    // Get min and max temp; convert from Kelvin to Celsius
    let temps = data.map(m => Math.round(m.main.temp - 273));
    let minTemp = Math.min(...temps);
    let maxTemp = Math.max(...temps);

    // Get average humidity
    let humidity = Math.round(data.reduce((acc, val) => acc + val.main.humidity / data.length, 0));
    // Get total rainfall
    // val.rain can be undefined if no rain is recorded
    let rainfall = data.reduce((acc, val) => {
        if (val.rain === undefined
            || val.rain["3h"] == undefined
            || val.rain["3h"] == null) {
            return acc;
        }
        return acc + val.rain["3h"];
    }, 0);

    // Get the number of occurrences of each type
    let counts = {}
    for (m in data) {
        let type = data[m].weather[0].main;
        if (counts[type] == undefined) {
            counts[type] = 0;
        }
        ++counts[type];
    }
    // Find the most common
    let count = Math.max(...Object.values(counts));
    let type, desc;
    for (k in counts) {
        if (counts[k] == count) {
            type = k;
            let ind = data.map(m => m.weather[0].main).indexOf(k);
            desc = data.map(m => m.weather[0].description)[ind];
        }
    }
    
    // Convert country code to title-case name
    let countryName = cnames.getName(response.city.country)
                            .split(" ")
                            .map(s => s.charAt(0) + s.slice(1).toLowerCase())
                            .join("");

    // Construct the response
    return {
        temp: {
            min: minTemp,
            max: maxTemp
        },
        type: type,
        desc: desc,
        humidity: humidity,
        rainfall: rainfall,
        city_name: response.city.name,
        country_name: countryName
    };
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
                    console.log(err);
                    // Bad gateway: Weather server failed
                    res.status(502).json({ error: err });
                });
        //res.json(processResponse(RESPONSE));
    } else {
        res.status(503)
           .json({ error: "Server busy -- too many requests" });
    }
});

app.listen(8080, () => {
    console.log("Listening on port 8080.");
});